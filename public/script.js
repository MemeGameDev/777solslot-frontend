// public/script.js
const symbols = ['🍒','🍋','🍇','7'];

const reelsContainer   = document.getElementById('reels-container');
const resultDiv        = document.getElementById('result');
const holdersSpan      = document.getElementById('holders');
const jackpotSpan      = document.getElementById('jackpot');
const historyList      = document.getElementById('history-list'); // if present in DOM
const leaderboardList  = document.getElementById('leaderboard-list');
const timerDiv         = document.getElementById('payout-timer');
const playBtn          = document.getElementById('play-btn');
const distributedSpan  = document.getElementById('distributed-prizes');

const spinSound        = document.getElementById('spin-sound');
const smallWinSound    = document.getElementById('small-win');
const bigWinSound      = document.getElementById('big-win');
const jackpotWinSound  = document.getElementById('jackpot-win');
const backgroundSound  = document.getElementById('background-sound');

let audioAllowed = false;
let isSpinning   = false;
let reelIntervals = [];
let payoutSeconds = 600; // 10 minutes default
let payoutTimerId = null;

// WS setup (reads meta backend-ws if present)
const metaWs = document.querySelector('meta[name="backend-ws"]');
const wsProto = metaWs ? (metaWs.content.startsWith('wss') ? 'wss' : 'ws') : (location.protocol === 'https:' ? 'wss' : 'ws');
const wsHost  = metaWs ? metaWs.content.replace(/^wss?:\/\//,'').replace(/\/$/,'') : location.host;
const ws      = new WebSocket(`${wsProto}://${wsHost}`);

ws.addEventListener('open', () => {
  safeSend({ action: 'requestState' });
});

for (let col = 0; col < 3; col++) {
  const colDiv = document.createElement('div');
  colDiv.classList.add('reel-col');
  for (let row = 0; row < 3; row++) {
    colDiv.appendChild(createSymbol(randomSymbol()));
  }
  reelsContainer.appendChild(colDiv);
}

// Fill leaderboard with placeholders (top 10)
function initLeaderboardPlaceholders() {
  if (!leaderboardList) return;
  leaderboardList.innerHTML = '';
  for (let i = 0; i < 10; i++) {
    const li = document.createElement('li');
    li.textContent = `${i+1}. —`;
    leaderboardList.appendChild(li);
  }
}
initLeaderboardPlaceholders();

ws.addEventListener('message', (ev) => {
  let data;
  try { data = JSON.parse(ev.data); } catch { return; }
  if (!data || typeof data !== 'object') return;

  if (typeof data.holders === 'number') holdersSpan.textContent = data.holders;

  const jp = (typeof data.jackpot === 'number') ? data.jackpot : 0;
  jackpotSpan.textContent = jp.toFixed(4) + ' SOL';
  jackpotSpan.classList.toggle('high', jp > 1);

  if (typeof data.distributed === 'number' && distributedSpan) {
    distributedSpan.textContent = data.distributed.toFixed(4) + ' SOL';
  }

  if (Array.isArray(data.leaderboard)) {
    // replace placeholders with data up to 10
    initLeaderboardPlaceholders();
    data.leaderboard.slice(0,10).forEach((entry, idx) => {
      const li = leaderboardList.children[idx];
      const w = String(entry.wallet || '—');
      const c = Number(entry.wins || 0);
      li.textContent = `${idx+1}. ${w} — ${c} wins`;
    });
  }

  if (Array.isArray(data.history) && historyList) {
    historyList.innerHTML = '';
    data.history.forEach(win => {
      const li = document.createElement('li');
      const amt = Number(win.amount ?? 0);
      const sig = String(win.sig || '');
      const wallet = String(win.wallet || '????');
      const combo = win.combo || 'Win';
      li.innerHTML = `${wallet} — <strong>${amt.toFixed(4)} SOL</strong> <span style="opacity:0.85">(${combo})</span> ${sig ? `<a href="https://solscan.io/tx/${sig}" target="_blank">[tx]</a>` : ''}`;
      historyList.appendChild(li);
    });
  }
});

// helpers
function safeSend(obj){
  try {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
  } catch {}
}
function randomSymbol(){ return symbols[Math.floor(Math.random()*symbols.length)]; }
function createSymbol(sym){
  const el = document.createElement('div');
  el.classList.add('reel-symbol');
  if (sym === '7') el.classList.add('seven');
  el.textContent = (sym === '7') ? '7' : sym;
  return el;
}

/* spin (manual) */
function startReels(){
  const reelCols = document.querySelectorAll('.reel-col');
  reelCols.forEach((col, idx) => {
    reelIntervals[idx] = setInterval(() => {
      col.appendChild(createSymbol(randomSymbol()));
      if (col.children.length > 3) col.removeChild(col.firstChild);
    }, 100);
  });
  isSpinning = true;
  if (audioAllowed && spinSound) try { spinSound.currentTime=0; spinSound.loop=true; spinSound.play().catch(()=>{}); } catch {}
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
        if (spinSound) try{ spinSound.pause(); spinSound.currentTime=0 }catch{}
        resultDiv.className = '';
        resultDiv.textContent = resultText || 'Try Again';
        if (resultText && /Jackpot/i.test(resultText)) resultDiv.classList.add('jackpot-win');
        else if (resultText && /x3/.test(resultText)) resultDiv.classList.add('triple-win');
        else if (resultText && /x2/.test(resultText)) resultDiv.classList.add('double-win');

        if (resultText && resultText !== 'Try Again') celebrateWin(resultText);

        isSpinning = false;
      }
    }, idx * 300);
  });
}

