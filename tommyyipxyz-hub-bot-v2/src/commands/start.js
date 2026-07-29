const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('start')
    .setDescription('Start here: connect DVC and find your next move'),

  async execute(interaction) {
    const baseUrl = (
      process.env.DVC_WEB_URL || 'https://dollarvibeclub.com'
    ).replace(/\/+$/, '');

    const embed = new EmbedBuilder()
      .setColor('#9b59b6')
      .setTitle('⚡ Start with Dollar Vibe Club')
      .setDescription(
        [
          '**1. Connect your DVC account**',
          'Share one identity, rank, and XP across the website and Discord.',
          '',
          '**2. Choose your rooms**',
          'Use <id:browse> and <id:customize> to follow the topics you care about.',
          '',
          '**3. Make your first move**',
          'Introduce yourself, ship a project with `/showcase`, or ask for build help.',
          '',
          '**4. Check your progress**',
          'Run `/rank` or explore `/leaderboard scope:This week`.',
        ].join('\n')
      )
      .setFooter({ text: 'Learn. Build. Earn. Together.' });

    const actions = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel('Connect DVC Account')
        .setURL(`${baseUrl}/link/discord`),
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel('Open Dollar Vibe Club')
        .setURL(baseUrl)
    );

    await interaction.reply({
      embeds: [embed],
      components: [actions],
      allowedMentions: { parse: [] },
      ephemeral: true,
    });
  },
};
