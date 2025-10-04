// func/prices.js
import { state } from './state.js';

/**
 * Pookie DApp - Price Module (Moonshot-first -> DexScreener)
 * - ETH: Binance 24h ticker (harga & %)
 * - Lainnya: Moonshot (strict priceUsd + priceChange.h24) -> DexScreener token-pairs
 * - POOKIE Airdrop uses POOKIE Mainnet price (SAME_PRICE_ADDR)
 * - Cache 60s (localStorage)
 * - Mutates state.tokens: { usdPrice, usd, change24h, icon?, nativePrice? } <--- nativePrice DITAMBAHKAN
 * - Emits: window 'prices:updated' ({ pricesByAddr })
 */

const DS_CHAIN = 'abstract';
const DS_BASE  = `https://api.dexscreener.com/token-pairs/v1/${DS_CHAIN}/`;

const BINANCE_ETH_24H = 'https://api.binance.com/api/v3/ticker/24hr?symbol=ETHUSDT';

const CACHE_TTL = 60_000; // 60s
const CACHE_KEY = 'pookie:pricesCache:v1';

function now() { return Date.now(); }
function loadCache() { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch { return {}; } }
function saveCache(c) { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); }
function getCached(key) {
  const c = loadCache();
  const rec = c[key];
  return (rec && (now() - rec.t) < CACHE_TTL) ? rec.v : null;
}
function setCached(key, value) {
  const c = loadCache();
  c[key] = { v: value, t: now() };
  saveCache(c);
}

function num(v) {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : NaN;
}

function isImageLike(s) {
  return typeof s === 'string'
    && (/\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(s) || s.startsWith('http') || s.startsWith('data:image'));
}

/**
 * Token address mapping (fallbacks) - keys are descriptive; used when token has no t.address
 */
const TOKEN_ADDR = {
  USDT: '0x0709F39376dEEe2A2dfC94A58EdEb2Eb9DF012bD',
  ETH:  '0x3434610F6225ED4096e0D599a4f9082825382809', // WETH (balance), price from Binance
  POOKIE_MAINNET: '0x4ad9e272fc02afc518f402317ca9eeaebed96614',
  POOKIE_AIRDROP: '0xffC795b90Df484AdF7eC2e31A0569269007cBFBE'
};

/**
 * Map alamat (lowercase) yang harus memakai harga dari alamat lain (aliasing).
 * POOKIE airdrop -> POOKIE mainnet
 */
const SAME_PRICE_ADDR = {
  '0xffc795b90df484adf7ec2e31a0569269007cbfbe': '0x4ad9e272fc02afc518f402317ca9eeaebed96614'
};

/* ── DexScreener helper ───────────────────────────────────────────────────── */
function pickBestPair(pairs) {
  if (!Array.isArray(pairs)) return null;
  const candidates = pairs.filter(p => typeof p?.priceUsd === 'string' && p.priceUsd);
  if (!candidates.length) return null;
  candidates.sort((a, b) => (num(b?.liquidity?.usd ?? 0) - num(a?.liquidity?.usd ?? 0)));
  return candidates[0];
}

async function fetchFromDexScreener(address) {
  const addr = (address || '').toLowerCase();
  if (!addr || !/^0x[0-9a-fA-F]{40}$/.test(addr)) return null;

  const cacheKey = `ds:${DS_CHAIN}:${addr}`;
  const cached = getCached(cacheKey);
  if (cached != null) return cached;

  const url = DS_BASE + addr;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`DexScreener HTTP ${res.status}`);
    const json  = await res.json();
    const pairs = Array.isArray(json) ? json : json?.pairs;
    const best  = pickBestPair(pairs);
    if (!best) { setCached(cacheKey, null); return null; }

    const price = num(best.priceUsd);
    // TAMBAH: Ambil priceNative
    const nativePrice = num(best.priceNative); 
    
    const rawChange = (best?.priceChange?.h24 ?? best?.priceChange24h ?? null);
    const change24h = rawChange != null ? num(rawChange) : null;
    const icon = best?.info?.imageUrl || null;

    const val = Number.isFinite(price)
      ? { 
          price, 
          change24h: Number.isFinite(change24h) ? change24h : null, 
          icon,
          nativePrice: Number.isFinite(nativePrice) ? nativePrice : null // SIMPAN nativePrice
        }
      : null;

    setCached(cacheKey, val);
    console.debug('[DexScreener] addr=', addr, 'price=', val?.price, 'nativePrice=', val?.nativePrice, 'change24h=', val?.change24h);
    return val;
  } catch (e) {
    console.warn('[prices] DexScreener fetch error', addr, e);
    setCached(cacheKey, null);
    return null;
  }
}

