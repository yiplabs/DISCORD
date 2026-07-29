const { stmts } = require('./database');
const { EmbedBuilder } = require('discord.js');

const YOUTUBE_RSS_URL = 'https://www.youtube.com/feeds/videos.xml?channel_id=';
const USER_AGENT = 'TommyYipXYZ-Hub-Bot/1.0';
const DEFAULT_TOMMY_CHANNEL_ID = 'UCvNg5BdvvvU3-1RL5mRi6lQ';
const DEFAULT_HUNTER_CHANNEL_ID = 'UC_oMk6B6Hv7PwoyskeWWS2g';
const FIRST_RUN_FRESHNESS_MS = 15 * 60 * 1000;
const DEFAULT_FETCH_TIMEOUT_MS = 10_000;
const activeGuildChecks = new Set();

function normalizeChannelId(value, fallback, label) {
  const candidate = value?.trim();
  if (!candidate) return fallback;
  if (/^UC[A-Za-z0-9_-]{22}$/.test(candidate)) return candidate;

  console.warn(
    `[YouTube] Ignoring invalid ${label} channel ID; using the verified default`
  );
  return fallback;
}

function decodeXmlEntities(value) {
  if (!value) return value;

  const named = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    quot: '"',
  };

  return value.replace(
    /&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi,
    (entity, decimal, hexadecimal, name) => {
      if (decimal) return String.fromCodePoint(Number(decimal));
      if (hexadecimal) return String.fromCodePoint(parseInt(hexadecimal, 16));
      return named[name.toLowerCase()] ?? entity;
    }
  );
}

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

  const primaryId = normalizeChannelId(
    process.env.YOUTUBE_CHANNEL_ID,
    DEFAULT_TOMMY_CHANNEL_ID,
    'primary'
  );
  if (primaryId) {
    channels.push({
      channelId: primaryId,
      handle: process.env.YOUTUBE_HANDLE || 'TOMMYYIPXYZ',
    });
  }

  // HUNTER YIPLABS — https://www.youtube.com/@HUNTERYIPLABS
  const secondId = normalizeChannelId(
    process.env.YOUTUBE_CHANNEL_ID_2,
    DEFAULT_HUNTER_CHANNEL_ID,
    'secondary'
  );
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

