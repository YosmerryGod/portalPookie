// func/prices.js
import { state } from './state.js';

/**
 * Pookie DApp - Price Module
 * - ETH: Binance 24h ticker (harga & %)
 * - Lainnya: DexScreener token-pairs (harga, %24h, icon)
 * - POOKIE: harga sementara 0.0005 USD
 * - Cache 60s (localStorage)
 * - Mutates state.tokens: { usdPrice, usd, change24h, icon? }
 * - Emits: window 'prices:updated' ({ prices })
 */

const DS_CHAIN = 'abstract'; // slug DexScreener utk Abstract
const DS_BASE  = `https://api.dexscreener.com/token-pairs/v1/${DS_CHAIN}/`;

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

// ✅ terima .png/.jpg/.jpeg/.webp/.gif/.svg + query string (?size=...)
//    atau URL http(s) / data:image
function isImageLike(s) {
  return typeof s === 'string'
    && (/\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(s) || s.startsWith('http') || s.startsWith('data:image'));
}

/**
 * Peta symbol -> token address di Abstract (opsional).
 * Jika token punya t.address, itu akan dipakai lebih dulu.
 */
const TOKEN_ADDR = {
  USDT: '0x0709F39376dEEe2A2dfC94A58EdEb2Eb9DF012bD',
  ETH:  '0x3434610F6225ED4096e0D599a4f9082825382809', // WETH (balance), harga dari Binance
  POOKIE: '0xF0A8cD95Ac4Cb016Bd31335B417e3A1c8aB3Cc91',
};

/* ── DexScreener ──────────────────────────────────────────────────────────── */
function pickBestPair(pairs) {
  if (!Array.isArray(pairs)) return null;
  const candidates = pairs.filter(p => typeof p?.priceUsd === 'string' && p.priceUsd);
  if (!candidates.length) return null;
  candidates.sort((a, b) => (num(b?.liquidity?.usd ?? 0) - num(a?.liquidity?.usd ?? 0)));
  return candidates[0];
}

/**
 * Ambil { price, change24h, icon } dari DexScreener.
 * address: base token address (lowercased).
 */
async function fetchFromDexScreener(address) {
  const addr = (address || '').toLowerCase();
  if (!addr || !/^0x[0-9a-fA-F]{40}$/.test(addr)) return null;

  const cacheKey = `ds:${DS_CHAIN}:${addr}`;
  const cached = getCached(cacheKey);
  if (cached != null) return cached;

  const res = await fetch(DS_BASE + addr, { cache: 'no-store' });
  if (!res.ok) throw new Error(`DexScreener HTTP ${res.status}`);

  const json  = await res.json();
  const pairs = Array.isArray(json) ? json : json?.pairs;
  const best  = pickBestPair(pairs);
  if (!best) { setCached(cacheKey, null); return null; }

  const price = num(best.priceUsd);
  const rawChange = (best?.priceChange?.h24 ?? best?.priceChange24h ?? null);
  const change24h = rawChange != null ? num(rawChange) : null;
  const icon = best?.info?.imageUrl || null;

  const val = Number.isFinite(price)
    ? { price, change24h: Number.isFinite(change24h) ? change24h : null, icon }
    : null;

  setCached(cacheKey, val);
  return val;
}

