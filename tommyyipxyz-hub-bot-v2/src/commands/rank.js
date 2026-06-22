const { SlashCommandBuilder } = require('discord.js');
const { getUserStats } = require('../utils/xp');
const { COLORS, V2_FLAGS, ContainerBuilder, text, separator, thumbnailSection } = require('../utils/components');

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

    const container = new ContainerBuilder()
      .setAccentColor(COLORS.brand)
      .addSectionComponents(
        thumbnailSection(
          [`### ${target.displayName}`, `# Level ${stats.level}`].join('\n'),
          target.displayAvatarURL()
        )
      )
      .addSeparatorComponents(separator())
      .addTextDisplayComponents(
        text(
          [
            `**Rank** • #${stats.rank}`,
            `**XP** • ${stats.xp.toLocaleString()} / ${stats.nextLevelXp.toLocaleString()}`,
            `**Messages** • ${stats.messages.toLocaleString()}`,
          ].join('\n')
        )
      )
      .addTextDisplayComponents(text(`**Progress**\n${bar} ${stats.progress}%`))
      .addSeparatorComponents(separator())
      .addTextDisplayComponents(text(`-# ${stats.xpToNext.toLocaleString()} XP to next level`));

    await interaction.reply({ components: [container], flags: V2_FLAGS });
  },
};
