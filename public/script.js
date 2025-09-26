// public/script.js
// Main client runtime for slot UI
// - websocket state handling
// - reels visuals & spin
// - leaderboards (always show top 10)
// - payout countdown (server-driven, fallback local 10m)
// - render '7' as image (public/assets/seven.png)

const symbols = ['🍒', '🍋', '🍇', '7'];

const reelsContainer   = document.getElementById('reels-container');
const resultDiv        = document.getElementById('result') || document.getElementById('result-text');
const holdersSpan      = document.getElementById('holders') || document.getElementById('holders-val');
const jackpotSpan      = document.getElementById('jackpot') || document.getElementById('jackpot-val');
const historyList      = document.getElementById('history-list') || document.getElementById('history-list');
const leaderboardList  = document.getElementById('leaderboard-list');
const payoutTimerEl    = document.getElementById('payout-timer') || document.getElementById('timer-val') || document.getElementById('timer');
const distributedEl    = document.getElementById('distributed-prizes') || document.getElementById('distributed-val');
const playBtn          = document.getElementById('play-btn') || document.getElementById('spin-btn');

const spinSound        = document.getElementById('spin-sound');
const smallWinSound    = document.getElementById('small-win');
const bigWinSound      = document.getElementById('big-win');
const jackpotWinSound  = document.getElementById('jackpot-win');
const timerSound       = document.getElementById('timer-sound');
const backgroundSound  = document.getElementById('background-sound');

let audioAllowed = false;
let isSpinning   = false;
let cycleState   = 'timer';
let clientTimer  = 10; // legacy local timer (keeps UI responsive)
let reelIntervals = [];

let pendingFinalReels = null;
let pendingResultText = null;

let ws = null;
// WS init — use explicit backend if provided
(function initWebSocket(){
  try {
    // prefer explicit WS endpoint (BACKEND_WS),
    // then derive WS from BACKEND_URL (http->ws, https->wss),
    // fallback to same-origin (previous behavior).
    const explicitWs = window.BACKEND_WS || null;
    const backendUrl = (window.BACKEND_URL || '').replace(/\/$/, '');

    let wsUrl;
    if (explicitWs) {
      wsUrl = explicitWs.replace(/\/$/, '');
    } else if (backendUrl) {
      wsUrl = backendUrl.replace(/^http/, (m) => m === 'http' ? 'ws' : 'wss');
    } else {
      const wsProto = location.protocol === 'https:' ? 'wss' : 'ws';
      wsUrl = `${wsProto}://${location.host}`;
    }

    console.info('WebSocket connecting to', wsUrl);
    ws = new WebSocket(wsUrl);
    ws.addEventListener('open', () => {
      try { ws.send(JSON.stringify({ action: 'requestState' })); } catch {}
    });
    ws.addEventListener('message', onWsMessage);
    ws.addEventListener('close', ()=>{ console.warn('ws closed', wsUrl); });
    ws.addEventListener('error', (e) => console.warn('ws error', e));
  } catch(e){ console.warn('ws init failed', e); }
})();

function shortAddr(a){ if(!a) return '????'; return a.slice(0,6) + '…' + a.slice(-4); }
function safeSend(obj){ try{ if(ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj)); }catch{} }

/* ---------- createSymbol override for 7-image ---------- */
(function createSymbolOverride(){
  const original = window.createSymbol || null;
  function createSymbolWithImage(sym){
    const el = document.createElement('div');
    el.className = 'reel-symbol';
    if (sym === '7' || String(sym).toLowerCase().includes('7')) {
      const img = document.createElement('img');
      img.src = '/assets/seven.png';
      img.alt = '7';
      img.style.width = '62%';
      img.style.height = 'auto';
      img.style.objectFit = 'contain';
      el.appendChild(img);
      el.classList.add('seven');
    } else {
      el.textContent = sym;
    }
    return el;
  }
  window.createSymbol = createSymbolWithImage;
  if (!original) window.createSymbolOriginal = createSymbolWithImage;
})();

/* ---------- Build initial reels if missing (safe) ---------- */
(function buildInitialReels(){
  if (!reelsContainer) return;
  if (reelsContainer.querySelectorAll('.reel-col').length) return;
  for (let col = 0; col < 3; col++) {
    const colDiv = document.createElement('div');
    colDiv.classList.add('reel-col');
    for (let row = 0; row < 3; row++) {
      colDiv.appendChild(window.createSymbol(symbols[Math.floor(Math.random()*symbols.length)]));
    }
    reelsContainer.appendChild(colDiv);
  }
})();

