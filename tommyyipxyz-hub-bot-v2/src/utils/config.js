const PLACEHOLDER_VALUES = new Set([
  '',
  'your_bot_token_here',
  'your_client_id_here',
]);

function isConfigured(value) {
  return (
    typeof value === 'string' &&
    !PLACEHOLDER_VALUES.has(value.trim().toLowerCase())
  );
}

function isDiscordId(value) {
  return /^\d{5,25}$/.test(value?.trim() || '');
}

function validateRuntimeEnvironment(env = process.env) {
  const missing = [];

  if (!isConfigured(env.DISCORD_TOKEN)) missing.push('DISCORD_TOKEN');
  if (!isConfigured(env.CLIENT_ID) || !isDiscordId(env.CLIENT_ID)) {
    missing.push('CLIENT_ID');
  }
  if (
    !isConfigured(env.DISCORD_GUILD_ID) ||
    !isDiscordId(env.DISCORD_GUILD_ID)
  ) {
    missing.push('DISCORD_GUILD_ID');
  }

  if (missing.length > 0) {
    throw new Error(
      `[Config] Missing or invalid required environment variables: ${missing.join(', ')}`
    );
  }
}

function isConfiguredGuild(guildId, env = process.env) {
  const configuredGuildId = env.DISCORD_GUILD_ID?.trim();
  return isDiscordId(configuredGuildId) && configuredGuildId === guildId;
}

module.exports = {
  isConfigured,
  isConfiguredGuild,
  isDiscordId,
  validateRuntimeEnvironment,
};
