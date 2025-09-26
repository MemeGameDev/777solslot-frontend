let audioAllowed = false;
let isRegistered = false;
let currentWallet = null;
// public/script.js
// Main client logic for Casino Royale
(function(){
  // helper
  function $(id){ return document.getElementById(id); }
  function make(tag, cls){ const e = document.createElement(tag); if (cls) e.className = cls; return e; }

  // DOM refs
  const reelsContainer   = $('reels-container');
  const resultDiv        = $('result');
  const holdersSpan      = $('holders');
  const jackpotSpan      = $('jackpot');
  const historyList      = $('history-list');
  const leaderboardList  = $('leaderboard-list');
  const payoutTimerEl    = $('payout-timer');
  const playBtn          = $('play-btn');
  const registerBtn      = $('register-btn');
  const walletInput      = $('wallet-input');
  const registeredSpan   = $('registered-wallet');
  const distributedEl    = $('distributed-value');
  const demoSpinBtn      = $('demo-spin-btn');

  // sounds (optional elements in HTML if you added them)
  const spinSound = document.getElementById('spin-sound');
  const smallWinSound = document.getElementById('small-win');
  const bigWinSound = document.getElementById('big-win');
  const jackpotWinSound = document.getElementById('jackpot-win');
  const backgroundSound = document.getElementById('background-sound');

  // state
  let registeredWallet = null;
  let ws = null;
  let pendingFinalReels = null;
  let pendingResultText = null;
  let reelIntervals = [];
  let isSpinning = false;
  let clientTimer = 10; // local tick when in timer state (visual)
  let cycleState = 'timer'; // timer, spinning, result

  const symbols = ['🍒','🍋','🍇','7'];

  // ensure reels exist
  function buildInitialReels(){
    if (!reelsContainer) return;
    reelsContainer.innerHTML = '';
    for (let col=0; col<3; col++){
      const colDiv = make('div','reel-col');
      for (let r=0; r<3; r++){
        colDiv.appendChild(createSymbol(randomSymbol()));
      }
      reelsContainer.appendChild(colDiv);
    }
  }

  function randomSymbol(){ return symbols[Math.floor(Math.random()*symbols.length)]; }
  function createSymbol(sym){
    const el = make('div','reel-symbol');
    if (sym === '7') {
      // show the image if available
      const img = document.createElement('img');
      img.src = '/assets/seven.png';
      img.alt = '7';
      img.style.height = '60%';
      el.appendChild(img);
      el.classList.add('seven');
    } else {
      el.textContent = sym;
    }
    return el;
  }

  // toasts
  function ensureToastWrap(){ if (!window.__toast_wrap){ const w = make('div','toast-wrap'); document.body.appendChild(w); window.__toast_wrap = w; } return window.__toast_wrap; }
  function showToast(msg, type='info', ttl=2800){
    const wrap = ensureToastWrap();
    const t = make('div','toast ' + (type==='error'?'error':type==='success'?'success':'info'));
    t.innerHTML = `<strong style="display:block;margin-bottom:6px">${type==='error'?'Error':(type==='success'?'Success':'Info')}</strong><div style="line-height:1.2">${msg}</div>`;
    wrap.appendChild(t);
    setTimeout(()=>{ t.style.opacity='0'; t.style.transform='translateX(8px)'; setTimeout(()=>t.remove(),420); }, ttl);
  }

  // enable/disable play button
  function enablePlay(yes){
    if (!playBtn) return;
    playBtn.disabled = !yes;
    playBtn.style.opacity = yes ? 1 : 0.55;
  }

  // open WebSocket based on meta backend-ws or same origin
  function openWS(){
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
    const meta = document.querySelector('meta[name="backend-ws"]');
    let base = meta && meta.content ? meta.content : null;
    if (!base) {
      // default to same origin with ws protocol (useful for local dev when server serves both)
      const proto = location.protocol === 'https:' ? 'wss://' : 'ws://';
      base = proto + location.host;
    }
    try {
      ws = new WebSocket(base);
    } catch (e) {
      console.warn('WS open failed', e);
      return;
    }

    ws.addEventListener('open', () => {
      safeSend({ action: 'requestState' });
      // if we already have a registered wallet, ask server to validate
      if (registeredWallet) safeSend({ action: 'validateRegistration', wallet: registeredWallet });
    });

    ws.addEventListener('message', (ev) => {
      let data;
      try { data = JSON.parse(ev.data); } catch { return; }
      if (!data || typeof data !== 'object') return;

      // full state broadcast
      if (data.type === 'state') {
        if (typeof data.holders === 'number') holdersSpan.textContent = data.holders;
        if (typeof data.jackpot === 'number') jackpotSpan.textContent = Number(data.jackpot).toFixed(4);
        if (typeof data.distributed === 'number') distributedEl.textContent = Number(data.distributed).toFixed(4);
        renderLeaderboard(data.leaderboard || []);
        renderHistory(data.history || []);
        if (data.round && data.round.end) {
          startCountdownTo(Number(data.round.end));
        }
        // enable/disable play depending on registration + server provided allowed flag
        if (data.registered && data.registered[registeredWallet]) {
          registeredSpan.textContent = registeredWallet || '—';
          enablePlay(true);
        } else {
          if (!registeredWallet) enablePlay(false);
        }
      }

      // specific message types
      if (data.type === 'register_result') {
        if (data.ok) {
          registeredWallet = data.wallet;
          registeredSpan.textContent = data.wallet;
          showToast('Wallet registered', 'success', 2200);
          enablePlay(true);
        } else {
          showToast('Not a holder or registration failed', 'error', 2600);
          enablePlay(false);
        }
      }

      if (data.type === 'spin_result') {
        if (data.ok) {
          // server delivered a final spin result/ reels
          pendingFinalReels = data.reels || pendingFinalReels;
          pendingResultText = data.result || pendingResultText;
        } else {
          showToast('Spin failed: ' + (data.reason || 'unknown'), 'error', 3000);
        }
      }

      if (data.type === 'payouts') {
        showToast('Payouts distributed: ' + Number(data.distributedTotal || 0).toFixed(4) + ' SOL', 'success', 4000);
      }
    });

    ws.addEventListener('close', () => { setTimeout(openWS, 1200); });
    ws.addEventListener('error', () => {});
  }

  function safeSend(obj){
    try { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj)); }
    catch(e){}
  }

  // render helpers
  function renderLeaderboard(arr){
    if (!leaderboardList) return;
    leaderboardList.innerHTML = '';
    (arr || []).slice(0,10).forEach(e => {
      const li = make('li');
      li.textContent = `${String(e.wallet||'????')} — ${Number(e.pts||0)} pts`;
      leaderboardList.appendChild(li);
    });
    // if fewer than 10 lines, pad visually
    for (let i=(arr||[]).length; i<10; i++){
      const li = make('li');
      li.style.opacity = 0.45;
      li.textContent = `—`;
      leaderboardList.appendChild(li);
    }
  }
  function renderHistory(arr){
    if (!historyList) return;
    historyList.innerHTML = '';
    (arr||[]).slice(0,6).forEach(win => {
      const li = make('li');
      li.innerHTML = `${String(win.wallet||'anon')} — <strong>${Number(win.amount||0).toFixed(4)} SOL</strong> <span style="opacity:.8">(${win.combo||'Win'})</span>`;
      historyList.appendChild(li);
    });
  }

  // reels visual control
  function startReels(){
    if (!reelsContainer) return;
    const cols = reelsContainer.querySelectorAll('.reel-col');
    cols.forEach((col, ci) => {
      reelIntervals[ci] = setInterval(()=>{
        col.appendChild(createSymbol(randomSymbol()));
        if (col.children.length > 3) col.removeChild(col.firstChild);
      }, 80 + (ci*20));
    });
    isSpinning = true;
    try { if (spinSound) { spinSound.currentTime = 0; spinSound.loop = true; spinSound.play().catch(()=>{}); } } catch(e){}
  }

  function stopReels(finalReels, resultText){
    reelIntervals.forEach(clearInterval);
    reelIntervals = [];
    const cols = reelsContainer.querySelectorAll('.reel-col');
    cols.forEach((col, idx) => {
      setTimeout(()=>{
        if (finalReels && finalReels[idx]) {
          col.innerHTML = '';
          finalReels[idx].forEach(sym => col.appendChild(createSymbol(sym)));
        }
        if (idx === cols.length - 1) {
          isSpinning = false;
          try { if (spinSound) { spinSound.pause(); spinSound.currentTime = 0; } } catch(e){}
          resultDiv.textContent = resultText || 'Try Again';
          // add visual effects if win
          if (resultText && /jackpot/i.test(resultText)) {
            document.querySelector('.machine-panel')?.classList.add('win-flash');
            setTimeout(()=> document.querySelector('.machine-panel')?.classList.remove('win-flash'), 1200);
            try { if (jackpotWinSound) jackpotWinSound.play().catch(()=>{}); } catch(e){}
          } else if (resultText && /x3|Big Win|Solid Win|Nice Win/i.test(resultText)) {
            try { if (bigWinSound) bigWinSound.play().catch(()=>{}); } catch(e){}
          } else if (resultText && /x2|Small|Mini|Tiny Win/i.test(resultText)) {
            try { if (smallWinSound) smallWinSound.play().catch(()=>{}); } catch(e){}
          }
        }
      }, idx * 300);
    });
  }

  // timer for auto spin cycle (visual)
  function localTick(){
    if (cycleState !== 'timer') return;
    clientTimer--;
    if (clientTimer < 0) {
      // start visual spin and request server spin
      startReels();
      cycleState = 'spinning';
      safeSend({ action: 'requestSpin', wallet: registeredWallet });
      // stop visual after 3.5s if server doesn't send final
      setTimeout(()=>{
        stopReels(pendingFinalReels, pendingResultText);
        pendingFinalReels = null; pendingResultText = null;
        cycleState = 'result';
        setTimeout(()=>{ cycleState = 'timer'; clientTimer = 10; }, 1500);
      }, 3500);
    }
    // update visual timer if present (we keep client visual small)
    const timerLocal = document.getElementById('timer-local');
    if (timerLocal) timerLocal.textContent = String(Math.max(0,clientTimer));
  }
  setInterval(localTick, 1000);

  // allow manual demo spin for testing
  if (demoSpinBtn) demoSpinBtn.addEventListener('click', () => {
    if (isSpinning) return;
    startReels();
    // simulate server returning something after 2.6s
    setTimeout(()=>{
      const sample = [['🍒','🍒','🍒'],['🍋','🍋','🍋'],['7','7','7']];
      stopReels(sample, 'Demo Win x3');
    }, 2600);
  });

  // registration button -> send registration via WS; server will verify holder on-chain
  if (registerBtn) registerBtn.addEventListener('click', async () => {
    const w = (walletInput && walletInput.value || '').trim();
    if (!w) { showToast('Enter a wallet address first', 'error'); return; }
    if (!ws || ws.readyState !== WebSocket.OPEN) { showToast('Not connected to server yet, please wait', 'error'); return; }
    // send registration request
    safeSend({ action: 'register', wallet: w });
  });

  // play button -> only allowed if registeredWallet set
  if (playBtn) playBtn.addEventListener('click', () => {
  if (!isRegistered) { showToast('Please register a wallet first'); return; }
    if (!registeredWallet) { showToast('You must register a holder wallet first', 'error'); enablePlay(false); return; }
    if (!ws || ws.readyState !== WebSocket.OPEN) { showToast('Server disconnected', 'error'); return; }
    // send spin request; the server should respond with spin_result message type
    safeSend({ action: 'requestSpin', wallet: registeredWallet });
    // start local visuals (server final result will override)
    startReels();
    setTimeout(()=> {
      stopReels(pendingFinalReels, pendingResultText);
      pendingFinalReels = null; pendingResultText = null;
    }, 3500);
  });

  // payout countdown: start a per-second tick to show mm:ss and when zero, call backend to distribute
  function startCountdownTo(timestampMs){
    if (!timestampMs || isNaN(Number(timestampMs))) return;
    if (window.__payout_timer_interval) clearInterval(window.__payout_timer_interval);

    function tick() {
      const now = Date.now();
      let ms = Math.max(0, timestampMs - now);
      const sec = Math.floor(ms/1000);
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      if (payoutTimerEl) payoutTimerEl.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;

      if (ms <= 0) {
        // ask server to execute distribution (server may require secret; if so, server will ignore if unauthorized)
        try {
          fetch((window.BACKEND_URL ? window.BACKEND_URL : '') + '/admin/execute-payout', { method: 'POST' })
            .catch(e => console.warn('payout trigger failed', e));
        } catch (e) {}
        // reset to 10 minutes locally until server pushes new end
        timestampMs = Date.now() + (10 * 60 * 1000);
      }
    }

    tick();
    window.__payout_timer_interval = setInterval(tick, 1000);
  }

  // when fetch-ca.js dispatches next_payout_ready
  window.addEventListener('next_payout_ready', ev => {
    const next = ev?.detail?.nextPayout;
    if (next) startCountdownTo(Number(next));
  });

  // build UI on load & open WS
  document.addEventListener('DOMContentLoaded', () => {
    // build reels initial grid
    buildInitialReels();
    // disable play by default
    enablePlay(false);
    // open websocket
    openWS();
    // expose a global helper for debug
    window.__casino_debug = { openWS, enablePlay, startReels, stopReels };
  });

})();


function setPlayEnabled(enabled) {
  if (typeof playBtn === 'undefined' || !playBtn) return;
  playBtn.disabled = !enabled;
  if (enabled) playBtn.classList.remove('disabled');
  else playBtn.classList.add('disabled');
}

function showToast(text, ttl=3000) {
  try {
    let wrap = document.querySelector('.toast-wrap');
    if (!wrap) { wrap = document.createElement('div'); wrap.className='toast-wrap'; document.body.appendChild(wrap); }
    const t = document.createElement('div'); t.className='toast'; t.textContent = text;
    wrap.appendChild(t);
    setTimeout(()=> { t.style.opacity='0'; setTimeout(()=>t.remove(),400); }, ttl);
  } catch(e){ console.warn(e); }
}

setPlayEnabled(false);
