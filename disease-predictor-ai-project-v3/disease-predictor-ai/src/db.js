const fs = require('fs');
const path = require('path');

/** Minimal JSON-file store with debounced, atomic writes. Pass null for an in-memory store (tests). */
class Store {
  constructor(file) {
    this.file = file;
    this.timer = null;
    this.data = { guests: {}, users: {} };
    if (file) {
      try { this.data = { ...this.data, ...JSON.parse(fs.readFileSync(file, 'utf8')) }; } catch { /* first run */ }
    }
  }
  guestCount(key) { return this.data.guests[key] || 0; }
  addGuest(key, delta) { this.data.guests[key] = Math.max(0, this.guestCount(key) + delta); this._dirty(); }
  user(sub) { return this.data.users[sub] || null; }
  upsertUser(sub, profile) { this.data.users[sub] = { ...this.data.users[sub], ...profile }; this._dirty(); }
  userUsed(sub, day) { return this.data.users[sub]?.usage?.[day] || 0; }
  addUser(sub, day, delta) {
    const u = this.data.users[sub];
    if (!u) return;
    u.usage = { [day]: Math.max(0, this.userUsed(sub, day) + delta) }; // keeps only today's counter
    this._dirty();
  }
  _dirty() {
    if (!this.file || this.timer) return;
    this.timer = setTimeout(() => this.flush(), 250);
    this.timer.unref?.();
  }
  /** Writes to disk atomically (temp file + rename). */
  flush() {
    clearTimeout(this.timer);
    this.timer = null;
    if (!this.file) return;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data));
    fs.renameSync(tmp, this.file);
  }
}
module.exports = { Store };
