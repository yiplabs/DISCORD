const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(
  path.join(__dirname, '../tommyyipxyz-hub-bot-v2/src/index.js'),
  'utf8'
);

test('uses the current discord.js client-ready event', () => {
  assert.match(source, /client\.once\('clientReady'/);
  assert.doesNotMatch(source, /client\.once\('ready'/);
});

test('does not claim a local XP fallback or request Message Content intent', () => {
  assert.doesNotMatch(source, /local XP fallback/);
  assert.doesNotMatch(source, /GatewayIntentBits\.MessageContent/);
});

test('relies on native onboarding instead of privileged member/reaction events', () => {
  assert.doesNotMatch(source, /GatewayIntentBits\.GuildMembers/);
  assert.doesNotMatch(source, /GatewayIntentBits\.GuildMessageReactions/);
  assert.doesNotMatch(source, /guildMemberAdd|messageReactionAdd|messageReactionRemove/);
});

test('contains YouTube check failures instead of crashing the bot process', () => {
  assert.match(source, /async function checkYoutubeForConfiguredGuilds/);
  assert.match(source, /\[YouTube\] Check failed/);
  assert.doesNotMatch(source, /setTimeout\(async/);
});
