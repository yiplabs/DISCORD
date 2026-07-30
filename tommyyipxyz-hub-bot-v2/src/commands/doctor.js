const {
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} = require('discord.js');
const { isConfiguredGuild } = require('../utils/config');
const { isDvcApiConfigured } = require('../utils/dvc-api');
const { getWatchedChannels } = require('../utils/youtube');

const CHANNEL_PERMISSIONS = [
  ['View channel', PermissionFlagsBits.ViewChannel],
  ['Send messages', PermissionFlagsBits.SendMessages],
  ['Embed links', PermissionFlagsBits.EmbedLinks],
  ['Read message history', PermissionFlagsBits.ReadMessageHistory],
  ['Mention everyone', PermissionFlagsBits.MentionEveryone],
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('doctor')
    .setDescription('Run a read-only DVC bot configuration check')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        content: 'You need the **Manage Server** permission to run `/doctor`.',
        ephemeral: true,
      });
    }

    const checks = [];
    const guildReady = isConfiguredGuild(interaction.guildId);
    checks.push({
      ok: guildReady,
      label: 'Server scope',
      detail: guildReady
        ? 'Pinned to this DVC server'
        : 'DISCORD_GUILD_ID points somewhere else',
    });

    const notifyChannelId = process.env.DISCORD_NOTIFY_CHANNEL_ID?.trim();
    const channel = notifyChannelId
      ? interaction.guild.channels.cache.get(notifyChannelId)
      : null;
    checks.push({
      ok: Boolean(channel),
      label: 'YouTube destination',
      detail: channel
        ? `#${channel.name}`
        : 'DISCORD_NOTIFY_CHANNEL_ID is missing or inaccessible',
    });

    if (channel) {
      const permissions = channel.permissionsFor(interaction.guild.members.me);
      for (const [label, permission] of CHANNEL_PERMISSIONS) {
        checks.push({
          ok: Boolean(permissions?.has(permission)),
          label,
          detail: `#${channel.name}`,
        });
      }
    }

    const watchedChannels = getWatchedChannels();
    checks.push({
      ok: watchedChannels.length === 2,
      label: 'Creator feeds',
      detail: watchedChannels.map((item) => `@${item.handle}`).join(' + '),
    });

    checks.push({
      ok: isDvcApiConfigured(),
      label: 'DVC account + XP bridge',
      detail: isDvcApiConfigured()
        ? 'Configured'
        : 'DVC_API_URL or DISCORD_BOT_XP_SECRET is missing',
    });

    const isAdministrator = Boolean(
      interaction.guild.members.me?.permissions?.has(
        PermissionFlagsBits.Administrator
      )
    );
    checks.push({
      ok: !isAdministrator,
      label: 'Least privilege',
      detail: isAdministrator
        ? 'Bot still has Administrator; reduce it after verification'
        : 'Administrator is not granted',
    });

    const ready = checks.every((check) => check.ok);
    const embed = new EmbedBuilder()
      .setColor(ready ? '#2ecc71' : '#f39c12')
      .setTitle(ready ? '✅ DVC Bot Ready' : '⚠️ DVC Bot Needs Attention')
      .setDescription(
        'This is a read-only check. It does not change channels, roles, or settings.'
      )
      .addFields(
        checks.map((check) => ({
          name: `${check.ok ? '✅' : '⚠️'} ${check.label}`,
          value: check.detail,
          inline: true,
        }))
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
