// public/script.js
// Controls spins + registration + play-permission + payout timer + UI toasts

const symbols = ['🍒','🍋','🍇','7'];

const reelsContainer   = document.getElementById('reels-container');
const resultDiv        = document.getElementById('result');
const holdersSpan      = document.getElementById('holders');
const jackpotSpan      = document.getElementById('jackpot');
const historyList      = document.getElementById('history-list'); // optional
const leaderboardList  = document.getElementById('leaderboard-list');
const timerDiv         = document.getElementById('payout-timer');
const playBtn          = document.getElementById('play-btn');
const registerBtn      = document.getElementById('register-btn');
const walletInput      = document.getElementById('wallet-input');
const registeredEl     = document.getElementById('registered-wallet');
const distributedSpan  = document.getElementById('distributed-prizes');

const spinSound        = document.getElementById('spin-sound');
const smallWinSound    = document.getElementById('small-win');
const bigWinSound      = document.getElementById('big-win');
const jackpotWinSound  = document.getElementById('jackpot-win');
const backgroundSound  = document.getElementById('background-sound');

let audioAllowed = false;
let isSpinning   = false;
let reelIntervals = [];
let payoutSeconds = 600; // 10 minutes
let payoutTimerId = null;

// small toast system
const toastWrap = document.createElement('div');
toastWrap.className = 'toast-wrap';
document.body.appendChild(toastWrap);
function showToast(message, type = 'info', ms = 3500){
  const t = document.createElement('div');
  t.className = 'toast';
  if (type === 'error') t.style.borderLeftColor = 'rgba(255,100,100,0.9)';
  t.textContent = message;
  toastWrap.appendChild(t);
  setTimeout(()=> {
    t.style.opacity = 0;
    setTimeout(()=> t.remove(), 300);
  }, ms);
}

// meta backend ws
const metaWs = document.querySelector('meta[name="backend-ws"]');
const wsProto = metaWs ? (metaWs.content.startsWith('wss') ? 'wss' : 'ws') : (location.protocol === 'https:' ? 'wss' : 'ws');
const wsHost  = metaWs ? metaWs.content.replace(/^wss?:\/\//,'').replace(/\/$/,'') : location.host;
let ws;
try {
  ws = new WebSocket(`${wsProto}://${wsHost}`);
} catch (e) {
  ws = null;
}
const pendingRPC = {}; // id -> {resolve, reject, timer}

// simple RPC helper (tries WS first, falls back to fetch)
function rpcRequest(action, payload = {}, timeout = 4000){
  return new Promise((resolve, reject) => {
    const id = `${Date.now()}-${Math.floor(Math.random()*9999)}`;
    payload.action = action;
    payload.id = id;

    // set timeout
    const t = setTimeout(() => {
      delete pendingRPC[id];
      // fallback to HTTP if possible
      httpFallback(action, payload).then(resolve).catch(reject);
    }, timeout);

    pendingRPC[id] = {
      resolve: (data) => { clearTimeout(t); delete pendingRPC[id]; resolve(data); },
      reject: (err) => { clearTimeout(t); delete pendingRPC[id]; reject(err); },
      timer: t
    };

    // try websocket
    try {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload));
      } else {
        // fallback now
        clearTimeout(t);
        delete pendingRPC[id];
        httpFallback(action, payload).then(resolve).catch(reject);
      }
    } catch (err) {
      clearTimeout(t);
      delete pendingRPC[id];
      httpFallback(action, payload).then(resolve).catch(reject);
    }
  });
}

// very small HTTP fallback mapping: check-holder and register
async function httpFallback(action, payload){
  if (action === 'checkHolder') {
    const wallet = encodeURIComponent(payload.wallet || '');
    const r = await fetch(`/check-holder?wallet=${wallet}`);
    if (!r.ok) throw new Error('http fallback failed');
    return r.json();
  }
  if (action === 'register') {
    const r = await fetch('/register', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ wallet: payload.wallet }) });
    if (!r.ok) throw new Error('register failed');
    return r.json();
  }
  if (action === 'requestPayout') {
    const r = await fetch('/payout', { method:'POST' }).catch(()=>null);
    if (!r) return { ok:false };
    return r.json();
  }
  return { ok:false, reason:'no fallback' };
}

