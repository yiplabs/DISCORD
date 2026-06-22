// ─── ONE-TIME XP BACKFILL ───
// Sends each member's existing local XP total to the DVC website once, as a
// `discord_backfill` event. Linked users are credited immediately; unlinked users'
// totals are parked and credited automatically when they link. The stable dedupe
// key makes this safe to re-run (re-sends come back as "deduped").
//
// Run once after the website endpoints are live:
//   DVC_API_BASE=... DISCORD_BOT_XP_SECRET=... npm run backfill

require('dotenv').config();
const { db } = require('../utils/database');
const dvcApi = require('../utils/dvcApi');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!dvcApi.isConfigured()) {
    console.error('[Backfill] DVC_API_BASE and DISCORD_BOT_XP_SECRET must be set. Aborting.');
    process.exit(1);
  }

  const users = db.prepare('SELECT user_id, xp FROM users WHERE xp > 0').all();
  console.log(`[Backfill] Found ${users.length} users with XP to migrate.`);

  let awarded = 0;
  let deduped = 0;
  let parked = 0;
  let failed = 0;

  for (const u of users) {
    const res = await dvcApi.awardXp({
      discordId: u.user_id,
      source: 'discord_backfill',
      amount: u.xp,
      dedupeKey: `sqlite_backfill:${u.user_id}`,
    });

    if (res.httpStatus === 200) {
      if (res.status === 'unlinked') parked++;
      else if (res.status === 'deduped') deduped++;
      else awarded++;
      console.log(`  ${u.user_id}: ${res.status} (${u.xp} XP)`);
    } else {
      failed++;
      console.warn(`  ${u.user_id}: HTTP ${res.httpStatus}${res.error ? ` (${res.error})` : ''}`);
    }

    // Stay well under the API's ~900 req/min limit.
    await sleep(120);
  }

  console.log(
    `[Backfill] Done. credited=${awarded} parked(unlinked)=${parked} alreadyDone=${deduped} failed=${failed}`
  );
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('[Backfill] Fatal:', err);
  process.exit(1);
});
