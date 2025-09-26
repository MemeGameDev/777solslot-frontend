// public/fetch-ca.js
// Simple helper: fetch backend config.token_ca and populate #token-ca-val
(function () {
  async function setCA() {
    try {
      const res = await fetch('/config', { cache: 'no-store' });
      if (!res.ok) return console.warn('fetch-ca: /config returned', res.status);
      const json = await res.json();
      const val = json && (json.token_ca || json.token_ca === '' ? json.token_ca : null);
      const el = document.getElementById('token-ca-val');
      if (el) el.textContent = val && val.length ? val : '—';
    } catch (e) {
      console.warn('fetch-ca: error', e?.message || e);
    }
  }

  // run asap, and again after DOM loaded for safety
  setCA();
  document.addEventListener('DOMContentLoaded', setCA);
})();
