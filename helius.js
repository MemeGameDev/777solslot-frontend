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