/* ── Binance (ETH) ─────────────────────────────────────────────────────────── */
async function fetchEthFromBinance() {
  const cacheKey = 'binance:ETHUSDT:24h';
  const cached = getCached(cacheKey);
  if (cached != null) return cached;

  const res = await fetch(BINANCE_ETH_24H, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Binance HTTP ${res.status}`);
  const json = await res.json();
  const price     = num(json?.lastPrice);
  const change24h = num(json?.priceChangePercent);
  const value = Number.isFinite(price) ? { price, change24h: Number.isFinite(change24h) ? change24h : null } : null;
  setCached(cacheKey, value);
  return value;
}

/* ── Public API ────────────────────────────────────────────────────────────── */
export async function refreshPrices() {
  const tokens = Array.isArray(state.tokens) ? state.tokens : [];
  const prices = {}; // symbol -> { price, change24h, icon? } | null

  // fetch harga per token
  await Promise.all(tokens.map(async (t) => {
    const sym = (t.symbol || '').toUpperCase();
    try {
      if (sym === 'ETH') {
        prices[sym] = await fetchEthFromBinance();
        return;
      }

      if (sym === 'USDT') {
        prices[sym] = { price: 1.0, change24h: 0, icon: null };
        return;
      }

      if (sym === 'POOKIE') {
        // harga sementara
        prices[sym] = { price: 0.0006, change24h: 15, icon: t.icon || null };
        return;
      }

      // tentukan address: prioritas t.address, kalau tidak ada pakai mapping TOKEN_ADDR
      const addr = (t.address && /^0x[0-9a-fA-F]{40}$/.test(t.address)) ? t.address
                  : (TOKEN_ADDR[sym] || null);

      if (!addr) { prices[sym] = null; return; }

      prices[sym] = await fetchFromDexScreener(addr);
    } catch (e) {
      console.warn('[prices] fetch error', sym, e);
      prices[sym] = null;
    }
  }));

  // apply ke state
  for (const t of tokens) {
    const sym = (t.symbol || '').toUpperCase();
    const rec = prices[sym];

    const price = rec?.price ?? null;
    const change24h = Number.isFinite(rec?.change24h) ? rec.change24h : null;
    const icon = rec?.icon || null;

    if (price != null) {
      t.usdPrice  = price;
      t.usd       = (t.balance != null) ? num(t.balance) * price : null;
      t.change24h = change24h ?? null;
    } else {
      t.usdPrice  = null;
      t.usd       = null;
      t.change24h = null;
    }

    // ✅ set icon dari DexScreener jika ada
    if (icon && !isImageLike(t.icon)) {
      t.icon = icon;
    }
  }

  // total USD
  try {
    state.totalUsd = tokens.reduce((sum, t) => {
      const bal = Number(t.balance ?? 0);
      const p   = Number(t.usdPrice ?? 0);
      return sum + (bal * p);
    }, 0);
  } catch { /* noop */ }

  // log ringkas
  const dbg = tokens.map(t => {
    const p = t.usdPrice != null ? `$${t.usdPrice}` : '$-';
    const c = (t.change24h != null && isFinite(t.change24h)) ? ` (${t.change24h.toFixed(2)}%)` : '';
    return `${t.symbol}: ${p}${c}`;
  }).join(', ');
  console.log('[prices] updated:', dbg);

  // notify UI
  window.dispatchEvent(new CustomEvent('prices:updated', { detail: { prices } }));
  return prices;
}

/** Baca harga dari cache cepat (tanpa fetch). */
export function getUsdPrice(addressOrSymbol) {
  if (typeof addressOrSymbol === 'string' && !addressOrSymbol.startsWith('0x')) {
    const sym = addressOrSymbol.toUpperCase();
    const t = (state.tokens || []).find(x => (x.symbol || '').toUpperCase() === sym);
    return t?.usdPrice ?? null;
  }
  const addr = (addressOrSymbol || '').toLowerCase();
  const rec = getCached(`ds:${DS_CHAIN}:${addr}`);
  return rec?.price ?? null;
}

/** Daftar/ubah address token saat runtime. */
export function setTokenAddress(symbol, address) {
  TOKEN_ADDR[(symbol || '').toUpperCase()] = address;
}

/** (Opsional) ambil % perubahan dari cache cepat. */
export function getChange24h(symbol) {
  const sym = (symbol || '').toUpperCase();
  const t = (state.tokens || []).find(x => (x.symbol || '').toUpperCase() === sym);
  return (t && Number.isFinite(t.change24h)) ? t.change24h : null;
}
