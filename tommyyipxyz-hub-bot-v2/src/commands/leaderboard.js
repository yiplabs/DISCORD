const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getLeaderboard } = require('../utils/xp');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('See the top members by XP'),

  async execute(interaction) {
    const leaders = getLeaderboard(interaction.guildId, 10);

    if (!leaders.length) {
      return interaction.reply({
        content: 'No one has earned XP yet. Start chatting to get on the board!',
        ephemeral: true,
      });
    }

    const medals = ['🥇', '🥈', '🥉'];
    const lines = [];

    for (let i = 0; i < leaders.length; i++) {
      const u = leaders[i];
      const prefix = medals[i] || `**${i + 1}.**`;
      const member = await interaction.guild.members.fetch(u.user_id).catch(() => null);
      const name = member ? member.displayName : `User ${u.user_id.slice(-4)}`;
      lines.push(`${prefix} **${name}** — Level ${u.level} • ${u.xp.toLocaleString()} XP`);
    }

    const embed = new EmbedBuilder()
      .setColor('#f1c40f')
      .setTitle('🏆 Leaderboard')
      .setDescription(lines.join('\n'))
      .setFooter({ text: 'Keep chatting and building to climb the ranks!' });

    await interaction.reply({ embeds: [embed] });
  },
};
