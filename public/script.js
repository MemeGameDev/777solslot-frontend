// public/script.js
// Clean client runtime for slot UI (Next-ready)

const symbols = ['🍒', '🍋', '🍇', '7'];

// DOM refs
const reelsContainer   = document.getElementById('reels-container');
const resultDiv        = document.getElementById('result-text') || document.getElementById('result');
const holdersSpan      = document.getElementById('holders-val') || document.getElementById('holders');
const jackpotSpan      = document.getElementById('jackpot-val') || document.getElementById('jackpot');
const leaderboardList  = document.getElementById('leaderboard-list');
const distributedEl    = document.getElementById('distributed-val') || document.getElementById('distributed-prizes');
const payoutTimerEl    = document.getElementById('timer-val') || document.getElementById('payout-timer');
const playBtn          = document.getElementById('spin-btn') || document.getElementById('play-btn');
const registerBtn      = document.getElementById('register-btn');
const walletInput      = document.getElementById('wallet-input');
const registeredLine   = document.getElementById('registered-line');

// sounds (optional)
const spinSound        = document.getElementById('spin-sound');
const smallWinSound    = document.getElementById('small-win');
const bigWinSound      = document.getElementById('big-win');
const jackpotWinSound  = document.getElementById('jackpot-win');
const timerSound       = document.getElementById('timer-sound');
const backgroundSound  = document.getElementById('background-sound');

let ws = null;
let canPlay = false;
let registeredWallet = null;

let reelIntervals = [];
let isSpinning = false;
let pendingFinalReels = null;
let pendingResultText = null;

// ---- helpers ----
function shortAddr(a){ if(!a) return '????'; return a.slice(0,6) + '…' + a.slice(-4); }
function safeSend(obj){ try{ if(ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj)); }catch(e){} }
function formatSol(v){ const n = Number(v || 0); return n.toFixed(3) + ' SOL'; }

// 7 as image
(function createSymbolOverride(){
  window.createSymbol = function(sym){
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
    } else {
      el.textContent = sym;
    }
    return el;
  };
})();

// Build or pad reels to 3x3
(function buildInitialReels(){
  if (!reelsContainer) return;
  let cols = reelsContainer.querySelectorAll('.reel-col');
  if (!cols.length) {
    for (let c = 0; c < 3; c++) {
      const col = document.createElement('div');
      col.className = 'reel-col';
      for (let r = 0; r < 3; r++) col.appendChild(window.createSymbol(symbols[Math.floor(Math.random()*symbols.length)]));
      reelsContainer.appendChild(col);
    }
  } else {
    cols.forEach(col => {
      while (col.children.length < 3) col.appendChild(window.createSymbol(symbols[Math.floor(Math.random()*symbols.length)]));
    });
  }
})();

// ---- WebSocket ----
(function initWS(){
  try {
    const base = (window.BACKEND_ORIGIN || window.location.origin);
    const u = new URL(base);
    const wsProto = u.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${wsProto}://${u.host}`);
    ws.addEventListener('open', () => safeSend({ action: 'requestState' }));
    ws.addEventListener('message', onWsMessage);
  } catch(e){ console.warn('ws init failed', e); }
})();

function onWsMessage(ev) {
  let data = null;
  try { data = JSON.parse(ev.data); } catch { return; }
  if (!data || typeof data !== 'object') return;

  // holders
  if (typeof data.holders === 'number' && holdersSpan) holdersSpan.textContent = data.holders;

  // jackpot / distributed
  if (typeof data.jackpot === 'number' && jackpotSpan) jackpotSpan.textContent = formatSol(data.jackpot);
  if (typeof data.distributedPrizes === 'number' && distributedEl) distributedEl.textContent = formatSol(data.distributedPrizes);

  // leaderboard top 10
  if (Array.isArray(data.leaderboard) && leaderboardList) renderLeaderboard(data.leaderboard);

  // result for current spin (if server sent)
  if (data.currentSpin && data.currentSpin.reels) {
    pendingFinalReels = data.currentSpin.reels;
    pendingResultText = data.currentSpin.result || '';
  }

  // payout percents table
  if (Array.isArray(data.payoutPercents)) renderPayouts(data.payoutPercents);

  // round end -> timer
  if (data.roundEnd && Number(data.roundEnd) > 0) {
    window.__serverRoundSeen = true;
    startCountdownTo(Number(data.roundEnd));
  }
  
  if (data.type === 'register_result') {
    if (data.ok) {
      registeredWallet = data.wallet;
      canPlay = true;
      if (registeredLine) registeredLine.textContent = `Registered: ${shortAddr(registeredWallet)}`;
      if (playBtn) playBtn.disabled = false;
    } else {
      canPlay = false;
      if (playBtn) playBtn.disabled = true;
      if (registeredLine) registeredLine.textContent = `Registered: —`;
      toast(data.reason === 'not_holder' ? 'Wallet is not a holder' : 'Register failed');
    }
  }

  if (data.type === 'can_play') {
    if (!data.ok) {
      canPlay = false;
      if (playBtn) playBtn.disabled = true;
      toast('You are no longer a holder — re-buy and register again to play.');
    } else {
      canPlay = true;
      if (playBtn) playBtn.disabled = false;
    }
  }

  if (data.type === 'spin_result') {
    pendingFinalReels = data.reels || null;
    pendingResultText = data.result || '';
    // stop sooner if we already started
    if (isSpinning) {
      setTimeout(() => {
        stopReels(pendingFinalReels, pendingResultText || 'Try Again');
        pendingFinalReels = null; pendingResultText = null;
      }, 1500);
    }
  }
}

