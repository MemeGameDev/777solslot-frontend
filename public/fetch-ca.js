// /public/fetch-ca.js
(function () {
  // Try a wide net of selectors so we can't miss wherever CA is rendered.
  const ID_CANDIDATES = ['token-ca-val', 'caText', 'ca', 'tokenCA', 'ca-value'];
  const QUERY_CANDIDATES = [
    '[data-ca-target]', // our explicit marker in index.js
    '.token-ca',        // common class used in header
    '.ca-text'
  ];

  function selectTargets() {
    const els = new Set();
    for (const id of ID_CANDIDATES) {
      const el = document.getElementById(id);
      if (el) els.add(el);
    }
    for (const q of QUERY_CANDIDATES) {
      document.querySelectorAll(q).forEach(el => els.add(el));
    }
    return Array.from(els);
  }

  function writeCA(val) {
    const str = String(val || '---');
    selectTargets().forEach(el => { el.textContent = str; });
    // expose globally for any other scripts/components
    try {
      window.TOKEN_CA = str;
      window.__TOKEN_CA = str;
      document.documentElement.dataset.tokenCa = str;
      window.dispatchEvent(new CustomEvent('tokenCAUpdate', { detail: { ca: str } }));
    } catch (e) {}
  }

  function resolveBackendOrigin() {
    // Prefer runtime globals, then meta tag, then baked env (last resort).
    const w = (typeof window !== 'undefined') ? window : {};
    const fromWindow = w.BACKEND_ORIGIN || w.NEXT_PUBLIC_BACKEND_ORIGIN || w.__BACKEND_ORIGIN || '';
    const meta = document.querySelector('meta[name="backend-origin"]');
    const fromMeta = meta && meta.content || '';
    const env = (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_BACKEND_ORIGIN) || '';
    const base = (fromWindow || fromMeta || env || '').replace(/\/+$/,'');
    if (!base) console.warn('[fetch-ca] backend origin missing');
    return base;
  }

  async function fetchCAOnce() {
    const base = resolveBackendOrigin();
    const url = (base || '') + '/config?t=' + Date.now();
    try {
      const r = await fetch(url, { cache: 'no-store', mode: 'cors' });
      if (!r.ok) {
        console.warn('[fetch-ca] /config non-ok:', r.status, url);
        return;
      }
      const j = await r.json();
      if (j && j.token_ca) {
        writeCA(j.token_ca);
      } else {
        console.warn('[fetch-ca] /config missing token_ca');
      }
    } catch (e) {
      console.warn('[fetch-ca] failed:', e);
    }
  }

  // Initial run on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fetchCAOnce);
  } else {
    fetchCAOnce();
  }

  // Reapply a few times post-load to beat any late scripts that might overwrite
  setTimeout(fetchCAOnce, 800);
  setTimeout(fetchCAOnce, 2000);

  // Keep it fresh (handles backend CA updates without rebuild)
  setInterval(fetchCAOnce, 15000);
})();
