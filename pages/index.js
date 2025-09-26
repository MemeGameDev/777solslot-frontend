// pages/index.js
import Head from "next/head";
import Script from "next/script";

export default function Home() {
  return (
    <>
      <Head>
        <title>Casino Royale</title>
        <meta name="description" content="Casino Royale - Sol slot" />
        {/* If your backend is hosted somewhere public, set its origin here:
            <meta name="backend-url" content="https://your-backend.example.com" />
            and optionally set a websocket URL:
            <meta name="backend-ws" content="wss://your-backend.example.com" />
        */}
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="stylesheet" href="/style.css" />
      </Head>

      {/* Load config fetcher early, and main script after interactive */}
      <Script src="/fetch-ca.js" strategy="beforeInteractive" />
      <Script src="/script.js" strategy="afterInteractive" />

      <main className="app-root">
        <header className="header-row">
          <div className="title-block">
            <h1 className="title">Casino Royale</h1>
            <div className="subline">Solana community slot machine</div>
          </div>

          <div style={{display:'flex', gap:12, alignItems:'center'}}>
            <div className="token-ca info-panel golden-panel">
              <div style={{fontSize:12, opacity:0.9}}>Token CA</div>
              <div id="token-ca-val" style={{fontWeight:700, marginTop:6}}>—</div>
            </div>

            <div className="wallet-block info-panel golden-panel">
              <input id="wallet-input" className="wallet-input" placeholder="Enter wallet to register" />
              <button id="register-btn" className="register-btn btn small">Register</button>
              <div id="registered-line" className="registered-line">Registered: —</div>
            </div>
          </div>
        </header>

        <section className="main-grid">
          <aside className="left-col">
            <div className="panel holders-card golden-panel">
              <div style={{fontSize:12}}>Holders</div>
              <div id="holders" style={{fontWeight:800, fontSize:20}}>0</div>
            </div>

            <div className="panel jackpot-card golden-panel">
              <div style={{fontSize:12}}>Jackpot</div>
              <div id="jackpot" style={{fontWeight:800, fontSize:18}}>0.0000 SOL</div>
            </div>

            <div className="panel distributed-card golden-panel">
              <div style={{fontSize:12}}>Distributed</div>
              <div id="distributed" style={{fontWeight:800, fontSize:18}}>0.0000 SOL</div>
            </div>

            <div className="panel payout-card golden-panel">
              <div style={{fontSize:12}}>Payout (per round)</div>
              <ol style={{margin:'8px 0 0 18px'}}>
                <li>Jackpot is funded by the creator fees collected during the round.</li>
                <li>1st place - 30%</li>
                <li>2nd place - 20%</li>
                <li>3rd place - 15%</li>
                <li>4th place - 10%</li>
                <li>5th - 10th - split the remaining 25%</li>
              </ol>
              <div style={{marginTop:8,fontSize:13,color:'var(--sub)'}}>Minimum payout enforced: 0.01 SOL</div>
            </div>
          </aside>

          <section className="center-col">
            <div className="stats-row">
              <div className="stat-card timer-card golden-panel" style={{minWidth:110}}>
                <div className="label">Payout in</div>
                <div id="payout-timer" className="value">10:00</div>
              </div>

              <div className="stat-card holders-card golden-panel">
                <div className="label">Holders</div>
                <div className="value" id="holders-stat">0</div>
              </div>

              <div className="stat-card jackpot-card golden-panel">
                <div className="label">Jackpot</div>
                <div className="value" id="jackpot-stat">0.0000 SOL</div>
              </div>
            </div>

            <div className="machine-panel golden-panel">
              <div id="win-line" style={{height:6, width:'100%', borderRadius:6, marginBottom:12}}></div>
              <div id="reels-container" className="reels-container" style={{display:'flex'}}></div>
              <div id="result" className="result-text" style={{minHeight:28, marginTop:8}}>Try Again</div>
              <div className="controls-panel" style={{marginTop:12}}>
                <button id="play-btn" className="btn play">PLAY</button>
                <div id="timer" className="timer" style={{opacity:0.9, marginTop:6}}>10</div>
              </div>
            </div>

            <div className="panel history-panel golden-panel" style={{width:'100%', maxWidth:760}}>
              <div style={{fontWeight:700, marginBottom:8}}>Recent Wins</div>
              <ul id="history-list" className="history-list"></ul>
            </div>
          </section>

          <aside className="left-col">
            <div className="panel leaderboard-panel golden-panel">
              <div style={{fontWeight:700}}>Leaderboard</div>
              <ul id="leaderboard-list" className="leaderboard-list" style={{marginTop:8}}></ul>
            </div>

            <div className="panel paytable-panel golden-panel">
              <div style={{fontWeight:700}}>Winning Combinations</div>
              <ul style={{marginTop:8}}>
                <li>Cherry x2 - Tiny Win</li>
                <li>Lemon x2 - Mini Win</li>
                <li>Grape x2 - Small Win</li>
                <li>Cherry x3 - Big Win</li>
                <li>Lemon x3 - Big Win</li>
                <li>Grape x3 - Big Win</li>
                <li>7 7 7 = JACKPOT (500 pts)</li>
              </ul>
            </div>
          </aside>
        </section>

        {/* audio assets (ids used by script.js) */}
        <audio id="spin-sound" src="/assets/spin.mp3" preload="auto"></audio>
        <audio id="small-win" src="/assets/small-win.mp3" preload="auto"></audio>
        <audio id="big-win" src="/assets/big-win.mp3" preload="auto"></audio>
        <audio id="jackpot-win" src="/assets/jackpot.mp3" preload="auto"></audio>
        <audio id="timer-sound" src="/assets/tick.mp3" preload="auto"></audio>
        <audio id="background-sound" src="/assets/bg.mp3" preload="auto" loop></audio>
      </main>
      <style jsx>{``}</style>
    </>
  );
}
