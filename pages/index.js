// frontend/pages/index.js
import Head from "next/head";
import Script from "next/script";

export default function Home() {
  return (
    <>
      <Head>
        <title>Casino Royale</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="stylesheet" href="/style.css" />
      </Head>

      {/* fetch token CA + round info from backend */}
      <Script src="/fetch-ca.js" strategy="afterInteractive" />

      <div className="app-root">
        <header className="header-row">
          <div className="title-block">
            <h1 className="title">Casino Royale</h1>
            <div className="subline">Luxury slot experience — real rewards</div>
          </div>

          {/* token CA container (between title and wallet) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div id="token-ca-container" className="token-ca-container">
              <span className="token-ca-label">CA:</span>
              <span id="token-ca-val" className="token-ca">—</span>
            </div>

            {/* wallet/register area */}
            <div className="wallet-section">
              <div className="wallet-row">
                <input id="wallet-input" className="wallet-input" placeholder="Wallet address" />
                <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                  <button id="register-btn" className="btn small">Register</button>
                </div>
              </div>
              <div id="registered-line" className="registered-line">Registered: —</div>
            </div>
          </div>
        </header>

        {/* main grid */}
        <div className="main-grid">

          {/* LEFT */}
          <aside className="left-col">
            <section id="winning-combinations" className="panel golden-panel">
              <h3>Winning Combinations</h3>
              <ul className="paytable">
                <li>🍇 🍇 🍇 = Big Win (200 pts)</li>
                <li>🍋 🍋 🍋 = Solid Win (175 pts)</li>
                <li>🍒 🍒 🍒 = Nice Win (150 pts)</li>
                <li>7 7 7 = JACKPOT (500 pts)</li>
              </ul>
            </section>

            <section id="leaderboard" className="panel golden-panel">
              <h3>Leaderboard — Top 10</h3>
              <ol id="leaderboard-list" className="leaderboard-list"></ol>
            </section>

            <section id="distributed" className="panel golden-panel">
              <h3>Distributed</h3>
              <div className="stat-card distributed-card">
                <div className="value" id="distributed-val">0</div>
              </div>
            </section>
          </aside>

          {/* CENTER */}
          <main className="center-col">

            {/* stats row */}
            <div className="stats-row">
              <div className="stat-card holders-card golden-panel">
                <div className="label">Holders</div>
                <div className="value" id="holders-val">0</div>
              </div>

              <div className="stat-card jackpot-card golden-panel">
                <div className="label">Jackpot</div>
                <div className="value" id="jackpot-val">0</div>
              </div>

              <div className="stat-card timer-card golden-panel">
                <div className="label">Payout In</div>
                <div className="value" id="timer-val">00:00</div>
              </div>
            </div>

            {/* slot machine panel */}
            <div id="machine" className="machine-panel golden-panel">
              <div id="reels-container" className="reels-container gold-bg">
                <div className="reel-col">
                  <div className="reel-symbol">🍇</div>
                </div>
                <div className="reel-col">
                  <div className="reel-symbol">🍋</div>
                </div>
                <div className="reel-col">
                  <div className="reel-symbol">🍒</div>
                </div>
              </div>

              <div className="controls-panel">
                <button id="spin-btn" className="btn play">PLAY</button>
                <div className="result-text" id="result-text">Good luck!</div>
              </div>
            </div>

            {/* register note placed below the slot machine */}
            <div className="register-instruction register-note">
              Register a holder&apos;s wallet to unlock the play button (necessary for the leaderboard)
            </div>

            {/* audio assets */}
            <audio id="spin-sound" src="/assets/spin-sound.mp3" preload="auto"></audio>
            <audio id="small-win" src="/assets/small-win.mp3" preload="auto"></audio>
            <audio id="big-win" src="/assets/big-win.mp3" preload="auto"></audio>
            <audio id="jackpot-win" src="/assets/jackpot-win.mp3" preload="auto"></audio>
            <audio id="timer-sound" src="/assets/timer-sound.mp3" preload="auto"></audio>
            <audio id="background-sound" src="/assets/background.mp3" preload="auto" loop></audio>

          </main>

          {/* RIGHT (if you add future panels) */}
          <aside className="right-col"></aside>

        </div>
      </div>

      {/* main client runtime for slot UI */}
      <Script src="/script.js" strategy="afterInteractive" />
    </>
  );
}
