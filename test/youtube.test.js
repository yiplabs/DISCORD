const assert = require('node:assert/strict');
const test = require('node:test');

const {
  checkAndNotify,
  checkChannel,
  checkNewVideo,
  fetchWithTimeout,
  getWatchedChannels,
} = require('../tommyyipxyz-hub-bot-v2/src/utils/youtube');

const YOUTUBE_ENV_KEYS = [
  'YOUTUBE_CHANNEL_ID',
  'YOUTUBE_HANDLE',
  'YOUTUBE_CHANNEL_ID_2',
  'YOUTUBE_HANDLE_2',
  'DISCORD_GUILD_ID',
  'DISCORD_NOTIFY_CHANNEL_ID',
  'YOUTUBE_MENTION_ROLE_ID',
  'YOUTUBE_PING_EVERYONE',
  'YOUTUBE_LIVE_PING_EVERYONE_CHANNEL_IDS',
];

function withCleanYoutubeEnv(run) {
  const previous = Object.fromEntries(
    YOUTUBE_ENV_KEYS.map((key) => [key, process.env[key]])
  );

  for (const key of YOUTUBE_ENV_KEYS) {
    delete process.env[key];
  }

  return Promise.resolve()
    .then(run)
    .finally(() => {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    });
}

test('watches Tommy and Hunter by default', () =>
  withCleanYoutubeEnv(() => {
    assert.deepEqual(getWatchedChannels(), [
      {
        channelId: 'UCvNg5BdvvvU3-1RL5mRi6lQ',
        handle: 'TOMMYYIPXYZ',
      },
      {
        channelId: 'UC_oMk6B6Hv7PwoyskeWWS2g',
        handle: 'HUNTERYIPLABS',
      },
    ]);
  }));

test('ignores a placeholder primary channel ID instead of disabling Tommy', () =>
  withCleanYoutubeEnv(() => {
    process.env.YOUTUBE_CHANNEL_ID = 'your_UC_channel_id_here';

    assert.equal(
      getWatchedChannels()[0].channelId,
      'UCvNg5BdvvvU3-1RL5mRi6lQ'
    );
  }));

test('uses the Railway-pinned DVC announcement channel without SQLite settings', () =>
  withCleanYoutubeEnv(async () => {
    process.env.DISCORD_GUILD_ID = 'dvc-guild';
    process.env.DISCORD_NOTIFY_CHANNEL_ID = 'dvc-announcements';

    const fetchedChannelIds = [];
    const client = {
      channels: {
        fetch: async (channelId) => {
          fetchedChannelIds.push(channelId);
          return null;
        },
      },
    };

    await checkAndNotify(client, 'dvc-guild');

    assert.deepEqual(fetchedChannelIds, ['dvc-announcements']);
  }));

test('decodes XML entities in YouTube feed titles and channel names', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    text: async () => `
      <feed>
        <author><name>Tommy &amp; Hunter</name></author>
        <entry>
          <yt:videoId>entity-video</yt:videoId>
          <title>We&#39;re live &amp; building</title>
          <published>2026-07-29T20:58:00.000Z</published>
          <updated>2026-07-29T20:59:00.000Z</updated>
        </entry>
      </feed>
    `,
  });

  try {
    const result = await checkNewVideo(TOMMY.channelId);
    assert.equal(result.channelName, 'Tommy & Hunter');
    assert.equal(result.entries[0].title, "We're live & building");
  } finally {
    global.fetch = originalFetch;
  }
});

test('aborts a YouTube request that exceeds its deadline', async () => {
  const fetchImpl = async (_url, options) =>
    new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      });
    });

  await assert.rejects(
    fetchWithTimeout(
      'https://www.youtube.com/feeds/videos.xml',
      {},
      { fetchImpl, timeoutMs: 5 }
    ),
    /timed out/
  );
});

function createStateStore(initialState = null) {
  let current = initialState ? { ...initialState } : null;
  const writes = [];

  return {
    get() {
      return current ? { ...current } : null;
    },
    upsert(nextState) {
      current = { ...nextState };
      writes.push({ ...nextState });
    },
    snapshot() {
      return current ? { ...current } : null;
    },
    writes,
  };
}

function createDiscordChannel({
  guildId = 'dvc-guild',
  recentMessages = [],
  send,
}) {
  return {
    guildId,
    messages: {
      fetch: async () =>
        new Map(
          recentMessages.map((message, index) => [String(index), message])
        ),
    },
    send,
  };
}

const TOMMY = {
  channelId: 'UCvNg5BdvvvU3-1RL5mRi6lQ',
  handle: 'TOMMYYIPXYZ',
};

const HUNTER = {
  channelId: 'UC_oMk6B6Hv7PwoyskeWWS2g',
  handle: 'HUNTERYIPLABS',
};

