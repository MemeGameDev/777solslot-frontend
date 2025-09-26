// public/fetch-ca.js
(function () {
  // Use explicit backend if provided by the page (window.BACKEND_URL),
  // otherwise fall back to same-origin /config
  const BACKEND = (window.BACKEND_URL || '').replace(/\/$/, '') || '';
  const CONFIG_URL = BACKEND ? `${BACKEND}/config` : '/config';

  async function ensureCA() {
    try {
      const resp = await fetch(CONFIG_URL, { cache: 'no-store' });
      if (!resp.ok) {
        console.warn('fetch-ca: /config returned non-ok', resp.status, CONFIG_URL);
        return;
      }
      const data = await resp.json();

      const caVal = data && data.token_ca ? String(data.token_ca) : '';
      let el = document.getElementById('token-ca-val') || document.getElementById('token-ca');
      if (!el) {
        const titleBlock = document.querySelector('.title-block') || document.querySelector('.title') || document.querySelector('h1');
        if (titleBlock && titleBlock.parentNode) {
          const wrapper = document.createElement('div');
          wrapper.className = 'token-ca-wrapper';
          wrapper.innerHTML = `<span class="token-ca-label">CA:</span> <span id="token-ca-val" class="token-ca-val">—</span>`;
          titleBlock.parentNode.insertBefore(wrapper, titleBlock.nextSibling);
          el = wrapper.querySelector('#token-ca-val');
        }
      }
      if (el) el.textContent = caVal || '—';

      // round end / next payout: support various keys
      let nextPayoutMs = null;
      if (data && data.roundEnd) nextPayoutMs = Number(data.roundEnd);
      else if (data && data.round_end) nextPayoutMs = Number(data.round_end);
      else if (data && data.nextPayout) nextPayoutMs = Number(data.nextPayout);
      else if (data && typeof data.payout_seconds_left === 'number') nextPayoutMs = Date.now() + Number(data.payout_seconds_left) * 1000;

      if (nextPayoutMs && !Number.isNaN(nextPayoutMs)) {
        window.__CA_CONFIG__ = window.__CA_CONFIG__ || {};
        window.__CA_CONFIG__.nextPayout = nextPayoutMs;
        const ev = new CustomEvent('next_payout_ready', { detail: { nextPayout: nextPayoutMs, raw: data } });
        window.dispatchEvent(ev);
      }
    } catch (err) {
      console.warn('fetch-ca: failed to load /config', err?.message || err, CONFIG_URL);
    }
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', ensureCA);
  } else {
    ensureCA();
  }
})();