async function fetchWithTimeout(
  url,
  options = {},
  {
    fetchImpl = global.fetch,
    timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
  } = {}
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetchImpl(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`[YouTube] Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Check for new YouTube videos/streams via RSS feed (free, no API key needed)
 */
async function checkNewVideo(channelId, dependencies = {}) {
  if (!channelId) return null;

  try {
    const url = `${YOUTUBE_RSS_URL}${channelId}`;
    const res = await fetchWithTimeout(
      url,
      { headers: { 'User-Agent': USER_AGENT } },
      dependencies
    );
    if (!res.ok) return null;

    const xml = await res.text();

    // Parse ALL entries (not just first) to catch recent uploads
    const entries = [];
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match;

    while ((match = entryRegex.exec(xml)) !== null) {
      const entry = match[1];
      const videoId = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
      const title = decodeXmlEntities(
        entry.match(/<title>([^<]+)<\/title>/)?.[1]
      );
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
    const encodedChannelName =
      xml.match(/<author>\s*<name>([^<]+)<\/name>/)?.[1] || null;
    const channelName = decodeXmlEntities(encodedChannelName);

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
async function checkIfLive(channelId, dependencies = {}) {
  try {
    const res = await fetchWithTimeout(
      `https://www.youtube.com/channel/${channelId}/live`,
      {
        headers: { 'User-Agent': USER_AGENT },
        redirect: 'follow',
      },
      dependencies
    );
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
function defaultStateStore() {
  return {
    get: (guildId, channelId) =>
      stmts.getYoutubeState.get(guildId, channelId),
    upsert: (state) => stmts.upsertYoutubeState.run(state),
  };
}

function isFreshUpload(published, now) {
  const publishedAt = Date.parse(published);
  if (!Number.isFinite(publishedAt)) return false;

  const age = now - publishedAt;
  return age >= 0 && age <= FIRST_RUN_FRESHNESS_MS;
}

async function wasVideoAlreadyPosted(discordChannel, videoId) {
  if (!discordChannel.messages?.fetch || !videoId) return false;

  try {
    const recentMessages = await discordChannel.messages.fetch({ limit: 50 });
    for (const message of recentMessages.values()) {
      if (message.content?.includes(videoId)) return true;
      if (message.embeds?.some((embed) => embed.url?.includes(videoId))) {
        return true;
      }
    }
  } catch (err) {
    console.warn(
      `[YouTube] Could not inspect recent Discord messages: ${err.message}`
    );
  }

  return false;
}

function notificationMention(env = process.env) {
  const roleId = env.YOUTUBE_MENTION_ROLE_ID?.trim();
  if (/^\d{5,25}$/.test(roleId || '')) {
    return {
      suffix: ` <@&${roleId}>`,
      allowedMentions: { parse: [], roles: [roleId] },
    };
  }
  if (env.YOUTUBE_PING_EVERYONE?.trim().toLowerCase() === 'true') {
    return {
      suffix: ' @everyone',
      allowedMentions: { parse: ['everyone'] },
    };
  }
  return { suffix: '', allowedMentions: { parse: [] } };
}

function uploadMessage(latest, channelName, handle) {
  const mention = notificationMention();
  const embed = new EmbedBuilder()
    .setColor('#FF0000')
    .setTitle(`📹 ${latest.title}`)
    .setURL(latest.url)
    .setAuthor({
      name: channelName,
      url: `https://www.youtube.com/@${handle}`,
      iconURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(handle)}&background=FF0000&color=fff`,
    })
    .setDescription(
      [
        `**${channelName}** just uploaded a new video!`,
        '',
        `> **${latest.title}**`,
        '',
        `┃ [Watch now →](${latest.url})`,
      ].join('\n')
    )
    .setImage(latest.thumbnail)
    .setTimestamp(new Date(latest.published))
    .setFooter({ text: 'Dollar Vibe Club ┃ New YouTube Upload' });

  return {
    content: `🚨 **NEW VIDEO JUST DROPPED**${mention.suffix}`,
    embeds: [embed],
    allowedMentions: mention.allowedMentions,
  };
}

function liveMessage(live, handle) {
  const mention = notificationMention();
  const embed = new EmbedBuilder()
    .setColor('#FF0000')
    .setTitle(`🔴 LIVE NOW: ${live.title}`)
    .setURL(live.url)
    .setAuthor({
      name: `${handle} is LIVE`,
      url: `https://www.youtube.com/@${handle}`,
    })
    .setDescription(
      [
        `**@${handle}** is streaming right now!`,
        '',
        `> **${live.title}**`,
        '',
        `┃ [Join the stream →](${live.url})`,
      ].join('\n')
    )
    .setImage(
      `https://i.ytimg.com/vi/${live.videoId}/maxresdefault_live.jpg`
    )
    .setTimestamp()
    .setFooter({ text: 'Dollar Vibe Club ┃ Live Stream' });

  return {
    content: `🔴 **@${handle} IS LIVE**${mention.suffix}`,
    embeds: [embed],
    allowedMentions: mention.allowedMentions,
  };
}

