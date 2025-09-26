// public/fetch-ca.js
// Loads the token CA from backend /config and inserts it in the page.
// Safe & idempotent, runs on DOMContentLoaded.

(function () {
  async function ensureCA() {
    try {
      // backend endpoint must be reachable from browser
      const resp = await fetch('/config', { cache: 'no-store' });
      if (!resp.ok) return;
      const data = await resp.json();
      const val = (data && data.token_ca) ? String(data.token_ca) : '';
      // find the element where we show CA
      let el = document.getElementById('token-ca-val');
      if (!el) {
        // if not present, try to create a small fallback container next to title
        const title = document.querySelector('.title-block') || document.querySelector('.title');
        if (title) {
          const wrapper = document.createElement('div');
          wrapper.className = 'token-ca-wrapper';
          wrapper.innerHTML = `<span class="token-ca-label">CA:</span> <span id="token-ca-val" class="token-ca-val">–</span>`;
          title.parentNode.insertBefore(wrapper, title.nextSibling);
          el = wrapper.querySelector('#token-ca-val');
        }
      }
      if (el) {
        el.textContent = val || '—';
      }
    } catch (e) {
      // silent failure, don't break the page
      console.warn('fetch-ca.js error', e && e.message ? e.message : e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureCA);
  } else {
    ensureCA();
  }
})();
