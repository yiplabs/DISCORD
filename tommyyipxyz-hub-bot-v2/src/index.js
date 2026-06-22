require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
  REST,
  Routes,
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { stmts } = require('./utils/database');
const dvcApi = require('./utils/dvcApi');
const { checkAndNotify, getWatchedChannels } = require('./utils/youtube');
const serverConfig = require('./data/server-config.json');
const {
  COLORS,
  V2_FLAGS,
  ContainerBuilder,
  text,
  separator,
  thumbnailSection,
  banneredContainer,
  v2Payload,
} = require('./utils/components');
const { TOGGLE_ID, handleToggle } = require('./utils/liveNotify');

// ─── CLIENT SETUP ───
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// ─── LOAD COMMANDS ───
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'));

const commands = [];
for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  client.commands.set(command.data.name, command);
  commands.push(command.data.toJSON());
}

// ─── REGISTER SLASH COMMANDS (per-guild for instant updates) ───
async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    console.log('[Bot] Registering slash commands...');
    for (const guild of client.guilds.cache.values()) {
      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, guild.id),
        { body: commands }
      );
      console.log(`[Bot] ${commands.length} slash commands registered for guild: ${guild.name}`);
    }
  } catch (err) {
    console.error('[Bot] Failed to register commands:', err);
  }
}

// ─── EVENT: READY ───
client.once('ready', async () => {
  console.log('');
  console.log('┃ ⚡ Dollar Vibe Club Bot');
  console.log(`┃ Logged in as ${client.user.tag}`);
  console.log(`┃ Serving ${client.guilds.cache.size} server(s)`);
  console.log('');

  await registerCommands();

  // YouTube check every 3 minutes
  const watchedChannels = getWatchedChannels();
  if (watchedChannels.length > 0) {
    // Run once on startup
    setTimeout(async () => {
      for (const guild of client.guilds.cache.values()) {
        await checkAndNotify(client, guild.id);
      }
    }, 10_000); // 10s after boot

    // Then every 3 minutes
    cron.schedule('*/3 * * * *', async () => {
      for (const guild of client.guilds.cache.values()) {
        await checkAndNotify(client, guild.id);
      }
    });
    console.log('┃ YouTube checker started (every 3 min)');
    for (const c of watchedChannels) {
      console.log(`┃ Watching @${c.handle} (${c.channelId || 'id resolved at runtime'})`);
    }
  } else {
    console.log('┃ ⚠ No YouTube channels configured — YouTube notifications disabled');
  }

  console.log('┃ Ready!\n');
});

// ─── EVENT: SLASH COMMANDS ───
client.on('interactionCreate', async (interaction) => {
  // Opt-in button under stream/video posts and on the standing panel.
  if (interaction.isButton()) {
    if (interaction.customId === TOGGLE_ID) {
      try {
        await handleToggle(interaction);
      } catch (err) {
        console.error('[Bot] Live notify toggle error:', err);
      }
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`[Bot] Command error (${interaction.commandName}):`, err);
    const reply = {
      content: 'Something went wrong running that command.',
      ephemeral: true,
    };
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply(reply).catch(() => {});
    } else {
      await interaction.reply(reply).catch(() => {});
    }
  }
});

// ─── EVENT: NEW MEMBER (WELCOME) ───
client.on('guildMemberAdd', async (member) => {
  const settings = stmts.getSettings.get(member.guild.id);
  if (!settings?.welcome_channel_id) return;

  const channel = await member.guild.channels.fetch(settings.welcome_channel_id).catch(() => null);
  if (!channel) return;

  // Auto-assign Member role
  const memberRole = member.guild.roles.cache.find((r) => r.name === '── Member ──');
  if (memberRole) {
    await member.roles.add(memberRole).catch(() => {});
  }

  const { container, art } = banneredContainer(COLORS.brand, 'welcome');
  container
    .addSectionComponents(
      thumbnailSection(
        [
          `## Welcome, ${member.displayName}! 👋`,
          '',
          `Hey ${member}, welcome to **Dollar Vibe Club**!`,
        ].join('\n'),
        member.displayAvatarURL({ size: 256 })
      )
    )
    .addSeparatorComponents(separator())
    .addTextDisplayComponents(
      text(
        [
          '```',
          '┃ Read the rules',
          '┃ Pick your path, grab your roles',
          '┃ Introduce yourself',
          '┃ Start building',
          '```',
          '',
          `You're member **#${member.guild.memberCount}**, let's get it.`,
        ].join('\n')
      )
    )
    .addSeparatorComponents(separator())
    .addTextDisplayComponents(text("-# Dollar Vibe Club ┃ Learn. Build. Earn."));

  await channel.send(v2Payload(container, art, { allowedMentions: { parse: [] } }));
});

