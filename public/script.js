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
    jackpotSpan.textContent = jp.toFixed(4);
  }
  jackpotSpan.classList.toggle('high', jp > 1);

  // history (only payouts)
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

  // leaderboard
  leaderboardList.innerHTML = '';
  // normalize leaderboard array
  const lb = Array.isArray(data.leaderboard) ? data.leaderboard.slice() : [];
  lb.sort((a,b)=> (Number(b.wins||0) - Number(a.wins||0)));
  // show top 10 and pad placeholders
  for (let i=0;i<10;i++){
    const entry = lb[i];
    const li = document.createElement('li');
    if (entry){
      const w = String(entry.wallet || '????');
      const c = Number(entry.wins || 0);
      li.textContent = `${i+1}. ${w} — ${c} wins`;
    } else {
      li.textContent = `${i+1}. ---`;
      li.classList.add('placeholder');
    }
    leaderboardList.appendChild(li);
  }


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
  if (sym === '7') {
    // use image for 7 if available, fallback to text
    const img = document.createElement('img');
    img.src = '/assets/7.png';
    img.alt = '7';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'contain';
    img.onerror = function(){ el.textContent = '7'; };
    el.appendChild(img);
    el.classList.add('seven');
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
  timerDiv.style.visibility = 'hidden';

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
        resultDiv.className = ''; // reset classes
        resultDiv.textContent = resultText || 'Try Again';
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
          timerDiv.style.visibility = 'visible';
          timeLeft = 5;
        }, 1500);
      }
    }, idx * 300);
  });
}

/* ---------- Timer ---------- */

function updateTimer(){
  if (cycleState !== 'timer') return;

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
    let particleCount, spread, originY;
    if (payout === 100){ particleCount = 500; spread = 120; originY = 0.6; }
    else if (payout >= 10){ particleCount = 250; spread = 100; originY = 0.7; }
    else { particleCount = 90; spread = 70; originY = 0.8; }
    confetti({ particleCount, spread, startVelocity: 45, origin: { y: originY } });

    // Flash gold win-line
    const winLine = document.getElementById('win-line');
    winLine.classList.add('active');
    setTimeout(() => winLine.classList.remove('active'), 1000);

    // Glow middle row symbols
    const reelCols = document.querySelectorAll('.reel-col');
    reelCols.forEach(col => {
      const mid = col.children[1];
      if (mid) { mid.classList.add('win'); setTimeout(() => mid.classList.remove('win'), 1000); }
    });
  }
}

/* ---------- Helpers ---------- */

// --- Payout timer fallback: if server doesn't send round end, start local 10min timer
let __localPayoutRemaining = null; // seconds
function startLocalPayoutTimer(seconds){
  __localPayoutRemaining = Math.max(0, Number(seconds) || 600);
  if (!window.__local_payout_interval){
    window.__local_payout_interval = setInterval(()=>{
      if (__localPayoutRemaining <= 0){
        // call backend to distribute prizes
        (async ()=>{
          try{
            const url = (window.BACKEND_URL||'') + '/distribute';
            await fetch(url, { method:'POST' });
          }catch(e){ console.warn('distribute call failed',e) }
        })();
        __localPayoutRemaining = 600; // reset to 10min
      } else {
        __localPayoutRemaining--;
      }
      // update UI element if present
      const el = document.getElementById('payout-timer') || document.getElementById('payout-in');
      if (el){
        const mm = String(Math.floor(__localPayoutRemaining/60)).padStart(2,'0');
        const ss = String(__localPayoutRemaining%60).padStart(2,'0');
        el.textContent = `${mm}:${ss}`;
      }
    },1000);
  }
}

/* ===== additions: payout timer, enforce register-only play, 7-image rendering, leaderboard filler ===== */

