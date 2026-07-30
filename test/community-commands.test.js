const assert = require('node:assert/strict');
const test = require('node:test');

const { PermissionFlagsBits } = require('discord.js');
const doctor = require('../tommyyipxyz-hub-bot-v2/src/commands/doctor');
const start = require('../tommyyipxyz-hub-bot-v2/src/commands/start');

test('/start gives a polished private DVC onboarding path', async () => {
  const previous = process.env.DVC_WEB_URL;
  process.env.DVC_WEB_URL = 'https://dollarvibeclub.com/';
  const replies = [];

  try {
    await start.execute({
      reply: async (message) => replies.push(message),
    });
  } finally {
    if (previous === undefined) delete process.env.DVC_WEB_URL;
    else process.env.DVC_WEB_URL = previous;
  }

  assert.equal(replies[0].ephemeral, true);
  assert.deepEqual(replies[0].allowedMentions, { parse: [] });
  const embed = replies[0].embeds[0].toJSON();
  assert.match(embed.title, /Dollar Vibe Club/);
  assert.match(embed.description, /Connect your DVC account/);

  const buttons = replies[0].components[0].toJSON().components;
  assert.deepEqual(
    buttons.map((button) => [button.label, button.url]),
    [
      [
        'Connect DVC Account',
        'https://dollarvibeclub.com/link/discord',
      ],
      ['Open Dollar Vibe Club', 'https://dollarvibeclub.com'],
    ]
  );
});

test('/doctor performs a read-only production configuration check', async () => {
  const previous = {
    DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID,
    DISCORD_NOTIFY_CHANNEL_ID: process.env.DISCORD_NOTIFY_CHANNEL_ID,
    DVC_API_URL: process.env.DVC_API_URL,
    DISCORD_BOT_XP_SECRET: process.env.DISCORD_BOT_XP_SECRET,
  };
  Object.assign(process.env, {
    DISCORD_GUILD_ID: '1485230613047939114',
    DISCORD_NOTIFY_CHANNEL_ID: '1494244485545070622',
    DVC_API_URL: 'https://dollarvibeclub.com',
    DISCORD_BOT_XP_SECRET: 'configured-secret',
  });

  const replies = [];
  const channel = {
    id: '1494244485545070622',
    name: 'announcements',
    permissionsFor: () => ({
      has: (permission) =>
        [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.MentionEveryone,
        ].includes(permission),
    }),
  };
  const botMember = {
    permissions: { has: () => false },
  };
  const interaction = {
    guildId: '1485230613047939114',
    guild: {
      channels: {
        cache: new Map([['1494244485545070622', channel]]),
      },
      members: { me: botMember },
    },
    memberPermissions: {
      has: (permission) => permission === PermissionFlagsBits.ManageGuild,
    },
    reply: async (message) => replies.push(message),
  };

  try {
    await doctor.execute(interaction);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }

  assert.equal(replies[0].ephemeral, true);
  const embed = replies[0].embeds[0].toJSON();
  assert.match(embed.title, /Ready/);
  assert.match(embed.description, /read-only/i);
  assert.match(
    embed.fields.map((field) => field.value).join('\n'),
    /#announcements/
  );
});

test('/doctor reports when the announcement channel cannot mention everyone', async () => {
  const previous = {
    DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID,
    DISCORD_NOTIFY_CHANNEL_ID: process.env.DISCORD_NOTIFY_CHANNEL_ID,
    DVC_API_URL: process.env.DVC_API_URL,
    DISCORD_BOT_XP_SECRET: process.env.DISCORD_BOT_XP_SECRET,
  };
  Object.assign(process.env, {
    DISCORD_GUILD_ID: '1485230613047939114',
    DISCORD_NOTIFY_CHANNEL_ID: '1494244485545070622',
    DVC_API_URL: 'https://dollarvibeclub.com',
    DISCORD_BOT_XP_SECRET: 'configured-secret',
  });

  const replies = [];
  const channel = {
    name: 'announcements',
    permissionsFor: () => ({
      has: (permission) =>
        [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.ReadMessageHistory,
        ].includes(permission),
    }),
  };
  const interaction = {
    guildId: '1485230613047939114',
    guild: {
      channels: {
        cache: new Map([['1494244485545070622', channel]]),
      },
      members: {
        me: { permissions: { has: () => false } },
      },
    },
    memberPermissions: {
      has: (permission) => permission === PermissionFlagsBits.ManageGuild,
    },
    reply: async (message) => replies.push(message),
  };

  try {
    await doctor.execute(interaction);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }

  const embed = replies[0].embeds[0].toJSON();
  assert.match(embed.title, /Needs Attention/);
  assert.deepEqual(
    embed.fields.find((field) => field.name.includes('Mention everyone')),
    {
      name: '⚠️ Mention everyone',
      value: '#announcements',
      inline: true,
    }
  );
});
