// public/fetch-ca.js
// Lightweight script to fetch token CA from backend (/config) and update the UI.
// Safe / defensive: only touches elements if they exist.

(async function () {
  const LOG_PREFIX = "[fetch-ca]";
  function log(...args) { try { console.log(LOG_PREFIX, ...args); } catch {} }

  // try to fetch token CA from backend /config
  let tokenCA = "";
  try {
    const resp = await fetch("/config", { cache: "no-store" });
    if (resp.ok) {
      const j = await resp.json();
      tokenCA = (j && j.token_ca) ? String(j.token_ca).trim() : "";
      log("fetched token CA:", tokenCA || "(empty)");
    } else {
      log("failed to fetch /config:", resp.status, resp.statusText);
    }
  } catch (e) {
    log("fetch /config error:", e?.message || e);
  }

  // helper: add class safely
  function safeAddClass(sel, cls) {
    try {
      const el = document.querySelector(sel);
      if (el && !el.classList.contains(cls)) el.classList.add(cls);
      return !!el;
    } catch (e) { return false; }
  }

  // helper: add class to all matches
  function addClassAll(sel, cls) {
    try {
      const nodes = document.querySelectorAll(sel);
      nodes.forEach(n => { if (!n.classList.contains(cls)) n.classList.add(cls); });
      return nodes.length;
    } catch (e) { return 0; }
  }

  // wait for DOM ready (no-op if already ready)
  if (document.readyState === "loading") {
    await new Promise(res => document.addEventListener("DOMContentLoaded", res, { once: true }));
  }

  // 1) Update title text to "Casino Royale" if a title element exists
  let titleUpdated = false;
  const titleSelCandidates = [
    ".title",          // common
    "#title",          // id
    "h1", "h2", ".title-block .title"
  ];
  for (const s of titleSelCandidates) {
    const el = document.querySelector(s);
    if (el) {
      el.textContent = "Casino Royale";
      titleUpdated = true;
      log("title replaced via", s);
      break;
    }
  }

  // 2) Insert CA display (between name and wallet area ideally)
  // create token CA node
  if (tokenCA) {
    const tokenNode = document.createElement("div");
    tokenNode.className = "token-ca";
    tokenNode.setAttribute("title", "Token contract address (CA)");
    tokenNode.textContent = `CA: ${tokenCA}`;

    // attempt smart placements (try header/title area, else wallet area, else top of body)
    let placed = false;
    const trySelectors = [
      ".title-block",         // Next / custom header
      ".header-row",          // header container
      ".wallet-block",        // wallet area
      ".panel",               // first panel
      "body"
    ];
    for (const sel of trySelectors) {
      const parent = document.querySelector(sel);
      if (parent) {
        // prefer inserting after title if title exists inside parent
        const title = parent.querySelector(".title");
        if (title && title.parentElement === parent) {
          // insert right after title
          title.insertAdjacentElement("afterend", tokenNode);
        } else {
          // append at end of parent
          parent.insertAdjacentElement("afterbegin", tokenNode);
        }
        log("token CA inserted into", sel);
        placed = true;
        break;
      }
    }
    if (!placed) {
      document.body.insertAdjacentElement("afterbegin", tokenNode);
      log("token CA inserted at top of body (fallback)");
    }
  } else {
    log("no token CA to display (empty)");
  }

  // 3) Add 'gold' / subtle gold background styling to important UI pieces
  // These selectors are targeted but safe if not present.
  const goldenTargets = [
    ".holders-card",
    ".jackpot-card",
    ".distributed-card",
    ".timer-card",
    ".stat-card",
    ".paytable",
    ".paytable ul",
    ".leaderboard-list",
    ".machine-panel",
    "#reels-container",
    ".reels-container",
    ".panel"
  ];
  let goldenCount = 0;
  for (const sel of goldenTargets) {
    goldenCount += addClassAll(sel, "golden-panel"); // class defined in CSS
  }
  log("golden-panel applied to elements count (approx):", goldenCount);

  // 4) Replace the register instruction text, being defensive about node selection
  // Look for nodes likely containing the register text
  const registerSelectors = [
    ".register-note",
    ".register-instruction",
    ".registered-line",
    "#register-note",
    ".register-text",
    ".wallet-instruction",
    ".register-help"
  ];
  let regUpdated = false;
  for (const sel of registerSelectors) {
    const el = document.querySelector(sel);
    if (el) {
      el.textContent = "To play you have to register the wallet you bought with. (Necessary step for leaderboard purposes)";
      regUpdated = true;
      log("register instruction updated via", sel);
      break;
    }
  }

  // If we didn't find explicit node, try to find any element containing old phrase and replace
  if (!regUpdated) {
    const oldPhrase = "Register the holder wallet to play";
    const candidates = Array.from(document.querySelectorAll("p,div,span,label"));
    for (const el of candidates) {
      try {
        if (el.textContent && el.textContent.includes(oldPhrase)) {
          el.textContent = "To play you have to register the wallet you bought with. (Necessary step for leaderboard purposes)";
          regUpdated = true;
          log("register instruction updated by searching old phrase");
          break;
        }
      } catch (e) {}
    }
  }

  // 5) Slightly highlight the token CA node (if present)
  const caNode = document.querySelector(".token-ca");
  if (caNode) {
    // clickable copy-to-clipboard
    caNode.style.cursor = "pointer";
    caNode.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(caNode.textContent.replace(/^CA:\s*/i, ""));
        const old = caNode.textContent;
        caNode.textContent = "Copied!";
        setTimeout(() => caNode.textContent = old, 1200);
      } catch (e) {
        log("copy failed", e);
      }
    });
  }

  log("fetch-ca script done. titleUpdated:", titleUpdated, "regUpdated:", regUpdated);
})();
