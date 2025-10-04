// components/trade/tokenInformation.js
import { getTokenVerificationInfo } from './tokenVerify.js';
import { toast } from './utils.js';

const DS_CHAIN = 'abstract';
const DS_BASE = `https://api.dexscreener.com/token-pairs/v1/${DS_CHAIN}/`;
const CACHE_TTL = 60_000; // 60s

// --- IN-MEMORY CACHE (no localStorage) ---
const cache = new Map();

function now() { 
  return Date.now(); 
}

function getCached(key) {
  const rec = cache.get(key);
  return (rec && (now() - rec.t) < CACHE_TTL) ? rec.v : null;
}

function setCached(key, value) {
  cache.set(key, { v: value, t: now() });
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
 * Select best pair from DexScreener pairs array
 * Priority: highest 24h volume with valid price
 */
function pickBestPair(pairs) {
  if (!Array.isArray(pairs) || pairs.length === 0) {
    return null;
  }

  return pairs.reduce((best, current) => {
    const bestVolume = num(best?.volume?.h24 ?? 0);
    const currentVolume = num(current?.volume?.h24 ?? 0);
    const hasPrice = Number.isFinite(num(current.priceUsd)) && num(current.priceUsd) > 0;
    
    if (!hasPrice) return best;
    return (!best || currentVolume > bestVolume) ? current : best;
  }, null);
}

// --- API FETCHERS ---

/**
 * Fetch from Moonshot API and normalize structure
 */
async function fetchMoonshotData(tokenAddress) {
  try {
    const url = `https://api.moonshot.cc/token/v1/abstract/${tokenAddress}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Moonshot API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Normalize to consistent structure
    return {
      success: true,
      dex: 'Moonshot',
      data: {
        // Basic info
        url: data.url,
        chainId: data.chainId,
        dexId: data.dexId,
        pairAddress: data.pairAddress,
        
        // Token info
        baseToken: data.baseToken,
        quoteToken: data.quoteToken,
        
        // Price data
        priceNative: num(data.priceNative),
        priceUsd: num(data.priceUsd),
        priceChange: {
          h24: num(data.priceChange?.h24 ?? 0)
        },
        
        // Volume - NORMALIZE: Moonshot uses object, convert to number
        volume: {
          h24: num(data.volume?.h24?.total ?? 0)
        },
        
        // Transactions
        txns: {
          h24: {
            buys: data.txns?.h24?.buys ?? 0,
            sells: data.txns?.h24?.sells ?? 0
          }
        },
        
        // Market data
        fdv: num(data.fdv ?? 0),
        marketCap: num(data.marketCap ?? 0),
        liquidity: {
          usd: null // Moonshot doesn't provide liquidity
        },
        
        // Moonshot specific
        moonshot: data.moonshot,
        
        // Profile/Info - NORMALIZE: use consistent 'info' key
        info: {
          imageUrl: data.profile?.icon,
          banner: data.profile?.banner,
          links: data.profile?.links,
          description: data.profile?.decription // typo in API
        },
        
        // Metadata
        createdAt: data.createdAt
      }
    };
  } catch (err) {
    console.error('[tokenInformation] fetchMoonshotData error:', err);
    return {
      success: false,
      dex: 'Moonshot',
      error: err.message
    };
  }
}

/**
 * Fetch from DexScreener API and normalize structure
 */
async function fetchDexScreenerData(address) {
  const addr = (address || '').toLowerCase();
  if (!addr || !/^0x[0-9a-fA-F]{40}$/.test(addr)) {
    return { success: false, error: 'Invalid address format' };
  }

  const cacheKey = `ds:${DS_CHAIN}:${addr}`;
  const cached = getCached(cacheKey);
  if (cached != null) return cached;

  const url = DS_BASE + addr;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`DexScreener HTTP ${res.status}`);
    
    const json = await res.json();
    
    // CRITICAL: DexScreener returns ARRAY or object with 'pairs' array
    const pairs = Array.isArray(json) ? json : json?.pairs;
    
    if (!Array.isArray(pairs) || pairs.length === 0) {
      const result = { success: false, error: 'No pairs found' };
      setCached(cacheKey, result);
      return result;
    }

    // Pick best pair by volume
    const best = pickBestPair(pairs);
    
    if (!best) {
      const result = { success: false, error: 'No valid pair with price' };
      setCached(cacheKey, result);
      return result;
    }

    // Normalize to consistent structure (matching Moonshot)
    const normalized = {
      success: true,
      dex: 'DexScreener',
      data: {
        // Basic info
        url: best.url,
        chainId: best.chainId,
        dexId: best.dexId,
        pairAddress: best.pairAddress,
        
        // Token info
        baseToken: best.baseToken,
        quoteToken: best.quoteToken,
        
        // Price data
        priceNative: num(best.priceNative),
        priceUsd: num(best.priceUsd),
        priceChange: {
          h24: num(best.priceChange?.h24 ?? 0)
        },
        
        // Volume - already number in DexScreener
        volume: {
          h24: num(best.volume?.h24 ?? 0)
        },
        
        // Transactions
        txns: {
          h24: {
            buys: best.txns?.h24?.buys ?? 0,
            sells: best.txns?.h24?.sells ?? 0
          }
        },
        
        // Market data
        fdv: num(best.fdv ?? 0),
        marketCap: num(best.marketCap ?? 0),
        liquidity: {
          usd: num(best.liquidity?.usd ?? 0)
        },
        
        // Moonshot data (if available)
        moonshot: best.moonshot || null,
        
        // Info - normalized from 'info' key
        info: best.info ? {
          imageUrl: best.info.imageUrl,
          header: best.info.header,
          websites: best.info.websites,
          socials: best.info.socials
        } : null,
        
        // Metadata
        pairCreatedAt: best.pairCreatedAt
      },
      
      // Include all pairs for reference
      allPairs: pairs
    };

    setCached(cacheKey, normalized);
    console.debug('[DexScreener] Normalized data for', addr, 'price:', normalized.data.priceUsd);
    return normalized;
    
  } catch (e) {
    console.error('[tokenInformation] DexScreener fetch error:', addr, e);
    const result = { success: false, error: e.message };
    setCached(cacheKey, result);
    return result;
  }
}

// --- MAIN EXPORTS ---

/**
 * Get complete token information based on verification
 */
export async function getTokenInformation(tokenAddress) {
  try {
    if (!tokenAddress || typeof tokenAddress !== 'string') {
      throw new Error('Invalid token address');
    }

    console.log('[tokenInformation] Verifying DEX for token:', tokenAddress);
    
    // Step 1: Verify which DEX to use
    const verificationInfo = await getTokenVerificationInfo(tokenAddress);
    const recommendedDex = verificationInfo.recommendedDex;
    
    console.log('[tokenInformation] Recommended DEX:', recommendedDex);

    // Step 2: Fetch data from appropriate API
    let result;
    
    if (recommendedDex === 'Moonshot') {
      result = await fetchMoonshotData(tokenAddress);
    } else {
      result = await fetchDexScreenerData(tokenAddress);
    }

    // Step 3: Combine verification and token data
    return {
      success: result.success,
      tokenAddress: tokenAddress,
      verification: verificationInfo,
      tokenData: result.success ? result.data : null,
      allPairs: result.allPairs || null,
      error: result.error || null
    };
    
  } catch (err) {
    console.error('[tokenInformation] getTokenInformation error:', err);
    return {
      success: false,
      tokenAddress: tokenAddress,
      verification: null,
      tokenData: null,
      error: err.message
    };
  }
}

/**
 * Get formatted token summary for display
 */
export async function getTokenSummary(tokenAddress) {
  const info = await getTokenInformation(tokenAddress);
  
  if (!info.success || !info.tokenData) {
    return {
      success: false,
      error: info.error || 'Token data is unavailable.'
    };
  }

  const data = info.tokenData;
  const verification = info.verification;

  return {
    success: true,
    address: tokenAddress,
    
    // Token info
    symbol: data.baseToken?.symbol || 'UNKNOWN',
    name: data.baseToken?.name || 'Unknown Token',
    
    // DEX info
    dex: verification.recommendedDex,
    isMoonshot: verification.isMoonshotToken,
    isMigrated: verification.isReadyForMigration,
    
    // Price info (normalized)
    priceUsd: data.priceUsd || 0,
    priceNative: data.priceNative || 0,
    priceChange24h: data.priceChange?.h24 || 0,
    
    // Market info
    marketCap: data.marketCap || 0,
    fdv: data.fdv || 0,
    liquidity: data.liquidity?.usd || 0,
    
    // Volume info (normalized)
    volume24h: data.volume?.h24 || 0,
    
    // Transaction info
    txns24h: {
      buys: data.txns?.h24?.buys || 0,
      sells: data.txns?.h24?.sells || 0,
      total: (data.txns?.h24?.buys || 0) + (data.txns?.h24?.sells || 0)
    },
    
    // Links
    url: data.url,
    
    // Icon/Image (normalized from both sources)
    icon: data.info?.imageUrl || null,
    banner: data.info?.banner || data.info?.header || null,
    
    // Moonshot specific
    moonshotProgress: data.moonshot?.progress || null,
    moonshotCreator: data.moonshot?.creator || null,
    
    // Pair info
    pairAddress: data.pairAddress,
    quoteToken: data.quoteToken?.symbol || 'ETH'
  };
}

/**
 * Get token information and display notification
 */
export async function fetchAndNotify(tokenAddress) {
  try {
    const summary = await getTokenSummary(tokenAddress);
    
    if (!summary.success) {
      toast(`Failed to fetch token info: ${summary.error}`);
      return summary;
    }

    const priceStr = summary.priceUsd < 0.01 
      ? summary.priceUsd.toExponential(4)
      : summary.priceUsd.toFixed(6);
    
    const changeStr = summary.priceChange24h > 0 ? '+' : '';
    
    const msg = `${summary.symbol} - ${summary.dex}${summary.isMoonshot ? ' (Moonshot)' : ''}\nPrice: $${priceStr}\n24h: ${changeStr}${summary.priceChange24h.toFixed(2)}%`;
    
    toast(msg);
    
    return summary;
  } catch (err) {
    console.error('[tokenInformation] fetchAndNotify error:', err);
    toast('Failed to fetch token information');
    return { success: false, error: err.message };
  }
}