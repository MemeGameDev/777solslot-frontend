// public/fetch-ca.js (robust backend origin picker)
(function () {
  function pickBackendOrigin() {
    try {
      // priority: URL ?backend=... > window.BACKEND_ORIGIN > localStorage > data-backend-origin attr > location.origin
      const url = new URL(window.location.href);
      const qp = url.searchParams.get('backend');
      if (qp) {
        localStorage.setItem('BACKEND_ORIGIN', qp);
        window.BACKEND_ORIGIN = qp;
        return qp.replace(/\/$/, '');
      }
      if (window.BACKEND_ORIGIN && typeof window.BACKEND_ORIGIN === 'string') return window.BACKEND_ORIGIN.replace(/\/$/, '');
      const ls = localStorage.getItem('BACKEND_ORIGIN');
      if (ls) { window.BACKEND_ORIGIN = ls; return ls.replace(/\/$/, ''); }
      const attr = document.body && document.body.getAttribute('data-backend-origin');
      if (attr) { window.BACKEND_ORIGIN = attr; return attr.replace(/\/$/, ''); }
      return window.location.origin.replace(/\/$/, '');
    } catch { return window.location.origin.replace(/\/$/, ''); }
  }

  async function ensureCA() {
    try {
      const base = pickBackendOrigin();
      const resp = await fetch(base + '/config', { cache: 'no-store' });
      if (!resp.ok) {
        console.warn('fetch-ca: /config returned non-ok', resp.status, '/config');
        window.APP_CONFIG = window.APP_CONFIG || {};
        window.dispatchEvent(new CustomEvent('next_payout_ready', { detail: { nextPayout: null } }));
        return;
      }
      const data = await resp.json();
      window.APP_CONFIG = window.APP_CONFIG || {};
      window.APP_CONFIG.token_ca = data && (data.token_ca || data.TOKEN_CA) || null;
      window.APP_CONFIG.nextPayout = data && (data.nextPayout || (data.roundEnd || null));

      // Write CA into header
      const tokenEl = document.getElementById('token-ca-val');
      if (tokenEl && window.APP_CONFIG.token_ca) tokenEl.textContent = window.APP_CONFIG.token_ca;

      // Fire event so scripts can start countdowns
      window.dispatchEvent(new CustomEvent('next_payout_ready', { detail: { nextPayout: window.APP_CONFIG.nextPayout } }));
    } catch (err) {
      console.warn('fetch-ca: failed to load /config', err && err.message ? err.message : err);
      window.APP_CONFIG = window.APP_CONFIG || {};
      window.dispatchEvent(new CustomEvent('next_payout_ready', { detail: { nextPayout: null } }));
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureCA);
  } else {
    ensureCA();
  }
})();