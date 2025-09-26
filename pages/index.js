// pages/index.js
import Head from "next/head";
import Script from "next/script";

export default function Home() {
  return (
    <>
      <Head>
	<script src="/fetch-ca.js" defer></script>
        <title>Casino Royale</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/assets/seven.png" />
        {/* IMPORTANT: must point to the BACKEND tunnel (wss://.), not the frontend one */}
        <meta name="backend-ws" content="wss://response-fortune-adrian-period.trycloudflare.com/" />
        <link rel="stylesheet" href="/style.css" />
      </Head>

      <div id="app-root" className="app-root">
        <header className="header-row">
          <div className="title-block">
  <h1 className="title">Casino Royale</h1>
  <div className="subline">Luxury slot experience — real rewards</div>

         {/* <<--- INSERT the CA wrapper here */}
      <div className="token-ca-wrapper" style={{display:'inline-block', marginTop:'6px'}}>
        <span className="token-ca token-ca-label">CA:</span>
        <span id="token-ca-val" className="token-ca token-ca-val">—</span>
       </div>
      </div>

          <div className="wallet-block">
            <input id="wallet-input" placeholder="Wallet address" className="wallet-input" />
            <button id="register-btn" className="btn small">Register</button>
            <div className="registered-line">
              <div className="register-instruction">
                To play you have to register the wallet you bought with. (Necessary step for leaderboard purposes)
              </div>
              Registered: <span id="registered-wallet">—</span>
            </div>
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
                  = JACKPOT (500 pts)
                </li>
              </ul>
            </div>

            <div className="panel leaderboard golden-panel">
              <h3>Leaderboard</h3>
              <ul id="leaderboard-list" className="leaderboard-list"></ul>
            </div>

            <div className="panel distributed-card golden-panel">
              <h3>Distributed</h3>
              <div id="distributed-value" className="stat-card value">0</div>
            </div>
          </aside>

          <section className="center-col">
            {/* stats row (Holders, Jackpot, Payout-in, Timer) */}
            <div className="stats-row">
              <div className="stat-card holders-card golden-panel">
                <div className="label">Holders</div>
                <div id="holders-value" className="value">0</div>
              </div>

              <div className="stat-card jackpot-card golden-panel">
                <div className="label">Jackpot</div>
                <div id="jackpot-value" className="value glow">0</div>
              </div>

              <div className="stat-card payoutin-card golden-panel">
                <div className="label">Payout In</div>
                <div id="timer-value" className="value">00:00</div>
              </div>
            </div>

            {/* machine panel (slot machine) */}
            <div id="machine-panel" className="machine-panel golden-panel">
              <div id="reels-container" className="reels-container"></div>

              <div className="controls-panel">
                <button id="spin-btn" className="btn play">SPIN</button>
                <div id="result-text" className="result-text">Good luck!</div>
              </div>

              <div id="history" className="panel" style={{marginTop:12}}>
                <h4>Recent History</h4>
                <ul id="history-list"></ul>
              </div>
            </div>
          </section>
        </main>

        {/* Keep existing client script(s) included by the app */}
        {/* Ensure fetch-ca.js loads after the page is interactive so it can populate #token-ca */}
        <Script src="/fetch-ca.js" strategy="afterInteractive" />
        {/* Your main client logic (existing) should still load as it did before (e.g. script.js included by the Next build or via pages) */}
      </div>
    </>
  );
}
