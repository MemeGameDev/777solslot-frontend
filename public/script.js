/* public/script.js
   Merged + adapted:
   - Uses IDs from pages/index.js (holders-value, jackpot-value, timer-value, result-text, spin-btn)
   - Robust token-CA loader (tries window var, /config, backend-ws -> https /config)
   - Keeps existing spin logic and WS handling
*/

const symbols = ['🍒', '🍋', '🍇', '7'];

/* --- Element refs (IDs match pages/index.js) --- */
const reelsContainer   = document.getElementById('reels-container');
const resultDiv        = document.getElementById('result-text') || document.getElementById('result');
const holdersSpan      = document.getElementById('holders-value') || document.getElementById('holders');
const jackpotSpan      = document.getElementById('jackpot-value') || document.getElementById('jackpot');
const historyList      = document.getElementById('history-list');
const leaderboardList  = document.getElementById('leaderboard-list');
const timerDiv         = document.getElementById('timer-value') || document.getElementById('timer');
const playBtn          = document.getElementById('spin-btn') || document.getElementById('play-btn');

/* Sounds (may be absent) */
const spinSound        = document.getElementById('spin-sound');
const smallWinSound    = document.getElementById('small-win');
const bigWinSound      = document.getElementById('big-win');
const jackpotWinSound  = document.getElementById('jackpot-win');
const timerSound       = document.getElementById('timer-sound');
const backgroundSound  = document.getElementById('background-sound');

let audioAllowed = false;
let isSpinning   = false;
let cycleState   = 'timer';
let timeLeft     = 5;
let reelIntervals = [];

/* Hold backend results until spin ends */
let pendingFinalReels = null;
let pendingResultText = null;

/* ---------------- WebSocket setup ----------------
   Prefer meta[name="backend-ws"] if present (set in pages/index.js).
   Fall back to location.host (use same-origin websocket server).
*/
function getBackendWsUrl() {
  const meta = document.querySelector('meta[name="backend-ws"]');
  if (meta && meta.content) {
    // ensure trailing slash handling
    return meta.content.replace(/\s+$/,'');
  }
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}`;
}
const wsUrl = getBackendWsUrl();
let ws;
try {
  ws = new WebSocket(wsUrl);
} catch (e) {
  // fallback to host-based ws
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}`);
}

ws.addEventListener('open', () => {
  safeSend({ action: 'requestState' });
});

/* ---------- initial reels build ---------- */
if (reelsContainer) {
  for (let col = 0; col < 3; col++) {
    const colDiv = document.createElement('div');
    colDiv.classList.add('reel-col');
    for (let row = 0; row < 3; row++) {
      colDiv.appendChild(createSymbol(randomSymbol()));
    }
    reelsContainer.appendChild(colDiv);
  }
}

/* ---------- WS message handling ---------- */
ws.addEventListener('message', (ev) => {
  let data;
  try { data = JSON.parse(ev.data); } catch { return; }
  if (!data || typeof data !== 'object') return;

  // holders
  if (typeof data.holders === 'number' && holdersSpan) holdersSpan.textContent = data.holders;

  // jackpot
  const jp = (typeof data.jackpot === 'number') ? data.jackpot : 0;
  if (jackpotSpan) {
    // if you have a smooth animateJackpot function, keep using it — otherwise set text
    if (window.animateJackpot) window.animateJackpot(jp);
    else jackpotSpan.textContent = (typeof jp === 'number') ? jp.toFixed(4) : String(jp);
    jackpotSpan.classList.toggle('high', jp > 1);
  }

  // history (only payouts)
  if (historyList) {
    historyList.innerHTML = '';
    (Array.isArray(data.history) ? data.history : []).forEach(win => {
      const li = document.createElement('li');
      const combo = win.combo || '';
      if (/Jackpot/i.test(combo))       li.classList.add('jackpot-win');
      else if (/x3/.test(combo))        li.classList.add('triple-win');
      else if (/x2/.test(combo))        li.classList.add('double-win');

      const amt = Number(win.amount ?? 0);
      const sig = String(win.sig || '');
      const wallet = String(win.wallet || '????');

      li.innerHTML = `
        ${wallet} — <strong>${amt.toFixed(4)} SOL</strong>
        <span style="opacity:0.85">(${combo || "Win"})</span>
        ${sig ? `<a href="https://solscan.io/tx/${sig}" target="_blank">[tx]</a>` : ''}
      `;
      historyList.appendChild(li);
    });
  }

  // leaderboard
  if (leaderboardList) {
    leaderboardList.innerHTML = '';
    (Array.isArray(data.leaderboard) ? data.leaderboard : []).forEach(entry => {
      const li = document.createElement('li');
      const w = String(entry.wallet || '????');
      const c = Number(entry.wins || 0);
      li.textContent = `${w} - ${c} wins`;
      leaderboardList.appendChild(li);
    });
  }

  // capture final result (don’t stop reels yet)
  if (typeof data.currentSpin?.result === 'string' &&
      data.currentSpin.result.length &&
      data.currentSpin.result !== 'Spinning...') {
    pendingFinalReels = data.currentSpin.reels;
    pendingResultText = data.currentSpin.result;
  }
});

