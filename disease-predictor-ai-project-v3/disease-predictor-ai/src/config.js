try { require('dotenv').config(); } catch { /* optional in tests */ }
const path = require('path');
const crypto = require('crypto');

const num = (v, d) => (Number.isFinite(+v) && +v > 0 ? +v : d);

/** Reads and validates environment configuration. */
function loadConfig(env = process.env) {
  const isProd = env.NODE_ENV === 'production';
  if (isProd && (!env.JWT_SECRET || env.JWT_SECRET.length < 32)) {
    throw new Error('JWT_SECRET (min 32 characters) is required in production');
  }
  return {
    isProd,
    port: num(env.PORT, 3000),
    model: env.MODEL || 'claude-sonnet-5-5',
    anthropicKey: env.ANTHROPIC_API_KEY,
    googleClientId: env.GOOGLE_CLIENT_ID,
    jwtSecret: env.JWT_SECRET || crypto.randomBytes(32).toString('hex'), // dev only: sessions reset on restart
    guestLimit: num(env.GUEST_LIMIT, 2),
    userDailyLimit: num(env.USER_DAILY_LIMIT, 20),
    maxFileMB: 10,
    maxFiles: 3,
    aiTimeoutMs: 60000,
    dbFile: env.DB_FILE || path.join(__dirname, '..', 'data', 'db.json'),
  };
}
module.exports = { loadConfig };
