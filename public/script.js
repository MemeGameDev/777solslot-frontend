// public/script.js (full file)
// Combined, cleaned-up client script:
// - disables Play until registered (and holder).
// - registers via ws, handles register_result / registration_revoked.
// - uses assets/seven.png for the "7" symbol.
// - displays toasts, handles spin_result and state updates.

const symbols = ['🍒', '🍋', '🍇', '7'];

// DOM helpers: tolerant selectors (id first, then class)
function $id(name, clsFallback) {
  const byId = document.getElementById(name);
  if (byId) return byId;
  if (clsFallback) {
    return document.querySelector(clsFallback);
  }
  return null;
}
function $(s) { return document.querySelector(s); }
function make(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

// DOM elements (try id then class)
const reelsContainer   = $id('reels-container', '.reels-container');
const resultDiv        = $id('result', '.result-text');
const holdersSpan      = $id('holders', '.holders-count') || document.querySelector('#holders');
const jackpotSpan      = $id('jackpot', '.jackpot-span') || document.querySelector('#jackpot');
const historyList      = $id('history-list', '.history-list') || document.querySelector('#history-list');
const leaderboardList  = $id('leaderboard-list', '.leaderboard-list') || document.querySelector('#leaderboard-list');
const timerDiv         = $id('timer', '.timer') || document.querySelector('#timer');
const playBtn          = $id('play-btn', '.btn.play') || document.querySelector('.btn.play');
const walletInput      = $id('wallet-input', '.wallet-input') || document.querySelector('.wallet-input');
const registerBtn      = $id('register-btn', '.register-btn') || document.querySelector('.register-btn');
const registeredLine   = $id('registered-line', '.registered-line') || document.querySelector('.registered-line');
const jackpotCard      = document.querySelector('.jackpot-card') || null;
const distributedSpan  = $id('distributed', '.distributed') || document.querySelector('#distributed');

const spinSound        = document.getElementById('spin-sound');
const smallWinSound    = document.getElementById('small-win');
const bigWinSound      = document.getElementById('big-win');
const jackpotWinSound  = document.getElementById('jackpot-win');
const timerSound       = document.getElementById('timer-sound');
const backgroundSound  = document.getElementById('background-sound');

let audioAllowed = false;
let isSpinning   = false;
let reelIntervals = [];
let pendingFinalReels = null;
let pendingResultText = null;
let registeredWallet = null;
let payoutEndTs = null;
let payoutInterval = null;

// backend ws URL: prefer meta tag if present
const metaWs = document.querySelector('meta[name="backend-ws"]');
const wsProto = location.protocol === 'https:' ? 'wss' : 'ws';
const wsUrl = (metaWs && metaWs.content) ? metaWs.content : `${wsProto}://${location.host}`;
const ws = new WebSocket(wsUrl);

ws.addEventListener('open', () => {
  safeSend({ action: 'requestState' });
});

ws.addEventListener('message', (ev) => {
  let data;
  try { data = JSON.parse(ev.data); } catch { return; }
  if (!data || typeof data !== 'object') return;

  // registration results
  if (data.type === 'register_result') {
    if (data.ok) {
      registeredWallet = data.wallet || (walletInput && walletInput.value) || null;
      showToast('Registered successfully', 'success');
      setRegisteredUI(registeredWallet);
      setPlayEnabled(true);
    } else {
      const reason = data.reason || 'failed';
      if (reason === 'not_holder') showToast('Not a holder — registration denied', 'error');
      else showToast('Registration failed', 'error');
      setPlayEnabled(false);
    }
    return;
  }

  // registration revoked (single or batch)
  if (data.type === 'registration_revoked' || data.type === 'registration_revoked_batch') {
    const removed = data.type === 'registration_revoked' ? [data.wallet] : (Array.isArray(data.wallets) ? data.wallets : []);
    if (removed.includes(registeredWallet)) {
      registeredWallet = null;
      setRegisteredUI(null);
      setPlayEnabled(false);
      showToast('Your registration was removed — you no longer hold the token', 'error');
    } else {
      // if some other wallets removed, just rebuild state via state broadcast
    }
    return;
  }

  // spin direct result (when server responds)
  if (data.type === 'spin_result') {
    if (data.ok) {
      pendingFinalReels = data.reels || null;
      pendingResultText = data.result || 'Try Again';
      // if reels are returned we stop reels (the current spin cycle will call stopReels)
      // if we are not animating at the moment, show final straight away:
      if (!isSpinning) {
        stopReels(pendingFinalReels, pendingResultText);
        pendingFinalReels = null;
        pendingResultText = null;
      }
    } else {
      const reason = data.reason || 'error';
      if (reason === 'not_registered') showToast('Wallet not registered — register to play', 'error');
      else if (reason === 'not_holder') showToast('Not a holder — cannot play', 'error');
      else showToast('Spin rejected: ' + reason, 'error');
    }
    return;
  }

  // state broadcast (default)
  if (data.type === 'state') {
    if (typeof data.holders === 'number') holdersSpan && (holdersSpan.textContent = String(data.holders));
    if (typeof data.jackpot === 'number' || typeof data.jackpot === 'string') {
      const v = Number(data.jackpot || 0);
      if (jackpotSpan) jackpotSpan.textContent = v.toFixed(4) + ' SOL';
    }
    if (typeof data.distributedPrizes !== 'undefined') {
      if (distributedSpan) distributedSpan.textContent = (Number(data.distributedPrizes || 0)).toFixed(4) + ' SOL';
    }
    // history
    if (Array.isArray(data.history)) {
      historyList && (historyList.innerHTML = '');
      (data.history || []).forEach(h => {
        const li = document.createElement('li');
        const amt = Number(h.amount || 0).toFixed(4);
        const combo = h.combo || "Win";
        li.innerHTML = `${h.wallet || '—'} — <strong>${amt} SOL</strong> <span style="opacity:0.85">(${combo})</span>`;
        historyList && historyList.appendChild(li);
      });
    }
    // leaderboard (pad to 10)
    if (Array.isArray(data.leaderboard)) {
      leaderboardList && (leaderboardList.innerHTML = '');
      const arr = data.leaderboard.slice(0, 10);
      for (let i=0;i<10;i++) {
        const li = document.createElement('li');
        if (arr[i]) li.textContent = `${i+1}. ${arr[i].wallet} — ${arr[i].pts} pts`;
        else li.textContent = `${i+1}. —`;
        leaderboardList.appendChild(li);
      }
    }
    // round timer
    if (data.round && data.round.end) {
      payoutEndTs = Number(data.round.end) || null;
      startPayoutTimer();
    }
    return;
  }
});

// safe send helper
function safeSend(obj){
  try {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
  } catch {}
}

// UI helpers
function showToast(msg, type='info', ttl=2800) {
  let wrap = document.querySelector('.toast-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'toast-wrap';
    document.body.appendChild(wrap);
  }
  const t = document.createElement('div');
  t.className = 'toast ' + (type === 'error' ? 'err' : (type === 'success' ? 'success' : 'info'));
  t.innerHTML = `<div>${msg}</div>`;
  wrap.appendChild(t);
  setTimeout(()=> {
    t.style.opacity = '0';
    setTimeout(()=> t.remove(), 420);
  }, ttl);
}

function setRegisteredUI(wallet) {
  if (registeredLine) registeredLine.textContent = wallet ? `Registered: ${wallet}` : 'Registered: —';
}

function setPlayEnabled(yes) {
  if (!playBtn) return;
  playBtn.disabled = !yes;
  if (yes) playBtn.classList.remove('disabled'); else playBtn.classList.add('disabled');
}

// reels helpers
function randomSymbol(){ return symbols[Math.floor(Math.random()*symbols.length)]; }
function createSymbol(sym){
  const el = document.createElement('div');
  el.classList.add('reel-symbol');
  if (String(sym) === '7' || String(sym).toLowerCase().includes('7')) {
    const img = document.createElement('img');
    img.src = '/assets/seven.png';
    img.alt = '7';
    img.style.height = '56px';
    img.style.objectFit = 'contain';
    el.appendChild(img);
    el.classList.add('seven');
  } else {
    el.textContent = sym;
  }
  return el;
}

function buildReelsInitial(){
  if (!reelsContainer) return;
  reelsContainer.innerHTML = '';
  for (let col=0; col<3; col++){
    const colDiv = document.createElement('div');
    colDiv.classList.add('reel-col');
    for (let r=0; r<3; r++) colDiv.appendChild(createSymbol(randomSymbol()));
    reelsContainer.appendChild(colDiv);
  }
}
buildReelsInitial();

function startReels() {
  const reelCols = document.querySelectorAll('.reel-col');
  reelCols.forEach((col, idx) => {
    reelIntervals[idx] = setInterval(() => {
      col.appendChild(createSymbol(randomSymbol()));
      if (col.children.length > 3) col.removeChild(col.firstChild);
    }, 100 + idx*20);
  });
  isSpinning = true;
  // spin sound
  try { if (spinSound && audioAllowed) { spinSound.currentTime = 0; spinSound.loop = true; spinSound.play().catch(()=>{}); } } catch {}
}

function stopReels(finalReels, resultText){
  reelIntervals.forEach(clearInterval); reelIntervals = [];
  const reelCols = document.querySelectorAll('.reel-col');
  reelCols.forEach((col, idx) => {
    setTimeout(() => {
      if (finalReels && finalReels[idx]) {
        col.innerHTML = '';
        finalReels[idx].forEach(sym => col.appendChild(createSymbol(sym)));
      }
      if (idx === reelCols.length - 1) {
        isSpinning = false;
        try { if (spinSound) { spinSound.pause(); spinSound.currentTime = 0; } } catch {}
        // result
        resultDiv && (resultDiv.textContent = resultText || 'Try Again');
        if (resultText && resultText !== 'Try Again') {
          // flash machine
          const machine = document.querySelector('.machine-panel');
          if (machine) { machine.classList.add('win-flash'); setTimeout(()=> machine.classList.remove('win-flash'), 1200); }
          playResultSound(resultText);
          // glow middle row
          const cols = document.querySelectorAll('.reel-col');
          cols.forEach(c => {
            const mid = c.children[1];
            if (mid) { mid.classList.add('win'); setTimeout(()=> mid.classList.remove('win'), 1200); }
          });
        }
      }
    }, idx * 300);
  });
}

// Play/Timer logic (client-side timer triggers server spin)
let clientTimer = 10;
let cycleState = 'timer'; // 'timer', 'spinning', 'result'
function clientTick() {
  if (cycleState !== 'timer') return;
  // show clientTimer
  if (timerDiv) timerDiv.textContent = String(clientTimer).padStart(2,'0');
  clientTimer--;
  if (clientTimer < 0) {
    // start spin visually and ask server
    startReels();
    cycleState = 'spinning';
    safeSend({ action: 'spin', wallet: registeredWallet });
    // stop after fixed duration if server hasn't provided final reels
    setTimeout(() => {
      stopReels(pendingFinalReels, pendingResultText);
      pendingFinalReels = null;
      pendingResultText = null;
      cycleState = 'result';
      setTimeout(() => { cycleState = 'timer'; clientTimer = 10; }, 1400);
    }, 3500);
  }
}

// update payment countdown based on server round end (payoutEndTs)
function startPayoutTimer(){
  if (payoutInterval) clearInterval(payoutInterval);
  payoutInterval = setInterval(()=> {
    if (!payoutEndTs) { if (timerDiv) timerDiv.textContent = '00:00'; return; }
    const diff = Math.max(0, Math.floor((payoutEndTs - Date.now()) / 1000));
    const mm = Math.floor(diff / 60);
    const ss = diff % 60;
    if (timerDiv) timerDiv.textContent = `${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
  }, 500);
}
startPayoutTimer();

// play sound depending on result string
function playResultSound(resultText){
  try {
    if (!audioAllowed) return;
    const r = String(resultText || '').toLowerCase();
    if (/jackpot|777/.test(r)) {
      if (jackpotWinSound) jackpotWinSound.play().catch(()=>{});
    } else if (/x3|3/.test(r) || /x3/i.test(r)) {
      if (bigWinSound) bigWinSound.play().catch(()=>{});
    } else if (/x2|2/.test(r)) {
      if (smallWinSound) smallWinSound.play().catch(()=>{});
    }
  } catch {}
}

// UI events
if (registerBtn) {
  registerBtn.addEventListener('click', () => {
    const w = (walletInput && walletInput.value) ? String(walletInput.value).trim() : null;
    if (!w) { showToast('Enter a wallet address to register', 'error'); return; }
    safeSend({ action: 'register', wallet: w });
    showToast('Checking wallet...', 'info', 1200);
  });
}

// disable play by default (until registration OK)
setPlayEnabled(false);

if (playBtn) {
  playBtn.addEventListener('click', () => {
    if (!registeredWallet) { showToast('Register a holder wallet to play', 'error'); return; }
    audioAllowed = true;
    try { if (backgroundSound) backgroundSound.play().catch(()=>{}); } catch {}
    // trigger immediate spin via client timer
    clientTimer = 0;
    clientTick();
  });
}

// small "auto timer" loop for clientTick (keeps local UI responsive; final result controlled by server)
setInterval(clientTick, 1000);

// when ws opens we also requested state; but also handle initial enablement if server accepts later

// initial local styling/UX
setRegisteredUI(null);

// Expose some helpers for debugging (optional)
window._solo_debug = {
  registeredSet: () => registeredWallet,
  requestState: () => safeSend({ action: 'requestState' })
};