/* ── Moonshot helper (strict) ──────────────────────────────────────────────
   Uses official pattern: https://api.moonshot.cc/token/v1/{chainId}/{pairIdOrTokenId}
   We try chainId candidates; only accept result if json.priceUsd parseable.
*/
const MOONSHOT_BASE = 'https://api.moonshot.cc/token/v1';
const MOONSHOT_CHAIN_IDS = ['abstract', '2741'];

async function fetchFromMoonshot(address) {
  const addr = (address || '').toLowerCase();
  if (!addr || !/^0x[0-9a-fA-F]{40}$/.test(addr)) return null;

  const cacheKey = `moon:${addr}`;
  const cached = getCached(cacheKey);
  if (cached != null) return cached;

  for (const chainId of MOONSHOT_CHAIN_IDS) {
    const url = `${MOONSHOT_BASE}/${encodeURIComponent(chainId)}/${addr}`;
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) {
        // try next chainId
        continue;
      }
      const json = await res.json();

      // Strict extraction: expect priceUsd and priceChange.h24
      const rawPrice = json?.priceUsd ?? null;
      // TAMBAH: Ambil priceNative
      const rawNativePrice = json?.priceNative ?? null; 
      
      const rawChange24 = (json?.priceChange && (json.priceChange.h24 ?? json.priceChange?.h24)) ?? null;

      const price = num(rawPrice);
      const nativePrice = num(rawNativePrice); // PARSING nativePrice
      const change24h = num(rawChange24);

      if (!Number.isFinite(price)) {
        // no usable price here; try next chainId
        continue;
      }

      const val = {
        price,
        change24h: Number.isFinite(change24h) ? change24h : null,
        icon: (json?.profile?.icon || json?.image || json?.logo || null),
        nativePrice: Number.isFinite(nativePrice) ? nativePrice : null // SIMPAN nativePrice
      };

      setCached(cacheKey, val);
      console.debug('[Moonshot] chain=', chainId, 'addr=', addr, 'price=', val.price, 'nativePrice=', val.nativePrice, 'change24h=', val.change24h);
      return val;
    } catch (e) {
      // try next chainId
      continue;
    }
  }

  setCached(cacheKey, null);
  return null;
}

/* ── Combined fetch: Moonshot first, then DexScreener ──────────────────────── */
async function fetchPreferMoonshot(address) {
  const addrLower = (address || '').toLowerCase();
  if (!addrLower) return null;

  try {
    const m = await fetchFromMoonshot(addrLower);
    if (m) return m;
  } catch (e) {
    console.warn('[prices] moonshot fetch error', address, e);
  }

  // fallback
  return await fetchFromDexScreener(addrLower);
}

