const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createDvcApi,
  createDvcXpService,
  isDvcApiConfigured,
} = require('../tommyyipxyz-hub-bot-v2/src/utils/dvc-api');

const ENV = {
  DVC_API_URL: 'https://dollarvibeclub.com/',
  DISCORD_BOT_XP_SECRET: 'server-to-server-secret',
};

test('detects whether the DVC XP bridge is fully configured', () => {
  assert.equal(isDvcApiConfigured({}), false);
  assert.equal(
    isDvcApiConfigured({ DVC_API_URL: ENV.DVC_API_URL }),
    false
  );
  assert.equal(isDvcApiConfigured(ENV), true);
});

test('refuses to send the XP bearer secret over an insecure URL', () => {
  assert.throws(
    () =>
      createDvcApi({
        env: {
          ...ENV,
          DVC_API_URL: 'http://example.com',
        },
      }),
    /HTTPS/
  );
});

test('awards message XP with a stable dedupe key and no message content', async () => {
  const calls = [];
  const api = createDvcApi({
    env: ENV,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: 'awarded',
          awarded: 2,
          new_xp: 102,
          new_level: 1,
          level_name: 'Builder',
          leveled_up: true,
        }),
      };
    },
  });

  const result = await api.awardMessage({
    discordId: '1234567890',
    guildId: '9876543210',
    channelId: '1111111111',
    messageId: '2222222222',
  });

  assert.equal(result.status, 'awarded');
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    'https://dollarvibeclub.com/api/internal/discord/xp'
  );
  assert.equal(
    calls[0].options.headers.authorization,
    'Bearer server-to-server-secret'
  );
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    discord_id: '1234567890',
    source: 'discord_message',
    dedupe_key:
      'discord_message:9876543210:2222222222',
    metadata: {
      guild_id: '9876543210',
      channel_id: '1111111111',
    },
  });
  assert.equal(calls[0].options.body.includes('server-to-server-secret'), false);
});

test('retries a transient DVC API failure without exposing the secret', async () => {
  let attempts = 0;
  const api = createDvcApi({
    env: ENV,
    wait: async () => {},
    fetchImpl: async () => {
      attempts += 1;
      if (attempts === 1) {
        return { ok: false, status: 503 };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ linked: false, pending_xp: 8 }),
      };
    },
  });

  const result = await api.getUser('1234567890');
  assert.equal(attempts, 2);
  assert.deepEqual(result, { linked: false, pending_xp: 8 });

  const rejectingApi = createDvcApi({
    env: ENV,
    wait: async () => {},
    fetchImpl: async () => ({ ok: false, status: 401 }),
  });
  await assert.rejects(
    rejectingApi.getUser('1234567890'),
    (error) =>
      error.message.includes('401') &&
      !error.message.includes('server-to-server-secret')
  );
});

test('coalesces overlapping XP awards and applies a per-member cooldown', async () => {
  let now = 1_000;
  let calls = 0;
  let release;
  const firstAward = new Promise((resolve) => {
    release = resolve;
  });
  const service = createDvcXpService({
    cooldownMs: 60_000,
    now: () => now,
    api: {
      getUser: async () => ({ linked: true }),
      awardMessage: async () => {
        calls += 1;
        await firstAward;
        return { status: 'awarded', awarded: 2, leveled_up: false };
      },
    },
  });
  const event = {
    discordId: '1234567890',
    guildId: '9876543210',
    channelId: '1111111111',
    messageId: '2222222222',
  };

  const first = service.awardMessage(event);
  assert.deepEqual(await service.awardMessage(event), { status: 'cooldown' });
  release();
  await first;

  now += 30_000;
  assert.deepEqual(await service.awardMessage(event), { status: 'cooldown' });

  now += 31_000;
  const later = service.awardMessage({ ...event, messageId: '3333333333' });
  await later;
  assert.equal(calls, 2);
});

test('does not bank uncapped XP for members who have not linked DVC', async () => {
  let awards = 0;
  const service = createDvcXpService({
    api: {
      getUser: async () => ({ linked: false, pending_xp: 0 }),
      awardMessage: async () => {
        awards += 1;
        return { status: 'awarded' };
      },
    },
  });

  const result = await service.awardMessage({
    discordId: '1234567890',
    guildId: '9876543210',
    channelId: '1111111111',
    messageId: '2222222222',
  });

  assert.deepEqual(result, { status: 'unlinked' });
  assert.equal(awards, 0);
});

test('starts the cooldown before a remote award with an uncertain outcome', async () => {
  let awards = 0;
  const service = createDvcXpService({
    api: {
      getUser: async () => ({ linked: true }),
      awardMessage: async () => {
        awards += 1;
        throw new Error('response timed out after the server accepted it');
      },
    },
  });
  const event = {
    discordId: '1234567890',
    guildId: '9876543210',
    channelId: '1111111111',
    messageId: '2222222222',
  };

  await assert.rejects(service.awardMessage(event), /timed out/);
  assert.deepEqual(await service.awardMessage(event), { status: 'cooldown' });
  assert.equal(awards, 1);
});
