// ─── DOLLAR VIBE CLUB WEBSITE API CLIENT ───
// The bot NEVER touches the database. It awards and reads XP only through the
// website's server-to-server endpoints, authenticated with a shared secret.
// The website owns all XP rules (values, caps, streak multiplier, level math).
// Contract: POST /api/internal/discord/xp, GET /api/internal/discord/xp/:id,
// GET /api/internal/discord/leaderboard.

const BASE = (process.env.DVC_API_BASE || '').replace(/\/+$/, '');
const SECRET = process.env.DISCORD_BOT_XP_SECRET || '';
const LINK_URL = process.env.DVC_LINK_URL || '';

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRIES = 3;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const backoffMs = (attempt) => Math.min(16_000, 1000 * 2 ** attempt); // 1s, 2s, 4s, ...

/** True once both the base URL and the shared secret are configured. */
function isConfigured() {
  return Boolean(BASE && SECRET);
}

/** The "Link Discord" page URL, or null if not configured. */
function linkUrl() {
  return LINK_URL || null;
}

/**
 * Make a request to the DVC API. Retries 429 and 5xx with backoff (honoring
 * Retry-After); never retries 4xx (those are bugs to fix). Returns a normalized
 * { ok, httpStatus, error, ...responseBody }. Reads should pass a tight timeout
 * and retries: 0 so a slash command can always answer inside Discord's window.
 */
async function request(method, path, { body, query, timeoutMs = DEFAULT_TIMEOUT_MS, retries = DEFAULT_RETRIES } = {}) {
  if (!isConfigured()) {
    return { ok: false, httpStatus: 0, error: 'not_configured' };
  }

  let url = BASE + path;
  if (query) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) qs.append(k, String(v));
    }
    const s = qs.toString();
    if (s) url += `?${s}`;
  }

  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${SECRET}`,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      // Network error or timeout — retryable.
      if (attempt < retries) {
        await sleep(backoffMs(attempt));
        continue;
      }
      return { ok: false, httpStatus: 0, error: err.name === 'TimeoutError' ? 'timeout' : err.message };
    }

    // 429 and 5xx are retryable; everything else is a final answer.
    if ((res.status === 429 || res.status >= 500) && attempt < retries) {
      const retryAfter = Number(res.headers.get('retry-after'));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoffMs(attempt));
      continue;
    }

    let data = {};
    try {
      const txt = await res.text();
      data = txt ? JSON.parse(txt) : {};
    } catch {
      data = {};
    }
    return { ok: res.ok, httpStatus: res.status, ...data };
  }
}

/**
 * Award (or park) XP for one event. `source` is discord_message | discord_voice |
 * discord_backfill. Omit `amount` for messages (the server decides it). Always pass
 * a stable `dedupeKey` so retries can never double-award.
 */
async function awardXp({ discordId, source = 'discord_message', amount, dedupeKey, metadata }, opts = {}) {
  const body = { discord_id: discordId, source };
  if (amount !== undefined && amount !== null) body.amount = amount;
  if (dedupeKey) body.dedupe_key = dedupeKey;
  if (metadata) body.metadata = metadata;
  return request('POST', '/api/internal/discord/xp', { body, ...opts });
}

/** Read a user's XP/level/rank (or pending XP if they have not linked). */
async function getUserXp(discordId, opts = {}) {
  return request('GET', `/api/internal/discord/xp/${encodeURIComponent(discordId)}`, opts);
}

/** Read a leaderboard page. scope: all-time | weekly | monthly. */
async function getLeaderboard({ scope = 'all-time', limit = 10, viewer } = {}, opts = {}) {
  return request('GET', '/api/internal/discord/leaderboard', { query: { scope, limit, viewer }, ...opts });
}

module.exports = { isConfigured, linkUrl, awardXp, getUserXp, getLeaderboard };
