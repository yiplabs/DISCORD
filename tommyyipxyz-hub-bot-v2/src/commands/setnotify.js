const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');
const { stmts } = require('../utils/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setnotify')
    .setDescription('Choose which channel gets YouTube notifications (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
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

    console.log(`[SetNotify] YouTube notifications set to #${channel.name} (${channel.id}) in ${guild.name}`);
  },
};
