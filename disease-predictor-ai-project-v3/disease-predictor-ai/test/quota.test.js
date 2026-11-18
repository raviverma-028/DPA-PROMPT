const test = require('node:test');
const assert = require('node:assert/strict');
const { Store } = require('../src/db');
const { getQuota, reserve, release } = require('../src/quota');

const cfg = { guestLimit: 2, userDailyLimit: 3 };
const day = '2026-01-01';

test('guest gets exactly guestLimit tries, then is blocked', () => {
  const s = new Store(null), who = { gid: 'g1', ip: '1.1.1.1', user: null };
  assert.ok(reserve(s, cfg, who, day));
  assert.ok(reserve(s, cfg, who, day));
  assert.equal(reserve(s, cfg, who, day), false);
  assert.equal(getQuota(s, cfg, who, day).remaining, 0);
});

test('release gives the try back (failed analysis is free)', () => {
  const s = new Store(null), who = { gid: 'g1', ip: '1.1.1.1', user: null };
  reserve(s, cfg, who, day); release(s, who, day);
  assert.equal(getQuota(s, cfg, who, day).remaining, 2);
});

test('clearing cookies does not bypass the IP-wide cap', () => {
  const s = new Store(null);
  for (let i = 0; i < cfg.guestLimit * 5; i++) reserve(s, cfg, { gid: 'g' + i, ip: '9.9.9.9', user: null }, day);
  assert.equal(reserve(s, cfg, { gid: 'fresh', ip: '9.9.9.9', user: null }, day), false);
});

test('logged-in user has a separate daily limit that resets each day', () => {
  const s = new Store(null);
  s.upsertUser('u1', { name: 'A' });
  const who = { gid: 'g', ip: 'x', user: { sub: 'u1' } };
  for (let i = 0; i < 3; i++) assert.ok(reserve(s, cfg, who, day));
  assert.equal(reserve(s, cfg, who, day), false);
  assert.equal(getQuota(s, cfg, who, '2026-01-02').remaining, 3);
});