function toast(msg){
  try {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  } catch {}
}

// ---- Reels visuals ----
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
  if (spinSound) { try { spinSound.currentTime = 0; spinSound.loop = true; spinSound.play().catch(()=>{}); } catch {} }
}

function stopReels(finalReels, resultText){
  reelIntervals.forEach(clearInterval);
  reelIntervals = [];
  const reelCols = document.querySelectorAll('.reel-col');
  reelCols.forEach((col, idx) => {
    setTimeout(() => {
      if (finalReels && finalReels[idx]) {
        col.innerHTML = '';
        finalReels[idx].forEach(sym => col.appendChild(window.createSymbol(sym)));
      }
    }, idx * 120);
  });
  isSpinning = false;
  if (spinSound) { try { spinSound.pause(); spinSound.currentTime = 0; } catch {} }
  if (resultDiv && resultText) resultDiv.textContent = String(resultText);
}

// ---- Countdown ----
let _payoutInterval = null;
let _payoutEndTs = null;
const DEFAULT_ROUND_SECS = Number(window.DEFAULT_ROUND_SECS || 600);

function startCountdownTo(timestampMs) {
  if (!timestampMs || isNaN(Number(timestampMs))) return;
  _payoutEndTs = Number(timestampMs);
  if (_payoutInterval) clearInterval(_payoutInterval);

  function tick() {
    const now = Date.now();
    const msLeft = Math.max(0, _payoutEndTs - now);
    const secLeft = Math.floor(msLeft / 1000);
    const mm = String(Math.floor(secLeft / 60)).padStart(2,'0');
    const ss = String(secLeft % 60).padStart(2,'0');
    if (payoutTimerEl) payoutTimerEl.textContent = `${mm}:${ss}`;
    if (msLeft <= 0) {
      // restart next local round countdown
      _payoutEndTs = Date.now() + DEFAULT_ROUND_SECS * 1000;
    }
  }

  tick();
  _payoutInterval = setInterval(tick, 1000);
}

// Allow fetch-ca to push the next payout time
window.addEventListener('next_payout_ready', (ev) => {
  const d = ev && ev.detail;
  if (d && d.nextPayout) startCountdownTo(Number(d.nextPayout));
});

// fallback: start a local 10:00 timer if no server timing arrives shortly
window.addEventListener('load', () => {
  setTimeout(() => {
    if (!window.__serverRoundSeen) startCountdownTo(Date.now() + DEFAULT_ROUND_SECS * 1000);
  }, 1200);
});

// ---- UI actions ----
if (playBtn) {
  playBtn.addEventListener('click', () => {
    if (!canPlay) {
      toast('You must register a holder wallet to play');
      return;
    }
    startReels();
    safeSend({ action: 'spin', wallet: registeredWallet });
    // Safety stop in 3.5s if server result didn't arrive
    setTimeout(() => {
      stopReels(pendingFinalReels, pendingResultText || 'Try Again');
      pendingFinalReels = null; pendingResultText = null;
    }, 3500);
  });
}

if (registerBtn) {
  registerBtn.addEventListener('click', () => {
    const w = (walletInput && walletInput.value || '').trim();
    registeredWallet = w || null;
    safeSend({ action: 'register', wallet: w });
  });
}

// ---- Rendering helpers ----
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

function renderPayouts(arr){
  const list = document.getElementById('payouts-list');
  if (!list) return;
  list.innerHTML = '';
  const a = Array.isArray(arr) ? arr : [];
  for (let i = 0; i < 10; i++){
    const li = document.createElement('li');
    const pct = a[i] ? Math.round(a[i]*1000)/10 : 0;
    li.textContent = `#${i+1} — ${pct}%`;
    list.appendChild(li);
  }
}
