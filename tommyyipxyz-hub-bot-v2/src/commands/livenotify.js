const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { COLORS, V2_FLAGS, ContainerBuilder, text, separator } = require('../utils/components');
const { ensureLiveRole, optInButtonRow } = require('../utils/liveNotify');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('livenotify')
    .setDescription('Post the opt-in panel for live and new video notifications (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((opt) =>
      opt
        .setName('channel')
        .setDescription('Where to post the panel (defaults to this channel)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    ),

  async execute(interaction) {
    const guild = interaction.guild;
    if (!guild) {
      return interaction.reply({ content: 'This command only works in a server.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const role = await ensureLiveRole(guild);
    if (!role) {
      return interaction.editReply(
        'I could not create the notifications role. Check that I have the Manage Roles permission and that my role is high enough.'
      );
    }

    const channel = interaction.options.getChannel('channel') || interaction.channel;

    const container = new ContainerBuilder()
      .setAccentColor(COLORS.youtube)
      .addTextDisplayComponents(text('# 🔔 Live and Video Notifications'))
      .addSeparatorComponents(separator())
      .addTextDisplayComponents(
        text(
          [
            'Want a ping when we go live or drop a new video?',
            '',
            'Tap the button below to turn notifications on. Tap it again any time to turn them off.',
            'Only people who opt in get pinged, never the whole server.',
          ].join('\n')
        )
      )
      .addActionRowComponents(optInButtonRow());

    const sent = await channel
      .send({ components: [container], flags: V2_FLAGS })
      .catch(() => null);

    if (!sent) {
      return interaction.editReply(
        `I could not post in ${channel}. Check that I can view and send messages there.`
      );
    }

    return interaction.editReply(`Opt-in panel posted in ${channel}. Members can turn notifications on there.`);
  },
};
