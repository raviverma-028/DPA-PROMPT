import { el } from './dom.js';

async function getJSON(url, opts) {
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

/** Google sign-in + usage counter. The server verifies the Google token; this file only shows UI. */
export function createAuth({ authBox, quotaBox, modalBtnBox, modal, notify }) {
  let me = null;
  let googleReady = false;

  function drawButton(box) {
    box.textContent = '';
    if (!googleReady) { box.textContent = 'Google login is not configured on this server.'; return; }
    window.google.accounts.id.renderButton(box, { theme: 'filled_black', size: 'medium', text: 'signin_with' });
  }

  function render() {
    authBox.textContent = '';
    const q = me.quota;
    if (me.user) {
      const img = el('img', 'avatar'); img.alt = ''; img.referrerPolicy = 'no-referrer'; img.src = me.user.picture || '';
      const out = el('button', null, 'Logout'); out.type = 'button';
      out.addEventListener('click', async () => { await getJSON('/auth/logout', { method: 'POST' }); await refresh(); notify('Logged out.'); });
      authBox.append(img, el('span', null, me.user.name), out);
      quotaBox.textContent = `Signed in: ${q.remaining} of ${q.limit} analyses left today`;
    } else {
      const slot = el('div'); authBox.append(slot);
      if (googleReady) drawButton(slot);
      quotaBox.textContent = `Guest mode: ${q.remaining} free ${q.remaining === 1 ? 'try' : 'tries'} left. Login with Google for more.`;
    }
  }

  async function refresh() { me = await getJSON('/api/me'); render(); }

  async function onCredential({ credential }) {
    try {
      await getJSON('/auth/google', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ credential }) });
      modal.close();
      await refresh();
      notify('Logged in successfully.');
    } catch (e) { notify('Login failed: ' + e.message, true); }
  }

  async function init() {
    try {
      const cfg = await getJSON('/api/config');
      if (cfg.googleClientId) {
        for (let i = 0; i < 50 && !window.google?.accounts; i++) await new Promise((r) => setTimeout(r, 100));
        if (window.google?.accounts) {
          window.google.accounts.id.initialize({ client_id: cfg.googleClientId, callback: onCredential });
          googleReady = true;
        }
      }
    } catch { /* login stays unavailable; guest mode still works */ }
    await refresh();
  }

  return {
    init, refresh,
    isGuest: () => !!me && !me.user,
    canAnalyze: () => !me || me.quota.remaining > 0,
    showLogin() { modal.open(); drawButton(modalBtnBox); },
  };
}
