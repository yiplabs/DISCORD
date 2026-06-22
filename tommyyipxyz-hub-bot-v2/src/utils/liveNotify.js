// ─── LIVE NOTIFICATIONS OPT-IN ───
// Shared helpers for the self-assignable "live notifications" role. Members opt in
// from a standing panel or from the button attached under every stream/video post,
// and only people who opted in get pinged. The whole server is never pinged.

const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { stmts } = require('./database');

// Name is only a fallback. The authoritative reference is the role id saved in settings.
const LIVE_ROLE_NAME = '🔴 Live Pings';
const TOGGLE_ID = 'dvc-live-notify-toggle';

/**
 * Find the guild's opt-in role, creating it once if it does not exist yet, and keep
 * its id saved in settings. Returns the role, or null if it could not be created.
 */
async function ensureLiveRole(guild) {
  const settings = stmts.getSettings.get(guild.id);

  let role = settings?.live_notify_role_id
    ? guild.roles.cache.get(settings.live_notify_role_id)
    : null;
  if (!role) role = guild.roles.cache.find((r) => r.name === LIVE_ROLE_NAME);

  if (!role) {
    role = await guild.roles
      .create({
        name: LIVE_ROLE_NAME,
        color: 0xff0000,
        mentionable: true,
        reason: 'Live notifications opt-in role',
      })
      .catch(() => null);
  }

  if (role && settings?.live_notify_role_id !== role.id) {
    stmts.setLiveNotifyRole.run(guild.id, role.id);
  }

  return role;
}

/** The "Opt in to follow streams" button row, attached under every stream/video post. */
function optInButtonRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(TOGGLE_ID)
      .setLabel('Opt in to follow streams')
      .setEmoji('🔔')
      .setStyle(ButtonStyle.Primary)
  );
}

/** Toggle the opt-in role for the clicking member and reply privately. */
async function handleToggle(interaction) {
  const guild = interaction.guild;
  if (!guild) return;

  const role = await ensureLiveRole(guild);
  if (!role) {
    return interaction.reply({
      content: 'I could not set up the notifications role. An admin may need to give me the Manage Roles permission.',
      ephemeral: true,
    });
  }

  const member = await guild.members.fetch(interaction.user.id).catch(() => null);
  if (!member) {
    return interaction.reply({ content: 'I could not find your membership in this server.', ephemeral: true });
  }

  if (member.roles.cache.has(role.id)) {
    await member.roles.remove(role.id).catch(() => {});
    return interaction.reply({
      content: 'You opted out. We will not ping you about streams or new videos.',
      ephemeral: true,
    });
  }

  await member.roles.add(role.id).catch(() => {});
  return interaction.reply({
    content: 'You are in. You will get a ping when we go live or post a new video.',
    ephemeral: true,
  });
}

module.exports = { LIVE_ROLE_NAME, TOGGLE_ID, ensureLiveRole, optInButtonRow, handleToggle };
