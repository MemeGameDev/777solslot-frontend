const symbols = ['🍒', '🍋', '🍇', '7'];

const reelsContainer   = document.getElementById('reels-container');
const resultDiv        = document.getElementById('result');
const holdersSpan      = document.getElementById('holders');
// MC removed
const jackpotSpan      = document.getElementById('jackpot');
const historyList      = document.getElementById('history-list');
const leaderboardList  = document.getElementById('leaderboard-list');
const timerDiv         = document.getElementById('timer');
const playBtn          = document.getElementById('play-btn');

// Sounds
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

// Hold backend results until spin ends
let pendingFinalReels = null;
let pendingResultText = null;

// WebSocket
const wsProto = location.protocol === 'https:' ? 'wss' : 'ws';
const ws      = new WebSocket(`${wsProto}://${location.host}`);

ws.addEventListener('open', () => {
  safeSend({ action: 'requestState' });
});

// Build reels initially
for (let col = 0; col < 3; col++) {
  const colDiv = document.createElement('div');
  colDiv.classList.add('reel-col');
  for (let row = 0; row < 3; row++) {
    colDiv.appendChild(createSymbol(randomSymbol()));
  }
  reelsContainer.appendChild(colDiv);
}

// Handle server messages
ws.addEventListener('message', (ev) => {
  let data;
  try { data = JSON.parse(ev.data); } catch { return; }
  if (!data || typeof data !== 'object') return;

  // holders
  if (typeof data.holders === 'number') holdersSpan.textContent = data.holders;

  // jackpot
  const jp = (typeof data.jackpot === 'number') ? data.jackpot : 0;
  if (window.animateJackpot) {
    animateJackpot(jp); // smooth roll
  } else {
    if (jackpotSpan) jackpotSpan.textContent = jp.toFixed(4);
  }
  if (jackpotSpan) jackpotSpan.classList.toggle('high', jp > 1);

  // history (only payouts)
  if (historyList) historyList.innerHTML = '';
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

  // leaderboard
  if (leaderboardList) leaderboardList.innerHTML = '';
  (Array.isArray(data.leaderboard) ? data.leaderboard : []).forEach(entry => {
    const li = document.createElement('li');
    const w = String(entry.wallet || '????');
    const c = Number(entry.wins || 0);
    li.textContent = `${w} - ${c} wins`;
    leaderboardList.appendChild(li);
  });

  // capture final result (don’t stop reels yet)
  if (typeof data.currentSpin?.result === 'string' &&
      data.currentSpin.result.length &&
      data.currentSpin.result !== 'Spinning...') {
    pendingFinalReels = data.currentSpin.reels;
    pendingResultText = data.currentSpin.result;
  }
});

// Helpers
function safeSend(obj){
  try {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
  } catch {}
}
function randomSymbol(){ return symbols[Math.floor(Math.random()*symbols.length)]; }
function createSymbol(sym){
  const el = document.createElement('div');
  el.classList.add('reel-symbol');
  if (sym === '7') el.classList.add('seven'); else el.textContent = sym;
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

  if (audioAllowed) {
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
        if (resultDiv) {
          resultDiv.className = ''; // reset classes
          resultDiv.textContent = resultText || 'Try Again';
          if (resultText && /Jackpot/i.test(resultText)) resultDiv.classList.add('jackpot-win');
          else if (resultText && /x3/.test(resultText))  resultDiv.classList.add('triple-win');
          else if (resultText && /x2/.test(resultText))  resultDiv.classList.add('double-win');
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
  if (audioAllowed) {
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
    if (payout === 100)      jackpotWinSound.play().catch(()=>{});
    else if (payout >= 10)   bigWinSound.play().catch(()=>{});
    else if (payout > 0)     smallWinSound.play().catch(()=>{});
  }

  if (payout > 0){
    let particleCount, spread, originY;
    if (payout === 100){ particleCount = 500; spread = 120; originY = 0.6; }
    else if (payout >= 10){ particleCount = 250; spread = 100; originY = 0.7; }
    else { particleCount = 90; spread = 70; originY = 0.8; }
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
function stopAudio(aud){ try{ aud.pause(); aud.currentTime = 0; }catch{} }

if (playBtn) {
  playBtn.addEventListener('click', () => {
    audioAllowed = true;
    try { backgroundSound.play().catch(()=>{}); } catch {}
    if (!isSpinning && cycleState === 'timer') {
      timeLeft = 0; // trigger first spin immediately
      updateTimer();
    }
  });
}

/* ---------- UI tweaks: CA + Register text wiring (merged safely) ---------- */

/*
  These functions are non-destructive and won't interfere with existing register logic.
  They:
   - set the register instruction text as requested
   - attempt to fetch /config to populate #token-ca-val if present
   - wire a register button fallback that calls your original register if you expose it as window.originalRegister
*/

const REGISTER_INSTRUCTION = "To play you have to register the wallet you bought with. (Necessary step for leaderboard purposes)";

function updateRegisterText(){
  const el = document.querySelector('.register-instruction') || document.querySelector('.register-note') || document.querySelector('.registered-line');
  if (el) el.textContent = REGISTER_INSTRUCTION;
}

async function ensureCA(){
  const el = document.getElementById('token-ca-val');
  if (!el) return;
  if (el.textContent && el.textContent.trim() !== '—') return;
  try {
    const res = await fetch('/config', { cache: 'no-store' });
    if (!res.ok) return;
    const j = await res.json();
    if (j && j.token_ca) {
      el.textContent = j.token_ca;
    }
  } catch (e) {
    // not critical; ignore
    console.warn('ensureCA failed:', e && e.message ? e.message : e);
  }
}

function wireRegisterButton(){
  const btn = document.getElementById('register-btn');
  if (!btn) return;
  btn.addEventListener('click', (ev) => {
    // if the app has its own register routine exposed, prefer that
    if (typeof window.originalRegister === 'function') {
      try { window.originalRegister(ev); } catch (e) { console.warn('originalRegister error', e); }
      return;
    }

    // fallback behavior: show registered line for UX
    const input = document.getElementById('wallet-input');
    const regLine = document.getElementById('registered-line');
    const addr = input && input.value ? input.value.trim() : '';
    if (regLine) regLine.textContent = addr ? `Registered: ${addr}` : 'Registered: —';
  });
}

function uiInit() {
  updateRegisterText();
  wireRegisterButton();
  ensureCA();
}

// run ASAP
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', uiInit);
} else {
  uiInit();
}

// Auto-load token CA (legacy small loader) - keep for compatibility; fetch-ca.js also populates #token-ca-val
(function(){var s=document.createElement('script');s.src='/fetch-ca.js';s.async=true;document.head.appendChild(s);})();