/* ---------- WebSocket message handling ---------- */
function onWsMessage(ev) {
  let data = null;
  try { data = JSON.parse(ev.data); } catch { return; }
  if (!data || typeof data !== 'object') return;

  // holders
  if (typeof data.holders === 'number' && holdersSpan) holdersSpan.textContent = data.holders;

  // jackpot (roll animation if desired)
  if (typeof data.jackpot === 'number' && jackpotSpan) {
    jackpotSpan.textContent = Number(data.jackpot).toFixed(4) + (String(jackpotSpan.textContent||'').includes('SOL') ? '' : ' SOL');
    jackpotSpan.classList.toggle('high', data.jackpot > 1);
  }

  // distributed
  if (typeof data.distributedPrizes === 'number' && distributedEl) {
    distributedEl.textContent = Number(data.distributedPrizes).toFixed(4) + ' SOL';
  }

  // history
  if (Array.isArray(data.history) && historyList) {
    historyList.innerHTML = '';
    data.history.forEach(h => {
      const li = document.createElement('li');
      const wallet = String(h.wallet || '—');
      const amt = Number(h.amount || 0);
      li.innerHTML = `${shortAddr(wallet)} — <strong>${amt.toFixed(4)} SOL</strong> <span style="opacity:0.85">(${String(h.combo||'Win')})</span>`;
      historyList.appendChild(li);
    });
  }

  // leaderboard (ensure top 10)
  if (Array.isArray(data.leaderboard) && leaderboardList) {
    renderLeaderboard(data.leaderboard);
  }

  // capture final result for spin visuals
  if (data.currentSpin && typeof data.currentSpin.result === 'string') {
    if (data.currentSpin.reels) pendingFinalReels = data.currentSpin.reels;
    pendingResultText = data.currentSpin.result;
  }

  // if server provides roundEnd (ms), start countdown
  if (data.roundEnd && Number(data.roundEnd) > 0) {
    startCountdownTo(Number(data.roundEnd));
  } else if (typeof data.payout_seconds_left === 'number') {
    // alternative: server provided seconds left
    startCountdownTo(Date.now() + data.payout_seconds_left * 1000);
  }
}

/* ---------- Reel visuals ---------- */

function randomSymbol(){ return symbols[Math.floor(Math.random()*symbols.length)]; }

function startReels(){
  const reelCols = document.querySelectorAll('.reel-col');
  reelCols.forEach((col, idx) => {
    reelIntervals[idx] = setInterval(() => {
      col.appendChild(window.createSymbol(randomSymbol()));
      if (col.children.length > 3) col.removeChild(col.firstChild);
    }, 100);
  });
  isSpinning = true;
  cycleState = 'spinning';
  if (audioAllowed && spinSound) {
    try { spinSound.currentTime = 0; spinSound.loop = true; spinSound.play().catch(()=>{}); } catch {}
  }
}

function stopReels(finalReels, resultText){
  reelIntervals.forEach(clearInterval);
  reelIntervals = [];
  const reelCols = document.querySelectorAll('.reel-col');
  reelCols.forEach((col, idx) => {
    setTimeout(() => {
      if (finalReels && Array.isArray(finalReels[idx])) {
        col.innerHTML = '';
        finalReels[idx].forEach(sym => col.appendChild(window.createSymbol(sym)));
      }
      if (idx === 2) {
        if (spinSound) { try { spinSound.pause(); spinSound.currentTime = 0; } catch{} }
        // result text & celebration
        if (resultText && resultDiv) {
          resultDiv.textContent = resultText;
          if (/jackpot/i.test(resultText)) {
            if (jackpotWinSound) jackpotWinSound.play().catch(()=>{});
          } else if (/x3|triple|big/i.test(resultText)) {
            if (bigWinSound) bigWinSound.play().catch(()=>{});
          } else if (resultText !== 'Try Again') {
            if (smallWinSound) smallWinSound.play().catch(()=>{});
          }
          // flash
          const machine = document.querySelector('.machine-panel');
          if (machine) { machine.classList.add('win-flash'); setTimeout(()=> machine.classList.remove('win-flash'), 1100); }
        }
        isSpinning = false;
        cycleState = 'result';
        setTimeout(()=> { cycleState = 'timer'; }, 1500);
      }
    }, idx * 300);
  });
}

