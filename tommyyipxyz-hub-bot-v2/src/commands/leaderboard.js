const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('See the top Dollar Vibe Club members by XP')
    .addStringOption((option) =>
      option
        .setName('scope')
        .setDescription('Leaderboard time range')
        .addChoices(
          { name: 'All time', value: 'all-time' },
          { name: 'This week', value: 'weekly' },
          { name: 'This month', value: 'monthly' }
        )
    ),

  async execute(interaction) {
    if (interaction.client.dvcApi) {
      await interaction.deferReply();

      const scope = interaction.options.getString('scope') || 'all-time';
      let board;
      try {
        board = await interaction.client.dvcApi.getLeaderboard(
          scope,
          10,
          interaction.user.id
        );
      } catch (error) {
        console.error(`[DVC XP] Could not read leaderboard: ${error.message}`);
        return interaction.editReply({
          content:
            'The DVC leaderboard is temporarily unavailable. Please try again shortly.',
        });
      }

      if (!board.rows.length) {
        return interaction.editReply({
          content: 'No XP has been earned in this time range yet.',
        });
      }

      const medals = ['🥇', '🥈', '🥉'];
      const lines = board.rows.map((row, index) => {
        const prefix = medals[index] || `**${row.rank}.**`;
        return (
          `${prefix} **@${row.username}** — ` +
          `${row.level_name} · ${row.xp.toLocaleString()} XP`
        );
      });
      const scopeLabel = {
        'all-time': 'All-Time',
        weekly: 'Weekly',
        monthly: 'Monthly',
      }[board.scope];

      const embed = new EmbedBuilder()
        .setColor('#f1c40f')
        .setTitle(`🏆 DVC ${scopeLabel} Leaderboard`)
        .setDescription(lines.join('\n'))
        .setFooter({
          text: board.viewer
            ? `Your position: #${board.viewer.rank} · ${board.viewer.value.toLocaleString()} XP`
            : 'Connect Discord on dollarvibeclub.com to join the leaderboard',
        });

      return interaction.editReply({ embeds: [embed] });
    }

    return interaction.reply({
      content:
        'The shared DVC XP bridge is not configured yet. Local Railway XP is disabled to keep one authoritative leaderboard.',
      ephemeral: true,
    });
  },
};