/* ── Binance ETH price (unchanged) ───────────────────────────────────────── */
async function fetchEthFromBinance() {
  const cacheKey = 'binance:ETHUSDT:24h';
  const cached = getCached(cacheKey);
  if (cached != null) return cached;

  const res = await fetch(BINANCE_ETH_24H, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Binance HTTP ${res.status}`);
  const json = await res.json();
  const price     = num(json?.lastPrice);
  const change24h = num(json?.priceChangePercent);
  // ETH adalah mata uang native, jadi priceNative = 1, tapi karena sumbernya Binance, kita asumsikan ETH/ETH = 1
  const value = Number.isFinite(price) ? { price, change24h: Number.isFinite(change24h) ? change24h : null, nativePrice: 1 } : null; 
  setCached(cacheKey, value);
  console.debug('[Binance] ETH price=', value?.price, 'change24h=', value?.change24h);
  return value;
}

/* ── Public API: refreshPrices (address-keyed) ───────────────────────────── */
export async function refreshPrices() {
  const tokens = Array.isArray(state.tokens) ? state.tokens : [];

  // pricesByAddr: addrLower -> { price, change24h, icon, nativePrice } | null
  const pricesByAddr = {};

  // collect unique addresses to fetch (after aliasing)
  const toFetchSet = new Set();

  // Prepare list: for each token, resolve the address we should fetch (apply TOKEN_ADDR fallback)
  for (const t of tokens) {
    const sym = (t.symbol || '').toUpperCase();

    if (sym === 'ETH') {
      // If token has an address, include it (we may map ETH address to Binance price later)
      if (t.address && /^0x[0-9a-fA-F]{40}$/.test(t.address)) toFetchSet.add(t.address.toLowerCase());
      continue;
    }

    // pick address: token.address > mapping by symbol in TOKEN_ADDR
    let addr = (t.address && /^0x[0-9a-fA-F]{40}$/.test(t.address)) ? t.address : (TOKEN_ADDR[sym] || null);

    if (!addr) continue;

    const lower = addr.toLowerCase();
    const source = SAME_PRICE_ADDR[lower] || lower;
    toFetchSet.add(source);
  }

  const uniqFetch = Array.from(toFetchSet);

  // Pre-fetch ETH price from Binance once
  let ethPriceObj = null;
  try {
    ethPriceObj = await fetchEthFromBinance();
  } catch (e) {
    console.warn('[prices] failed to fetch ETH from Binance', e);
  }

  // Fetch all addresses in parallel (Moonshot-first, fallback DexScreener)
  await Promise.all(uniqFetch.map(async (addrLower) => {
    try {
      const rec = await fetchPreferMoonshot(addrLower);
      pricesByAddr[addrLower] = rec; // may be null
    } catch (e) {
      console.warn('[prices] fetch error for', addrLower, e);
      pricesByAddr[addrLower] = null;
    }
  }));

  // Apply results back to state.tokens (lookup by token's effective source address)
  for (const t of tokens) {
    const sym = (t.symbol || '').toUpperCase();

    if (sym === 'ETH') {
      // prefer per-address record if present, otherwise Binance ETH price
      let rec = null;
      if (t.address && /^0x[0-9a-fA-F]{40}$/.test(t.address)) {
        rec = pricesByAddr[t.address.toLowerCase()] ?? null;
      }
      if (!rec && ethPriceObj) {
        // GUNAKAN nativePrice DARI ethPriceObj
        rec = { price: ethPriceObj.price, change24h: ethPriceObj.change24h, icon: null, nativePrice: ethPriceObj.nativePrice }; 
      }

      if (rec && Number.isFinite(rec.price)) {
        t.usdPrice  = rec.price;
        t.usd       = (t.balance != null) ? num(t.balance) * rec.price : null;
        t.change24h = Number.isFinite(rec.change24h) ? rec.change24h : null;
        // UPDATE: Tambahkan nativePrice
        t.nativePrice = Number.isFinite(rec.nativePrice) ? rec.nativePrice : null; 
      } else {
        t.usdPrice = null; t.usd = null; t.change24h = null; t.nativePrice = null;
      }
      continue;
    }

    // determine effective source address for this token (apply SAME_PRICE_ADDR)
    let addr = (t.address && /^0x[0-9a-fA-F]{40}$/.test(t.address)) ? t.address : (TOKEN_ADDR[sym] || null);
    if (!addr) {
      t.usdPrice = null; t.usd = null; t.change24h = null; t.nativePrice = null;
      continue;
    }
    const source = (SAME_PRICE_ADDR[addr.toLowerCase()] || addr).toLowerCase();
    const rec = pricesByAddr[source] ?? null;

    if (rec && Number.isFinite(rec.price)) {
      t.usdPrice  = rec.price;
      t.usd       = (t.balance != null) ? num(t.balance) * rec.price : null;
      t.change24h = Number.isFinite(rec.change24h) ? rec.change24h : null;
      // UPDATE: Tambahkan nativePrice
      t.nativePrice = Number.isFinite(rec.nativePrice) ? rec.nativePrice : null; 
    } else {
      t.usdPrice  = null;
      t.usd       = null;
      t.change24h = null;
      t.nativePrice = null;
    }

    if (rec?.icon && !isImageLike(t.icon)) {
      t.icon = rec.icon;
    }
  }

  // compute totals
  try {
    state.totalUsd = tokens.reduce((sum, t) => {
      const bal = Number(t.balance ?? 0);
      const p   = Number(t.usdPrice ?? 0);
      return sum + (bal * p);
    }, 0);
  } catch (e) { /* noop */ }

  // concise log for debugging
  const dbg = tokens.map(t => {
    const p = t.usdPrice != null ? `$${t.usdPrice}` : '$-';
    const n = t.nativePrice != null ? ` / ${t.nativePrice.toFixed(6)} Native` : ''; // LOG nativePrice
    const c = (t.change24h != null && isFinite(t.change24h)) ? ` (${t.change24h.toFixed(2)}%)` : '';
    return `${t.symbol}@${t.address ? t.address.slice(0,10) : 'noaddr'}: ${p}${n}${c}`;
  }).join(', ');
  console.log('[prices] updated:', dbg);

  // emit UI event
  window.dispatchEvent(new CustomEvent('prices:updated', { detail: { pricesByAddr } }));
  return pricesByAddr;
}

/* ── Helper: getUsdPrice (address-first) ─────────────────────────────────── */
export function getUsdPrice(addressOrSymbol) {
  if (typeof addressOrSymbol !== 'string') return null;

  if (addressOrSymbol.startsWith('0x')) {
    const addr = addressOrSymbol.toLowerCase();
    // Cari harga di cache Moonshot dan DexScreener
    const rec = getCached(`moon:${addr}`) ?? getCached(`ds:${DS_CHAIN}:${addr}`); 
    return rec?.price ?? null;
  }

  const sym = addressOrSymbol.toUpperCase();
  const t = (state.tokens || []).find(x => (x.symbol || '').toUpperCase() === sym);
  return t?.usdPrice ?? null;
}

/* ── Helper: getNativePrice (address-first) ──────────────────────────────── */
export function getNativePrice(addressOrSymbol) {
  if (typeof addressOrSymbol !== 'string') return null;

  if (addressOrSymbol.startsWith('0x')) {
    const addr = addressOrSymbol.toLowerCase();
    // Cari harga di cache Moonshot dan DexScreener
    const rec = getCached(`moon:${addr}`) ?? getCached(`ds:${DS_CHAIN}:${addr}`); 
    return rec?.nativePrice ?? null;
  }

  const sym = addressOrSymbol.toUpperCase();
  const t = (state.tokens || []).find(x => (x.symbol || '').toUpperCase() === sym);
  return t?.nativePrice ?? null;
}


/* ── Utility: setTokenAddress (runtime override) ─────────────────────────── */
export function setTokenAddress(symbol, address) {
  TOKEN_ADDR[(symbol || '').toUpperCase()] = address;
}

/* ── Utility: getChange24h (from state) ─────────────────────────────────── */
export function getChange24h(symbol) {
  const sym = (symbol || '').toUpperCase();
  const t = (state.tokens || []).find(x => (x.symbol || '').toUpperCase() === sym);
  return (t && Number.isFinite(t.change24h)) ? t.change24h : null;
}