// ─── EVENT: REACTION ROLES ───
client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot) return;

  if (reaction.partial) await reaction.fetch().catch(() => {});
  if (reaction.message.partial) await reaction.message.fetch().catch(() => {});

  const settings = stmts.getSettings.get(reaction.message.guildId);
  if (!settings?.role_react_message_id) return;
  if (reaction.message.id !== settings.role_react_message_id) return;

  const emoji = reaction.emoji.name;
  const roleName = serverConfig.roleReactions.reactions[emoji];
  if (!roleName) return;

  const guild = reaction.message.guild;
  const role = guild.roles.cache.find((r) => r.name === roleName);
  if (!role) return;

  const member = await guild.members.fetch(user.id).catch(() => null);
  if (member) {
    await member.roles.add(role).catch(() => {});
  }
});

client.on('messageReactionRemove', async (reaction, user) => {
  if (user.bot) return;

  if (reaction.partial) await reaction.fetch().catch(() => {});
  if (reaction.message.partial) await reaction.message.fetch().catch(() => {});

  const settings = stmts.getSettings.get(reaction.message.guildId);
  if (!settings?.role_react_message_id) return;
  if (reaction.message.id !== settings.role_react_message_id) return;

  const emoji = reaction.emoji.name;
  const roleName = serverConfig.roleReactions.reactions[emoji];
  if (!roleName) return;

  const guild = reaction.message.guild;
  const role = guild.roles.cache.find((r) => r.name === roleName);
  if (!role) return;

  const member = await guild.members.fetch(user.id).catch(() => null);
  if (member) {
    await member.roles.remove(role).catch(() => {});
  }
});

// ─── EVENT: XP ON MESSAGE ───
// XP is awarded by the DVC website through its API. We only POST one event per
// minute per user (our own anti-spam); the website applies values, caps, the
// streak multiplier, and the level math, then tells us what actually happened.
const MESSAGE_XP_COOLDOWN_MS = 60_000;
const UNLINKED_NUDGE_MS = 24 * 60 * 60 * 1000;
const lastMessageXp = new Map(); // discordId -> timestamp ms
const lastUnlinkedNudge = new Map(); // discordId -> timestamp ms

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;
  if (!dvcApi.isConfigured()) return;

  const userId = message.author.id;
  const now = Date.now();
  if (now - (lastMessageXp.get(userId) || 0) < MESSAGE_XP_COOLDOWN_MS) return;
  lastMessageXp.set(userId, now);

  const res = await dvcApi.awardXp({
    discordId: userId,
    source: 'discord_message',
    dedupeKey: `discord_msg:${message.id}`,
    metadata: {
      guild_id: message.guild.id,
      channel_id: message.channelId,
      message_id: message.id,
    },
  });

  if (res.httpStatus !== 200) {
    if (res.httpStatus || res.error) {
      console.warn(`[XP] award failed: HTTP ${res.httpStatus}${res.error ? ` (${res.error})` : ''}`);
    }
    return;
  }

  // awarded | deduped | capped | ineligible | skipped | unlinked. Most are silent.
  if (res.status === 'awarded' && res.leveled_up) {
    const settings = stmts.getSettings.get(message.guild.id);
    const channelId = settings?.xp_announce_channel_id || message.channelId;
    const channel = await message.guild.channels.fetch(channelId).catch(() => message.channel);

    const container = new ContainerBuilder()
      .setAccentColor(COLORS.success)
      .addTextDisplayComponents(
        text(`⚡ **${message.author.displayName}** reached **Level ${res.new_level}** ┃ ${res.level_name}`)
      );

    await channel.send({ components: [container], flags: V2_FLAGS }).catch(() => {});
  } else if (res.status === 'unlinked') {
    await nudgeUnlinked(message.author);
  }
});

// Gentle, opt-in reminder to link. Only fires if a link URL is configured, and at
// most once per day per user. XP keeps being parked either way, so this never blocks.
async function nudgeUnlinked(user) {
  const url = dvcApi.linkUrl();
  if (!url) return;

  const now = Date.now();
  if (now - (lastUnlinkedNudge.get(user.id) || 0) < UNLINKED_NUDGE_MS) return;
  lastUnlinkedNudge.set(user.id, now);

  await user
    .send(
      [
        'Heads up: your Discord is not linked to Dollar Vibe Club yet, so your XP is being saved but not counted on the leaderboard.',
        `Link it here to start climbing: ${url}`,
      ].join('\n')
    )
    .catch(() => {});
}

// ─── START ───
client.login(process.env.DISCORD_TOKEN);
