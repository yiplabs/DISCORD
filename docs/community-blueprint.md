# Dollar Vibe Club Discord Community Blueprint

This blueprint turns the bot into a focused bridge between the DVC website and
Discord. It favors native Discord features, contribution quality, and a small
set of excellent interactions over a large generic command list.

## Experience principles

1. One identity: Discord user ID links to the existing DVC profile.
2. One progress ledger: DVC Postgres is authoritative for XP, levels, and rank.
3. Native first: use Discord Community Onboarding, Rules Screening, AutoMod,
   Scheduled Events, forums, and Linked Roles where they fit.
4. Reward contribution: recognize shipping, helping, and hosting—not raw spam.
5. Safe by default: one guild, least privilege, no destructive setup, no default
   mass mentions, and read-only diagnostics before changes.

## Front door

Use Discord Community Onboarding with these default channels:

- `#start-here`
- `#announcements`
- `#general`
- `#introductions`
- `#build-showcase`
- `#build-help`
- `#events`

Suggested onboarding questions:

- What are you here to do? Build, learn, collaborate, find collaborators.
- What are you building? AI, web, mobile, ecommerce, design.
- Where are you now? Exploring, shipping, scaling.
- Which updates do you want? Coworking, demo days, challenges.

The bot follows native onboarding with private `/start` guidance and a direct
button to the existing DVC Discord-link flow.

## Community flywheels

### Build help

Use a Discord forum for `#build-help`, with tags such as AI, Web, Product,
Design, and Growth. Add accepted answers and a Solved tag so good support
becomes searchable community knowledge.

### Show-and-ship

Keep `/showcase`, then award evidence-backed DVC recognition for a shipped
project. Later phases can add `Helpful`, `Shipped`, and `Hosted` reputation
events tied to the source message instead of increasing chat XP.

### Events

Make Discord Scheduled Events the canonical record for coworking, demo days,
and challenges. Add RSVP states, waitlists, reminders, and a recap workflow
only after the base event flow is stable.

### DVC status

Use native Discord Linked Roles after the XP bridge is proven. Candidate
metadata includes active membership, DVC level, current streak, or an earned
builder badge.

## Operational baseline

- Run `/doctor` before and after deployments.
- Replace Administrator with the exact permissions the bot needs.
- Keep giveaways limited to members with Manage Server.
- Keep Message Content intent disabled.
- Keep uploads quiet by default; use an opt-in role if notification pings are
  desired.
- Use native AutoMod and Raid Protection before adding custom moderation.
- Keep moderation evidence and actions private, attributable, and durable.
- Never store Discord tokens, webhooks, DVC service secrets, or message bodies
  in logs.

## Public references reviewed

- [Discord example app](https://github.com/discord/discord-example-app) — MIT
- [Python Discord bot](https://github.com/python-discord/bot) — MIT
- [Answer Overflow](https://github.com/AnswerOverflow/AnswerOverflow) — MIT
- [YAGPDB](https://github.com/botlabs-gg/yagpdb) — MIT
- [Skyra](https://github.com/skyra-project/skyra) — Apache-2.0
- [Discord Components](https://docs.discord.com/developers/components/reference)
- [Discord permissions](https://docs.discord.com/developers/topics/permissions)
- [Discord Auto Moderation](https://docs.discord.com/developers/resources/auto-moderation)
- [Discord Linked Roles](https://docs.discord.com/developers/resources/application-role-connection-metadata)

GPL, AGPL, Elastic License, stale, and unlicensed projects were used only as
interaction-pattern references. No source or branding was copied from them.
