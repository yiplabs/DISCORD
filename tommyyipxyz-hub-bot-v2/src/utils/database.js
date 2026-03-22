const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'hub.db');
const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 0,
    messages INTEGER DEFAULT 0,
    last_xp_at INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS settings (
    guild_id TEXT PRIMARY KEY,
    welcome_channel_id TEXT,
    rules_channel_id TEXT,
    role_react_channel_id TEXT,
    role_react_message_id TEXT,
    youtube_notify_channel_id TEXT,
    last_youtube_video_id TEXT,
    xp_announce_channel_id TEXT
  );
`);

// Prepared statements for performance
const stmts = {
  getUser: db.prepare('SELECT * FROM users WHERE user_id = ? AND guild_id = ?'),
  upsertUser: db.prepare(`
    INSERT INTO users (user_id, guild_id, xp, level, messages, last_xp_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      xp = excluded.xp,
      level = excluded.level,
      messages = excluded.messages,
      last_xp_at = excluded.last_xp_at
  `),
  getTopUsers: db.prepare('SELECT * FROM users WHERE guild_id = ? ORDER BY xp DESC LIMIT ?'),
  getSettings: db.prepare('SELECT * FROM settings WHERE guild_id = ?'),
  upsertSettings: db.prepare(`
    INSERT INTO settings (guild_id, welcome_channel_id, rules_channel_id, role_react_channel_id, role_react_message_id, youtube_notify_channel_id, last_youtube_video_id, xp_announce_channel_id)
    VALUES (@guild_id, @welcome_channel_id, @rules_channel_id, @role_react_channel_id, @role_react_message_id, @youtube_notify_channel_id, @last_youtube_video_id, @xp_announce_channel_id)
    ON CONFLICT(guild_id) DO UPDATE SET
      welcome_channel_id = excluded.welcome_channel_id,
      rules_channel_id = excluded.rules_channel_id,
      role_react_channel_id = excluded.role_react_channel_id,
      role_react_message_id = excluded.role_react_message_id,
      youtube_notify_channel_id = excluded.youtube_notify_channel_id,
      last_youtube_video_id = excluded.last_youtube_video_id,
      xp_announce_channel_id = excluded.xp_announce_channel_id
  `),
  getUserRank: db.prepare(`
    SELECT COUNT(*) + 1 as rank FROM users 
    WHERE guild_id = ? AND xp > (SELECT xp FROM users WHERE user_id = ? AND guild_id = ?)
  `),
};

module.exports = { db, stmts };