/* Celebration */
function celebrateWin(result){
  const payouts = {
    'Cherry x2': 1, 'Lemon x2': 1.5, 'Grape x2': 2.5,
    'Cherry x3': 10, 'Lemon x3': 12.5, 'Grape x3': 15,
    '7 7 7 Jackpot!': 100
  };
  const payout = payouts[result] || 0;
  if (audioAllowed) {
    try {
      if (payout === 100) jackpotWinSound.play().catch(()=>{});
      else if (payout >= 10) bigWinSound.play().catch(()=>{});
      else if (payout > 0) smallWinSound.play().catch(()=>{});
    } catch {}
  }

  if (payout > 0) {
    try { confetti({ particleCount: payout === 100 ? 400 : 120, spread: 100, origin:{y:0.7} }); } catch {}
    const reelCols = document.querySelectorAll('.reel-col');
    reelCols.forEach(col => {
      const mid = col.children[1];
      if (mid) { mid.classList.add('win'); setTimeout(()=>mid.classList.remove('win'), 1000); }
    });
  }
}

/* Payout timer: 10 minutes -> send payout -> reset */
function formatMMSS(s){
  const mm = Math.floor(s/60).toString().padStart(2,'0');
  const ss = Math.floor(s%60).toString().padStart(2,'0');
  return `${mm}:${ss}`;
}

function startPayoutTimer(){
  // initialize UI immediately
  if (timerDiv) timerDiv.textContent = formatMMSS(payoutSeconds);

  if (payoutTimerId) clearInterval(payoutTimerId);
  payoutTimerId = setInterval(() => {
    payoutSeconds -= 1;
    if (timerDiv) timerDiv.textContent = formatMMSS(payoutSeconds);
    if (payoutSeconds <= 0) {
      // trigger payout on server, then reset
      safeSend({ action: 'requestPayout' });
      // optional fallback to HTTP:
      // fetch('/payout', { method:'POST' }).catch(()=>{});
      payoutSeconds = 600;
      if (timerDiv) timerDiv.textContent = formatMMSS(payoutSeconds);
    }
  }, 1000);
}

// start the payout timer on load
startPayoutTimer();

// play button (manual spin)
playBtn.addEventListener('click', () => {
  audioAllowed = true;
  try { if (backgroundSound) backgroundSound.play().catch(()=>{}); } catch {}
  if (!isSpinning) {
    // request spin result from server and run local spin visuals
    safeSend({ action: 'requestSpin' });
    startReels();
    // stop after fixed interval; server should send final result and client will override if needed
    setTimeout(() => {
      // server may have provided final reels via WS
      stopReels(null, 'Try Again');
    }, 3500);
  }
});
