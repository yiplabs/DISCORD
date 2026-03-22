const { stmts } = require('./database');

const YOUTUBE_RSS_URL = 'https://www.youtube.com/feeds/videos.xml?channel_id=';

/**
 * Check for new YouTube videos via RSS feed (free, no API key needed)
 * Returns the latest video if it's new, or null
 */
async function checkNewVideo(channelId) {
  if (!channelId) return null;

  try {
    const url = `${YOUTUBE_RSS_URL}${channelId}`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const xml = await res.text();

    // Parse the latest video from RSS
    const videoIdMatch = xml.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
    const titleMatch = xml.match(/<media:title>([^<]+)<\/media:title>/);
    const publishedMatch = xml.match(/<published>([^<]+)<\/published>/);
    const authorMatch = xml.match(/<author>\s*<name>([^<]+)<\/name>/);

    if (!videoIdMatch) return null;

    return {
      videoId: videoIdMatch[1],
      title: titleMatch ? titleMatch[1] : 'New Video',
      published: publishedMatch ? publishedMatch[1] : new Date().toISOString(),
      author: authorMatch ? authorMatch[1] : 'TommyYipXYZ',
      url: `https://www.youtube.com/watch?v=${videoIdMatch[1]}`,
    };
  } catch (err) {
    console.error('[YouTube] RSS check failed:', err.message);
    return null;
  }
}

/**
 * Check and notify if there's a new video
 */
async function checkAndNotify(client, guildId) {
  const settings = stmts.getSettings.get(guildId);
  if (!settings?.youtube_notify_channel_id) return;

  const channelId = process.env.YOUTUBE_CHANNEL_ID;
  if (!channelId) return;

  const video = await checkNewVideo(channelId);
  if (!video) return;

  // Check if we already notified about this video
  if (settings.last_youtube_video_id === video.videoId) return;

  // Update last video ID
  stmts.upsertSettings.run({
    ...settings,
    last_youtube_video_id: video.videoId,
  });

  // Send notification
  const channel = await client.channels.fetch(settings.youtube_notify_channel_id).catch(() => null);
  if (!channel) return;

  const { EmbedBuilder } = require('discord.js');

  const embed = new EmbedBuilder()
    .setColor('#FF0000')
    .setTitle(`🔴 ${video.title}`)
    .setURL(video.url)
    .setAuthor({ name: video.author, url: `https://www.youtube.com/channel/${channelId}` })
    .setDescription(`**${video.author}** just uploaded a new video!\n\n👉 [Watch now](${video.url})`)
    .setThumbnail(`https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`)
    .setTimestamp(new Date(video.published))
    .setFooter({ text: 'YouTube' });

  await channel.send({
    content: '🚨 **NEW VIDEO JUST DROPPED** @everyone',
    embeds: [embed],
  });

  console.log(`[YouTube] Notified about: ${video.title}`);
}

module.exports = { checkNewVideo, checkAndNotify };
