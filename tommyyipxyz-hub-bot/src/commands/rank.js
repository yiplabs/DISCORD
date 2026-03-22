const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUserStats } = require('../utils/xp');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Check your level, XP, and rank')
    .addUserOption((opt) =>
      opt.setName('user').setDescription('Check another member').setRequired(false)
    ),

  async execute(interaction) {
    const target = interaction.options.getUser('user') || interaction.user;
    const stats = getUserStats(target.id, interaction.guildId);

    if (!stats) {
      return interaction.reply({
        content: target.id === interaction.user.id
          ? "You haven't earned any XP yet. Start chatting!"
          : "That user hasn't earned any XP yet.",
        ephemeral: true,
      });
    }

    // Build a progress bar
    const filled = Math.round(stats.progress / 5);
    const bar = '▰'.repeat(filled) + '▱'.repeat(20 - filled);

    const embed = new EmbedBuilder()
      .setColor('#9b59b6')
      .setAuthor({ name: target.displayName, iconURL: target.displayAvatarURL() })
      .setTitle(`Level ${stats.level}`)
      .addFields(
        { name: 'Rank', value: `#${stats.rank}`, inline: true },
        { name: 'XP', value: `${stats.xp.toLocaleString()} / ${stats.nextLevelXp.toLocaleString()}`, inline: true },
        { name: 'Messages', value: stats.messages.toLocaleString(), inline: true },
        { name: 'Progress', value: `${bar} ${stats.progress}%`, inline: false }
      )
      .setFooter({ text: `${stats.xpToNext.toLocaleString()} XP to next level` });

    await interaction.reply({ embeds: [embed] });
  },
};
