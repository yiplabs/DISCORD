require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  Collection,
  REST,
  Routes,
  EmbedBuilder,
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { checkAndNotify, getWatchedChannels } = require('./utils/youtube');
const {
  isConfiguredGuild,
  validateRuntimeEnvironment,
} = require('./utils/config');
const {
  createDvcApi,
  createDvcXpService,
  isDvcApiConfigured,
} = require('./utils/dvc-api');
validateRuntimeEnvironment();

// ─── CLIENT SETUP ───
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
});

const dvcApi = isDvcApiConfigured() ? createDvcApi() : null;
const dvcXpService = dvcApi ? createDvcXpService({ api: dvcApi }) : null;
client.dvcApi = dvcApi;

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
      if (!isConfiguredGuild(guild.id)) continue;
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

async function checkYoutubeForConfiguredGuilds() {
  for (const guild of client.guilds.cache.values()) {
    if (!isConfiguredGuild(guild.id)) continue;

    try {
      await checkAndNotify(client, guild.id);
    } catch (error) {
      console.error(
        `[YouTube] Check failed for guild ${guild.id}: ${error.message}`
      );
    }
  }
}

// ─── EVENT: READY ───
client.once('clientReady', async () => {
  console.log('');
  console.log('┃ ⚡ Dollar Vibe Club Bot');
  console.log(`┃ Logged in as ${client.user.tag}`);
  console.log(`┃ Serving ${client.guilds.cache.size} server(s)`);
  console.log(
    dvcApi
      ? '┃ DVC account + XP bridge connected'
      : '┃ DVC account + XP bridge not configured (XP disabled)'
  );
  console.log('');

  await registerCommands();

  // YouTube check every 3 minutes
  const watchedChannels = getWatchedChannels();
  if (watchedChannels.length > 0) {
    // Run once on startup
    setTimeout(() => {
      void checkYoutubeForConfiguredGuilds();
    }, 10_000); // 10s after boot

    // Then every 3 minutes
    cron.schedule('*/3 * * * *', () => {
      void checkYoutubeForConfiguredGuilds();
    });
    console.log('┃ YouTube checker started (every 3 min)');
    for (const c of watchedChannels) {
      console.log(`┃ Watching @${c.handle} (${c.channelId})`);
    }
  } else {
    console.log('┃ ⚠ No YouTube channels configured — YouTube notifications disabled');
  }

  console.log('┃ Ready!\n');
});

// ─── EVENT: SLASH COMMANDS ───
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (!isConfiguredGuild(interaction.guildId)) {
    return interaction.reply({
      content: 'This bot is configured only for Dollar Vibe Club.',
      ephemeral: true,
    });
  }

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

// ─── EVENT: XP ON MESSAGE ───
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;
  if (!isConfiguredGuild(message.guild.id)) return;

  if (dvcXpService) {
    try {
      const result = await dvcXpService.awardMessage({
        discordId: message.author.id,
        guildId: message.guild.id,
        channelId: message.channelId,
        messageId: message.id,
      });

      if (result.leveled_up) {
        const embed = new EmbedBuilder()
          .setColor('#2ecc71')
          .setTitle('⚡ DVC Rank Up')
          .setDescription(
            `**${message.author.displayName}** reached **${result.level_name} · Level ${result.new_level}**!`
          )
          .setFooter({
            text: 'Progress is shared with your Dollar Vibe Club account',
          });
        await message.channel.send({ embeds: [embed] }).catch(() => {});
      }
    } catch (error) {
      console.error(`[DVC XP] Award failed: ${error.message}`);
    }
    return;
  }
});

// ─── START ───
client.login(process.env.DISCORD_TOKEN);
