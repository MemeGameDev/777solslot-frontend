// public/fetch-ca.js
// Fetch /config from backend (tries same-origin first). If not found, uses meta[name="backend-url"] or window.BACKEND_URL as fallback.
// Sets window.APP_CONFIG and dispatches 'next_payout_ready' for the UI to pick up.

(async function ensureCA(){
  try {
    const tryPaths = [
      () => fetch('/config', { credentials: 'same-origin' }),
      // If a backend url meta tag or global exists, try that as well.
      () => {
        const meta = document.querySelector('meta[name="backend-url"]');
        const backend = (meta && meta.content) ? meta.content : (window.BACKEND_URL || '');
        if (!backend) return Promise.reject(new Error('no backend configured'));
        // ensure no trailing slash
        const base = backend.replace(/\/+$/, '');
        return fetch(base + '/config', { mode: 'cors' });
      }
    ];

    let res = null;
    for (const fn of tryPaths) {
      try {
        res = await fn();
        if (res && (res.status === 200 || res.status === 201)) break;
      } catch (e) {
        res = null;
      }
    }

    if (!res || !res.ok) {
      throw new Error('no config');
    }

    const data = await res.json();
    window.APP_CONFIG = window.APP_CONFIG || {};
    if (data.token_ca) {
      window.APP_CONFIG.token_ca = data.token_ca;
      window.TOKEN_CA = data.token_ca;
    }
    if (data.nextPayout) window.APP_CONFIG.nextPayout = Number(data.nextPayout);
    // expose backend url for client-side actions if we used fallback backend
    try {
      const meta = document.querySelector('meta[name="backend-url"]');
      if (meta && meta.content) window.BACKEND_URL = meta.content;
    } catch(e){}

    // Set token text in DOM if present
    const tokenEl = document.getElementById('token-ca-val');
    if (tokenEl && window.APP_CONFIG.token_ca) tokenEl.textContent = window.APP_CONFIG.token_ca;

    // Fire event so scripts can start countdowns
    window.dispatchEvent(new CustomEvent('next_payout_ready', { detail: { nextPayout: window.APP_CONFIG.nextPayout } }));

  } catch (err) {
    // Quietly log and set APP_CONFIG empty so other scripts can still check
    console.warn('fetch-ca: failed to load /config', err && err.message ? err.message : err);
    window.APP_CONFIG = window.APP_CONFIG || {};
    // Dispatch event indicating there's no payout info (so UI can fallback)
    window.dispatchEvent(new CustomEvent('next_payout_ready', { detail: { nextPayout: null } }));
  }
})();
