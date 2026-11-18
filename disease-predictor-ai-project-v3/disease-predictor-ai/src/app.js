const path = require('path');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { AppError } = require('./errors');
const { detectType } = require('./validate');
const { getQuota, reserve, release } = require('./quota');

const today = () => new Date().toISOString().slice(0, 10);
const limiter = (limit, message) => rateLimit({ windowMs: 60000, limit, standardHeaders: true, legacyHeaders: false, message: { error: message } });

/** Builds the Express app. Dependencies are injected so it can be tested without network or real Google/AI. */
function createApp({ config, store, analyze, verifyGoogle }) {
  const app = express();
  app.disable('x-powered-by');
  if (config.isProd) app.set('trust proxy', 1);
  const cookieOpts = { httpOnly: true, sameSite: 'lax', secure: config.isProd };

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://accounts.google.com/gsi/client'],
        styleSrc: ["'self'", 'https://accounts.google.com/gsi/style'],
        frameSrc: ['https://accounts.google.com/'],
        connectSrc: ["'self'", 'https://accounts.google.com/gsi/'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https://*.googleusercontent.com'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        'upgrade-insecure-requests': config.isProd ? [] : null,
      },
    },
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  }));
  app.use(compression());
  app.use(cookieParser());
  app.use(express.json({ limit: '10kb' }));
  app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: config.isProd ? '1d' : 0 }));
  app.get('/healthz', (_req, res) => res.json({ ok: true }));

  // CSRF defence in depth: state-changing requests must come from the same origin.
  app.use((req, _res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const origin = req.get('origin');
    if (origin) {
      try { if (new URL(origin).host !== req.get('host')) return next(new AppError(403, 'Cross-origin request blocked.')); }
      catch { return next(new AppError(403, 'Bad origin.')); }
    }
    next();
  });

  // Identify visitor: guest (random cookie id) or logged-in user (signed JWT).
  app.use((req, res, next) => {
    let gid = req.cookies.gid;
    if (!/^[0-9a-f-]{36}$/.test(gid || '')) {
      gid = crypto.randomUUID();
      res.cookie('gid', gid, { ...cookieOpts, maxAge: 365 * 864e5 });
    }
    req.who = { gid, ip: req.ip, user: null };
    if (req.cookies.token) {
      try {
        const { sub } = jwt.verify(req.cookies.token, config.jwtSecret, { algorithms: ['HS256'] });
        const u = store.user(sub);
        if (u) req.who.user = { sub, ...u };
      } catch { /* invalid or expired token: treat as guest */ }
    }
    next();
  });

  const limitError = (q) => (q.type === 'guest'
    ? new AppError(401, 'Free limit reached. Please login with Google to continue.', { loginRequired: true })
    : new AppError(429, `Daily limit of ${q.limit} analyses reached. Try again tomorrow.`));

  app.get('/api/config', (_req, res) => res.json({ googleClientId: config.googleClientId || null }));

  app.get('/api/me', (req, res) => {
    const u = req.who.user;
    res.json({ user: u ? { name: u.name, email: u.email, picture: u.picture } : null, quota: getQuota(store, config, req.who, today()) });
  });

  app.post('/auth/google', limiter(20, 'Too many attempts. Try again later.'), async (req, res, next) => {
    try {
      const cred = req.body?.credential;
      if (typeof cred !== 'string' || cred.length > 4096) throw new AppError(400, 'Missing credential.');
      const p = await verifyGoogle(cred);
      store.upsertUser(p.sub, { name: p.name, email: p.email, picture: p.picture });
      const token = jwt.sign({ sub: p.sub }, config.jwtSecret, { algorithm: 'HS256', expiresIn: '7d' });
      res.cookie('token', token, { ...cookieOpts, maxAge: 7 * 864e5 });
      res.json({ ok: true });
    } catch (e) { next(e instanceof AppError ? e : new AppError(401, 'Google login failed.')); }
  });

  app.post('/auth/logout', (_req, res) => { res.clearCookie('token', cookieOpts); res.json({ ok: true }); });

  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.maxFileMB * 1048576, files: config.maxFiles } });
  const checkQuota = (req, _res, next) => {
    const q = getQuota(store, config, req.who, today());
    next(q.remaining > 0 ? undefined : limitError(q));
  };

  app.post('/api/analyze', limiter(10, 'Too many requests. Please wait a minute.'), checkQuota, upload.array('reports', config.maxFiles), async (req, res, next) => {
    const day = today();
    let reserved = false;
    try {
      const files = req.files || [];
      if (!files.length) throw new AppError(400, 'Please upload at least one file.');
      for (const f of files) {
        const type = detectType(f.buffer);
        if (!type) throw new AppError(400, `"${f.originalname}" is not a valid PNG, JPG or PDF file.`);
        f.mimetype = type;
      }
      if (!reserve(store, config, req.who, day)) throw limitError(getQuota(store, config, req.who, day));
      reserved = true;
      res.json(await analyze(files, req.body?.lang));
    } catch (e) {
      if (reserved) release(store, req.who, day); // failed analyses do not use up the free quota
      next(e);
    }
  });

  // Central error handler: never leaks internals or stack traces.
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof multer.MulterError) {
      const big = err.code === 'LIMIT_FILE_SIZE';
      return res.status(big ? 413 : 400).json({ error: big ? `File too large (max ${config.maxFileMB} MB).` : 'Too many files or invalid upload.' });
    }
    if (err instanceof AppError) return res.status(err.status).json({ error: err.message, ...err.extra });
    if (err.status >= 400 && err.status < 500) return res.status(err.status).json({ error: 'Bad request.' });
    console.error('[error]', err.message); // message only: never log report contents
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  });
  return app;
}
module.exports = { createApp };
