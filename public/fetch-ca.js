// public/fetch-ca.js
// Loads /config from the backend and writes token CA into #token-ca-val
(function () {
  async function ensureCA() {
    try {
      const res = await fetch('/config', { cache: 'no-store' });
      if (!res.ok) throw new Error('no config');
      const json = await res.json();
      const el = document.getElementById('token-ca-val');
      if (el) el.textContent = json.token_ca || '—';
    } catch (err) {
      console.warn('fetch-ca: failed to load /config', err);
      const el = document.getElementById('token-ca-val');
      if (el && el.textContent === '') el.textContent = '—';
    }
  }

  // run now and periodically (in case backend changed)
  ensureCA();
  setInterval(ensureCA, 30_000);
})();
