// Entry point: wires real dependencies (Google verification, AI analyzer, JSON store).
const { OAuth2Client } = require('google-auth-library');
const { loadConfig } = require('./src/config');
const { Store } = require('./src/db');
const { createApp } = require('./src/app');
const { analyzeReports } = require('./src/analyzer');

const config = loadConfig();
const store = new Store(config.dbFile);
const google = new OAuth2Client(config.googleClientId);

const app = createApp({
  config,
  store,
  analyze: (files, lang) => analyzeReports(files, lang, config),
  verifyGoogle: async (idToken) => {
    const ticket = await google.verifyIdToken({ idToken, audience: config.googleClientId });
    const p = ticket.getPayload();
    if (!p.email_verified) throw new Error('Email not verified');
    return p;
  },
});

const server = app.listen(config.port, () => console.log(`Disease Predictor AI -> http://localhost:${config.port}`));
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { store.flush(); server.close(() => process.exit(0)); });
}