const FRESH_LIVE = {
  videoId: 'fresh-live',
  title: 'Live DVC build',
  url: 'https://www.youtube.com/watch?v=fresh-live',
};

const FRESH_VIDEO = {
  videoId: 'fresh-video',
  title: 'Fresh DVC build',
  published: '2026-07-29T20:58:00.000Z',
  updated: '2026-07-29T20:58:00.000Z',
  url: 'https://www.youtube.com/watch?v=fresh-video',
  thumbnail: 'https://i.ytimg.com/vi/fresh-video/hqdefault.jpg',
};

test('does not advance notification state when Discord rejects the send', async () => {
  const stateStore = createStateStore({
    guild_id: 'dvc-guild',
    yt_channel_id: TOMMY.channelId,
    last_video_id: 'older-video',
    last_live_id: null,
  });
  const discordChannel = createDiscordChannel({
    send: async () => {
      throw new Error('Discord send failed');
    },
  });

  await assert.rejects(
    checkChannel(null, 'dvc-guild', discordChannel, TOMMY, {
      stateStore,
      fetchFeed: async () => ({
        entries: [FRESH_VIDEO],
        channelName: 'TOMMY YIPXYZ',
        channelId: TOMMY.channelId,
      }),
      fetchLive: async () => null,
      now: () => Date.parse('2026-07-29T21:00:00.000Z'),
    }),
    /Discord send failed/
  );

  assert.equal(stateStore.snapshot().last_video_id, 'older-video');
  assert.equal(stateStore.writes.length, 0);
});

test('announces a fresh upload after Railway loses first-run SQLite state', async () => {
  const stateStore = createStateStore();
  const sent = [];
  const discordChannel = createDiscordChannel({
    send: async (message) => {
      sent.push(message);
    },
  });

  await checkChannel(null, 'dvc-guild', discordChannel, TOMMY, {
    stateStore,
    fetchFeed: async () => ({
      entries: [FRESH_VIDEO],
      channelName: 'TOMMY YIPXYZ',
      channelId: TOMMY.channelId,
    }),
    fetchLive: async () => null,
    now: () => Date.parse('2026-07-29T21:00:00.000Z'),
  });

  assert.equal(sent.length, 1);
  assert.equal(stateStore.snapshot().last_video_id, FRESH_VIDEO.videoId);
});

test('does not mass-mention the server for uploads by default', () =>
  withCleanYoutubeEnv(async () => {
    const stateStore = createStateStore({
      guild_id: 'dvc-guild',
      yt_channel_id: TOMMY.channelId,
      last_video_id: 'older-video',
      last_live_id: null,
    });
    const sent = [];
    const discordChannel = createDiscordChannel({
      send: async (message) => sent.push(message),
    });

    await checkChannel(null, 'dvc-guild', discordChannel, TOMMY, {
      stateStore,
      fetchFeed: async () => ({
        entries: [FRESH_VIDEO],
        channelName: 'TOMMY YIPXYZ',
        channelId: TOMMY.channelId,
      }),
      fetchLive: async () => null,
      now: () => Date.parse('2026-07-29T21:00:00.000Z'),
    });

    assert.equal(sent[0].content.includes('@everyone'), false);
    assert.deepEqual(sent[0].allowedMentions, { parse: [] });
  }));

test('mass-mentions the server for Tommy live events when his channel is allowlisted', () =>
  withCleanYoutubeEnv(async () => {
    process.env.YOUTUBE_LIVE_PING_EVERYONE_CHANNEL_IDS = TOMMY.channelId;

    const stateStore = createStateStore({
      guild_id: 'dvc-guild',
      yt_channel_id: TOMMY.channelId,
      last_video_id: FRESH_VIDEO.videoId,
      last_live_id: 'older-live',
    });
    const sent = [];
    const discordChannel = createDiscordChannel({
      send: async (message) => sent.push(message),
    });

    await checkChannel(null, 'dvc-guild', discordChannel, TOMMY, {
      stateStore,
      fetchFeed: async () => ({ entries: [] }),
      fetchLive: async () => FRESH_LIVE,
    });

    assert.equal(sent.length, 1);
    assert.equal(sent[0].content.includes('@everyone'), true);
    assert.deepEqual(sent[0].allowedMentions, { parse: ['everyone'] });
  }));

