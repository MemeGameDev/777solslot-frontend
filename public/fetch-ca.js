// fetch-ca.js
// Simple snippet: query backend /config for token CA and render into #token-ca
(async function(){
  try {
    const res = await fetch('/config', { cache: 'no-store' });
    if (!res.ok) return;
    const j = await res.json();
    if (j && j.token_ca) {
      const el = document.getElementById('token-ca');
      if (el) el.textContent = j.token_ca;
    }
  } catch (e) {
    // silent fail - leave placeholder
    console.warn('fetch-ca failed', e?.message || e);
  }
})();
