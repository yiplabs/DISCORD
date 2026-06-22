const { SlashCommandBuilder } = require('discord.js');
const dvcApi = require('../utils/dvcApi');
const { COLORS, V2_FLAGS, ContainerBuilder, text, separator, thumbnailSection, v2Payload } = require('../utils/components');

// Tight budget so we always answer inside Discord's response window.
const READ_OPTS = { timeoutMs: 2200, retries: 0 };

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Check your level, XP, and rank')
    .addUserOption((opt) =>
      opt.setName('user').setDescription('Check another member').setRequired(false)
    ),

  async execute(interaction) {
    const target = interaction.options.getUser('user') || interaction.user;
    const isSelf = target.id === interaction.user.id;

    if (!dvcApi.isConfigured()) {
      return interaction.reply({ content: 'XP is not set up yet. Check back soon.', ephemeral: true });
    }

    const res = await dvcApi.getUserXp(target.id, READ_OPTS);

    if (res.httpStatus !== 200) {
      return interaction.reply({
        content: 'Could not reach the XP service right now. Try again in a moment.',
        ephemeral: true,
      });
    }

    // Not linked: show parked XP (for yourself) and point to the link page.
    if (res.linked === false) {
      const url = dvcApi.linkUrl();
      const lines = [
        isSelf
          ? `You have **${Number(res.pending_xp || 0).toLocaleString()} XP** saved up, but your Discord is not linked to Dollar Vibe Club yet.`
          : `**${target.displayName}** has not linked their Dollar Vibe Club account yet.`,
      ];
      if (isSelf) {
        lines.push(
          '',
          url
            ? `Link your account here to start ranking: ${url}`
            : 'Link your account on the Dollar Vibe Club website to start ranking.'
        );
      }

      const container = new ContainerBuilder()
        .setAccentColor(COLORS.muted)
        .addTextDisplayComponents(text('# 🔗 Not Linked Yet'))
        .addSeparatorComponents(separator())
        .addTextDisplayComponents(text(lines.join('\n')));

      return interaction.reply(v2Payload(container, null, { allowedMentions: { parse: [] } }));
    }

    // Linked: rank, level, and total, using the names the website returns.
    const container = new ContainerBuilder()
      .setAccentColor(COLORS.brand)
      .addSectionComponents(
        thumbnailSection(
          [`### ${target.displayName}`, `# ${res.level_name}`].join('\n'),
          target.displayAvatarURL()
        )
      )
      .addSeparatorComponents(separator())
      .addTextDisplayComponents(
        text(
          [
            `**Level** • ${res.level}`,
            `**Rank** • #${res.rank}`,
            `**XP** • ${Number(res.xp).toLocaleString()}`,
          ].join('\n')
        )
      );

    return interaction.reply(v2Payload(container, null));
  },
};