(function () {
  // --- 7-image rendering: override createSymbol if exists, otherwise define safe helper
  function createSymbolWithImage(sym) {
    const el = document.createElement('div');
    el.className = 'reel-symbol';
    if (sym === '7') {
      const img = document.createElement('img');
      img.src = '/assets/seven.png'; // <-- ensure this path exists in public/assets/seven.png
      img.alt = '7';
      el.appendChild(img);
      el.classList.add('seven');
    } else {
      el.textContent = sym;
    }
    return el;
  }

  // If your code already defines createSymbol, we'll override it safely:
  try {
    if (typeof window.createSymbol === 'function') {
      // keep old in case needed
      window.createSymbolOriginal = window.createSymbol;
    }
  } catch (e) {}
  // expose our createSymbol for use below
  window.createSymbol = createSymbolWithImage;

  // --- payout countdown
  const payoutQueryTargets = [
    () => document.querySelector('.payout-in'),
    () => document.querySelector('.timer'),
    () => document.getElementById('payout-timer'),
  ];
  function findPayoutEl() {
    for (const f of payoutQueryTargets) {
      const el = f();
      if (el) return el;
    }
    return null;
  }

  let payoutSeconds = 10 * 60; // default 10 minutes
  let payoutInterval = null;
  function formatMMSS(s) {
    s = Math.max(0, Math.floor(s));
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  }

  async function initPayoutTimer() {
    const el = findPayoutEl();
    if (!el) return;
    // try remote config first (fetch-ca should populate window.__CA_CONFIG__)
    if (window.__CA_CONFIG__ && Number(window.__CA_CONFIG__.payout_seconds_left) >= 0) {
      payoutSeconds = Number(window.__CA_CONFIG__.payout_seconds_left);
    } else {
      // try fetching /config directly
      try {
        const res = await fetch('/config', { cache: 'no-store' });
        if (res.ok) {
          const cfg = await res.json();
          if (cfg && typeof cfg.payout_seconds_left === 'number') payoutSeconds = cfg.payout_seconds_left;
        }
      } catch (e) {}
    }

    // render onto el
    const displayEl = el.querySelector('.timer-val') || el;
    function tick() {
      displayEl.textContent = formatMMSS(payoutSeconds);
      if (payoutSeconds <= 0) {
        // trigger a round payout action: POST /payout or call server endpoint
        try { fetch('/payout', { method: 'POST' }).catch(()=>{}); } catch {}
        // restart countdown
        payoutSeconds = 10 * 60;
      } else {
        payoutSeconds -= 1;
      }
    }
    // start now
    tick();
    if (payoutInterval) clearInterval(payoutInterval);
    payoutInterval = setInterval(tick, 1000);
  }

  // listen if config loads after fetch-ca
  document.addEventListener('ca:loaded', initPayoutTimer);
  document.addEventListener('DOMContentLoaded', initPayoutTimer);
  setTimeout(initPayoutTimer, 500); // also run shortly after append

  // --- enforce register-only play
  function isWalletRegistered() {
    // try multiple selectors (robust)
    const r1 = document.getElementById('registered') || document.querySelector('.registered-line') || document.querySelector('#registered-val');
    if (!r1) return false;
    const txt = (r1.textContent || r1.innerText || '').trim();
    if (!txt) return false;
    if (/—|—|none|not registered|no/i.test(txt)) return false;
    return true;
  }

  function showToast(msg, time = 3000) {
    // minimal toast if page doesn't have one
    let wrap = document.querySelector('.toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'toast-wrap';
      document.body.appendChild(wrap);
    }
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    wrap.appendChild(t);
    setTimeout(() => t.classList.add('hide'), time - 400);
    setTimeout(() => t.remove(), time);
  }

  function enforcePlayButton() {
    const playBtn = document.getElementById('play-btn') || document.querySelector('.btn.play') || document.querySelector('button.play');
    if (!playBtn) return;
    // disable if not registered
    function refresh() {
      if (isWalletRegistered()) {
        playBtn.disabled = false;
      } else {
        playBtn.disabled = true;
      }
    }
    // run now and on CA loaded
    refresh();
    document.addEventListener('ca:loaded', refresh);

    // intercept register attempt if needed: if user tries to register and server says not holder show toast
    const regBtn = document.getElementById('register-btn') || document.querySelector('.register-btn') || document.querySelector('#register');
    if (regBtn) {
      regBtn.addEventListener('click', async (e) => {
        // assume input id wallet-input or #wallet
        const walletInput = document.getElementById('wallet-input') || document.querySelector('input[name="wallet"]') || document.querySelector('input[placeholder*="Wallet"]');
        const address = walletInput ? walletInput.value.trim() : null;
        if (!address) { showToast('Enter a wallet address'); return; }
        try {
          const res = await fetch('/check-holder?wallet=' + encodeURIComponent(address));
          if (!res.ok) {
            const txt = await res.text().catch(()=>'');
            showToast('Registration failed: ' + (txt || res.statusText));
            return;
          }
          const json = await res.json().catch(()=>({ ok:false }));
          if (!json.ok) {
            showToast(json.message || 'Not a holder');
            return;
          }
          // registration succeeded - re-enable play after backend registers
          showToast('Registered ✓');
          setTimeout(()=>{ document.dispatchEvent(new Event('registered:changed')); }, 350);
        } catch (err) {
          showToast('Registration error');
        }
      });
    }

    // re-check after server notifications
    document.addEventListener('registered:changed', refresh);
    document.addEventListener('ca:loaded', refresh);
  }
  // run enforcer
  document.addEventListener('DOMContentLoaded', enforcePlayButton);
  setTimeout(enforcePlayButton, 700);

  // --- leaderboard: ensure 10 rows always shown
  function ensureTop10() {
    const ul = document.querySelector('.leaderboard-list') || document.getElementById('leaderboard-list');
    if (!ul) return;
    // run when leaderboard updates (if server emits event it should update list)
    function fill() {
      const items = Array.from(ul.children || []);
      const current = items.length;
      if (current < 10) {
        for (let i = current+1; i <= 10; i++) {
          const li = document.createElement('li');
          li.className = 'empty';
          li.textContent = `${i}. —`;
          ul.appendChild(li);
        }
      } else if (current > 10) {
        // trim extras
        while (ul.children.length > 10) ul.removeChild(ul.lastChild);
      }
    }
    // try to run repeatedly in case async updates
    fill();
    setInterval(fill, 2000);
    document.addEventListener('ca:loaded', fill);
  }
  document.addEventListener('DOMContentLoaded', ensureTop10);
  setTimeout(ensureTop10, 700);

  // Remove demo-spin buttons if any (defensive)
  document.addEventListener('DOMContentLoaded', () => {
    const b = document.querySelector('button.demo, .demo-spin, #demo-btn');
    if (b) b.remove();
  });

})();



function stopAudio(aud){ try{ aud.pause(); aud.currentTime = 0; }catch{} }

playBtn.addEventListener('click', () => {
  audioAllowed = true;
  try { backgroundSound.play().catch(()=>{}); } catch {}
  if (!isSpinning && cycleState === 'timer') {
    timeLeft = 0; // trigger first spin immediately
    updateTimer();
  }
});
