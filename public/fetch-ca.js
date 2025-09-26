// public/fetch-ca.js
(function () {
  async function ensureCA() {
    try {
      const res = await fetch('/config', { cache: 'no-store' });
      if (!res.ok) return hide();
      const json = await res.json();
      const token = (json && json.token_ca) ? String(json.token_ca) : '';
      const elVal = document.getElementById('token-ca-val');
      const container = document.getElementById('token-ca-container');
      if (elVal && container && token) {
        elVal.textContent = token;
        container.style.display = 'inline-block';
      } else if (container) {
        container.style.display = 'none';
      }
    } catch (e) {
      // silent
      const container = document.getElementById('token-ca-container');
      if (container) container.style.display = 'none';
    }
  }

  function hide() {
    const container = document.getElementById('token-ca-container');
    if (container) container.style.display = 'none';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureCA);
  } else {
    ensureCA();
  }
})();
