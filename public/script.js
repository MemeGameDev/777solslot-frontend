(function () {
  function $(id) { return document.getElementById(id); }
  function make(tag, cls) { const el = document.createElement(tag); if (cls) el.className = cls; return el; }
  function shortAddr(a) { if (!a || typeof a !== 'string') return '—'; if (a.length <= 10) return a; return a.slice(0,4) + '....' + a.slice(-4); }

  // runtime state
  const WS_PORT = 8080; // dev fallback port
  let ws = null;
  let registeredWallet = null;
  let isSpinning = false;
  let pendingFinalReels = null;
  let pendingResultText = null;
  let reelIntervals = [];
  let confettiCanvas = null;
  let confettiCtx = null;
  let particles = [];
  let particleAnimId = null;
  let confettiActive = false;
  let previousDistributed = 0;

  // ---------------------------
  // Confetti / particles
  // ---------------------------
  function initConfettiCanvas() {
    confettiCanvas = $('confetti-canvas');
    if (!confettiCanvas) return;
    confettiCtx = confettiCanvas.getContext('2d');
    resizeConfettiCanvas();
    window.addEventListener('resize', resizeConfettiCanvas);
  }
  function resizeConfettiCanvas() {
    if (!confettiCanvas) return;
    const rect = confettiCanvas.getBoundingClientRect();
    confettiCanvas.width = Math.ceil(rect.width * devicePixelRatio);
    confettiCanvas.height = Math.ceil(rect.height * devicePixelRatio);
    confettiCanvas.style.width = rect.width + 'px';
    confettiCanvas.style.height = rect.height + 'px';
    if (confettiCtx) confettiCtx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  }
  function randomGoldShade() {
    const golds = ['#FFD54A','#F2C94C','#E6B243','#FFD980','#F0C05A'];
    return golds[Math.floor(Math.random()*golds.length)];
  }
  function spawnParticles(x, y, count = 80) {
    if (!confettiCanvas) return;
    particles = particles.concat(Array.from({length: count}).map(() => {
      const isCoin = Math.random() < 0.32;
      const vx = (Math.random() - 0.5) * 6;
      const vy = - (6 + Math.random() * 6) - Math.random()*6;
      return {
        x: x + (Math.random()-0.5)*120,
        y: y + (Math.random()-0.5)*40,
        vx, vy,
        ax: 0,
        ay: 0.28 + Math.random()*0.18,
        size: isCoin ? 12 + Math.random()*10 : 6 + Math.random()*10,
        rot: Math.random()*Math.PI*2,
        drot: (Math.random()-0.5)*0.3,
        color: isCoin ? null : randomGoldShade(),
        coin: isCoin,
        life: 0,
        ttl: 200 + Math.random()*120
      };
    }));
    if (!confettiActive) {
      confettiActive = true;
      particleLoop();
      setTimeout(()=>{ confettiActive=false; }, 4200);
    }
  }
  function particleLoop() {
    if (!confettiCtx || !confettiCanvas) return;
    const ctx = confettiCtx;
    ctx.clearRect(0,0,confettiCanvas.width, confettiCanvas.height);
    for (let i = particles.length -1; i >= 0; i--) {
      const p = particles[i];
      p.vx += p.ax;
      p.vy += p.ay;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.drot;
      p.life++;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      if (p.coin) {
        const r = p.size;
        const g = ctx.createRadialGradient(-r*0.2, -r*0.2, r*0.1, 0,0, r);
        g.addColorStop(0, '#fff7d6');
        g.addColorStop(0.35, '#fff0b6');
        g.addColorStop(1, '#d9a700');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0,0,r,0,Math.PI*2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.18)';
        ctx.lineWidth = Math.max(1, r*0.08);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size*1.8);
      }
      ctx.restore();
      if (p.y > (confettiCanvas.height/devicePixelRatio) + 120 || p.life > p.ttl) particles.splice(i,1);
    }
    if (particles.length > 0) {
      particleAnimId = requestAnimationFrame(particleLoop);
    } else {
      if (particleAnimId) cancelAnimationFrame(particleAnimId);
      particleAnimId = null;
    }
  }
  function triggerJackpotParticles() {
    if (!confettiCanvas) initConfettiCanvas();
    const rect = confettiCanvas.getBoundingClientRect();
    const cx = rect.width / 2;
    const topY = rect.height * 0.18;
    spawnParticles(cx, topY, 120);
    setTimeout(()=> spawnParticles(cx-120, topY+20, 40), 200);
    setTimeout(()=> spawnParticles(cx+120, topY+20, 40), 350);
  }

  // ---------------------------
  // WS resolver: prefer localStorage -> meta -> window.SOL_WS_HOST -> fallback
  // ---------------------------
  function getBackendWS() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage.SOL_WS_HOST) {
        const v = localStorage.SOL_WS_HOST;
        if (v.startsWith('http://')) return v.replace(/^http:/, 'ws:');
        if (v.startsWith('https://')) return v.replace(/^https:/, 'wss:');
        return v;
      }
    } catch (e) {}

    try {
      const meta = document.querySelector('meta[name="backend-ws"]');
      if (meta && meta.content) {
        if (location && location.protocol === 'https:' && meta.content.startsWith('ws://')) {
          return meta.content.replace(/^ws:/, 'wss:');
        }
        return meta.content;
      }
    } catch (e) {}

    if (typeof window !== 'undefined' && window.SOL_WS_HOST) return window.SOL_WS_HOST;

    const scheme = (location && location.protocol === 'https:') ? 'wss:' : 'ws:';
    return scheme + '//' + location.hostname + ':' + (location.port || WS_PORT) + '/';
  }

  // ---------------------------
  // WebSocket open/handling
  // ---------------------------
  function openWS() {
    const wsUrl = getBackendWS();
    console.log('Connecting to WS →', wsUrl);
    if (ws && ws.readyState === WebSocket.OPEN) return;
    try { ws = new WebSocket(wsUrl); } catch (e) { console.warn('WS error', e); return; }

    ws.addEventListener('open', () => {
      safeSend({ action: 'requestState' });
      if (registeredWallet) safeSend({ action: 'register', wallet: registeredWallet });
    });

    ws.addEventListener('message', (ev) => {
      let data;
      try { data = JSON.parse(ev.data); } catch { return; }
      if (!data) return;

      if (data.type === 'state') {
        if (typeof data.jackpot !== 'undefined' && $('jackpot')) {
          const val = Number(data.jackpot || 0);
          $('jackpot').textContent = val.toFixed(4) + ' SOL';
          const jc = document.querySelector('.jackpot-card .value');
          if (jc) { if (val > 0) jc.classList.add('glow'); else jc.classList.remove('glow'); }
        }
        if (typeof data.holders !== 'undefined' && $('holders')) $('holders').textContent = Number(data.holders || 0);
        if (typeof data.distributedPrizes !== 'undefined') {
          const newVal = Number(data.distributedPrizes || 0);
          animateDistributedIncrease(previousDistributed, newVal);
          previousDistributed = newVal;
        }
        renderLeaderboard(data.leaderboard || []);
        if (data.round && data.round.end && $('payout-timer')) {
          updateTimerTick(Number(data.round.end));
          if (!window.__payout_timer_interval) {
            window.__payout_timer_interval = setInterval(()=> updateTimerTick(Number(data.round.end)), 1000);
          }
        }
      }

      if (data.type === 'register_result') {
        if (data.ok) {
          registeredWallet = data.wallet;
          if ($('registered-wallet')) $('registered-wallet').textContent = data.wallet;
          enablePlay(true);
          showToast('Wallet verified and registered','success',2200);
          try { const bg = $('background-sound'); if (bg) { bg.volume = 0.45; bg.play().catch(()=>{}); } } catch {}
        } else {
          enablePlay(false);
          showToast('Registration failed: ' + (data.reason || 'not a holder'), 'error', 3000);
        }
      }

      if (data.type === 'spin_result') {
        if (data.ok) {
          pendingFinalReels = data.reels;
          pendingResultText = data.result || 'Try Again';
          if (String(pendingResultText).toLowerCase().includes('777') || /jackpot/i.test(String(pendingResultText))) {
            triggerJackpotParticles();
          }
        } else {
          showToast('Spin failed: ' + (data.reason || 'unknown'), 'error', 3000);
        }
      }

      if (data.type === 'payouts') {
        showToast('Payouts distributed: ' + Number(data.distributedTotal || 0).toFixed(4) + ' SOL','success',5000);
      }
    });

    ws.addEventListener('close', () => setTimeout(openWS, 1500));
    ws.addEventListener('error', () => {});
  }

  // ---------------------------
  // Utilities
  // ---------------------------
  function safeSend(obj) { try { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj)); } catch (e) {} }
  function ensureToastWrap(){ if (!window.__toast_wrap) { const w = make('div','toast-wrap'); document.body.appendChild(w); window.__toast_wrap = w; } return window.__toast_wrap; }
  function showToast(msg, type='info', ttl=2800){ const w = ensureToastWrap(); const t = make('div','toast ' + (type==='error'?'error':type==='success'?'success':'info')); t.innerHTML = `<strong style="display:block;margin-bottom:6px">${type==='error'?'Error':(type==='success'?'Success':'Info')}</strong><div style="line-height:1.2;font-size:13px">${msg}</div>`; w.appendChild(t); setTimeout(()=> { t.style.opacity = '0'; t.style.transform = 'translateX(8px)'; setTimeout(()=> t.remove(), 400); }, ttl); }

  // ---------------------------
  // Reels UI
  // ---------------------------
  function createSymbol(sym) {
    const el = make('div','reel-symbol'); if (!sym) return el;
    const s = String(sym);
    if (s === '7' || s === '777') {
      const img = document.createElement('img'); img.src = '/assets/seven.png'; img.alt = '7'; img.style.height = '56px'; img.style.objectFit = 'contain';
      el.appendChild(img); el.classList.add('seven'); return el;
    }
    if (/GRAPE/i.test(s) || s.startsWith('G')) el.textContent = '🍇';
    else if (/LEMON/i.test(s) || s.startsWith('L')) el.textContent = '🍋';
    else if (/CHERRY/i.test(s) || s.startsWith('C')) el.textContent = '🍒';
    else el.textContent = s;
    return el;
  }
  function randomSymbolCode() { const arr = ['CHERRY','LEMON','GRAPE','7']; return arr[Math.floor(Math.random()*arr.length)]; }
  function buildReels() {
    const rc = $('reels-container'); if (!rc) return;
    rc.innerHTML = '';
    for (let c=0;c<3;c++){
      const col = make('div','reel-col');
      for (let r=0;r<3;r++) col.appendChild(createSymbol(randomSymbolCode()));
      rc.appendChild(col);
    }
  }
  function startReels() {
    const cols = document.querySelectorAll('.reel-col');
    if (!cols || cols.length === 0) buildReels();
    const reelCols = document.querySelectorAll('.reel-col');
    reelCols.forEach((col, idx) => {
      reelIntervals[idx] = setInterval(() => {
        col.appendChild(createSymbol(randomSymbolCode()));
        if (col.children.length > 3) col.removeChild(col.firstChild);
      }, 80 + idx*12);
    });
    isSpinning = true;
    try {
      const s = $('spin-sound');
      if (s) { s.currentTime = 0; s.loop = true; s.play().catch(()=>{}); }
    } catch {}
  }
  function stopReels(finalReels, resultText) {
    reelIntervals.forEach(clearInterval);
    reelIntervals = [];
    const cols = document.querySelectorAll('.reel-col');
    cols.forEach((col, idx) => {
      setTimeout(()=> {
        if (finalReels && finalReels[idx]) {
          col.innerHTML = '';
          finalReels[idx].forEach(sym => col.appendChild(createSymbol(sym)));
        }
        if (idx === cols.length -1) {
          isSpinning = false;
          try { const s = $('spin-sound'); if (s) { s.pause(); s.currentTime = 0; } } catch {}
          if (resultText && resultText !== 'NONE' && resultText !== 'Try Again') {
            playResultSound(resultText);
            const machine = document.querySelector('.machine-panel');
            if (machine) { machine.classList.add('win-flash'); setTimeout(()=> machine.classList.remove('win-flash'), 1200); }
          }
          if ($('result')) $('result').textContent = resultText || 'Try Again';
        }
      }, idx * 300);
    });
  }
  function playResultSound(resultCode) {
    try {
      const rc = String(resultCode || '').toLowerCase();
      if (/777|jackpot/.test(rc)) { const s = $('jackpot-win'); if (s) s.play().catch(()=>{}); }
      else if (/ggg|lll|ccc|x3|triple|big/.test(rc)) { const s = $('big-win'); if (s) s.play().catch(()=>{}); }
      else { const s = $('small-win'); if (s) s.play().catch(()=>{}); }
    } catch {}
  }

  // ---------------------------
  // Leaderboard / Timer / UI helpers
  // ---------------------------
  function renderLeaderboard(arr) {
    const list = $('leaderboard-list'); if (!list) return;
    list.innerHTML = '';
    for (let i = 0; i < 10; i++) {
      const li = make('li');
      const entry = (Array.isArray(arr)?arr:[])[i];
      if (entry) {
        li.textContent = `${i+1}. ${shortAddr(entry.wallet)} - ${entry.pts || 0} pts`;
      } else {
        li.textContent = `${i+1}. —`; li.className = 'placeholder';
      }
      list.appendChild(li);
    }
  }
  function updateTimerTick(endTs) {
    const remaining = Math.max(0, Math.floor((endTs - Date.now()) / 1000));
    const mm = String(Math.floor(remaining / 60)).padStart(2,'0');
    const ss = String(remaining % 60).padStart(2,'0');
    if ($('payout-timer')) $('payout-timer').textContent = `${mm}:${ss}`;
  }
  function enablePlay(enabled) {
    const btn = $('play-btn');
    if (!btn) return;
    btn.disabled = !enabled;
    if (enabled) btn.classList.remove('disabled'); else btn.classList.add('disabled');
  }

  // ---------------------------
  // distributed prizes animator
  // ---------------------------
  function animateDistributedIncrease(oldVal, newVal) {
    oldVal = Number(oldVal || 0); newVal = Number(newVal || 0);
    const display = $('distributed-prizes'); if (!display) return;
    const start = oldVal; const end = newVal; const diff = end - start;
    const steps = 24; let i = 0;
    if (diff > 0.0000001) { spawnCoinPop(diff); }
    const iv = setInterval(() => {
      i++;
      const t = i / steps;
      const cur = start + (end - start) * easeOutCubic(t);
      display.textContent = cur.toFixed(4) + ' SOL';
      if (i >= steps) { clearInterval(iv); display.textContent = end.toFixed(4) + ' SOL'; }
    }, 28);
  }
  function spawnCoinPop(diff) {
    const card = document.querySelector('.distributed-card');
    let rect;
    if (card) rect = card.getBoundingClientRect();
    else rect = { left: window.innerWidth/2, top: window.innerHeight/2, width: 60 };
    const pop = make('div','coin-pop'); pop.textContent = '+' + Number(diff).toFixed(4) + ' SOL';
    document.body.appendChild(pop);
    const left = (rect.left + (rect.width||60)/2) - 30;
    const top = rect.top - 16;
    pop.style.left = Math.max(12, left) + 'px';
    pop.style.top = Math.max(8, top) + 'px';
    requestAnimationFrame(()=> pop.classList.add('hide'));
    setTimeout(()=> { pop.remove(); }, 900);
  }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  // ---------------------------
  // Controls / wiring
  // ---------------------------
  function setupControls() {
    const playBtn = $('play-btn');
    const regBtn = $('register-btn');
    const wInput = $('wallet-input');

    enablePlay(false);

    if (playBtn) playBtn.addEventListener('click', () => {
      if (!registeredWallet) { showToast('Register a wallet to play','info'); return; }
      if (isSpinning) return;
      buildReels(); startReels();
      safeSend({ action: 'spin', wallet: registeredWallet });
      setTimeout(()=> {
        stopReels(pendingFinalReels, pendingResultText || 'Try Again');
        pendingFinalReels = null; pendingResultText = null;
      }, 3500);
    });

    if (regBtn && wInput) regBtn.addEventListener('click', () => {
      const val = (wInput.value||'').trim();
      if (!val) { showToast('Enter a wallet address','info'); return; }
      if (!ws || ws.readyState !== WebSocket.OPEN) openWS();
      safeSend({ action: 'register', wallet: val });
      regBtn.textContent = 'Verifying...'; regBtn.disabled = true;
      setTimeout(()=> { regBtn.textContent = 'Register'; regBtn.disabled = false; }, 2200);
    });
  }

  // ---------------------------
  // init DOM tweaks & boot
  // ---------------------------
  function init() {
    try {
      const paytable = document.querySelector('.paytable');
      if (paytable) {
        const pb = paytable.querySelector('.payouts-box');
        if (pb) pb.remove();

        const jackpots = Array.from(paytable.querySelectorAll('li')).filter(li => /777|jackpot/i.test(li.textContent));
        if (jackpots.length) {
          jackpots.forEach(li => {
            li.innerHTML = '';
            const img1 = document.createElement('img'); img1.src='/assets/seven.png'; img1.alt='7'; img1.style.height='22px';
            const img2 = document.createElement('img'); img2.src='/assets/seven.png'; img2.alt='7'; img2.style.height='22px';
            const img3 = document.createElement('img'); img3.src='/assets/seven.png'; img3.alt='7'; img3.style.height='22px';
            li.appendChild(img1); li.appendChild(img2); li.appendChild(img3);
            const span = document.createElement('span'); span.style.marginLeft='8px'; span.textContent = ' = JACKPOT (500 pts)';
            li.appendChild(span);
          });
        }
      }

      let payoutsPanel = document.querySelector('.payouts-panel');
      if (!payoutsPanel) {
        payoutsPanel = document.createElement('div');
        payoutsPanel.className = 'panel payouts-panel golden-panel';
        payoutsPanel.innerHTML = '<strong>Payouts (per round)</strong><ol class="payouts-list"><li>1st — 30%</li><li>2nd — 20%</li><li>3rd — 15%</li><li>4th — 10%</li><li>5th–10th — share remaining 25% equally</li></ol><div class="payout-note">Jackpot is funded by creator fees collected in the payout window.</div><div class="min-payout-note">Minimum payout enforced: 0.01 SOL</div>';
        const leftCol = document.querySelector('.left-col');
        if (leftCol) leftCol.appendChild(payoutsPanel);
      } else {
        if (!payoutsPanel.querySelector('.payout-note')) {
          const note = document.createElement('div');
          note.className = 'payout-note';
          note.textContent = 'Jackpot is funded by creator fees collected in the payout window.';
          payoutsPanel.appendChild(note);
        }
        const list = payoutsPanel.querySelector('.payouts-list');
        if (list) {
          list.innerHTML = '<li>1st — 30%</li><li>2nd — 20%</li><li>3rd — 15%</li><li>4th — 10%</li><li>5th–10th — share remaining 25% equally</li>';
        }
      }

      const payEl = document.querySelector('.paytable'); if (payEl) payEl.classList.add('golden-panel');
      const lb = document.querySelector('.leaderboard'); if (lb) lb.classList.add('golden-panel');

    } catch (e) {
      console.warn('init DOM tweak failed', e);
    }

    initConfettiCanvas(); buildReels(); setupControls(); openWS();
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(init,0); else document.addEventListener('DOMContentLoaded', init);
})();