/* ---------- Helpers ---------- */
function safeSend(obj){
  try {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
  } catch {}
}
function randomSymbol(){ return symbols[Math.floor(Math.random()*symbols.length)]; }
function createSymbol(sym){
  const el = document.createElement('div');
  el.classList.add('reel-symbol');
  if (sym === '7') { el.classList.add('seven'); el.textContent = '7'; }
  else el.textContent = sym;
  return el;
}

/* ---------- Spin Cycle ---------- */

function triggerSpinFromTimer(){
  if (cycleState !== 'timer') return;

  stopAudio(timerSound);
  startReels();

  // Ask backend for spin result
  safeSend({ action: 'requestSpin' });

  // End spin after fixed 3.5s
  setTimeout(() => {
    stopReels(pendingFinalReels, pendingResultText);
    pendingFinalReels = null;
    pendingResultText = null;
  }, 3500);
}

function startReels(){
  const reelCols = document.querySelectorAll('.reel-col');
  reelCols.forEach((col, idx) => {
    reelIntervals[idx] = setInterval(() => {
      col.appendChild(createSymbol(randomSymbol()));
      if (col.children.length > 3) col.removeChild(col.firstChild);
    }, 100);
  });

  isSpinning = true;
  cycleState = 'spinning';
  timeLeft = 5;
  if (timerDiv) timerDiv.style.visibility = 'hidden';

  if (audioAllowed && spinSound) {
    try {
      spinSound.currentTime = 0;
      spinSound.loop = true;
      spinSound.play().catch(()=>{});
    } catch {}
  }
}

function stopReels(finalReels, resultText){
  // Stop spinning visuals
  reelIntervals.forEach(clearInterval);
  reelIntervals = [];

  const reelCols = document.querySelectorAll('.reel-col');

  // Staggered stops: left -> middle -> right
  reelCols.forEach((col, idx) => {
    setTimeout(() => {
      if (finalReels && finalReels[idx]) {
        col.innerHTML = '';
        finalReels[idx].forEach(sym => col.appendChild(createSymbol(sym)));
      }
      if (idx === 2) {
        stopAudio(spinSound);

        // color-coded result text
        if (resultDiv) resultDiv.className = ''; // reset classes
        if (resultDiv) resultDiv.textContent = resultText || 'Try Again';
        if (resultDiv && resultText) {
          if (/Jackpot/i.test(resultText)) resultDiv.classList.add('jackpot-win');
          else if (/x3/.test(resultText))  resultDiv.classList.add('triple-win');
          else if (/x2/.test(resultText))  resultDiv.classList.add('double-win');
        }

        if (resultText && resultText !== 'Try Again') {
          celebrateWin(resultText);
        }

        isSpinning = false;
        cycleState = 'result';
        setTimeout(() => {
          cycleState = 'timer';
          if (timerDiv) timerDiv.style.visibility = 'visible';
          timeLeft = 5;
        }, 1500);
      }
    }, idx * 300);
  });
}

/* ---------- Timer ---------- */

function updateTimer(){
  if (cycleState !== 'timer') return;

  if (timerDiv) timerDiv.textContent = timeLeft;
  if (audioAllowed && timerSound) {
    try {
      timerSound.currentTime = 0;
      timerSound.play().catch(()=>{});
    } catch {}
  }
  timeLeft -= 1;

  if (timeLeft < 0){
    triggerSpinFromTimer();
    timeLeft = 5;
  }
}
setInterval(updateTimer, 1000);

/* ---------- Celebration ---------- */

