const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Check your level, XP, and rank')
    .addUserOption((opt) =>
      opt.setName('user').setDescription('Check another member').setRequired(false)
    ),

  async execute(interaction) {
    const target = interaction.options.getUser('user') || interaction.user;

    if (interaction.client.dvcApi) {
      await interaction.deferReply({ ephemeral: true });

      let state;
      try {
        state = await interaction.client.dvcApi.getUser(target.id);
      } catch (error) {
        console.error(`[DVC XP] Could not read rank: ${error.message}`);
        return interaction.editReply({
          content:
            'DVC rank data is temporarily unavailable. Please try again shortly.',
        });
      }

      if (!state.linked) {
        if (target.id !== interaction.user.id) {
          return interaction.editReply({
            content: 'This member does not have a public DVC rank yet.',
          });
        }

        const baseUrl = (
          process.env.DVC_WEB_URL || 'https://dollarvibeclub.com'
        ).replace(/\/+$/, '');
        return interaction.editReply({
          content:
            `You have **${state.pending_xp.toLocaleString()} XP** waiting. ` +
            `Connect Discord to your Dollar Vibe Club account to claim it:\n` +
            `${baseUrl}/link/discord`,
        });
      }

      const embed = new EmbedBuilder()
        .setColor('#9b59b6')
        .setAuthor({
          name: target.displayName,
          iconURL: target.displayAvatarURL(),
        })
        .setTitle(`${state.level_name} · Level ${state.level}`)
        .setDescription(
          `Shared progress for **@${state.username}** across Dollar Vibe Club and Discord.`
        )
        .addFields(
          { name: 'DVC Rank', value: `#${state.rank}`, inline: true },
          {
            name: 'Total XP',
            value: state.xp.toLocaleString(),
            inline: true,
          },
          { name: 'Level', value: String(state.level), inline: true }
        )
        .setFooter({ text: 'Dollar Vibe Club · One account, shared progress' });

      return interaction.editReply({ embeds: [embed] });
    }

    return interaction.reply({
      content:
        'The shared DVC XP bridge is not configured yet. Local Railway XP is disabled to keep one authoritative rank.',
      ephemeral: true,
    });
  },
};
