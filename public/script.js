// public/script.js
/* Main slot frontend logic (websocket + UI + spin visuals)
   Merged from your working script; kept audio + celebration code.
   Note: timer loop is started only after the user clicks PLAY (prevents auto-spins).
*/

const symbols = ['🍒','🍋','🍇','7'];

const reelsContainer   = document.getElementById('reels-container');
const resultDiv        = document.getElementById('result');
const holdersSpan      = document.getElementById('holders');
const jackpotSpan      = document.getElementById('jackpot');
const historyList      = document.getElementById('history-list');
const leaderboardList  = document.getElementById('leaderboard-list');
const timerDiv         = document.getElementById('payout-timer');
const playBtn          = document.getElementById('play-btn');

// sounds (may not always exist)
const spinSound        = document.getElementById('spin-sound');
const smallWinSound    = document.getElementById('small-win');
const bigWinSound      = document.getElementById('big-win');
const jackpotWinSound  = document.getElementById('jackpot-win');
const backgroundSound  = document.getElementById('background-sound');

let audioAllowed = false;
let isSpinning   = false;
let cycleState   = 'idle'; // changed from 'timer' -> 'idle' to avoid auto-spins
let timeLeft     = 5;
let reelIntervals = [];
let timerIntervalId = null;
let timerLoopStarted = false;

// Hold backend results until spin ends
let pendingFinalReels = null;
let pendingResultText = null;

