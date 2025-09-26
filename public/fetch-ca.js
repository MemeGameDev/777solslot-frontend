// public/fetch-ca.js
// Loads token CA and round info from backend /config and writes into the page.
// Also dispatches a 'next_payout_ready' custom event with the roundEnd timestamp (ms)
// so the client script can start the countdown.

(function () {
  async function ensureCA() {
    try {
      const resp = await fetch('/config', { cache: 'no-store' });
      if (!resp.ok) {
        console.warn('fetch-ca: /config returned non-ok', resp.status);
        return;
      }
      const data = await resp.json();

      // token CA display
      const caVal = data && data.token_ca ? String(data.token_ca) : '';
      let el = document.getElementById('token-ca-val') || document.getElementById('token-ca');
      if (!el) {
        // create fallback small CA display after title (non-intrusive)
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

      // payout/round: prefer roundEnd in ms (number). Accept round_end / roundEnd / nextPayout / payout_ts
      let nextPayoutMs = null;
      if (data && data.roundEnd) nextPayoutMs = Number(data.roundEnd);
      else if (data && data.round_end) nextPayoutMs = Number(data.round_end);
      else if (data && data.nextPayout) nextPayoutMs = Number(data.nextPayout);
      else if (data && typeof data.payout_seconds_left === 'number') nextPayoutMs = Date.now() + Number(data.payout_seconds_left) * 1000;

      if (nextPayoutMs && !Number.isNaN(nextPayoutMs)) {
        // expose on window and also dispatch event so client can react
        window.__CA_CONFIG__ = window.__CA_CONFIG__ || {};
        window.__CA_CONFIG__.nextPayout = nextPayoutMs;
        const ev = new CustomEvent('next_payout_ready', { detail: { nextPayout: nextPayoutMs, raw: data } });
        window.dispatchEvent(ev);
      }
    } catch (err) {
      // not fatal — just log so devs can debug
      // keep quiet in prod though
      if (typeof console !== 'undefined') console.warn('fetch-ca: failed to load /config', err?.message || err);
    }
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', ensureCA);
  } else {
    ensureCA();
  }
})();
