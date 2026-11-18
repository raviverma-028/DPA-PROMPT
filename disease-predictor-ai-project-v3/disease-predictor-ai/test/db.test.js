const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Store } = require('../src/db');

test('store persists atomically and reloads', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dp-'));
  const file = path.join(dir, 'db.json');
  const a = new Store(file);
  a.addGuest('gid:1', 1); a.upsertUser('u', { name: 'Test' }); a.flush();
  assert.ok(!fs.existsSync(file + '.tmp'));
  const b = new Store(file);
  assert.equal(b.guestCount('gid:1'), 1);
  assert.equal(b.user('u').name, 'Test');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('counters never go negative', () => {
  const s = new Store(null);
  s.addGuest('k', -5);
  assert.equal(s.guestCount('k'), 0);
});
