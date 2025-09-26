// pages/index.js
import Head from 'next/head'
import Script from 'next/script'
import React from 'react'

export default function Home() {
  return (
    <>
      <Head>
        <title>Casino Royale</title>
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="stylesheet" href="/style.css" />
      </Head>

      {/* load client scripts after interactive */}
      <Script src="/fetch-ca.js" strategy="afterInteractive" />
      <Script src="/script.js" strategy="afterInteractive" />

      <div className="app-root">
        <header className="header-row">
          <div className="title-block">
            <h1 className="title">Casino Royale</h1>
            <div className="subline">A refined spin for winners</div>
          </div>

          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <div id="token-ca-container" className="token-ca" aria-hidden="true" style={{display:'none'}}>
              CA: <span id="token-ca-val" className="token-ca-val">—</span>
            </div>
          </div>
        </header>

        <main className="main-grid">
          <aside className="left-col">
            <div className="panel stat-card holders-card golden-panel info-panel">
              <div className="label">Holders</div>
              <div className="value"><span id="holders">0</span></div>
            </div>

            <div className="panel jackpot-card golden-panel info-panel">
              <div className="label">Jackpot</div>
              <div className="value" id="jackpot">0.0000</div>
            </div>

            <div className="panel distributed-card golden-panel info-panel">
              <div className="label">Distributed</div>
              <div className="value" id="distributed">0.0000</div>
            </div>

            <div className="panel payout-card golden-panel info-panel">
              <div className="label">Payout in</div>
              <div className="value" id="payout-in">—</div>
            </div>

            <div className="panel paytable golden-panel info-panel">
              <div className="label">Winning combinations</div>
              <ul>
                <li>7 7 7 — Jackpot</li>
                <li>🍒 x3 — big</li>
                <li>🍇 x3 — medium</li>
                <li>🍋 x2 — small</li>
              </ul>
            </div>
          </aside>

          <section className="center-col">
            <div className="stats-row">
              <div className="stat-card jackpot-card">
                <div className="label">Jackpot</div>
                <div className="value" id="jackpot-stat">0.0000</div>
              </div>
              <div className="stat-card distributed-card">
                <div className="label">Distributed</div>
                <div className="value" id="distributed-stat">0.0000</div>
              </div>
            </div>

            <div className="machine-panel golden-panel">
              <div className="reels-container" id="reels-container" />
              <div id="win-line" className="win-line" aria-hidden="true"></div>

              <div className="controls-panel">
                <div id="timer" className="timer">5</div>
                <button id="play-btn" className="btn play">Play</button>
                <div id="result" className="result-text">Ready</div>
                <div className="register-note register-instruction">
                  To play you have to register the wallet you bought with. (Necessary step for leaderboard purposes)
                </div>
                <div className="wallet-block">
                  <input id="wallet-input" className="wallet-input" placeholder="Registered wallet (optional)" />
                  <div className="registered-line">Registered wallet: <span id="registered-wallet">—</span></div>
                </div>
              </div>
            </div>

            <div className="panel leaderboard-panel golden-panel">
              <h3>Leaderboard</h3>
              <ul id="leaderboard-list" className="leaderboard-list"></ul>
            </div>

            <div className="panel history-panel golden-panel">
              <h3>History (payouts)</h3>
              <ul id="history-list"></ul>
            </div>
          </section>
        </main>

        <div id="toast-root" className="toast-wrap" />
      </div>
    </>
  )
}