// WebSocket (use meta in page to determine backend ws if needed)
const metaWs = document.querySelector('meta[name="backend-ws"]');
const wsProto = metaWs ? (metaWs.content.startsWith('wss') ? 'wss' : 'ws') : (location.protocol === 'https:' ? 'wss' : 'ws');
const wsHost  = metaWs ? metaWs.content.replace(/^wss?:\/\//,'').replace(/\/$/,'') : location.host;
const ws      = new WebSocket(`${wsProto}://${wsHost}`);

ws.addEventListener('open', () => {
  safeSend({ action: 'requestState' });
});

// Build empty reels initially (3 columns x 3 rows)
for (let col = 0; col < 3; col++) {
  const colDiv = document.createElement('div');
  colDiv.classList.add('reel-col');
  for (let row = 0; row < 3; row++) {
    colDiv.appendChild(createSymbol(randomSymbol()));
  }
  reelsContainer.appendChild(colDiv);
}

// WS messages from server
ws.addEventListener('message', (ev) => {
  let data;
  try { data = JSON.parse(ev.data); } catch { return; }
  if (!data || typeof data !== 'object') return;

  // holders
  if (typeof data.holders === 'number') holdersSpan.textContent = data.holders;

  // jackpot (smooth animation if available)
  const jp = (typeof data.jackpot === 'number') ? data.jackpot : 0;
  if (typeof animateJackpot === 'function') {
    animateJackpot(jp);
  } else {
    jackpotSpan.textContent = jp.toFixed(4);
  }
  jackpotSpan.classList.toggle('high', jp > 1);

  // history
  if (Array.isArray(data.history)) {
    historyList.innerHTML = '';
    data.history.forEach(win => {
      const li = document.createElement('li');
      const amt = Number(win.amount ?? 0);
      const sig = String(win.sig || '');
      const wallet = String(win.wallet || '????');
      const combo = win.combo || 'Win';
      li.innerHTML = `${wallet} — <strong>${amt.toFixed(4)} SOL</strong> <span style="opacity:0.85">(${combo})</span> ${sig ? `<a href="https://solscan.io/tx/${sig}" target="_blank">[tx]</a>` : ''}`;
      if (/Jackpot/i.test(combo)) li.classList.add('jackpot-win');
      historyList.appendChild(li);
    });
  }

  // leaderboard
  if (Array.isArray(data.leaderboard)) {
    leaderboardList.innerHTML = '';
    data.leaderboard.forEach(entry => {
      const li = document.createElement('li');
      const w = String(entry.wallet || '????');
      const c = Number(entry.wins || 0);
      li.textContent = `${w} - ${c} wins`;
      leaderboardList.appendChild(li);
    });
  }

  // Handle any server-side "currentSpin" final result
  if (data.currentSpin?.result && data.currentSpin.result !== 'Spinning...') {
    pendingFinalReels = data.currentSpin.reels || null;
    pendingResultText = data.currentSpin.result;
  }

  // If server wants the client to run timing rounds, check fields (optional)
  if (typeof data.payoutSeconds === 'number') {
    // start timer loop with server-specified time left
    timeLeft = Math.max(0, Math.floor(data.payoutSeconds));
    if (!timerLoopStarted) startTimerLoop();
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
  if (sym === '7') {
    el.classList.add('seven');
    // for seven we also show the icon text
    el.textContent = '7';
  } else {
    el.textContent = sym;
  }
  return el;
}

/* ---------- Spin Cycle ---------- */

function triggerSpinFromTimer(){
  if (cycleState !== 'timer') return;

  stopAudio(timerSound);
  startReels();

  safeSend({ action: 'requestSpin' });

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
  timerDiv.style.visibility = 'hidden';

  if (audioAllowed) {
    try {
      if (spinSound) { spinSound.currentTime = 0; spinSound.loop = true; spinSound.play().catch(()=>{}); }
    } catch {}
  }
}

function stopReels(finalReels, resultText){
  reelIntervals.forEach(clearInterval);
  reelIntervals = [];

  const reelCols = document.querySelectorAll('.reel-col');

  reelCols.forEach((col, idx) => {
    setTimeout(() => {
      if (finalReels && finalReels[idx]) {
        col.innerHTML = '';
        finalReels[idx].forEach(sym => col.appendChild(createSymbol(sym)));
      }
      if (idx === 2) {
        try { if (spinSound) { spinSound.pause(); spinSound.currentTime = 0; } } catch {}

        resultDiv.className = '';
        resultDiv.textContent = resultText || 'Try Again';
        if (resultText && /Jackpot/i.test(resultText)) resultDiv.classList.add('jackpot-win');
        else if (resultText && /x3/.test(resultText))  resultDiv.classList.add('triple-win');
        else if (resultText && /x2/.test(resultText))  resultDiv.classList.add('double-win');

        if (resultText && resultText !== 'Try Again') celebrateWin(resultText);

        isSpinning = false;
        cycleState = 'result';
        setTimeout(() => {
          cycleState = 'timer';
          timerDiv.style.visibility = 'visible';
          timeLeft = 5;
        }, 1500);
      }
    }, idx * 300);
  });
}

/* ---------- Timer (manual start) ---------- */

function updateTimer(){
  if (cycleState !== 'timer') return;

  timerDiv.textContent = timeLeft;
  timeLeft -= 1;

  if (timeLeft < 0){
    triggerSpinFromTimer();
    timeLeft = 5;
  }
}

function startTimerLoop(){
  if (timerLoopStarted) return;
  timerLoopStarted = true;
  cycleState = 'timer';
  if (timerIntervalId) clearInterval(timerIntervalId);
  timerIntervalId = setInterval(updateTimer, 1000);
}

/* ---------- Celebration ---------- */

function celebrateWin(result){
  const payouts = {
    'Cherry x2': 1, 'Lemon x2': 1.5, 'Grape x2': 2.5,
    'Cherry x3': 10, 'Lemon x3': 12.5, 'Grape x3': 15,
    '7 7 7 Jackpot!': 100
  };
  const payout = payouts[result] || 0;

  if (audioAllowed){
    try {
      if (payout === 100)      jackpotWinSound.play().catch(()=>{});
      else if (payout >= 10)   bigWinSound.play().catch(()=>{});
      else if (payout > 0)     smallWinSound.play().catch(()=>{});
    } catch {}
  }

  if (payout > 0){
    let particleCount = 90, spread = 70, originY = 0.8;
    if (payout === 100){ particleCount = 500; spread = 120; originY = 0.6; }
    else if (payout >= 10){ particleCount = 250; spread = 100; originY = 0.7; }
    try { confetti({ particleCount, spread, startVelocity: 45, origin: { y: originY } }); } catch {}

    // Flash win-line
    const winLine = document.getElementById('win-line');
    if (winLine) {
      winLine.classList.add('active');
      setTimeout(() => winLine.classList.remove('active'), 1000);
    }

    // Glow mid symbols
    const reelCols = document.querySelectorAll('.reel-col');
    reelCols.forEach(col => {
      const mid = col.children[1];
      if (mid) { mid.classList.add('win'); setTimeout(() => mid.classList.remove('win'), 1000); }
    });
  }
}

/* ---------- Helpers ---------- */
function stopAudio(aud){ try{ aud.pause(); aud.currentTime = 0; }catch{} }

playBtn.addEventListener('click', () => {
  audioAllowed = true;
  try { backgroundSound.play().catch(()=>{}); } catch {}
  if (!isSpinning && cycleState !== 'spinning') {
    // Start timer loop (if not already running) and trigger an immediate spin
    startTimerLoop();
    // trigger immediate spin by setting timeLeft to 0 (updateTimer will call triggerSpinFromTimer)
    timeLeft = 0;
    updateTimer();
  }
});
