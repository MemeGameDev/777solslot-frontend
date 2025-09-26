// pages/index.js
import Head from "next/head";
import Script from "next/script";

export default function Home() {
  return (
    <>
      <Head>
        <title>Casino Royale</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/assets/seven.png" />
        {/* backend websocket url - change if you use a different tunnel */}
        <meta name="backend-ws" content="wss://response-fortune-adrian-period.trycloudflare.com/" />
        <link rel="stylesheet" href="/style.css" />
      </Head>

      {/* load fetch-ca early (afterInteractive) and the main client script */}
      <Script src="/fetch-ca.js" strategy="afterInteractive" />
      <Script src="/script.js" strategy="afterInteractive" />

      <div id="app-root" className="app-root">
        <header className="header-row">
          <div className="title-block">
            <h1 className="title">Casino Royale</h1>
            <div className="subline">Luxury slot experience — real rewards</div>

            <div className="token-ca-wrapper" style={{ display: "inline-flex", gap: 8, marginTop: 6 }}>
              <strong style={{ color: "var(--sub)" }}>CA:</strong>
              <span id="token-ca-val" className="token-ca">—</span>
            </div>
          </div>

          <div className="wallet-block">
            <input id="wallet-input" placeholder="Wallet address" className="wallet-input" />
            <button id="register-btn" className="btn small">Register</button>
            <div className="registered-line">
              <div className="register-instruction" style={{ maxWidth: 320 }}>
                
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
                <li style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <img src="/assets/seven.png" alt="7" style={{ height: 22 }} />
                  <img src="/assets/seven.png" alt="7" style={{ height: 22 }} />
                  <img src="/assets/seven.png" alt="7" style={{ height: 22 }} />
                  = JACKPOT (500 pts)
                </li>
              </ul>
            </div>

            <div className="panel leaderboard golden-panel">
              <h3>Leaderboard</h3>
              <ul id="leaderboard-list" className="leaderboard-list"></ul>
            </div>

            <div className="panel payouts golden-panel">
              <h3>Payouts (per round)</h3>
              <div style={{ fontSize: 13, marginTop: 6 }}>
                Jackpot is funded by the creator + fees collected during the round.
              </div>
              <ol style={{ marginTop: 8 }}>
                <li>1st place - 30%</li>
                <li>2nd place - 20%</li>
                <li>3rd place - 15%</li>
                <li>4th place - 10%</li>
                <li>5th - 10th - split the remaining 25%</li>
              </ol>
              <div style={{ marginTop: 8, fontSize: 13, color: "var(--sub)" }}>
                Minimum payout enforced: 0.01 SOL
              </div>
            </div>
          </aside>

          <section className="center-col">
            <div className="stats-row">
              <div className="stat-card holders-card golden-panel">
                <div className="label">Holders</div>
                <div className="value"><span id="holders">0</span></div>
              </div>

              <div className="stat-card jackpot-card golden-panel">
                <div className="label">Jackpot</div>
                <div className="value"><span id="jackpot">0.0000</span> <span style={{ fontSize: 12 }}>SOL</span></div>
              </div>

              <div className="stat-card distributed-card golden-panel">
                <div className="label">Distributed</div>
                <div className="value"><span id="distributed-value">0.0000</span> SOL</div>
              </div>

              <div className="stat-card timer-card golden-panel">
                <div className="label">Payout in</div>
                <div className="value"><span id="payout-timer">10:00</span></div>
              </div>
            </div>

            <div className="machine-panel golden-panel">
              <div id="win-line" style={{ position: "absolute", inset: "auto 12% 50% 12%", height: 6, borderRadius: 8, pointerEvents: "none" }}></div>

              <div id="reels-container" className="reels-container"></div>

              <div className="controls-panel">
                <div id="result" className="result-text">Try Again</div>
                <div className="register-note" id="register-note">To play, register a wallet first.</div>
                <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                  <button id="play-btn" className="btn play" disabled>Play</button>
                  <button id="demo-spin-btn" className="btn small">Demo Spin</button>
                </div>
              </div>
            </div>

            <div className="panel history golden-panel" style={{ width: "100%", maxWidth: 760 }}>
              <h3>Recent Wins</h3>
              <ul id="history-list" style={{ marginLeft: 6, paddingLeft: 6 }}></ul>
            </div>
          </section>

          <aside className="right-col" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="panel paytable golden-panel">
              <h3>Payout %</h3>
              <div style={{ fontSize: 13 }}>
                1st - 30% | 2nd - 20% | 3rd - 15% | 4th - 10% | 5th-10th - split remaining 25%
              </div>
            </div>
          </aside>
        </main>
      </div>
    </>
  );
}
