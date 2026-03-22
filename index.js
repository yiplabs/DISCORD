const { stmts } = require('./database');
const { EmbedBuilder } = require('discord.js');

const YOUTUBE_RSS_URL = 'https://www.youtube.com/feeds/videos.xml?channel_id=';
const YOUTUBE_HANDLE = 'TOMMYYIPXYZ';

/**
 * Check for new YouTube videos/streams via RSS feed (free, no API key needed)
 * Also checks if the channel is currently live
 */
async function checkNewVideo(channelId) {
  if (!channelId) return null;

  try {
    const url = `${YOUTUBE_RSS_URL}${channelId}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'TommyYipXYZ-Hub-Bot/1.0' },
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
    const channelName = xml.match(/<author>\s*<name>([^<]+)<\/name>/)?.[1] || YOUTUBE_HANDLE;

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
      headers: { 'User-Agent': 'TommyYipXYZ-Hub-Bot/1.0' },
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
 * Main check and notify function — runs on cron
 */
async function checkAndNotify(client, guildId) {
  const settings = stmts.getSettings.get(guildId);
  if (!settings?.youtube_notify_channel_id) return;

  const channelId = process.env.YOUTUBE_CHANNEL_ID;
  if (!channelId) return;

  const channel = await client.channels.fetch(settings.youtube_notify_channel_id).catch(() => null);
  if (!channel) return;

  // ─── Check for new video uploads ───
  const data = await checkNewVideo(channelId);
  if (data && data.entries.length > 0) {
    const latest = data.entries[0];

    // Only notify if this is a new video we haven't seen
    if (settings.last_youtube_video_id !== latest.videoId) {
      stmts.upsertSettings.run({
        ...settings,
        last_youtube_video_id: latest.videoId,
      });

      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle(`📹 ${latest.title}`)
        .setURL(latest.url)
        .setAuthor({
          name: data.channelName,
          url: `https://www.youtube.com/@${YOUTUBE_HANDLE}`,
          iconURL: `https://ui-avatars.com/api/?name=${YOUTUBE_HANDLE}&background=FF0000&color=fff`,
        })
        .setDescription(
          [
            `**${data.channelName}** just uploaded a new video!`,
            '',
            `> **${latest.title}**`,
            '',
            `┃ [Watch now →](${latest.url})`,
          ].join('\n')
        )
        .setImage(latest.thumbnail)
        .setTimestamp(new Date(latest.published))
        .setFooter({ text: 'YouTube ┃ New Upload' });

      await channel.send({
        content: '🚨 **NEW VIDEO JUST DROPPED** @everyone',
        embeds: [embed],
      });

      console.log(`[YouTube] Notified — new video: ${latest.title}`);
    }
  }

  // ─── Check for live streams ───
  const live = await checkIfLive(channelId);
  if (live) {
    // Use a separate key to track if we already notified about this live stream
    const liveKey = `live_${live.videoId}`;
    const alreadyNotified = settings.last_youtube_video_id === liveKey;

    if (!alreadyNotified) {
      // Don't overwrite the video ID tracking — use a temp marker
      // We'll re-check and it will naturally clear when the stream ends

      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle(`🔴 LIVE NOW: ${live.title}`)
        .setURL(live.url)
        .setAuthor({
          name: `${YOUTUBE_HANDLE} is LIVE`,
          url: `https://www.youtube.com/@${YOUTUBE_HANDLE}`,
        })
        .setDescription(
          [
            `**@${YOUTUBE_HANDLE}** is streaming right now!`,
            '',
            `> **${live.title}**`,
            '',
            `┃ [Join the stream →](${live.url})`,
          ].join('\n')
        )
        .setImage(`https://i.ytimg.com/vi/${live.videoId}/maxresdefault_live.jpg`)
        .setTimestamp()
        .setFooter({ text: 'YouTube ┃ Live Stream' });

      await channel.send({
        content: '🔴 **@TOMMYYIPXYZ IS LIVE** @everyone',
        embeds: [embed],
      });

      // Mark as notified
      stmts.upsertSettings.run({
        ...settings,
        last_youtube_video_id: liveKey,
      });

      console.log(`[YouTube] Notified — LIVE: ${live.title}`);
    }
  }
}

module.exports = { checkNewVideo, checkIfLive, checkAndNotify };
