# Moderation setup (Dollar Vibe Club)

## Approach
Moderation is run by a proven moderation bot, not custom code, matching the
build-vs-buy decision. The split is:

- **Dollar Vibe Club bot (this repo):** XP and leveling (synced to the website),
  welcome, reaction roles (`#pick-your-path` and the live opt-in button), and
  YouTube alerts.
- **Carl-bot:** automod, warnings and escalation, mute/timeout, kick, ban, purge,
  raid protection, and logging.

Keep them split so they never fight each other. Do NOT set up reaction roles,
YouTube feeds, or a second XP system in Carl-bot.

Why Carl-bot: free, battle tested, with full automod, an escalation ladder, mod
logs, per user history, and raid mode. Alternatives: Dyno is similar; Wick is the
strongest for anti raid and anti nuke. You can run Carl-bot for day to day
moderation and add Wick purely as a raid and nuke guard (see section 6).

## 1. Prep the server
1. Run `/setup` in Discord first. It creates the `⚙ Admin` and `🛡 Mod` roles and a
   private `#staff-chat` and `#mod-log` (both hidden from members) that Carl-bot
   will use.

## 2. Invite Carl-bot
1. Go to carl.gg, sign in, and add Carl-bot to the Dollar Vibe Club server.
2. Give it permissions to do its job: Manage Roles, Manage Channels, Manage
   Messages, Kick Members, Ban Members, Moderate Members (timeout), Manage Server,
   View Channels, Send Messages, Read Message History. Administrator also works.
3. Role hierarchy matters: drag the **Carl-bot role above every role it needs to
   action** (above Member, Vibecoder, Freelancer, Creator, etc.) but you can keep
   it below `⚙ Admin`. A bot can only timeout, kick, or ban roles below its own.

## 3. Command permissions
- In the Carl-bot dashboard, restrict moderation commands to `⚙ Admin` and `🛡 Mod`
  only.
- Pick a prefix (default `?`) or use Carl-bot slash commands.

## 4. Automod  (P0: spam, links, invites, mention spam, caps, blacklist)
Dashboard, Automod. Turn on each module and give it an action. Exempt `⚙ Admin` and
`🛡 Mod` from all automod.
- **Spam / flood:** cap messages per few seconds, plus repeated and duplicate text.
  Action: delete and timeout.
- **Mention spam:** max user and role mentions per message (for example 4). A mass
  mention (for example 8 or more) escalates to a longer timeout.
- **Links:** either block all links or allow a whitelist (your domains, the DVC
  site, youtube.com). Action: delete, optional warn.
- **Invites:** block other servers' Discord invites. Action: delete and warn.
- **Caps:** messages over about 70 percent capitals and longer than N characters.
  Action: delete or warn.
- **Word / phrase blacklist:** add slurs, scam phrases, and banned words. Carl-bot
  supports wildcards and regex. Action: delete and warn or timeout.
- Optional extras: newline, emoji, and sticker spam, and zalgo text.

## 5. Warnings and escalation  (P0: warn system with escalation)
- Manual: `?warn @user reason`, review `?warnings @user`, remove `?delwarn`.
- Set the escalation ladder in the dashboard so punishments stack automatically,
  for example:
  - 3 warnings, 10 minute timeout
  - 5 warnings, 1 hour timeout
  - 7 warnings, kick
  - 10 warnings, ban
- Configure automod violations to auto issue a warning so the ladder runs itself.

## 6. Mute, kick, ban, purge  (P0 actions)
- Timeout (mute): `?mute @user 1h reason` or `?timeout`. Uses Discord native
  timeout. Add a Muted role too if you want channel level muting.
- Kick: `?kick @user reason`.
- Ban: `?ban @user reason`, plus `?softban` and `?tempban 7d`. Reverse with
  `?unban`.
- Purge: `?clean <n>` or `?purge <n>`, plus `?purge user @user` and `?purge bots`.

## 7. Raid detection and lockdown  (P0: raid detection and lockdown)
- Dashboard, Raid Mode / Anti raid: enable join rate detection (for example X joins
  in Y seconds triggers an action), and set the action (timeout, kick, or ban new
  joiners, or auto enable raid mode).
- Join gate: require a minimum account age and a Discord verification level. Hold
  new joins for verification if you want a stricter gate.
- Manual: `?lockdown` to lock channels and `?raidmode on/off`.
- For serious protection against mass ban or mass channel delete (a rogue or
  compromised admin), add **Wick** alongside Carl-bot and enable its anti nuke and
  raid modules. Carl-bot does not guard against that on its own.

## 8. Logging  (P0: mod action logging)
- Dashboard, Logging: set the log channel to `#mod-log` (created by `/setup`,
  staff only).
- Log: message deletes and edits, bulk deletes, joins and leaves, role and nickname
  changes, bans, unbans, kicks, timeouts, and mod command usage.
- If it gets noisy, split mod actions into `#mod-log` and member and message events
  into a separate audit channel.

## 9. Per user history  (P0: per-user history)
- `?warnings @user` for warnings, `?modlogs @user` (or the dashboard user lookup)
  for the full action history.
- Add private staff notes with `?note @user ...`.

## 10. Keep Carl-bot out of the DVC bot's lane
- Reaction roles: the DVC bot owns `#pick-your-path` and the live opt-in button. Do
  not recreate these in Carl-bot.
- YouTube and live alerts: the DVC bot owns these. Do not add YouTube feeds in
  Carl-bot.
- XP and leveling: the DVC bot plus the website own this. Turn OFF any Carl-bot
  leveling so there is no competing XP.

## Quick checklist
- [ ] `/setup` run, so the roles and `#staff-chat` plus `#mod-log` exist
- [ ] Carl-bot invited, role above members and below Admin
- [ ] Mod commands limited to Admin and Mod
- [ ] Automod on: spam, mentions, links, invites, caps, blacklist, with Admin and Mod exempt
- [ ] Warning escalation ladder set
- [ ] Raid mode and join gate configured (add Wick for anti nuke if wanted)
- [ ] Logging pointed at `#mod-log`
- [ ] Carl-bot leveling, reaction roles, and YouTube left OFF