test('does not mass-mention Hunter when only Tommy is allowlisted', () =>
  withCleanYoutubeEnv(async () => {
    process.env.YOUTUBE_LIVE_PING_EVERYONE_CHANNEL_IDS = TOMMY.channelId;

    const stateStore = createStateStore({
      guild_id: 'dvc-guild',
      yt_channel_id: HUNTER.channelId,
      last_video_id: FRESH_VIDEO.videoId,
      last_live_id: 'older-live',
    });
    const sent = [];
    const discordChannel = createDiscordChannel({
      send: async (message) => sent.push(message),
    });

    await checkChannel(null, 'dvc-guild', discordChannel, HUNTER, {
      stateStore,
      fetchFeed: async () => ({ entries: [] }),
      fetchLive: async () => FRESH_LIVE,
    });

    assert.equal(sent.length, 1);
    assert.equal(sent[0].content.includes('@everyone'), false);
    assert.deepEqual(sent[0].allowedMentions, { parse: [] });
  }));

test('does not mass-mention Tommy uploads when only live events are allowlisted', () =>
  withCleanYoutubeEnv(async () => {
    process.env.YOUTUBE_LIVE_PING_EVERYONE_CHANNEL_IDS = TOMMY.channelId;

    const stateStore = createStateStore({
      guild_id: 'dvc-guild',
      yt_channel_id: TOMMY.channelId,
      last_video_id: 'older-video',
      last_live_id: null,
    });
    const sent = [];
    const discordChannel = createDiscordChannel({
      send: async (message) => sent.push(message),
    });

    await checkChannel(null, 'dvc-guild', discordChannel, TOMMY, {
      stateStore,
      fetchFeed: async () => ({
        entries: [FRESH_VIDEO],
        channelName: 'TOMMY YIPXYZ',
        channelId: TOMMY.channelId,
      }),
      fetchLive: async () => null,
      now: () => Date.parse('2026-07-29T21:00:00.000Z'),
    });

    assert.equal(sent.length, 1);
    assert.equal(sent[0].content.includes('@everyone'), false);
    assert.deepEqual(sent[0].allowedMentions, { parse: [] });
  }));

test('uses Discord channel history to suppress a duplicate after state loss', async () => {
  const stateStore = createStateStore();
  const sent = [];
  const discordChannel = createDiscordChannel({
    recentMessages: [
      {
        content: 'Already announced',
        embeds: [{ url: FRESH_VIDEO.url }],
      },
    ],
    send: async (message) => {
      sent.push(message);
    },
  });

  await checkChannel(null, 'dvc-guild', discordChannel, TOMMY, {
    stateStore,
    fetchFeed: async () => ({
      entries: [FRESH_VIDEO],
      channelName: 'TOMMY YIPXYZ',
      channelId: TOMMY.channelId,
    }),
    fetchLive: async () => null,
    now: () => Date.parse('2026-07-29T21:00:00.000Z'),
  });

  assert.equal(sent.length, 0);
  assert.equal(stateStore.snapshot().last_video_id, FRESH_VIDEO.videoId);
});

test('coalesces overlapping cron checks for the same DVC server', () =>
  withCleanYoutubeEnv(async () => {
    process.env.DISCORD_GUILD_ID = 'dvc-guild';
    process.env.DISCORD_NOTIFY_CHANNEL_ID = 'dvc-announcements';

    let releaseFirstCheck;
    let startedFirstCheck;
    const firstCheckStarted = new Promise((resolve) => {
      startedFirstCheck = resolve;
    });
    const release = new Promise((resolve) => {
      releaseFirstCheck = resolve;
    });
    let channelChecks = 0;

    const discordChannel = createDiscordChannel({
      send: async () => {},
    });
    const client = {
      channels: {
        fetch: async () => discordChannel,
      },
    };
    const dependencies = {
      getChannels: () => [TOMMY],
      runChannel: async () => {
        channelChecks += 1;
        startedFirstCheck();
        await release;
      },
    };

    const first = checkAndNotify(client, 'dvc-guild', dependencies);
    await Promise.race([firstCheckStarted, first]);
    assert.equal(channelChecks, 1);

    const second = checkAndNotify(client, 'dvc-guild', dependencies);

    await Promise.resolve();
    assert.equal(channelChecks, 1);

    releaseFirstCheck();
    await Promise.all([first, second]);
    assert.equal(channelChecks, 1);
  }));

test('refuses to post through a notification channel from another server', () =>
  withCleanYoutubeEnv(async () => {
    process.env.DISCORD_GUILD_ID = 'dvc-guild';
    process.env.DISCORD_NOTIFY_CHANNEL_ID = 'foreign-announcements';

    let channelChecks = 0;
    const client = {
      channels: {
        fetch: async () =>
          createDiscordChannel({
            guildId: 'other-guild',
            send: async () => {},
          }),
      },
    };

    await checkAndNotify(client, 'dvc-guild', {
      getChannels: () => [TOMMY],
      runChannel: async () => {
        channelChecks += 1;
      },
    });

    assert.equal(channelChecks, 0);
  }));
