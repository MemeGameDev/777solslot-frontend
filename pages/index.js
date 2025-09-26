import Head from "next/head";
import Script from "next/script";

export default function Home() {
  return (
    <>
      <Head>
        <title>Casino Royale</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/assets/seven.png" />
        <meta name="backend-ws" content="wss://response-fortune-adrian-period.trycloudflare.com/" />
      </Head>

      <div id="app-root" className="app-root">
        <header className="header-row">
          <div className="title-block">
            <h1 className="title">Casino Royale</h1>
            <div className="subline">Luxury slot experience — real memecoin rewards</div>
          </div>

          <div className="token-ca" style={{alignSelf:'center', marginRight:12}}>
            <strong style={{marginRight:6}}>CA:</strong>
            <span id="token-ca-val">—</span>
          </div>

          <div className="wallet-block">
            <input id="wallet-input" placeholder="Wallet address" className="wallet-input" />
            <button id="register-btn" className="btn small">Register</button>
            <div className="registered-line">Registered: <span id="registered-wallet">—</span></div>
          </div>
        </header>

        <main className="main-grid">
          <aside className="left-col">
            <div className="panel paytable golden-panel">
              <h3>Winning Combinations</h3>
              <ul className="paytable-list">
                <li><span>🍇 🍇 🍇</span> <span>= Big Win (200 pts)</span></li>
                <li><span>🍋 🍋 🍋</span> <span>= Solid Win (175 pts)</span></li>
                <li><span>🍒 🍒 🍒</span> <span>= Nice Win (150 pts)</span></li>
                <li><span>🍇 🍇 X</span> <span>= Small Win (100 pts)</span></li>
                <li><span>🍋 🍋 X</span> <span>= Mini Win (75 pts)</span></li>
                <li><span>🍒 🍒 X</span> <span>= Tiny Win (50 pts)</span></li>
                <li className="jackpot-line"><span style={{display:'inline-flex',gap:6,alignItems:'center'}}><img src="/assets/seven.png" style={{height:20}} /><img src="/assets/seven.png" style={{height:20}} /><img src="/assets/seven.png" style={{height:20}} /></span> <span>= JACKPOT (500 pts)</span></li>
              </ul>
            </div>

            <div className="panel leaderboard golden-panel">
              <h4>Leaderboard — Top 10</h4>
              <ol id="leaderboard-list" className="leaderboard-list">
                {/* placeholders filled by script.js */}
              </ol>
            </div>

            <div className="panel payouts-panel golden-panel">
  <h4>Payouts (per round) - Jackpot is funded by the creator fees collected during the round.</h4>
  <ol style={{marginTop:8}}>
    <li>1st place - 30%</li>
    <li>2nd place - 20%</li>
    <li>3rd place - 15%</li>
    <li>4th place - 10%</li>
    <li>5th - 10th - split the remaining 25%</li>
  </ol>
  <div style={{marginTop:8,fontSize:13,color:'var(--sub)'}}>Minimum payout enforced: 0.01 SOL</div>
          </aside>

          <section className="center-col">
            <div className="stats-row">
              <div className="stat-card holders-card golden-panel">
                <div className="label">Holders</div>
                <div id="holders" className="value">0</div>
              </div>

              <div className="stat-card jackpot-card golden-panel">
                <div className="label">Jackpot</div>
                <div id="jackpot" className="value">0.0000 SOL</div>
              </div>

              <div className="stat-card distributed-card golden-panel">
                <div className="label">Distributed</div>
                <div id="distributed-prizes" className="value">0.0000 SOL</div>
              </div>

              <div className="stat-card timer-card golden-panel">
                <div className="label">Payout in</div>
                <div id="payout-timer" className="value">10:00</div>
              </div>
            </div>

            <div className="panel machine-panel golden-panel" id="machine-panel" style={{position:'relative', overflow:'visible'}}>
              <canvas id="confetti-canvas" style={{position:'absolute', inset:0, pointerEvents:'none'}}></canvas>
              <div id="reels-container" className="reels-container" aria-hidden="true"></div>
              <div id="win-line" style={{position:'absolute',left:0,right:0,top:'50%',height:6,pointerEvents:'none'}}></div>
            </div>

            <div className="controls-panel">
              <button id="play-btn" className="btn play">PLAY</button>
              <div id="result" className="result-text">Try Again</div>
              <div id="register-note" className="result-text register-note">
                To play you have to register the wallet you bought with. (Necessary step for leaderboard purposes)
              </div>
            </div>
          </section>
        </main>

        <audio id="background-sound" preload="auto" loop src="/assets/background.mp3"></audio>
        <audio id="spin-sound" preload="auto" src="/assets/spin-sound.mp3"></audio>
        <audio id="small-win" preload="auto" src="/assets/small-win.mp3"></audio>
        <audio id="big-win" preload="auto" src="/assets/big-win.mp3"></audio>
        <audio id="jackpot-win" preload="auto" src="/assets/jackpot-win.mp3"></audio>

      </div>

      <Script src="/fetch-ca.js" strategy="afterInteractive" />
      <Script src="/script.js" strategy="afterInteractive" />
    </>
  );
}
