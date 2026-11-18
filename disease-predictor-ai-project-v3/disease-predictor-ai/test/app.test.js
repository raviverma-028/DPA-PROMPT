// Integration tests (need `npm install`). Skipped automatically if dependencies are missing.
const test = require('node:test');
const assert = require('node:assert/strict');

let hasDeps = true;
try { ['express', 'multer', 'helmet', 'compression', 'cookie-parser', 'jsonwebtoken', 'express-rate-limit'].forEach((m) => require.resolve(m)); } catch { hasDeps = false; }
const opts = { skip: !hasDeps && 'dependencies not installed' };

const png = () => new Blob([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0])], { type: 'image/png' });
const form = (blob = png(), name = 'report.png') => { const fd = new FormData(); fd.append('reports', blob, name); fd.append('lang', 'english'); return fd; };

async function boot() {
  const { createApp } = require('../src/app');
  const { Store } = require('../src/db');
  const config = { isProd: false, jwtSecret: 'x'.repeat(40), guestLimit: 2, userDailyLimit: 3, maxFileMB: 1, maxFiles: 3 };
  const app = createApp({
    config, store: new Store(null),
    analyze: async () => ({ is_medical_report: true, summary: 'ok' }),
    verifyGoogle: async () => ({ sub: 'u1', name: 'Tester', email: 't@example.com', picture: '' }),
  });
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const cookies = {};
  const call = async (p, o = {}) => {
    const res = await fetch(base + p, { ...o, headers: { ...(o.headers || {}), cookie: Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ') } });
    for (const sc of res.headers.getSetCookie()) { const kv = sc.split(';')[0]; const i = kv.indexOf('='); cookies[kv.slice(0, i)] = kv.slice(i + 1); }
    return res;
  };
  return { call, close: () => { server.closeAllConnections?.(); server.close(); } };
}

test('health check works and security headers are set', opts, async () => {
  const { call, close } = await boot();
  const res = await call('/healthz');
  assert.equal(res.status, 200);
  assert.ok(res.headers.get('content-security-policy'));
  assert.equal(res.headers.get('x-powered-by'), null);
  close();
});

test('guest gets 2 free analyses, then login is required', opts, async () => {
  const { call, close } = await boot();
  assert.equal((await call('/api/analyze', { method: 'POST', body: form() })).status, 200);
  assert.equal((await call('/api/analyze', { method: 'POST', body: form() })).status, 200);
  const third = await call('/api/analyze', { method: 'POST', body: form() });
  assert.equal(third.status, 401);
  assert.equal((await third.json()).loginRequired, true);
  close();
});

test('fake image (wrong magic bytes) is rejected and does not use a try', opts, async () => {
  const { call, close } = await boot();
  const bad = new Blob(['<script>alert(1)</script>'], { type: 'image/png' });
  assert.equal((await call('/api/analyze', { method: 'POST', body: form(bad, 'evil.png') })).status, 400);
  assert.equal((await (await call('/api/me')).json()).quota.remaining, 2);
  close();
});

test('google login gives a user session with a bigger limit', opts, async () => {
  const { call, close } = await boot();
  const login = await call('/auth/google', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ credential: 'fake-token' }) });
  assert.equal(login.status, 200);
  const me = await (await call('/api/me')).json();
  assert.equal(me.user.name, 'Tester');
  assert.equal(me.quota.limit, 3);
  close();
});

test('cross-origin POST is blocked', opts, async () => {
  const { call, close } = await boot();
  const res = await call('/auth/logout', { method: 'POST', headers: { origin: 'http://evil.example' } });
  assert.equal(res.status, 403);
  close();
});
