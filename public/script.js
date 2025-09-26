// public/script.js
/* merged client script — reels, WS, timer, celebration, etc. */
/* kept function names and behavior from your version to preserve working logic */

const symbols = ['🍒', '🍋', '🍇', '7'];

const reelsContainer   = document.getElementById('reels-container');
const resultDiv        = document.getElementById('result');
const holdersSpan      = document.getElementById('holders');
const jackpotSpan      = document.getElementById('jackpot');
const historyList      = document.getElementById('history-list');
const leaderboardList  = document.getElementById('leaderboard-list');
const timerDiv         = document.getElementById('timer');
const playBtn          = document.getElementById('play-btn');

// Sounds (optional elements - keep safe)
const spinSound        = document.getElementById('spin-sound') || new Audio();
const smallWinSound    = document.getElementById('small-win') || new Audio();
const bigWinSound      = document.getElementById('big-win') || new Audio();
const jackpotWinSound  = document.getElementById('jackpot-win') || new Audio();
const timerSound       = document.getElementById('timer-sound') || new Audio();
const backgroundSound  = document.getElementById('background-sound') || new Audio();

let audioAllowed = false;
let isSpinning   = false;
let cycleState   = 'timer';
let timeLeft     = 5;
let reelIntervals = [];

// Hold backend results until spin ends
let pendingFinalReels = null;
let pendingResultText = null;

// WebSocket — using same host
const wsProto = location.protocol === 'https:' ? 'wss' : 'ws';
const ws      = new WebSocket(`${wsProto}://${location.host}`);

ws.addEventListener('open', () => {
  safeSend({ action: 'requestState' });
});

ws.addEventListener('message', (ev) => {
  let data;
  try { data = JSON.parse(ev.data); } catch { return; }
  if (!data || typeof data !== 'object') return;

  if (typeof data.holders === 'number') {
    if (holdersSpan) holdersSpan.textContent = data.holders;
  }

  const jp = (typeof data.jackpot === 'number') ? data.jackpot : 0;
  if (jackpotSpan) {
    jackpotSpan.textContent = typeof jp === 'number' ? jp.toFixed(4) : String(jp);
    jackpotSpan.classList.toggle('high', jp > 1);
  }

  historyList && (historyList.innerHTML = '');
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
    historyList && historyList.appendChild(li);
  });

  leaderboardList && (leaderboardList.innerHTML = '');
  (Array.isArray(data.leaderboard) ? data.leaderboard : []).forEach(entry => {
    const li = document.createElement('li');
    const w = String(entry.wallet || '????');
    const c = Number(entry.wins || 0);
    li.textContent = `${w} - ${c} wins`;
    leaderboardList && leaderboardList.appendChild(li);
  });

  if (typeof data.currentSpin?.result === 'string' &&
      data.currentSpin.result.length &&
      data.currentSpin.result !== 'Spinning...') {
    pendingFinalReels = data.currentSpin.reels;
    pendingResultText = data.currentSpin.result;
  }
});

function safeSend(obj){
  try {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
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

  safeSend({ action: 'requestSpin' });

  setTimeout(() => {
    stopReels(pendingFinalReels, pendingResultText);
    pendingFinalReels = null;
    pendingResultText = null;
  }, 3500);
}

function startReels(){
  const reelCols = document.querySelectorAll('.reel-col');
  if (reelCols.length === 0) {
    // build if not present
    for (let col = 0; col < 3; col++) {
      const colDiv = document.createElement('div');
      colDiv.classList.add('reel-col');
      for (let row = 0; row < 3; row++) colDiv.appendChild(createSymbol(randomSymbol()));
      reelsContainer.appendChild(colDiv);
    }
  }

  const cols = document.querySelectorAll('.reel-col');
  cols.forEach((col, idx) => {
    reelIntervals[idx] = setInterval(() => {
      col.appendChild(createSymbol(randomSymbol()));
      if (col.children.length > 3) col.removeChild(col.firstChild);
    }, 100);
  });

  isSpinning = true;
  cycleState = 'spinning';
  timeLeft = 5;
  timerDiv && (timerDiv.style.visibility = 'hidden');

  if (audioAllowed) {
    try {
      spinSound.currentTime = 0;
      spinSound.loop = true;
      spinSound.play().catch(()=>{});
    } catch {}
  }
}

function stopReels(finalReels, resultText){
  reelIntervals.forEach(clearInterval);
  reelIntervals = [];

  const reelCols = document.querySelectorAll('.reel-col');
  if (reelCols.length === 0) return;

  reelCols.forEach((col, idx) => {
    setTimeout(() => {
      if (finalReels && finalReels[idx]) {
        col.innerHTML = '';
        finalReels[idx].forEach(sym => col.appendChild(createSymbol(sym)));
      }
      if (idx === 2) {
        stopAudio(spinSound);

        resultDiv && (resultDiv.className = '');
        if (resultDiv) resultDiv.textContent = resultText || 'Try Again';
        if (resultText && /Jackpot/i.test(resultText)) resultDiv.classList.add('jackpot-win');
        else if (resultText && /x3/.test(resultText))  resultDiv.classList.add('triple-win');
        else if (resultText && /x2/.test(resultText))  resultDiv.classList.add('double-win');

        if (resultText && resultText !== 'Try Again') {
          celebrateWin(resultText);
        }

        isSpinning = false;
        cycleState = 'result';
        setTimeout(() => {
          cycleState = 'timer';
          timerDiv && (timerDiv.style.visibility = 'visible');
          timeLeft = 5;
        }, 1500);
      }
    }, idx * 300);
  });
}

/* ---------- Timer ---------- */
function updateTimer(){
  if (cycleState !== 'timer') return;
  if (!timerDiv) return;

  timerDiv.textContent = timeLeft;
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
    // confetti if available (optional)
    if (typeof confetti === 'function') {
      let particleCount = payout === 100 ? 500 : payout >= 10 ? 250 : 90;
      let spread = payout === 100 ? 120 : payout >= 10 ? 100 : 70;
      let originY = payout === 100 ? 0.6 : payout >= 10 ? 0.7 : 0.8;
      confetti({ particleCount, spread, startVelocity: 45, origin: { y: originY } });
    }

    const winLine = document.getElementById('win-line');
    winLine && winLine.classList.add('active');
    setTimeout(() => winLine && winLine.classList.remove('active'), 1000);

    const reelCols = document.querySelectorAll('.reel-col');
    reelCols.forEach(col => {
      const mid = col.children[1];
      if (mid) { mid.classList.add('win'); setTimeout(() => mid.classList.remove('win'), 1000); }
    });
  }
}

/* ---------- Helpers ---------- */
function stopAudio(aud){ try{ aud.pause(); aud.currentTime = 0; }catch{} }

playBtn && playBtn.addEventListener('click', () => {
  audioAllowed = true;
  try { backgroundSound.play().catch(()=>{}); } catch {}
  if (!isSpinning && cycleState === 'timer') {
    timeLeft = 0;
    updateTimer();
  }
});
