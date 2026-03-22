const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
} = require('discord.js');
const serverConfig = require('../data/server-config.json');
const { stmts } = require('../utils/database');

// Map permission strings to discord.js flags
const PERM_MAP = {
  Administrator: PermissionFlagsBits.Administrator,
  ManageMessages: PermissionFlagsBits.ManageMessages,
  KickMembers: PermissionFlagsBits.KickMembers,
  BanMembers: PermissionFlagsBits.BanMembers,
  MuteMembers: PermissionFlagsBits.MuteMembers,
  ManageNicknames: PermissionFlagsBits.ManageNicknames,
  ManageThreads: PermissionFlagsBits.ManageThreads,
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Set up the entire TommyYipXYZ Hub server (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild;
    if (!guild) return interaction.editReply('This command only works in a server.');

    let status = '🔄 Starting server setup...\n';
    const updateStatus = async (msg) => {
      status += msg + '\n';
      await interaction.editReply(status).catch(() => {});
    };

    try {
      // ─── 1. CREATE ROLES ───
      await updateStatus('⬥ Creating roles...');
      const createdRoles = {};

      for (const roleData of serverConfig.roles) {
        // Check if role already exists
        let role = guild.roles.cache.find((r) => r.name === roleData.name);
        if (!role) {
          const perms = roleData.permissions.map((p) => PERM_MAP[p]).filter(Boolean);
          role = await guild.roles.create({
            name: roleData.name,
            color: roleData.color,
            permissions: perms,
            hoist: roleData.hoist,
            mentionable: roleData.mentionable,
            reason: 'TommyYipXYZ Hub setup',
          });
        }
        createdRoles[roleData.name] = role;
      }
      await updateStatus(`  ✓ ${Object.keys(createdRoles).length} roles ready`);

      // ─── 2. CREATE CATEGORIES & CHANNELS ───
      await updateStatus('⬥ Creating channels...');
      const createdChannels = {};
      let channelCount = 0;

      for (const category of serverConfig.categories) {
        // Check if category exists
        let cat = guild.channels.cache.find(
          (c) => c.name === category.name && c.type === ChannelType.GuildCategory
        );
        if (!cat) {
          cat = await guild.channels.create({
            name: category.name,
            type: ChannelType.GuildCategory,
            reason: 'TommyYipXYZ Hub setup',
          });
        }

        for (const ch of category.channels) {
          // Check if channel already exists in this category
          const channelType = ch.type === 'voice' ? ChannelType.GuildVoice : ChannelType.GuildText;
          let channel = guild.channels.cache.find(
            (c) => c.name === ch.name.toLowerCase().replace(/\s+/g, '-') && c.parentId === cat.id
          );

          if (!channel) {
            const options = {
              name: ch.name,
              type: channelType,
              parent: cat.id,
              topic: ch.topic || null,
              reason: 'TommyYipXYZ Hub setup',
            };

            // Set read-only permissions
            if (ch.readonly) {
              options.permissionOverwrites = [
                {
                  id: guild.roles.everyone.id,
                  deny: [PermissionFlagsBits.SendMessages],
                  allow: [PermissionFlagsBits.ViewChannel],
                },
                {
                  id: interaction.client.user.id,
                  allow: [PermissionFlagsBits.SendMessages],
                },
              ];
            }

            channel = await guild.channels.create(options);
            channelCount++;
          }

          createdChannels[ch.name] = channel;
        }
      }
      await updateStatus(`  ✓ ${channelCount} channels created`);

      // ─── 3. POST RULES ───
      await updateStatus('⬥ Posting rules...');
      const rulesChannel = createdChannels['rules'];
      if (rulesChannel) {
        // Clear existing bot messages
        const existingMsgs = await rulesChannel.messages.fetch({ limit: 10 });
        const botMsgs = existingMsgs.filter((m) => m.author.id === interaction.client.user.id);
        for (const msg of botMsgs.values()) {
          await msg.delete().catch(() => {});
        }

        const rulesEmbed = new EmbedBuilder()
          .setColor('#9b59b6')
          .setTitle('📜 Server Rules')
          .setDescription(serverConfig.rules.join('\n\n'))
          .setFooter({ text: "TommyYipXYZ's Hub — Read, respect, build." });

        await rulesChannel.send({ embeds: [rulesEmbed] });
        await updateStatus('  ✓ Rules posted');
      }

      // ─── 4. POST ROLE REACTIONS ───
      await updateStatus('⬥ Setting up role reactions...');
      const roleReactChannel = createdChannels['pick-your-path'];
      if (roleReactChannel) {
        const existingMsgs = await roleReactChannel.messages.fetch({ limit: 10 });
        const botMsgs = existingMsgs.filter((m) => m.author.id === interaction.client.user.id);
        for (const msg of botMsgs.values()) {
          await msg.delete().catch(() => {});
        }

        const roleEmbed = new EmbedBuilder()
          .setColor('#9b59b6')
          .setTitle('🎯 Pick Your Path')
          .setDescription(serverConfig.roleReactions.message)
          .setFooter({ text: 'React below to grab your roles!' });

        const roleMsg = await roleReactChannel.send({ embeds: [roleEmbed] });

        // Add reactions
        for (const emoji of Object.keys(serverConfig.roleReactions.reactions)) {
          await roleMsg.react(emoji);
        }

        // Save message ID for reaction tracking
        const settings = stmts.getSettings.get(guild.id) || {};
        stmts.upsertSettings.run({
          guild_id: guild.id,
          welcome_channel_id: createdChannels['chat']?.id || null,
          rules_channel_id: rulesChannel?.id || null,
          role_react_channel_id: roleReactChannel?.id || null,
          role_react_message_id: roleMsg.id,
          youtube_notify_channel_id: createdChannels['stream-chat']?.id || null,
          last_youtube_video_id: settings.last_youtube_video_id || null,
          xp_announce_channel_id: createdChannels['chat']?.id || null,
        });

        await updateStatus('  ✓ Role reactions set up');
      }

      // ─── 5. POST WELCOME INFO ───
      await updateStatus('⬥ Setting up welcome channel...');
      const howItWorksChannel = createdChannels['how-it-works'];
      if (howItWorksChannel) {
        const existingMsgs = await howItWorksChannel.messages.fetch({ limit: 10 });
        const botMsgs = existingMsgs.filter((m) => m.author.id === interaction.client.user.id);
        for (const msg of botMsgs.values()) {
          await msg.delete().catch(() => {});
        }

        const embed = new EmbedBuilder()
          .setColor('#9b59b6')
          .setTitle("Welcome to TommyYipXYZ's Hub 🚀")
          .setDescription(
            [
              'This is a community of **builders, vibecoders, and hustlers** making money online.',
              '',
              '**How this works:**',
              '',
              '⬥ **THE LOBBY** — hang out, introduce yourself, share wins',
              '⬥ **THE LAB** — build stuff, share projects, get help',
              '⬥ **THE BAG** — money strategies, freelancing, SaaS, side hustles',
              '⬥ **LIVE** — stream chat, events, and collabs',
              '⬥ **VOICE** — co-working rooms, hangouts, screen sharing',
              '',
              '**Get started:**',
              '1. Read the rules',
              '2. Pick your path (grab your roles)',
              '3. Say hi in introductions',
              '4. Start building 🔨',
            ].join('\n')
          )
          .setFooter({ text: 'Learn. Build. Earn.' });

        await howItWorksChannel.send({ embeds: [embed] });
        await updateStatus('  ✓ How-it-works posted');
      }

      // ─── DONE ───
      await updateStatus('\n✅ **Server setup complete!** Your Hub is ready to go.');
      await updateStatus(
        '\n📝 **Next steps:**\n' +
          '• Invite your first members\n' +
          '• Set your YouTube Channel ID in the .env file\n' +
          '• The bot will auto-welcome members, track XP, and notify on new videos'
      );
    } catch (err) {
      console.error('[Setup] Error:', err);
      await updateStatus(`\n❌ Error: ${err.message}`);
    }
  },
};
