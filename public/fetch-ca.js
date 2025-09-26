// public/fetch-ca.js
// Responsible for obtaining token CA and minimal config from the backend.

(function () {
  const FALLBACK_PUBLIC_BACKEND = ''; // optional: put a stable public backend if you have one
  const LOCAL_BACKEND = 'http://localhost:8080';

  function setTokenCA(ca) {
    if (!ca) return;
    window.TOKEN_CA = ca;
    const el = document.getElementById('token-ca-val');
    if (el) el.textContent = ca;
    window.APP_CONFIG = window.APP_CONFIG || {};
    window.APP_CONFIG.token_ca = ca;
    try { window.dispatchEvent(new CustomEvent('token_ca_ready', { detail: { token_ca: ca } })); } catch (e) {}
  }

  async function tryFetchConfig(url) {
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) return { ok: false, status: r.status };
      const j = await r.json();
      return { ok: true, json: j };
    } catch (err) {
      return { ok: false, error: err };
    }
  }

  async function ensureCA() {
    const tries = [];
    tries.push(location.origin + '/config');
    if (window.BACKEND_URL && typeof window.BACKEND_URL === 'string') {
      tries.push(window.BACKEND_URL.replace(/\/$/, '') + '/config');
    }
    if (FALLBACK_PUBLIC_BACKEND) tries.push(FALLBACK_PUBLIC_BACKEND.replace(/\/$/, '') + '/config');
    tries.push(LOCAL_BACKEND + '/config');

    let lastErr = null;
    for (const url of tries) {
      try {
        const result = await tryFetchConfig(url);
        if (result.ok && result.json) {
          const cfg = result.json;
          window.APP_CONFIG = Object.assign(window.APP_CONFIG || {}, cfg);
          if (cfg.token_ca) setTokenCA(cfg.token_ca);
          // If server provided nextPayout timestamp, notify
          if (cfg.nextPayout) {
            try { window.dispatchEvent(new CustomEvent('next_payout_ready', { detail: { nextPayout: cfg.nextPayout } })); } catch (e) {}
          }
          return cfg;
        } else {
          lastErr = result;
        }
      } catch (e) {
        lastErr = e;
      }
    }

    console.error('fetch-ca: failed to load /config', lastErr);
    return null;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureCA);
  } else {
    ensureCA();
  }
})();
