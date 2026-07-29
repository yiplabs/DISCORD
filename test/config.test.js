const assert = require('node:assert/strict');
const test = require('node:test');

const {
  isConfiguredGuild,
  validateRuntimeEnvironment,
} = require('../tommyyipxyz-hub-bot-v2/src/utils/config');

test('startup rejects missing or placeholder Discord credentials', () => {
  assert.throws(
    () => validateRuntimeEnvironment({}),
    /DISCORD_TOKEN.*CLIENT_ID.*DISCORD_GUILD_ID/
  );

  assert.throws(
    () =>
      validateRuntimeEnvironment({
        DISCORD_TOKEN: 'your_bot_token_here',
        CLIENT_ID: '1485242134746628166',
        DISCORD_GUILD_ID: '1485230613047939114',
      }),
    /DISCORD_TOKEN/
  );

  assert.throws(
    () =>
      validateRuntimeEnvironment({
        DISCORD_TOKEN: 'test-token-that-is-not-a-placeholder',
        CLIENT_ID: '1485242134746628166',
        DISCORD_GUILD_ID: 'not-a-discord-id',
      }),
    /DISCORD_GUILD_ID/
  );
});

test('startup accepts configured Discord credentials', () => {
  assert.doesNotThrow(() =>
    validateRuntimeEnvironment({
      DISCORD_TOKEN: 'test-token-that-is-not-a-placeholder',
      CLIENT_ID: '1485242134746628166',
      DISCORD_GUILD_ID: '1485230613047939114',
    })
  );
});

test('guild scoping rejects events outside Dollar Vibe Club', () => {
  const env = { DISCORD_GUILD_ID: '1485230613047939114' };

  assert.equal(isConfiguredGuild('1485230613047939114', env), true);
  assert.equal(isConfiguredGuild('999999999999999999', env), false);
  assert.equal(isConfiguredGuild('1485230613047939114', {}), false);
});