async function checkChannel(
  _client,
  guildId,
  discordChannel,
  { channelId, handle },
  dependencies = {}
) {
  const stateStore = dependencies.stateStore || defaultStateStore();
  const fetchFeed = dependencies.fetchFeed || checkNewVideo;
  const fetchLive = dependencies.fetchLive || checkIfLive;
  const now = dependencies.now || Date.now;

  // Clone persisted state so a failed Discord send cannot mutate it in memory.
  let state = stateStore.get(guildId, channelId);
  const isFirstRun = !state;
  state = state
    ? { ...state }
    : {
        guild_id: guildId,
        yt_channel_id: channelId,
        last_video_id: null,
        last_live_id: null,
      };

  const [data, live] = await Promise.all([
    fetchFeed(channelId),
    fetchLive(channelId),
  ]);
  const notifiedThisCheck = new Set();

  // ─── Check for new video uploads ───
  if (data && data.entries.length > 0) {
    const latest = data.entries[0];
    const channelName = data.channelName || handle;

    if (state.last_video_id !== latest.videoId) {
      const alreadyPosted = await wasVideoAlreadyPosted(
        discordChannel,
        latest.videoId
      );
      const isCurrentlyLive = live?.videoId === latest.videoId;
      const shouldNotify =
        !alreadyPosted &&
        !isCurrentlyLive &&
        (!isFirstRun || isFreshUpload(latest.published, now()));

      if (shouldNotify) {
        await discordChannel.send(uploadMessage(latest, channelName, handle));
        notifiedThisCheck.add(latest.videoId);
        state.last_video_id = latest.videoId;
        stateStore.upsert(state);
        console.log(`[YouTube] Notified ${handle} — new video: ${latest.title}`);
      } else {
        state.last_video_id = latest.videoId;
        stateStore.upsert(state);
        const reason = alreadyPosted
          ? 'already present in Discord'
          : isCurrentlyLive
            ? 'handled as a live stream'
            : 'older than the first-run freshness window';
        console.log(
          `[YouTube] Seeded ${handle} — latest video: ${latest.title} (${reason})`
        );
      }
    }
  }

  // ─── Check for live streams ───
  if (live && state.last_live_id !== live.videoId) {
    const alreadyPosted =
      notifiedThisCheck.has(live.videoId) ||
      (await wasVideoAlreadyPosted(discordChannel, live.videoId));

    if (!alreadyPosted) {
      await discordChannel.send(liveMessage(live, handle));
      state.last_live_id = live.videoId;
      stateStore.upsert(state);
      console.log(`[YouTube] Notified ${handle} — LIVE: ${live.title}`);
    } else {
      state.last_live_id = live.videoId;
      stateStore.upsert(state);
      console.log(
        `[YouTube] Seeded ${handle} — live stream already present in Discord`
      );
    }
  }
}

/**
 * Main check and notify function — runs on cron.
 * Watches every channel returned by getWatchedChannels() and posts to the
 * guild's configured YouTube notification channel.
 */
async function checkAndNotify(client, guildId, dependencies = {}) {
  const configuredGuildId = process.env.DISCORD_GUILD_ID?.trim();
  if (configuredGuildId && configuredGuildId !== guildId) return;
  if (activeGuildChecks.has(guildId)) return;

  activeGuildChecks.add(guildId);
  try {
    const settings = stmts.getSettings.get(guildId);
    const notifyChannelId =
      process.env.DISCORD_NOTIFY_CHANNEL_ID?.trim() ||
      settings?.youtube_notify_channel_id;
    if (!notifyChannelId) return;

    const getChannels = dependencies.getChannels || getWatchedChannels;
    const runChannel = dependencies.runChannel || checkChannel;
    const channels = getChannels();
    if (channels.length === 0) return;

    const discordChannel = await client.channels
      .fetch(notifyChannelId)
      .catch(() => null);
    if (!discordChannel) return;
    if (discordChannel.guildId !== guildId) {
      console.error(
        '[YouTube] Refusing to use a notification channel outside the configured guild'
      );
      return;
    }

    for (const ytChannel of channels) {
      await runChannel(client, guildId, discordChannel, ytChannel);
    }
  } finally {
    activeGuildChecks.delete(guildId);
  }
}

module.exports = {
  checkNewVideo,
  checkIfLive,
  checkAndNotify,
  checkChannel,
  getWatchedChannels,
  decodeXmlEntities,
  fetchWithTimeout,
  isFreshUpload,
  wasVideoAlreadyPosted,
};
