require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
  REST,
  Routes,
  EmbedBuilder,
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { stmts } = require('./utils/database');
const { addMessageXP } = require('./utils/xp');
const { checkAndNotify } = require('./utils/youtube');
const serverConfig = require('./data/server-config.json');

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
  console.log('┃ ⚡ TommyYipXYZ Hub Bot');
  console.log(`┃ Logged in as ${client.user.tag}`);
  console.log(`┃ Serving ${client.guilds.cache.size} server(s)`);
  console.log('');

  await registerCommands();

  // YouTube check every 3 minutes
  if (process.env.YOUTUBE_CHANNEL_ID) {
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
    console.log(`┃ Watching channel: ${process.env.YOUTUBE_CHANNEL_ID}`);
  } else {
    console.log('┃ ⚠ No YOUTUBE_CHANNEL_ID set — YouTube notifications disabled');
  }

  console.log('┃ Ready!\n');
});

// ─── EVENT: SLASH COMMANDS ───
client.on('interactionCreate', async (interaction) => {
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

  const embed = new EmbedBuilder()
    .setColor('#9b59b6')
    .setTitle(`Welcome, ${member.displayName}! 👋`)
    .setDescription(
      [
        `Hey ${member}, welcome to **TommyYipXYZ's Hub**!`,
        '',
        '```',
        '┃ Read the rules',
        '┃ Pick your path — grab your roles',
        '┃ Introduce yourself',
        '┃ Start building',
        '```',
        '',
        `You're member **#${member.guild.memberCount}** — let's get it.`,
      ].join('\n')
    )
    .setThumbnail(member.displayAvatarURL({ size: 256 }))
    .setFooter({ text: "TommyYipXYZ's Hub ┃ Learn. Build. Earn." });

  await channel.send({ embeds: [embed] });
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
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  const result = addMessageXP(message.author.id, message.guild.id);

  if (result?.leveledUp) {
    const settings = stmts.getSettings.get(message.guild.id);
    const channelId = settings?.xp_announce_channel_id || message.channelId;
    const channel = await message.guild.channels.fetch(channelId).catch(() => message.channel);

    const embed = new EmbedBuilder()
      .setColor('#2ecc71')
      .setDescription(`⚡ **${message.author.displayName}** just reached **Level ${result.newLevel}**!`);

    await channel.send({ embeds: [embed] }).catch(() => {});
  }
});

// ─── START ───
client.login(process.env.DISCORD_TOKEN);
