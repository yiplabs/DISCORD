const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');
const serverConfig = require('../data/server-config.json');
const { stmts } = require('../utils/database');
const { COLORS, V2_FLAGS, ContainerBuilder, text, separator } = require('../utils/components');

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
    .setDescription('Wipe and rebuild the entire Dollar Vibe Club server (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild;
    if (!guild) return interaction.editReply('This command only works in a server.');

    let status = '```\n⚡ Dollar Vibe Club Setup\n────────────────────────\n```\n';
    const updateStatus = async (msg) => {
      status += msg + '\n';
      await interaction.editReply(status).catch(() => {});
    };

    try {
      // ─── 0. DELETE ALL EXISTING CHANNELS ───
      await updateStatus('🗑️ **Clearing old channels...**');
      const existingChannels = guild.channels.cache.filter(
        (c) => c.id !== interaction.channelId // Don't delete the channel we're talking in
      );

      let deleted = 0;
      // Delete non-category channels first, then categories
      const nonCategories = existingChannels.filter((c) => c.type !== ChannelType.GuildCategory);
      const categories = existingChannels.filter((c) => c.type === ChannelType.GuildCategory);

      for (const [, channel] of nonCategories) {
        try {
          await channel.delete('Dollar Vibe Club setup, rebuilding server');
          deleted++;
        } catch (e) {
          // Skip channels we can't delete
        }
      }
      for (const [, channel] of categories) {
        try {
          await channel.delete('Dollar Vibe Club setup, rebuilding server');
          deleted++;
        } catch (e) {}
      }
      await updateStatus(`  ┃ Removed ${deleted} old channels`);

      // ─── 0b. DELETE OLD BOT-CREATED ROLES ───
      await updateStatus('🗑️ **Clearing old roles...**');
      const configRoleNames = serverConfig.roles.map((r) => r.name);
      const oldRoles = guild.roles.cache.filter(
        (r) => configRoleNames.includes(r.name) && !r.managed && r.id !== guild.roles.everyone.id
      );
      let rolesDeleted = 0;
      for (const [, role] of oldRoles) {
        try {
          await role.delete('Dollar Vibe Club setup, rebuilding');
          rolesDeleted++;
        } catch (e) {}
      }
      await updateStatus(`  ┃ Removed ${rolesDeleted} old roles`);

      // ─── 1. CREATE ROLES ───
      await updateStatus('\n⚙️ **Creating roles...**');
      const createdRoles = {};

      for (const roleData of serverConfig.roles) {
        const perms = roleData.permissions.map((p) => PERM_MAP[p]).filter(Boolean);
        const role = await guild.roles.create({
          name: roleData.name,
          color: roleData.color,
          permissions: perms,
          hoist: roleData.hoist,
          mentionable: roleData.mentionable,
          reason: 'Dollar Vibe Club setup',
        });
        createdRoles[roleData.name] = role;
      }
      await updateStatus(`  ┃ Created ${Object.keys(createdRoles).length} roles`);

      // ─── 2. CREATE CATEGORIES & CHANNELS ───
      await updateStatus('\n📂 **Building channels...**');
      const createdChannels = {};
      let channelCount = 0;

      for (const category of serverConfig.categories) {
        const cat = await guild.channels.create({
          name: category.name,
          type: ChannelType.GuildCategory,
          reason: 'Dollar Vibe Club setup',
        });

        for (const ch of category.channels) {
          const channelType = ch.type === 'voice' ? ChannelType.GuildVoice : ChannelType.GuildText;

          const options = {
            name: ch.name,
            type: channelType,
            parent: cat.id,
            topic: ch.topic || null,
            reason: 'Dollar Vibe Club setup',
          };

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

          const channel = await guild.channels.create(options);
          // Store by clean name (without ┃ prefix)
          const cleanName = ch.name.replace(/^┃\s?/, '').trim();
          createdChannels[cleanName] = channel;
          createdChannels[ch.name] = channel;
          channelCount++;
        }
      }
      await updateStatus(`  ┃ Created ${channelCount} channels`);

      // ─── 3. POST RULES ───
      await updateStatus('\n📜 **Posting rules...**');
      const rulesChannel = createdChannels['rules'] || createdChannels['┃rules'];
      if (rulesChannel) {
        const rulesContainer = new ContainerBuilder()
          .setAccentColor(COLORS.brand)
          .addTextDisplayComponents(text('# 📜 Server Rules'))
          .addTextDisplayComponents(
            text('Read these before you post. Breaking them gets you muted, kicked, or banned.')
          )
          .addSeparatorComponents(separator(true))
          .addTextDisplayComponents(text(serverConfig.rules.join('\n\n')))
          .addSeparatorComponents(separator())
          .addTextDisplayComponents(text("-# Dollar Vibe Club ┃ Read, respect, build."));

        await rulesChannel.send({ components: [rulesContainer], flags: V2_FLAGS });
        await updateStatus('  ┃ Rules posted');
      }

      // ─── 4. POST HOW IT WORKS ───
      const howChannel = createdChannels['how-it-works'] || createdChannels['┃how-it-works'];
      if (howChannel) {
        const howContainer = new ContainerBuilder()
          .setAccentColor(COLORS.brand)
          .addTextDisplayComponents(text("# ⚡ Welcome to Dollar Vibe Club"))
          .addTextDisplayComponents(
            text('A community of **builders, vibecoders, and hustlers** making money online.')
          )
          .addSeparatorComponents(separator(true))
          .addTextDisplayComponents(
            text(
              [
                '```',
                '┃ THE LOBBY    → hang out, introduce yourself, share wins',
                '┃ THE LAB      → build stuff, share projects, get help',
                '┃ THE BAG      → money strategies, freelancing, SaaS',
                '┃ LIVE         → stream chat, YouTube feed, collabs',
                '┃ VOICE        → co-working, hangouts, screen sharing',
                '```',
              ].join('\n')
            )
          )
          .addSeparatorComponents(separator())
          .addTextDisplayComponents(
            text(
              [
                '**Get started:**',
                '> 1. Read the rules',
                '> 2. Pick your path (grab your roles)',
                '> 3. Introduce yourself',
                '> 4. Start building 🔨',
              ].join('\n')
            )
          )
          .addSeparatorComponents(separator())
          .addTextDisplayComponents(text('-# Learn. Build. Earn.'));

        await howChannel.send({ components: [howContainer], flags: V2_FLAGS });
        await updateStatus('  ┃ How-it-works posted');
      }

      // ─── 5. POST ROLE REACTIONS ───
      await updateStatus('\n🎯 **Setting up role reactions...**');
      const roleReactChannel = createdChannels['pick-your-path'] || createdChannels['┃pick-your-path'];
      if (roleReactChannel) {
        const roleContainer = new ContainerBuilder()
          .setAccentColor(COLORS.brand)
          .addTextDisplayComponents(text('# 🎯 Pick Your Path'))
          .addSeparatorComponents(separator())
          .addTextDisplayComponents(text(serverConfig.roleReactions.message))
          .addSeparatorComponents(separator())
          .addTextDisplayComponents(text('-# React below to grab your roles!'));

        const roleMsg = await roleReactChannel.send({ components: [roleContainer], flags: V2_FLAGS });

        for (const emoji of Object.keys(serverConfig.roleReactions.reactions)) {
          await roleMsg.react(emoji);
        }

        // Save settings
        const youtubeChannel = createdChannels['announcements'] || createdChannels['┃announcements'];
        const chatChannel = createdChannels['chat'] || createdChannels['┃chat'];

        stmts.upsertSettings.run({
          guild_id: guild.id,
          welcome_channel_id: chatChannel?.id || null,
          rules_channel_id: rulesChannel?.id || null,
          role_react_channel_id: roleReactChannel?.id || null,
          role_react_message_id: roleMsg.id,
          youtube_notify_channel_id: youtubeChannel?.id || null,
          last_youtube_video_id: null,
          xp_announce_channel_id: chatChannel?.id || null,
        });

        await updateStatus('  ┃ Role reactions set up');
      }

      // ─── DONE ───
      await updateStatus('\n```\n✅ SERVER REBUILD COMPLETE\n────────────────────────\n```');
      await updateStatus(
        '**Next steps:**\n' +
          '> ┃ Invite your first members\n' +
          '> ┃ Set `YOUTUBE_CHANNEL_ID` in .env for auto stream posts\n' +
          '> ┃ Bot auto-welcomes, tracks XP, and posts YouTube uploads\n' +
          '> ┃ Use `/showcase` to post projects, `/giveaway` to run giveaways'
      );
    } catch (err) {
      console.error('[Setup] Error:', err);
      await updateStatus(`\n❌ Error: ${err.message}`);
    }
  },
};
