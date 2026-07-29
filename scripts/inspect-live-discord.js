#!/usr/bin/env node

const API = 'https://discord.com/api/v10';
const ADMINISTRATOR = 1n << 3n;

async function discord(path) {
  const response = await fetch(`${API}${path}`, {
    headers: { authorization: `Bot ${process.env.DISCORD_TOKEN}` },
  });
  if (!response.ok) {
    throw new Error(`Discord API ${path} returned HTTP ${response.status}`);
  }
  return response.json();
}

async function main() {
  if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) {
    throw new Error('Railway is missing DISCORD_TOKEN or CLIENT_ID');
  }

  const [bot, guilds] = await Promise.all([
    discord('/users/@me'),
    discord('/users/@me/guilds'),
  ]);

  const configuredGuildId = process.env.DISCORD_GUILD_ID?.trim();
  const targetGuild =
    guilds.find((guild) => guild.id === configuredGuildId) ||
    guilds.find((guild) => /dollar\s*vibe/i.test(guild.name)) ||
    (guilds.length === 1 ? guilds[0] : null);

  const result = {
    bot: {
      id: bot.id,
      username: bot.username,
      clientIdMatchesBotId: process.env.CLIENT_ID === bot.id,
    },
    guildCount: guilds.length,
    guilds: guilds.map((guild) => ({
      id: guild.id,
      name: guild.name,
      administrator:
        (BigInt(guild.permissions || '0') & ADMINISTRATOR) === ADMINISTRATOR,
    })),
    targetGuild: null,
  };

  if (targetGuild) {
    const channels = await discord(`/guilds/${targetGuild.id}/channels`);
    const textChannels = channels
      .filter((channel) => channel.type === 0 || channel.type === 5)
      .map((channel) => ({
        id: channel.id,
        name: channel.name,
        type: channel.type === 5 ? 'announcement' : 'text',
      }));
    const configuredChannelId =
      process.env.DISCORD_NOTIFY_CHANNEL_ID?.trim();

    result.targetGuild = {
      id: targetGuild.id,
      name: targetGuild.name,
      configuredChannel:
        textChannels.find((channel) => channel.id === configuredChannelId) ||
        null,
      announcementCandidates: textChannels.filter((channel) =>
        /announcement|youtube|video|stream|update/i.test(channel.name)
      ),
    };
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
