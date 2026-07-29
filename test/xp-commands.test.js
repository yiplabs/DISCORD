const assert = require('node:assert/strict');
const test = require('node:test');

const rankCommand = require('../tommyyipxyz-hub-bot-v2/src/commands/rank');
const leaderboardCommand = require(
  '../tommyyipxyz-hub-bot-v2/src/commands/leaderboard'
);

function member(id, name) {
  return {
    id,
    displayName: name,
    displayAvatarURL: () => 'https://example.com/avatar.png',
  };
}

test('/rank reads the shared DVC account XP when the bridge is configured', async () => {
  const user = member('123456789012345678', 'Hunter');
  const deferrals = [];
  const replies = [];
  const interaction = {
    user,
    guildId: '987654321098765432',
    options: { getUser: () => null },
    client: {
      dvcApi: {
        getUser: async () => ({
          linked: true,
          username: 'hunter',
          xp: 1_250,
          level: 5,
          level_name: 'Vibecoder',
          rank: 3,
        }),
      },
    },
    deferReply: async (options) => deferrals.push(options),
    editReply: async (message) => replies.push(message),
  };

  await rankCommand.execute(interaction);

  assert.equal(deferrals.length, 1);
  assert.equal(deferrals[0].ephemeral, true);
  assert.equal(replies.length, 1);
  const embed = replies[0].embeds[0].toJSON();
  assert.match(embed.title, /Vibecoder/);
  assert.deepEqual(
    embed.fields.map((field) => [field.name, field.value]),
    [
      ['DVC Rank', '#3'],
      ['Total XP', '1,250'],
      ['Level', '5'],
    ]
  );
});

test('/rank sends unlinked members to the existing DVC Discord link flow', async () => {
  const user = member('123456789012345678', 'Hunter');
  const deferrals = [];
  const replies = [];
  const interaction = {
    user,
    guildId: '987654321098765432',
    options: { getUser: () => null },
    client: {
      dvcApi: {
        getUser: async () => ({ linked: false, pending_xp: 8 }),
      },
    },
    deferReply: async (options) => deferrals.push(options),
    editReply: async (message) => replies.push(message),
  };

  await rankCommand.execute(interaction);

  assert.match(replies[0].content, /8 XP/);
  assert.match(
    replies[0].content,
    /https:\/\/dollarvibeclub\.com\/link\/discord/
  );
  assert.equal(deferrals[0].ephemeral, true);
});

test('/rank does not expose another member link state or pending XP', async () => {
  const user = member('123456789012345678', 'Hunter');
  const target = member('223456789012345678', 'Tommy');
  const replies = [];
  const interaction = {
    user,
    options: { getUser: () => target },
    client: {
      dvcApi: {
        getUser: async () => ({ linked: false, pending_xp: 9876 }),
      },
    },
    deferReply: async () => {},
    editReply: async (message) => replies.push(message),
  };

  await rankCommand.execute(interaction);

  assert.match(replies[0].content, /does not have a public DVC rank/i);
  assert.doesNotMatch(replies[0].content, /9,876|pending|linked/i);
});

test('/leaderboard uses the canonical DVC weekly leaderboard', async () => {
  const user = member('123456789012345678', 'Hunter');
  const calls = [];
  const deferrals = [];
  const replies = [];
  const interaction = {
    user,
    guildId: '987654321098765432',
    options: { getString: () => 'weekly' },
    client: {
      dvcApi: {
        getLeaderboard: async (...args) => {
          calls.push(args);
          return {
            scope: 'weekly',
            rows: [
              {
                rank: 1,
                username: 'tommy',
                xp: 80,
                level: 4,
                level_name: 'Builder',
              },
              {
                rank: 2,
                username: 'hunter',
                xp: 60,
                level: 5,
                level_name: 'Vibecoder',
              },
            ],
            viewer: { rank: 2, value: 60 },
          };
        },
      },
    },
    deferReply: async (options) => deferrals.push(options),
    editReply: async (message) => replies.push(message),
  };

  await leaderboardCommand.execute(interaction);

  assert.equal(deferrals.length, 1);
  assert.deepEqual(calls, [['weekly', 10, user.id]]);
  const embed = replies[0].embeds[0].toJSON();
  assert.match(embed.title, /Weekly/);
  assert.match(embed.description, /tommy/);
  assert.match(embed.footer.text, /Your position: #2/);
});

test('/rank never falls back to Railway-local XP', async () => {
  const user = member('123456789012345678', 'Hunter');
  const replies = [];

  await rankCommand.execute({
    user,
    guildId: '987654321098765432',
    options: { getUser: () => null },
    client: { dvcApi: null },
    reply: async (message) => replies.push(message),
  });

  assert.match(replies[0].content, /shared DVC XP bridge/i);
  assert.equal(replies[0].ephemeral, true);
});

test('/leaderboard never falls back to Railway-local XP', async () => {
  const user = member('123456789012345678', 'Hunter');
  const replies = [];

  await leaderboardCommand.execute({
    user,
    guildId: '987654321098765432',
    options: { getString: () => 'all-time' },
    client: { dvcApi: null },
    reply: async (message) => replies.push(message),
  });

  assert.match(replies[0].content, /shared DVC XP bridge/i);
  assert.equal(replies[0].ephemeral, true);
});
