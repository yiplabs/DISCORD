const { stmts } = require('./database');
const { COLORS, V2_FLAGS, ContainerBuilder, text, separator, gallery } = require('./components');
const { ensureLiveRole, optInButtonRow } = require('./liveNotify');

const YOUTUBE_RSS_URL = 'https://www.youtube.com/feeds/videos.xml?channel_id=';
const USER_AGENT = 'DollarVibeClub-Bot/1.0';

/**
 * Build the list of YouTube channels to watch.
 *
 * Channel 1 (primary) comes from the env vars that the bot already used:
 *   YOUTUBE_CHANNEL_ID / YOUTUBE_HANDLE
 *
 * Channel 2 is HUNTER YIPLABS. It defaults to the known channel ID/handle so
 * it works out of the box, but can still be overridden via env vars:
 *   YOUTUBE_CHANNEL_ID_2 / YOUTUBE_HANDLE_2
 *
 * Returns an array of { channelId, handle }.
 */
function getWatchedChannels() {
  const channels = [];

  if (process.env.YOUTUBE_CHANNEL_ID) {
    channels.push({
      channelId: process.env.YOUTUBE_CHANNEL_ID,
      handle: process.env.YOUTUBE_HANDLE || 'TOMMYYIPXYZ',
    });
  }

  // HUNTER YIPLABS — https://www.youtube.com/@HUNTERYIPLABS
  const secondId = process.env.YOUTUBE_CHANNEL_ID_2 || 'UC_oMk6B6Hv7PwoyskeWWS2g';
  if (secondId) {
    channels.push({
      channelId: secondId,
      handle: process.env.YOUTUBE_HANDLE_2 || 'HUNTERYIPLABS',
    });
  }

  // De-dupe in case the same channel ID is configured twice.
  const seen = new Set();
  return channels.filter((c) => {
    if (!c.channelId || seen.has(c.channelId)) return false;
    seen.add(c.channelId);
    return true;
  });
}

/**
 * Check for new YouTube videos/streams via RSS feed (free, no API key needed)
 */
async function checkNewVideo(channelId) {
  if (!channelId) return null;

  try {
    const url = `${YOUTUBE_RSS_URL}${channelId}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!res.ok) return null;

    const xml = await res.text();

    // Parse ALL entries (not just first) to catch recent uploads
    const entries = [];
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match;

    while ((match = entryRegex.exec(xml)) !== null) {
      const entry = match[1];
      const videoId = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
      const title = entry.match(/<title>([^<]+)<\/title>/)?.[1];
      const published = entry.match(/<published>([^<]+)<\/published>/)?.[1];
      const updated = entry.match(/<updated>([^<]+)<\/updated>/)?.[1];

      if (videoId) {
        entries.push({
          videoId,
          title: title || 'New Video',
          published: published || new Date().toISOString(),
          updated: updated || published || new Date().toISOString(),
          url: `https://www.youtube.com/watch?v=${videoId}`,
          thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        });
      }
    }

    // Get channel name from feed
    const channelName = xml.match(/<author>\s*<name>([^<]+)<\/name>/)?.[1] || null;

    return { entries, channelName, channelId };
  } catch (err) {
    console.error('[YouTube] RSS check failed:', err.message);
    return null;
  }
}

/**
 * Check for live stream status by fetching the live page
 * This is a free method — checks if the channel has an active live stream
 */
async function checkIfLive(channelId) {
  try {
    const res = await fetch(`https://www.youtube.com/channel/${channelId}/live`, {
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'follow',
    });
    if (!res.ok) return null;

    const html = await res.text();

    // If redirected to a video page with "isLiveBroadcast" it's live
    const isLive = html.includes('"isLiveBroadcast":true') || html.includes('"isLiveNow":true');
    if (!isLive) return null;

    // Extract video ID from live page
    const videoIdMatch = html.match(/"videoId":"([^"]+)"/);
    const titleMatch = html.match(/"title":"([^"]+)"/);

    if (!videoIdMatch) return null;

    return {
      videoId: videoIdMatch[1],
      title: titleMatch ? titleMatch[1].replace(/\\u0026/g, '&') : 'LIVE NOW',
      url: `https://www.youtube.com/watch?v=${videoIdMatch[1]}`,
      isLive: true,
    };
  } catch (err) {
    console.error('[YouTube] Live check failed:', err.message);
    return null;
  }
}

/**
 * Check a single YouTube channel for a guild and post notifications.
 * Tracks state per (guild, YouTube channel) so each channel is independent.
 */