function celebrateWin(result){
  const payouts = {
    'Cherry x2': 1, 'Lemon x2': 1.5, 'Grape x2': 2.5,
    'Cherry x3': 10, 'Lemon x3': 12.5, 'Grape x3': 15,
    '7 7 7 Jackpot!': 100
  };
  const payout = payouts[result] || 0;

  if (audioAllowed){
    if (payout === 100 && jackpotWinSound)      jackpotWinSound.play().catch(()=>{});
    else if (payout >= 10 && bigWinSound)       bigWinSound.play().catch(()=>{});
    else if (payout > 0 && smallWinSound)       smallWinSound.play().catch(()=>{});
  }

  if (payout > 0){
    let particleCount, spread, originY;
    if (payout === 100){ particleCount = 500; spread = 120; originY = 0.6; }
    else if (payout >= 10){ particleCount = 250; spread = 100; originY = 0.7; }
    else { particleCount = 90; spread = 70; originY = 0.8; }

    // confetti if library present
    if (typeof confetti === 'function') {
      confetti({ particleCount, spread, startVelocity: 45, origin: { y: originY } });
    }

    // Flash gold win-line if present
    const winLine = document.getElementById('win-line');
    if (winLine) {
      winLine.classList.add('active');
      setTimeout(() => winLine.classList.remove('active'), 1000);
    }

    // Glow middle row symbols
    const reelCols = document.querySelectorAll('.reel-col');
    reelCols.forEach(col => {
      const mid = col.children[1];
      if (mid) { mid.classList.add('win'); setTimeout(() => mid.classList.remove('win'), 1000); }
    });
  }
}

/* ---------- Helpers ---------- */
function stopAudio(aud){ try{ if (aud) { aud.pause(); aud.currentTime = 0; } }catch{} }

/* ---------- Play button ---------- */
if (playBtn) {
  playBtn.addEventListener('click', () => {
    audioAllowed = true;
    try { if (backgroundSound) backgroundSound.play().catch(()=>{}); } catch {}
    if (!isSpinning && cycleState === 'timer') {
      timeLeft = 0; // trigger first spin immediately
      updateTimer();
    }
  });
}

/* ---------- Token CA loader (robust) ----------
   - If fetch-ca.js sets window.__TOKEN_CA__, use it
   - Otherwise try GET /config (same origin)
   - Otherwise try backend-ws meta -> https://.../config
   - Retries a few times because fetch-ca / backend might not be ready at exact time
*/
async function tryFetchConfigFromOrigin() {
  try {
    const r = await fetch('/config', {cache:'no-cache'});
    if (!r.ok) throw new Error('not-ok');
    const j = await r.json();
    if (j && j.token_ca) return j.token_ca;
  } catch (e) {}
  return null;
}
async function tryFetchConfigFromBackendMeta() {
  try {
    const meta = document.querySelector('meta[name="backend-ws"]');
    if (!meta || !meta.content) return null;
    // convert wss://host to https://host (or ws->http)
    let backend = meta.content.trim();
    backend = backend.replace(/^wss:\/\//i, 'https://').replace(/^ws:\/\//i, 'http://').replace(/\/$/, '');
    // prefer https
    if (!/^https?:\/\//i.test(backend)) backend = (location.protocol === 'https:' ? 'https://' : 'http://') + backend;
    const r = await fetch(`${backend}/config`, {cache:'no-cache'});
    if (!r.ok) throw new Error('not-ok');
    const j = await r.json();
    if (j && j.token_ca) return j.token_ca;
  } catch (e) {}
  return null;
}

async function loadTokenCA(retries = 6, delayMs = 800) {
  const el = document.getElementById('token-ca-val');
  if (!el) return;
  // 1) window var (fetch-ca.js may set this)
  if (window.__TOKEN_CA__) {
    el.textContent = window.__TOKEN_CA__;
    return;
  }
  // 2) try same-origin /config
  let ca = await tryFetchConfigFromOrigin();
  if (ca) { el.textContent = ca; return; }
  // 3) try backend meta
  ca = await tryFetchConfigFromBackendMeta();
  if (ca) { el.textContent = ca; return; }

  // retry a few times (maybe fetch-ca runs slightly later)
  if (retries > 0) {
    setTimeout(() => loadTokenCA(retries - 1, delayMs), delayMs);
  }
}

// kick off CA loader (non-blocking)
loadTokenCA(8, 700);

/* If your separate fetch-ca.js script exists it can set window.__TOKEN_CA__ for immediate display,
   otherwise loadTokenCA fallback will fetch /config or backend /config. */

/* ---------- END of client script ---------- */
