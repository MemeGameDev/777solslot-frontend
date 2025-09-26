// /public/fetch-ca.js
(function () {
  // include the id used in your header
  const EL_IDS = ['caText', 'ca', 'tokenCA', 'ca-value', 'token-ca-val'];

  function setCA(val) {
    for (const id of EL_IDS) {
      const el = document.getElementById(id);
      if (el) el.textContent = String(val || '---');
    }
  }

  function resolveBackendOrigin() {
    // Prefer runtime globals, then meta tag, then baked env.
    const fromWindow =
      (typeof window !== 'undefined' && (
        window.BACKEND_ORIGIN ||
        window.NEXT_PUBLIC_BACKEND_ORIGIN ||
        window.__BACKEND_ORIGIN
      )) || '';

    const meta = document.querySelector('meta[name="backend-origin"]');
    const fromMeta = meta && meta.content;

    // Note: process.env.* is baked at build; fallback only.
    const fromEnv =
      (typeof process !== 'undefined' &&
        process.env &&
        process.env.NEXT_PUBLIC_BACKEND_ORIGIN) ||
      '';

    const base = (fromWindow || fromMeta || fromEnv || '').replace(/\/+$/,'');
    if (!base) {
      console.warn('fetch-ca: backend origin unknown; set NEXT_PUBLIC_BACKEND_ORIGIN or <meta name="backend-origin"...>');
    }
    return base;
  }

  async function ensureCA() {
    try {
      const base = resolveBackendOrigin();
      const url = (base || '') + '/config?t=' + Date.now(); // cache-bust
      const r = await fetch(url, { cache: 'no-store', mode: 'cors' });
      if (!r.ok) {
        console.warn('fetch-ca: /config returned non-ok', r.status, url);
        return;
      }
      const j = await r.json();
      if (j && j.token_ca) {
        setCA(j.token_ca);
      }
    } catch (e) {
      console.warn('fetch-ca: failed to load /config', e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureCA);
  } else {
    ensureCA();
  }
})();
