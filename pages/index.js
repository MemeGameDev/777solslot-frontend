// pages/index.js
import Head from "next/head";
import Script from "next/script";

export default function Home() {
  return (
    <>
      <Head>
        <title>Casino Royale</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* favicon (use a PNG from /public/assets to avoid 404) */}
        <link rel="icon" href="/assets/seven.png" />
        {/* IMPORTANT: must point to the BACKEND tunnel (wss://.), not the frontend one */}
        <meta name="backend-ws" content="wss://response-fortune-adrian-period.trycloudflare.com/" />
        <link rel="stylesheet" href="/style.css" />
      </Head>

      <div id="app-root" className="app-root">
        <header className="header-row">
          <div className="title-block">
            <h1 className="title">Casino Royale</h1>
            <div className="subline">Luxury slot experience — real memecoin rewards</div>
          </div>

          {/* TOKEN CA badge placed between title and wallet */}
          <div className="ca-badge" title="Token contract address (mint)">
            CA: <span id="token-ca">4UuWni2GEUkikJFGyF8n4onKRxqCCSw8et5FVszmpump</span>
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
                <li>🍇 🍇 🍇 = Big Win (200 pts)</li>
                <li>🍋 🍋 🍋 = Solid Win (175 pts)</li>
                <li>🍒 🍒 🍒 = Nice Win (150 pts)</li>
                <li>🍇 🍇 X = Small Win (100 pts)</li>
                <li>🍋 🍋 X = Mini Win (75 pts)</li>
                <li>🍒 🍒 X = Tiny Win (50 pts)</li>
                <li style={{display:'flex',gap:6,alignItems:'center'}}>
                  <img src="/assets/seven.png" alt="7" style={{height:22}}/>
                  <img src="/assets/seven.png" alt="7" style={{height:22}}/>
                  <img src="/assets/seven.png" alt="7" style={{height:22}}/>
                  <span style={{marginLeft:8}}> = JACKPOT (500 pts)</span>
                </li>
              </ul>
            </div>

            <div className="panel leaderboard golden-panel">
              <h4>Leaderboard — Top 10</h4>
              <ol id="leaderboard-list" className="leaderboard-list"></ol>
            </div>
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
                <div id="payout-timer" className="value">--:--</div>
              </div>
            </div>

            <div className="panel machine-panel golden-panel" id="machine-panel" style={{position:'relative', overflow:'visible'}}>
              <canvas id="confetti-canvas" style={{position:'absolute', inset:0, pointerEvents:'none'}}></canvas>
              <div id="reels-container" className="reels-container"></div>
            </div>

            <div className="controls-panel">
              <button id="play-btn" className="btn play" disabled>PLAY</button>
              <div id="result" className="result-text">Try Again</div>
              <div id="register-note" className="result-text register-note">
                To play you have to register the wallet you bought with. (Necessary step for leaderboard purposes)
              </div>
            </div>
          </section>
        </main>

        {/* audio */}
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