async function checkChannel(client, guildId, discordChannel, { channelId, handle }, liveRoleId) {
  // Ping only the opt-in role, never the whole server. Attach the opt-in button so
  // anyone can start following streams straight from the post.
  const roleMention = liveRoleId ? `<@&${liveRoleId}> ` : '';
  const allowedMentions = liveRoleId ? { roles: [liveRoleId] } : { parse: [] };

  // Load per-channel state (or seed a fresh row).
  let state = stmts.getYoutubeState.get(guildId, channelId);
  const isFirstRun = !state;
  if (!state) {
    state = { guild_id: guildId, yt_channel_id: channelId, last_video_id: null, last_live_id: null };
  }

  // ─── Check for new video uploads ───
  const data = await checkNewVideo(channelId);
  if (data && data.entries.length > 0) {
    const latest = data.entries[0];
    const channelName = data.channelName || handle;

    if (state.last_video_id !== latest.videoId) {
      // On the very first run for this channel, seed the latest video without
      // notifying so we don't ping for content posted before setup.
      if (isFirstRun) {
        state.last_video_id = latest.videoId;
        stmts.upsertYoutubeState.run(state);
        console.log(`[YouTube] Seeded ${handle} — latest video: ${latest.title} (no notification)`);
      } else {
        state.last_video_id = latest.videoId;
        stmts.upsertYoutubeState.run(state);

        const publishedUnix = Math.floor(new Date(latest.published).getTime() / 1000);

        const container = new ContainerBuilder()
          .setAccentColor(COLORS.youtube)
          .addTextDisplayComponents(text(`${roleMention}🚨 **NEW VIDEO JUST DROPPED**`))
          .addSeparatorComponents(separator())
          .addTextDisplayComponents(
            text(
              [
                `## 📹 [${latest.title}](${latest.url})`,
                '',
                `**${channelName}** just uploaded a new video!`,
                '',
                `[Watch now →](${latest.url})`,
              ].join('\n')
            )
          )
          .addMediaGalleryComponents(gallery(latest.thumbnail))
          .addSeparatorComponents(separator())
          .addTextDisplayComponents(text(`-# YouTube ┃ New Upload • <t:${publishedUnix}:R>`))
          .addActionRowComponents(optInButtonRow());

        await discordChannel.send({
          components: [container],
          flags: V2_FLAGS,
          allowedMentions,
        });

        console.log(`[YouTube] Notified ${handle} — new video: ${latest.title}`);
      }
    }
  }

  // ─── Check for live streams ───
  const live = await checkIfLive(channelId);
  if (live) {
    if (state.last_live_id !== live.videoId) {
      state.last_live_id = live.videoId;
      stmts.upsertYoutubeState.run(state);

      if (!isFirstRun) {
        const container = new ContainerBuilder()
          .setAccentColor(COLORS.youtube)
          .addTextDisplayComponents(text(`${roleMention}🔴 **@${handle} IS LIVE**`))
          .addSeparatorComponents(separator())
          .addTextDisplayComponents(
            text(
              [
                `## 🔴 LIVE NOW: [${live.title}](${live.url})`,
                '',
                `**@${handle}** is streaming right now!`,
                '',
                `[Join the stream →](${live.url})`,
              ].join('\n')
            )
          )
          .addMediaGalleryComponents(
            gallery(`https://i.ytimg.com/vi/${live.videoId}/maxresdefault_live.jpg`)
          )
          .addSeparatorComponents(separator())
          .addTextDisplayComponents(text('-# YouTube ┃ Live Stream'))
          .addActionRowComponents(optInButtonRow());

        await discordChannel.send({
          components: [container],
          flags: V2_FLAGS,
          allowedMentions,
        });

        console.log(`[YouTube] Notified ${handle} — LIVE: ${live.title}`);
      }
    }
  }
}

/**
 * Main check and notify function — runs on cron.
 * Watches every channel returned by getWatchedChannels() and posts to the
 * guild's configured YouTube notification channel.
 */
async function checkAndNotify(client, guildId) {
  const settings = stmts.getSettings.get(guildId);
  if (!settings?.youtube_notify_channel_id) return;

  const channels = getWatchedChannels();
  if (channels.length === 0) return;

  const discordChannel = await client.channels
    .fetch(settings.youtube_notify_channel_id)
    .catch(() => null);
  if (!discordChannel) return;

  // Make sure the opt-in role exists so the ping and the button both work.
  const guild = discordChannel.guild || client.guilds.cache.get(guildId);
  const liveRole = guild ? await ensureLiveRole(guild) : null;
  const liveRoleId = liveRole?.id || null;

  for (const ytChannel of channels) {
    await checkChannel(client, guildId, discordChannel, ytChannel, liveRoleId);
  }
}

module.exports = { checkNewVideo, checkIfLive, checkAndNotify, getWatchedChannels };
