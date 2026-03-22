const { stmts } = require('./database');

// XP config
const XP_PER_MESSAGE_MIN = 15;
const XP_PER_MESSAGE_MAX = 25;
const XP_COOLDOWN_MS = 60_000; // 1 minute between XP gains (prevents spam)

/**
 * Calculate level from total XP
 * Uses a curve: level = floor(0.1 * sqrt(xp))
 * Level 1 = 100 XP, Level 5 = 2,500 XP, Level 10 = 10,000 XP
 */
function xpToLevel(xp) {
  return Math.floor(0.1 * Math.sqrt(xp));
}

/**
 * Calculate XP needed for a specific level
 */
function levelToXp(level) {
  return (level * 10) ** 2;
}

/**
 * Process a message for XP gain
 * Returns { leveledUp: boolean, newLevel: number } or null if on cooldown
 */
function addMessageXP(userId, guildId) {
  const now = Date.now();
  let user = stmts.getUser.get(userId, guildId);

  if (!user) {
    user = { user_id: userId, guild_id: guildId, xp: 0, level: 0, messages: 0, last_xp_at: 0 };
  }

  // Always count messages
  user.messages += 1;

  // Check cooldown
  if (now - user.last_xp_at < XP_COOLDOWN_MS) {
    stmts.upsertUser.run(userId, guildId, user.xp, user.level, user.messages, user.last_xp_at);
    return null;
  }

  // Random XP gain
  const xpGain = Math.floor(Math.random() * (XP_PER_MESSAGE_MAX - XP_PER_MESSAGE_MIN + 1)) + XP_PER_MESSAGE_MIN;
  user.xp += xpGain;
  user.last_xp_at = now;

  // Check level up
  const newLevel = xpToLevel(user.xp);
  const leveledUp = newLevel > user.level;
  user.level = newLevel;

  stmts.upsertUser.run(userId, guildId, user.xp, user.level, user.messages, user.last_xp_at);

  if (leveledUp) {
    return { leveledUp: true, newLevel };
  }

  return null;
}

/**
 * Get user stats
 */
function getUserStats(userId, guildId) {
  const user = stmts.getUser.get(userId, guildId);
  if (!user) return null;

  const rank = stmts.getUserRank.get(guildId, userId, guildId);
  const nextLevelXp = levelToXp(user.level + 1);

  return {
    ...user,
    rank: rank.rank,
    nextLevelXp,
    xpToNext: nextLevelXp - user.xp,
    progress: Math.min(100, Math.round(((user.xp - levelToXp(user.level)) / (nextLevelXp - levelToXp(user.level))) * 100)),
  };
}

/**
 * Get leaderboard
 */
function getLeaderboard(guildId, limit = 10) {
  return stmts.getTopUsers.all(guildId, limit);
}

module.exports = { addMessageXP, getUserStats, getLeaderboard, xpToLevel, levelToXp };
