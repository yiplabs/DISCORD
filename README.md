# Dollar Vibe Club Discord Bot

The community bot for Dollar Vibe Club. It connects Discord activity to the
existing DVC member account, posts reliable YouTube announcements for Tommy
and Hunter, and provides shared rank and leaderboard commands.

The researched community direction is documented in
[docs/community-blueprint.md](docs/community-blueprint.md).

## What it does

- Watches both verified YouTube channels every three minutes.
- Posts new uploads and live streams to one Railway-pinned Discord channel.
- Suppresses duplicate announcements across Railway restarts.
- Retries failed Discord notifications without prematurely advancing state.
- Awards Discord message XP to the existing DVC gamification ledger once the
  shared XP secret is activated on both services.
- Awards message XP only after a member connects DVC, preventing uncapped
  pre-link XP banking.
- Shows shared DVC progress with `/rank` and all-time, weekly, or monthly
  leaderboards with `/leaderboard`.
- Does not ship the destructive legacy full-server rebuild command.

## Commands

| Command | Purpose |
| --- | --- |
| `/start` | Open a private DVC onboarding and account-link path |
| `/doctor` | Run a read-only production configuration check |
| `/rank [user]` | Show a member's shared DVC rank and XP |
| `/leaderboard [scope]` | Show the DVC all-time, weekly, or monthly leaders |
| `/showcase` | Post a polished project showcase |
| `/setnotify` | Local fallback for the YouTube notification channel |

## Railway configuration

Copy the variable names from `.env.example` into Railway.

The durable production settings are:

- `DISCORD_GUILD_ID` — the Dollar Vibe Club server ID.
- `DISCORD_NOTIFY_CHANNEL_ID` — the YouTube announcement channel ID.
- `DVC_API_URL` — the DVC website origin.
- `DISCORD_BOT_XP_SECRET` — the same server-to-server secret configured on
  the DVC API.
- `YOUTUBE_LIVE_PING_EVERYONE_CHANNEL_IDS` — optional comma-separated YouTube
  channel IDs whose live events should ping `@everyone`; uploads stay quiet.

`/setnotify` writes to local SQLite and is only a fallback. Railway containers
can lose that file during a redeploy, so production should use
`DISCORD_NOTIFY_CHANNEL_ID`.

## Local verification

Requires Node 22–24.

```bash
npm ci
npm test
npm start
```

The bot validates required Discord credentials before login. Real secrets
belong in Railway Variables or a local untracked `.env` file.

## Safety

The original bot contained a command that could delete every server channel
and recreate the server. That command is no longer part of the production
command bundle. The restart-unsafe giveaway command is also excluded until it
has durable state and an audit trail. YouTube announcements do not mass-mention
by default. Configure an opt-in notification role with
`YOUTUBE_MENTION_ROLE_ID`, or narrowly allowlist live-event channel IDs with
`YOUTUBE_LIVE_PING_EVERYONE_CHANNEL_IDS`. The legacy
`YOUTUBE_PING_EVERYONE=true` switch pings for every watched upload and live
event and should remain off.
