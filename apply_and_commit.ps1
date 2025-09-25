# apply_and_commit.ps1
# Usage: powershell -ExecutionPolicy Bypass -File .\apply_and_commit.ps1
# This script writes helius.js, .env.example, logs.txt; patches server.js (backup), updates .gitignore,
# stages and commits the new files. It does NOT push.

$root = Get-Location
Write-Host "Working in: $root" -ForegroundColor Cyan

# --- 1) Write helius.js ---
$heliusPath = Join-Path $root "helius.js"
$heliusCode = @'
/**
 * helius.js
 * Lightweight Helius RPC helper with small in-memory cache.
 * exports: isHolder(owner, tokenMint, heliusApiKey) -> Promise<boolean>
 *
 * NOTE: Ensure Node has global fetch (Node 18+). If not, install node-fetch and modify accordingly.
 */

const TTL_MS = 5 * 60 * 1000; // 5 minutes cache TTL
const cache = new Map(); // key -> { ts: number, val: boolean }

function cacheKey(owner, tokenMint) {
  return (owner || '') + '|' + (tokenMint || '');
}

/**
 * isHolder - checks via Helius RPC if `owner` has a token account for `tokenMint`.
 * Returns boolean. Caches result for TTL_MS per owner+mint.
 */
async function isHolder(owner, tokenMint, heliusApiKey) {
  if (!owner || !tokenMint || !heliusApiKey) {
    // Missing inputs => do not allow
    return false;
  }

  const key = cacheKey(owner, tokenMint);
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && (now - cached.ts) < TTL_MS) {
    return cached.val;
  }

  const url = `https://rpc.helius.xyz/?api-key=${heliusApiKey}`;
  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "getTokenAccountsByOwner",
    params: [owner, { mint: tokenMint }, { encoding: "jsonParsed" }]
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      // treat non-OK as false but do not throw
      console.warn('Helius RPC non-ok:', res.status);
      cache.set(key, { ts: now, val: false });
      return false;
    }

    const j = await res.json().catch(()=>null);
    const found = !!(j && j.result && Array.isArray(j.result.value) && j.result.value.length > 0);

    cache.set(key, { ts: now, val: found });
    return found;
  } catch (err) {
    console.error('Helius isHolder error:', err && err.stack ? err.stack : err);
    // On error, don't allow; cache negative for short time to avoid hammering the RPC
    cache.set(key, { ts: now, val: false });
    return false;
  }
}

module.exports = { isHolder };
'@

Set-Content -Path $heliusPath -Value $heliusCode -Encoding UTF8
Write-Host "Wrote $heliusPath" -ForegroundColor Green

# --- 2) Write .env.example ---
$envExamplePath = Join-Path $root ".env.example"
$envExample = @'
# .env.example - copy to .env and fill values (DO NOT COMMIT .env)
HELIUS_API_KEY=REPLACE_ME
TOKEN_CA=REPLACE_ME  # SPL token mint required for registration
PORT=8080
'@
Set-Content -Path $envExamplePath -Value $envExample -Encoding UTF8
Write-Host "Wrote .env.example" -ForegroundColor Green

# --- 3) create logs.txt if missing ---
$logsPath = Join-Path $root "logs.txt"
if (-not (Test-Path $logsPath)) {
  Set-Content -Path $logsPath -Value "timestamp<TAB>type<TAB>wallet<TAB>tx<TAB>amount" -Encoding UTF8
  Write-Host "Created logs.txt" -ForegroundColor Green
} else {
  Write-Host "logs.txt already exists" -ForegroundColor Yellow
}

# --- 4) Patch server.js (backup + append helper, replace isHolder(..) -> globalIsHolder(..)) ---
$serverPath = Join-Path $root "server.js"
if (-not (Test-Path $serverPath)) {
  Write-Host "ERROR: server.js not found in $root. Please run script from project root." -ForegroundColor Red
  exit 1
}

# Backup server.js
$bak = "$serverPath.bak"
Copy-Item -Path $serverPath -Destination $bak -Force
Write-Host "Backed up server.js -> server.js.bak" -ForegroundColor Cyan