if (ws) {
  ws.addEventListener('open', () => {
    // request initial state
    safeSend({ action: 'requestState' });
  });

  ws.addEventListener('message', (ev) => {
    let data;
    try { data = JSON.parse(ev.data); } catch { return; }
    if (!data || typeof data !== 'object') return;

    // RPC resolution
    if (data.id && pendingRPC[data.id]) {
      pendingRPC[data.id].resolve(data);
      return;
    }

    // state -> update UI
    if (typeof data.holders === 'number') holdersSpan.textContent = data.holders;
    if (typeof data.jackpot === 'number') jackpotSpan.textContent = data.jackpot.toFixed(4) + ' SOL';
    if (typeof data.distributed === 'number' && distributedSpan) distributedSpan.textContent = data.distributed.toFixed(4) + ' SOL';

    if (Array.isArray(data.leaderboard)) {
      // reset then populate top10
      leaderboardList.innerHTML = '';
      for (let i = 0; i < 10; i++){
        const li = document.createElement('li');
        if (data.leaderboard[i]) {
          const e = data.leaderboard[i];
          li.textContent = `${i+1}. ${String(e.wallet||'—')} — ${Number(e.wins||0)} wins`;
        } else li.textContent = `${i+1}. —`;
        leaderboardList.appendChild(li);
      }
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

  ws.addEventListener('close', () => {
    // attempt reconnect after a delay
    setTimeout(()=> {
      try { ws = new WebSocket(`${wsProto}://${wsHost}`); } catch {}
    }, 4000);
  });
}

function safeSend(obj){
  try {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
  } catch {}
}

// Basic reels UI creation
for (let col = 0; col < 3; col++) {
  const colDiv = document.createElement('div');
  colDiv.classList.add('reel-col');
  for (let row = 0; row < 3; row++) {
    colDiv.appendChild(createSymbol(randomSymbol()));
  }
  reelsContainer.appendChild(colDiv);
}

function randomSymbol(){ return symbols[Math.floor(Math.random()*symbols.length)]; }
function createSymbol(sym){
  const el = document.createElement('div');
  el.classList.add('reel-symbol');
  if (sym === '7') el.classList.add('seven');
  el.textContent = sym === '7' ? '7' : sym;
  return el;
}

/* ---------- spin visuals ---------- */

function startReels(){
  const reelCols = document.querySelectorAll('.reel-col');
  reelCols.forEach((col, idx) => {
    reelIntervals[idx] = setInterval(() => {
      col.appendChild(createSymbol(randomSymbol()));
      if (col.children.length > 3) col.removeChild(col.firstChild);
    }, 100);
  });
  isSpinning = true;
  if (audioAllowed && spinSound) try{ spinSound.currentTime=0; spinSound.loop=true; spinSound.play().catch(()=>{}); } catch {}
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
        try { spinSound.pause(); spinSound.currentTime = 0; } catch {}
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

/* ---------- celebration ---------- */
function celebrateWin(result){
  if (audioAllowed){
    try {
      if (/Jackpot/i.test(result)) jackpotWinSound.play().catch(()=>{});
      else if (/x3/i.test(result)) bigWinSound.play().catch(()=>{});
      else smallWinSound.play().catch(()=>{});
    } catch {}
  }
  try { confetti({ particleCount: 120, spread: 90, origin:{y:0.7} }); } catch {}
}

/* ---------- payout timer ---------- */
function formatMMSS(s){ const mm = Math.floor(s/60).toString().padStart(2,'0'); const ss = Math.floor(s%60).toString().padStart(2,'0'); return `${mm}:${ss}`; }

function startPayoutTimer(){
  if (timerDiv) timerDiv.textContent = formatMMSS(payoutSeconds);
  if (payoutTimerId) clearInterval(payoutTimerId);
  payoutTimerId = setInterval(() => {
    payoutSeconds -= 1;
    if (timerDiv) timerDiv.textContent = formatMMSS(payoutSeconds);
    if (payoutSeconds <= 0) {
      // ask server to process payout
      rpcRequest('requestPayout', {}).catch(()=>{});
      payoutSeconds = 600;
      if (timerDiv) timerDiv.textContent = formatMMSS(payoutSeconds);
    }
  }, 1000);
}
startPayoutTimer();

/* ---------- registration logic ---------- */

let registeredWallet = localStorage.getItem('registeredWallet') || null;
let registeredIsHolder = false;

function setRegisteredWallet(wallet){
  registeredWallet = wallet ? String(wallet).trim() : null;
  if (registeredWallet) {
    localStorage.setItem('registeredWallet', registeredWallet);
    registeredEl.textContent = registeredWallet;
    playBtn.disabled = false;
    playBtn.classList.remove('disabled');
  } else {
    localStorage.removeItem('registeredWallet');
    registeredEl.textContent = '—';
    playBtn.disabled = true;
    playBtn.classList.add('disabled');
  }
}

// disable play by default unless registered and holder
setRegisteredWallet(registeredWallet);
if (!registeredWallet) { playBtn.disabled = true; playBtn.classList.add('disabled'); }

// check-holder RPC, used on register attempt and periodically to verify
async function checkHolder(wallet){
  if (!wallet) return { isHolder:false };
  try {
    const resp = await rpcRequest('checkHolder', { wallet }, 3500);
    // might be in nested object depending on server; accept {isHolder:bool} or {body:{isHolder}}
    if (typeof resp.isHolder === 'boolean') return resp;
    if (resp.body && typeof resp.body.isHolder === 'boolean') return resp.body;
    // fallback: server might return directly
    return { isHolder: !!resp.isHolder, balance: Number(resp.balance || 0) };
  } catch (err) {
    // try http fallback already handled inside rpcRequest
    return { isHolder:false };
  }
}

async function attemptRegister(wallet){
  if (!wallet) { showToast('Enter wallet address', 'error'); return; }
  showToast('Checking holder status...', 'info', 2000);
  const chk = await checkHolder(wallet);
  if (!chk.isHolder) {
    showToast('Not a holder', 'error', 3500);
    return;
  }
  // perform register rpc (server should record leaderboard registration)
  try {
    const res = await rpcRequest('register', { wallet }, 3500);
    const ok = res?.success === true || (res.body && res.body.success === true);
    if (ok) {
      setRegisteredWallet(wallet);
      registeredIsHolder = true;
      showToast('Registered — good luck!', 'info', 3000);
    } else {
      const reason = res?.reason || (res.body && res.body.reason) || 'register failed';
      showToast(String(reason), 'error', 3500);
    }
  } catch (err) {
    showToast('Register failed', 'error', 3500);
  }
}

// wire register button
registerBtn.addEventListener('click', async () => {
  const wallet = walletInput.value?.trim();
  await attemptRegister(wallet);
});

// periodic verification of registered wallet (every 30s)
setInterval(async () => {
  if (!registeredWallet) return;
  const chk = await checkHolder(registeredWallet);
  if (!chk.isHolder) {
    // unregister and update UI + leaderboard
    setRegisteredWallet(null);
    registeredIsHolder = false;
    showToast('Wallet no longer holds tokens — unregistered', 'error', 4500);
    // remove from leaderboard if present
    for (let li of Array.from(leaderboardList.children || [])) {
      if (li.textContent.includes(registeredWallet)) {
        li.textContent = li.textContent.replace(registeredWallet, '—');
      }
    }
  } else {
    registeredIsHolder = true;
    // ensure play enabled
    playBtn.disabled = false;
    playBtn.classList.remove('disabled');
  }
}, 30_000);

/* ---------- play button logic ---------- */
playBtn.addEventListener('click', () => {
  // only allow if registered and holder
  if (!registeredWallet) { showToast('You must register a holder wallet to play', 'error'); return; }
  if (!registeredIsHolder) { showToast('Not a holder — cannot play', 'error'); return; }
  // allowed -> request spin
  rpcRequest('requestSpin', {}).catch(()=>{});
  startReels();
  setTimeout(() => stopReels(null, 'Try Again'), 3500);
});

/* ---------- initialize leaderboard placeholders (top 10) ---------- */
(function initPlaceholders(){
  if (!leaderboardList) return;
  leaderboardList.innerHTML = '';
  for (let i = 0; i < 10; i++){
    const li = document.createElement('li');
    li.textContent = `${i+1}. —`;
    leaderboardList.appendChild(li);
  }
})();

