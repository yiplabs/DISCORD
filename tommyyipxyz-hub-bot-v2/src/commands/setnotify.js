const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');
const { stmts } = require('../utils/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setnotify')
    .setDescription('Choose the fallback channel for YouTube notifications')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('The channel to send YouTube notifications to')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    ),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    const guild = interaction.guild;

    if (!guild) {
      return interaction.reply({
        content: 'This command only works in a server.',
        ephemeral: true,
      });
    }

    if (process.env.DISCORD_NOTIFY_CHANNEL_ID?.trim()) {
      return interaction.reply({
        content:
          'The production announcement channel is pinned in Railway. Update `DISCORD_NOTIFY_CHANNEL_ID` there so the choice survives deployments.',
        ephemeral: true,
      });
    }

    // Get existing settings or create defaults
    let settings = stmts.getSettings.get(guild.id);

    if (!settings) {
      settings = {
        guild_id: guild.id,
        welcome_channel_id: null,
        rules_channel_id: null,
        role_react_channel_id: null,
        role_react_message_id: null,
        youtube_notify_channel_id: null,
        last_youtube_video_id: null,
        xp_announce_channel_id: null,
      };
    }

    // Update just the YouTube notification channel
    stmts.upsertSettings.run({
      ...settings,
      youtube_notify_channel_id: channel.id,
    });

    await interaction.reply({
      content: `YouTube notifications will now be posted in <#${channel.id}>`,
      ephemeral: true,
    });

    console.log(
      `[SetNotify] YouTube notifications set to #${channel.name} (${channel.id}) in ${guild.name}`
    );
  },
};