# The appended helper code (CommonJS friendly)
$appendBlock = @'
/* BEGIN HELIUS HOLDER CHECK PATCH - added by apply_and_commit.ps1 */
const fs = require('fs');
async function globalIsHolder(owner) {
  // read envs
  const heliusKey = process.env.HELIUS_API_KEY;
  const tokenMint = process.env.TOKEN_CA;
  if (!heliusKey || !tokenMint) {
    console.warn('globalIsHolder: HELIUS_API_KEY or TOKEN_CA not configured in environment');
    return false;
  }

  let heliusMod;
  try {
    heliusMod = require('./helius.js');
  } catch (e) {
    try {
      // support environments using ESM (dynamic import)
      heliusMod = await import('./helius.js');
      heliusMod = heliusMod.default || heliusMod;
    } catch (err) {
      console.error('globalIsHolder: failed to load helius.js', err);
      return false;
    }
  }

  const fn = heliusMod.isHolder || heliusMod.default || heliusMod;
  try {
    const ok = await fn(owner, tokenMint, heliusKey);
    return !!ok;
  } catch (err) {
    console.error('globalIsHolder: helius check error', err);
    return false;
  }
}

function appendLog(obj) {
  try {
    const time = (new Date()).toISOString();
    const line = [
      time,
      obj.type || '-',
      obj.wallet || '-',
      obj.tx || '-',
      (typeof obj.amount !== 'undefined') ? String(obj.amount) : '-'
    ].join('\\t') + '\\n';
    fs.appendFileSync('logs.txt', line, { encoding: 'utf8', flag: 'a' });
  } catch (e) {
    console.warn('appendLog failed', e);
  }
}
/* END HELIUS HOLDER CHECK PATCH */
'@

Add-Content -Path $serverPath -Value $appendBlock -Encoding UTF8
Write-Host "Appended helius helper block to server.js" -ForegroundColor Green

# Replace textual isHolder( with globalIsHolder(
# We do a straightforward textual replacement; this covers most registration checks that call isHolder(...)
$serverContent = Get-Content -Path $serverPath -Raw -ErrorAction Stop
$replaced = $serverContent -replace '\bisHolder\s*\(', 'globalIsHolder('
if ($serverContent -ne $replaced) {
  Set-Content -Path $serverPath -Value $replaced -Encoding UTF8
  Write-Host "Replaced occurrences of isHolder(...) with globalIsHolder(...)" -ForegroundColor Green
} else {
  Write-Host "No textual 'isHolder(' occurrences found; server.js unchanged except appended block." -ForegroundColor Yellow
}

# --- 5) Ensure .env is ignored in .gitignore ---
$gitignorePath = Join-Path $root ".gitignore"
if (-not (Test-Path $gitignorePath)) {
  Set-Content -Path $gitignorePath -Value ".env`nnode_modules`n.next`nout" -Encoding UTF8
  Write-Host "Created .gitignore" -ForegroundColor Green
} else {
  $g = Get-Content -Path $gitignorePath -Raw
  if ($g -notmatch "(^|\r?\n)\.env($|\r?\n)") {
    Add-Content -Path $gitignorePath -Value "`n.env"
    Write-Host "Appended .env to .gitignore" -ForegroundColor Green
  } else {
    Write-Host ".env already in .gitignore" -ForegroundColor Yellow
  }
}

# --- 6) Stage and commit the new files ---
git add helius.js .env.example logs.txt server.js .gitignore 2>$null
$has = git status --porcelain
if (-not $has) {
  Write-Host "No changes detected to commit" -ForegroundColor Yellow
} else {
  git commit -m "feat: add Helius holder check (helius.js) with caching + logs; add .env.example" 2>$null
  if ($LASTEXITCODE -eq 0) {
    Write-Host "Committed changes. Run 'git show --name-only HEAD' to review." -ForegroundColor Green
  } else {
    Write-Host "Git commit failed or nothing to commit. Run 'git status' to inspect." -ForegroundColor Red
  }
}

Write-Host ""
Write-Host "DONE. Files written and (if changes) committed locally." -ForegroundColor Cyan
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1) Copy .env.example -> .env and fill HELIUS_API_KEY and TOKEN_CA values." -ForegroundColor Yellow
Write-Host "  2) Restart your backend: node server.js" -ForegroundColor Yellow
Write-Host "  3) Test registration & watch logs.txt for appended entries." -ForegroundColor Yellow
