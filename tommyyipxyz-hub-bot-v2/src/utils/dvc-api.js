const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_COOLDOWN_MS = 60_000;
const MAX_ATTEMPTS = 2;

function isDvcApiConfigured(env = process.env) {
  return Boolean(
    env.DVC_API_URL?.trim() && env.DISCORD_BOT_XP_SECRET?.trim()
  );
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function createDvcApi({
  env = process.env,
  fetchImpl = global.fetch,
  wait = delay,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  if (!isDvcApiConfigured(env)) {
    throw new Error(
      '[DVC XP] DVC_API_URL and DISCORD_BOT_XP_SECRET must both be configured'
    );
  }

  let parsedBaseUrl;
  try {
    parsedBaseUrl = new URL(env.DVC_API_URL.trim());
  } catch {
    throw new Error('[DVC XP] DVC_API_URL must be a valid HTTPS URL');
  }

  const allowInsecureLocal =
    env.DVC_ALLOW_INSECURE_LOCAL?.trim().toLowerCase() === 'true' &&
    ['localhost', '127.0.0.1', '::1'].includes(parsedBaseUrl.hostname);
  if (
    (parsedBaseUrl.protocol !== 'https:' && !allowInsecureLocal) ||
    parsedBaseUrl.username ||
    parsedBaseUrl.password
  ) {
    throw new Error(
      '[DVC XP] DVC_API_URL must use HTTPS and must not contain credentials'
    );
  }

  const baseUrl = parsedBaseUrl.toString().replace(/\/+$/, '');
  const secret = env.DISCORD_BOT_XP_SECRET.trim();

  async function request(path, options = {}) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetchImpl(`${baseUrl}${path}`, {
          ...options,
          signal: controller.signal,
          headers: {
            authorization: `Bearer ${secret}`,
            ...(options.body ? { 'content-type': 'application/json' } : {}),
            ...options.headers,
          },
        });

        if (response.ok) return await response.json();

        const retryable = response.status >= 500;
        if (!retryable || attempt === MAX_ATTEMPTS) {
          throw new Error(
            `[DVC XP] Request failed with HTTP ${response.status}`
          );
        }
      } catch (error) {
        const retryable =
          error?.name === 'AbortError' ||
          !String(error?.message).startsWith('[DVC XP]');
        if (!retryable || attempt === MAX_ATTEMPTS) {
          if (String(error?.message).startsWith('[DVC XP]')) throw error;
          throw new Error('[DVC XP] Request failed before receiving a response');
        }
      } finally {
        clearTimeout(timeout);
      }

      await wait(250 * attempt);
    }

    throw new Error('[DVC XP] Request failed');
  }

  return {
    awardMessage({ discordId, guildId, channelId, messageId }) {
      return request('/api/internal/discord/xp', {
        method: 'POST',
        body: JSON.stringify({
          discord_id: discordId,
          source: 'discord_message',
          dedupe_key: `discord_message:${guildId}:${messageId}`,
          metadata: {
            guild_id: guildId,
            channel_id: channelId,
          },
        }),
      });
    },

    getUser(discordId) {
      return request(
        `/api/internal/discord/xp/${encodeURIComponent(discordId)}`
      );
    },

    getLeaderboard(scope = 'all-time', limit = 10, viewer) {
      const params = new URLSearchParams({
        scope,
        limit: String(limit),
      });
      if (viewer) params.set('viewer', viewer);
      return request(`/api/internal/discord/leaderboard?${params}`);
    },
  };
}

function createDvcXpService({
  api,
  cooldownMs = DEFAULT_COOLDOWN_MS,
  now = Date.now,
}) {
  const inFlight = new Set();
  const lastAwardedAt = new Map();

  return {
    async awardMessage(event) {
      const key = `${event.guildId}:${event.discordId}`;
      const lastAward = lastAwardedAt.get(key);
      if (
        inFlight.has(key) ||
        (lastAward !== undefined && now() - lastAward < cooldownMs)
      ) {
        return { status: 'cooldown' };
      }

      inFlight.add(key);
      // A timed-out response may still mean the server accepted the award.
      // Start the cooldown before any network I/O so an immediate retry cannot
      // double-award a member while the outcome is uncertain.
      lastAwardedAt.set(key, now());
      try {
        const state = await api.getUser(event.discordId);
        if (!state.linked) {
          return { status: 'unlinked' };
        }

        const result = await api.awardMessage(event);
        return result;
      } finally {
        inFlight.delete(key);
      }
    },
  };
}

module.exports = {
  createDvcApi,
  createDvcXpService,
  isDvcApiConfigured,
};
