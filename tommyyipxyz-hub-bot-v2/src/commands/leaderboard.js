const { SlashCommandBuilder } = require('discord.js');
const dvcApi = require('../utils/dvcApi');
const { COLORS, text, separator, banneredContainer, v2Payload } = require('../utils/components');

// Tight budget so we always answer inside Discord's response window.
const READ_OPTS = { timeoutMs: 2200, retries: 0 };

const SCOPE_LABELS = { 'all-time': 'All Time', weekly: 'This Week', monthly: 'This Month' };

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('See the top members by XP')
    .addStringOption((opt) =>
      opt
        .setName('scope')
        .setDescription('Which leaderboard to show')
        .setRequired(false)
        .addChoices(
          { name: 'All time', value: 'all-time' },
          { name: 'This week', value: 'weekly' },
          { name: 'This month', value: 'monthly' }
        )
    ),

  async execute(interaction) {
    if (!dvcApi.isConfigured()) {
      return interaction.reply({ content: 'XP is not set up yet. Check back soon.', ephemeral: true });
    }

    const scope = interaction.options.getString('scope') || 'all-time';
    const res = await dvcApi.getLeaderboard(
      { scope, limit: 10, viewer: interaction.user.id },
      READ_OPTS
    );

    if (res.httpStatus !== 200) {
      return interaction.reply({
        content: 'Could not reach the XP service right now. Try again in a moment.',
        ephemeral: true,
      });
    }

    const rows = res.rows || [];
    if (!rows.length) {
      return interaction.reply({
        content: 'No one is on the board yet. Start chatting here and posting on the site to climb!',
        ephemeral: true,
      });
    }

    const medals = ['🥇', '🥈', '🥉'];
    const lines = rows.map((r, i) => {
      const prefix = medals[i] || `**${r.rank}.**`;
      return `${prefix} **${r.username}** • ${r.level_name} • ${Number(r.xp).toLocaleString()} XP`;
    });

    const { container, art } = banneredContainer(COLORS.gold, 'leaderboard');
    container
      .addTextDisplayComponents(text(`# 🏆 Leaderboard ┃ ${SCOPE_LABELS[scope] || 'All Time'}`))
      .addSeparatorComponents(separator())
      .addTextDisplayComponents(text(lines.join('\n')))
      .addSeparatorComponents(separator());

    if (res.viewer && res.viewer.rank) {
      container.addTextDisplayComponents(
        text(`-# Your position: #${res.viewer.rank} • ${Number(res.viewer.value).toLocaleString()} XP`)
      );
    } else {
      container.addTextDisplayComponents(text('-# Keep chatting and building to climb the ranks!'));
    }

    return interaction.reply(v2Payload(container, art));
  },
};
