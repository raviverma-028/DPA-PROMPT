/** Usage limits: guests get a few free tries, logged-in users get a daily allowance. */
const IP_FACTOR = 5; // IP-wide cap = guestLimit * 5 (stops cookie clearing, tolerates shared WiFi)

function getQuota(store, cfg, who, day) {
  if (who.user) {
    const used = store.userUsed(who.user.sub, day);
    return { type: 'user', limit: cfg.userDailyLimit, used, remaining: Math.max(0, cfg.userDailyLimit - used) };
  }
  const used = store.guestCount('gid:' + who.gid);
  const ipBlocked = store.guestCount('ip:' + who.ip) >= cfg.guestLimit * IP_FACTOR;
  return { type: 'guest', limit: cfg.guestLimit, used, remaining: ipBlocked ? 0 : Math.max(0, cfg.guestLimit - used) };
}

function adjust(store, who, day, delta) {
  if (who.user) store.addUser(who.user.sub, day, delta);
  else { store.addGuest('gid:' + who.gid, delta); store.addGuest('ip:' + who.ip, delta); }
}

/** Takes one unit before the (slow) AI call so parallel requests cannot bypass the limit. */
function reserve(store, cfg, who, day) {
  if (getQuota(store, cfg, who, day).remaining <= 0) return false;
  adjust(store, who, day, 1);
  return true;
}
/** Gives the unit back when the analysis fails. */
function release(store, who, day) { adjust(store, who, day, -1); }

module.exports = { getQuota, reserve, release };
