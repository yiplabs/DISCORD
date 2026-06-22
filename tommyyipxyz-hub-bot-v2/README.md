# Dollar Vibe Club Bot 🚀

A custom Discord bot that sets up your entire server in one command and runs your community — welcome messages, XP/leveling, role reactions, and YouTube stream notifications.

---

## What it does

| Feature | Description |
|---------|-------------|
| `/setup` | Creates ALL categories, channels, roles, rules, and role reactions in one shot |
| Welcome system | Auto-welcomes new members with an embed + assigns the Member role |
| Role reactions | Members react in #pick-your-path to get Vibecoder, Freelancer, or Creator roles |
| XP & Leveling | Synced with the Dollar Vibe Club website: chatting earns XP into your shared DVC total and leaderboard |
| `/rank` | Check your level, XP, rank, and progress bar |
| `/leaderboard` | See the top 10 members by XP |
| YouTube notifications | Checks your channel every 5 min via RSS (free, no API key needed) |

---

## Quick start (15 minutes)

### Step 1: Create a Discord Bot

1. Go to [discord.com/developers/applications](https://discord.com/developers/applications)
2. Click **"New Application"** → name it `Dollar Vibe Club Bot`
3. Go to the **Bot** tab:
   - Click **"Reset Token"** → copy the token (you'll need this)
   - Enable **ALL 3 Privileged Intents**:
     - ✅ Presence Intent
     - ✅ Server Members Intent
     - ✅ Message Content Intent
4. Go to the **OAuth2** tab → copy the **Client ID**

### Step 2: Invite the bot to your server

Build your invite URL:
```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=8&scope=bot%20applications.commands
```
Replace `YOUR_CLIENT_ID` with your actual Client ID. The `permissions=8` gives Administrator (needed for /setup to create channels and roles).

### Step 3: Set up the project

**Option A: Railway (recommended — free $5/mo credit, always on)**
1. Push this code to a GitHub repo
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub repo
3. Add environment variables in Railway dashboard (see `.env.example`)
4. Railway auto-deploys on every push

**Option B: Run locally**
```bash
# Clone/download this project
cd tommyyipxyz-hub-bot-v2

# Install dependencies
npm install

# Copy .env.example to .env and fill in your values
cp .env.example .env

# Edit .env with your bot token and client ID
nano .env  # or open in any editor

# Start the bot
npm start
```

### Step 4: Run /setup in your server

1. Go to any channel in your Discord server
2. Type `/setup`
3. Wait ~30 seconds
4. Your entire server is built — categories, channels, roles, rules, role reactions, everything

---

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DISCORD_TOKEN` | ✅ | Bot token from Discord Developer Portal |
| `CLIENT_ID` | ✅ | OAuth2 Client ID from Discord Developer Portal |
| `YOUTUBE_CHANNEL_ID` | Optional | Your YouTube channel ID (enables video notifications) |
| `YOUTUBE_API_KEY` | No | Not needed — uses free RSS feed |
| `DVC_API_BASE` | For XP | Base URL of the DVC website that awards XP |
| `DISCORD_BOT_XP_SECRET` | For XP | Shared secret, must match the value set on the DVC web server |
| `DVC_LINK_URL` | Optional | "Link Discord" page URL, used by `/rank` and the once a day link reminder |

---

## Server structure created by /setup

```
⬥ START HERE
  ┃ rules (read-only, auto-posted)
  ┃ how-it-works (read-only, auto-posted)
  ┃ pick-your-path (read-only, role reactions)

⬥ THE LOBBY
  ┃ chat
  ┃ introductions
  ┃ daily-wins

⬥ THE LAB
  ┃ build-log
  ┃ show-your-work
  ┃ need-a-hand
  ┃ tools-and-stacks

⬥ THE BAG
  ┃ money-talk
  ┃ freelance-game
  ┃ saas-and-flips
  ┃ side-quests

⬥ LIVE
  ┃ stream-chat (YouTube notifications go here)
  ┃ upcoming (read-only)
  ┃ collabs

⬥ VOICE
  ┃ Deep Work
  ┃ The Lounge
  ┃ Screen Share

⬥ BOT STUFF
  ┃ commands
  ┃ suggestions
```

**Roles created:** Admin, Mod, OG, Builder, Vibecoder, Freelancer, Creator, Stream Regular, Member

---

## XP System

XP is shared with the Dollar Vibe Club website. Chatting in Discord and posting or joining events on the site both earn XP into one total, shown on one leaderboard in both places. The website owns all the rules (per action values, daily caps, the streak multiplier, and the level math); the bot just reports events and shows results.

- Chatting earns XP into your DVC total. The website sets the value and the daily cap.
- One message per minute counts (the bot's own anti spam).
- Link your Discord on the DVC website so your XP counts toward the leaderboard. Until you link, your XP is saved and credited automatically the moment you link.
- Levels and rank names come from the website, so Discord and the site always agree.
- `/rank` and `/leaderboard` read from the shared total. Run `npm run backfill` once to migrate any pre existing local XP.

---

## Customizing

### Change the server layout
Edit `src/data/server-config.json` — the entire server structure is defined there. Change channel names, add categories, modify roles, update rules. Run `/setup` again to apply changes (it won't duplicate existing channels/roles).

### Add new commands
Create a new file in `src/commands/` following the pattern:
```javascript
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('yourcommand')
    .setDescription('What it does'),

  async execute(interaction) {
    await interaction.reply('Hello!');
  },
};
```
The bot auto-discovers any `.js` file in the commands folder.

---

## Hosting on Railway (step by step)

1. Create a GitHub repo and push this project
2. Sign up at [railway.app](https://railway.app)
3. Click **"New Project"** → **"Deploy from GitHub repo"**
4. Select your repo
5. Go to the **Variables** tab → add:
   - `DISCORD_TOKEN` = your bot token
   - `CLIENT_ID` = your client ID
   - `YOUTUBE_CHANNEL_ID` = your YouTube channel ID (optional)
6. Railway auto-builds and deploys
7. Your bot is now running 24/7 for free (within the $5/mo credit)

---

## License

MIT — do whatever you want with it.