/* ---------- Auto-timer (legacy client tick kept for responsiveness) ---------- */
setInterval(()=> {
  if (cycleState !== 'timer') return;
  clientTimer--;
  if (clientTimer < 0) {
    // ask server to spin (if allowed) - server will reply with spin result
    startReels();
    safeSend({ action: 'requestSpin' });
    // stop after a fixed time if server hasn't returned final reels
    setTimeout(()=> {
      stopReels(pendingFinalReels, pendingResultText || 'Try Again');
      pendingFinalReels = null; pendingResultText = null;
      clientTimer = 10;
    }, 3500);
  }
}, 1000);

/* ---------- Leaderboard helper (always show top 10) ---------- */
function renderLeaderboard(arr){
  if (!leaderboardList) return;
  leaderboardList.innerHTML = '';
  const list = Array.isArray(arr) ? arr.slice(0,10) : [];
  for (let i = 0; i < 10; i++){
    const li = document.createElement('li');
    const entry = list[i];
    if (entry) {
      const wallet = String(entry.wallet || '—');
      const pts = Number(entry.pts || entry.wins || 0);
      li.textContent = `${i+1}. ${shortAddr(wallet)} - ${pts} pts`;
    } else {
      li.textContent = `${i+1}. —`;
      li.classList.add('placeholder');
    }
    leaderboardList.appendChild(li);
  }
}

/* ---------- Payout Countdown (server-driven, fallback local) ---------- */

let _payoutInterval = null;
let _payoutEndTs = null;

function startCountdownTo(timestampMs) {
  if (!timestampMs || isNaN(Number(timestampMs))) return;
  _payoutEndTs = Number(timestampMs);
  if (_payoutInterval) clearInterval(_payoutInterval);

  function tick() {
    const now = Date.now();
    let msLeft = Math.max(0, _payoutEndTs - now);
    const secLeft = Math.floor(msLeft / 1000);
    const mm = String(Math.floor(secLeft / 60)).padStart(2,'0');
    const ss = String(secLeft % 60).padStart(2,'0');
    if (payoutTimerEl) payoutTimerEl.textContent = `${mm}:${ss}`;
    if (msLeft <= 0) {
      // attempt to trigger server payout (fire-and-forget)
      try {
        fetch('/payout', { method: 'POST' }).catch(()=>{});
      } catch (e) {}
      // set next round to +10min
      _payoutEndTs = Date.now() + 10 * 60 * 1000;
    }
  }

  tick();
  _payoutInterval = setInterval(tick, 1000);
}

/* allow external triggers (fetch-ca dispatches next_payout_ready) */
window.addEventListener('next_payout_ready', (ev) => {
  const d = ev && ev.detail;
  if (d && d.nextPayout) startCountdownTo(Number(d.nextPayout));
});

/* ---------- Small helpers ---------- */
function stopAudio(aud){ try{ aud.pause(); aud.currentTime = 0; }catch{} }

/* ---------- Play button / registration logic (minimal enforcement) ---------- */
// assume registration + holder checks are handled by server; UI only enforces button disabled until server marks eligible.
// server should broadcast `registeredWallets` or `youAreHolder` etc. We'll listen for a "canPlay" boolean in state

let canPlay = true; // default to true; server can override
function enablePlay(yes){
  canPlay = !!yes;
  if (playBtn) {
    playBtn.disabled = !canPlay;
    playBtn.classList.toggle('disabled', !canPlay);
  }
}
enablePlay(true);

// When play button clicked, trigger spin request (if allowed)
if (playBtn) {
  playBtn.addEventListener('click', () => {
    if (!canPlay) {
      // small UI hint
      const t = document.createElement('div');
      t.className = 'toast';
      t.textContent = 'You must register a holder wallet to play';
      document.body.appendChild(t);
      setTimeout(()=> t.remove(), 2200);
      return;
    }
    audioAllowed = true;
    try { if (backgroundSound) backgroundSound.play().catch(()=>{}); } catch {}
    // start visual reels and ask server for spin
    startReels();
    safeSend({ action: 'requestSpin' });
    setTimeout(()=> {
      stopReels(pendingFinalReels, pendingResultText || 'Try Again');
      pendingFinalReels = null; pendingResultText = null;
    }, 3500);
  });
}

/* ---------- Expose minor helpers for debugging from console ---------- */
window._startCountdownTo = startCountdownTo;
window._renderLeaderboard = renderLeaderboard;
window._createSymbol = window.createSymbol;
