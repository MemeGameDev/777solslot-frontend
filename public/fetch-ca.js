// public/fetch-ca.js
// Loads /config and exposes token_ca + payout_seconds_left
(function () {
  const BASE = (location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? `${location.protocol}//${location.hostname}:8080` : '';
  async function loadConfig(){
    try {
      const res = await fetch(BASE + '/config', { cache: "no-store" });
      if (!res.ok) throw new Error('no config');
      const cfg = await res.json();
      window.__CA_CONFIG__ = cfg || {};
      // attach visible CA to page if #token-ca-val exists
      const el = document.getElementById('token-ca-val') || document.querySelector('.token-ca span');
      if (el) el.textContent = cfg.token_ca || '—';
      // expose helper
      document.dispatchEvent(new CustomEvent('ca:loaded', { detail: cfg }));
    } catch (err) {
      console.warn('fetch-ca: failed to load /config', err && err.message);
      window.__CA_CONFIG__ = window.__CA_CONFIG__ || {};
      document.dispatchEvent(new CustomEvent('ca:load-failed', { detail: err && err.message }));
    }
  }

  // try on load and then every 60s
  loadConfig();
  setInterval(loadConfig, 60_000);
})();
