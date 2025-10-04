// components/trade/tokenVerify.js
// versi tanpa ethers — memakai getEip1193() dari func/wallet.js
import { getEip1193 } from './wallet.js';
import { toast } from './utils.js';

const FACTORY_ADDRESS = '0x0D6848e39114abE69054407452b8aaB82f8a44BA';

// 4-byte selectors (dari screenshot Anda)
const SELECTORS = {
  moonshotTokens: '0xe228b1b3',     // moonshotTokens(address)
  readyForMigration: '0xace1bfab'   // readyForMigration(address)
};

/** Utility: ensure 0x-prefixed hex lowercase */
function normHex(h) {
  if (!h) return h;
  return h.startsWith('0x') ? h.toLowerCase() : '0x' + h.toLowerCase();
}

/** Encode address as 32-byte hex (without 0x prefix) */
function encodeAddress(addr) {
  if (!addr) throw new Error('Invalid address');
  let a = addr.toLowerCase();
  if (a.startsWith('0x')) a = a.slice(2);
  // pad left to 64 chars
  return a.padStart(64, '0');
}

/**
 * Low-level eth_call using provider.request
 * @param {string} to - contract address
 * @param {string} data - hex data (0x...)
 * @returns {Promise<string>} - hex result or '0x'
 */
async function ethCallRaw(to, data) {
  const provider = getEip1193();
  if (!provider || !provider.request) throw new Error('No EIP-1193 provider found');

  const params = [{ to: normHex(to), data: normHex(data) }, 'latest'];
  // provider.request may throw if provider not available or not connected
  const res = await provider.request({ method: 'eth_call', params }).catch(err => {
    // bubble error up
    throw err;
  });
  return res; // hex string
}

/** Parse boolean from returned hex (32 bytes). returns true/false */
function parseBool(hex) {
  if (!hex || hex === '0x') return false;
  // Trim 0x then take last byte (or interpret as bigint)
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  // If result shorter than 64, pad left (some nodes may return shorter)
  const padded = clean.padStart(64, '0');
  // last byte:
  const lastByte = padded.slice(-2);
  return lastByte !== '00';
}

/**
 * callSelectorRaw: build data = selector + encoded args
 * @param {string} selector - '0x...' or 'abcd1234'
 * @param {Array} types - not used (we only need address encoding here), kept for extensibility
 * @param {Array} values - values, for address we use encodeAddress
 */
async function callSelectorRaw(to, selector, types = [], values = []) {
  // Build data: selector (without 0x) + encoded args (without 0x)
  const sel = selector.startsWith('0x') ? selector.slice(2) : selector;
  let encodedArgs = '';

  // simple support for single 'address' argument array (common for your functions)
  if (types.length > 0 && types.length === values.length) {
    const parts = [];
    for (let i = 0; i < types.length; i++) {
      const t = types[i];
      const v = values[i];
      if (t === 'address') {
        parts.push(encodeAddress(v));
      } else {
        // for unsupported types, throw so developer can extend if needed
        throw new Error('Unsupported type in callSelectorRaw: ' + t);
      }
    }
    encodedArgs = parts.join('');
  }

  const data = '0x' + sel + encodedArgs;
  return await ethCallRaw(to, data);
}

/** safe wrapper to avoid app crash; returns fallback on error */
async function safeCallBool(selector, tokenAddress, fallback = false) {
  const selectorName = Object.keys(SELECTORS).find(key => SELECTORS[key] === selector) || selector;
  try {
    const raw = await callSelectorRaw(FACTORY_ADDRESS, selector, ['address'], [tokenAddress]);
    const result = parseBool(raw);
    console.log(`[tokenVerify] Call OK: ${selectorName}, Raw: ${raw}, Result: ${result}`); // LOG SUKSES
    return result;
  } catch (err) {
    // Tangani provider errors dengan anggun
    console.error(`[tokenVerify] ERROR: Call failed for ${selectorName}.`, err.message || String(err)); // LOG GAGAL
    console.warn('[tokenVerify] Returning fallback value:', fallback);
    return fallback;
  }
}

// Exported functions
export async function isMoonshotTokenSelector(tokenAddress) {
  if (!tokenAddress) return false;
  return await safeCallBool(SELECTORS.moonshotTokens, tokenAddress, false);
}

export async function isReadyForMigrationSelector(tokenAddress) {
  if (!tokenAddress) return false;
  return await safeCallBool(SELECTORS.readyForMigration, tokenAddress, false);
}

/** Combined verification info */
export async function getTokenVerificationInfo(tokenAddress) {
  if (!tokenAddress || typeof tokenAddress !== 'string') {
    return {
      address: tokenAddress || null,
      isMoonshotToken: false,
      isReadyForMigration: false,
      recommendedDex: 'AbstractSwap',
      verified: false,
      error: 'invalid_address'
    };
  }

  try {
    const [moon, ready] = await Promise.all([
      isMoonshotTokenSelector(tokenAddress),
      isReadyForMigrationSelector(tokenAddress)
    ]);

    // *** LOG HASIL VERIFIKASI ***
    console.log(`[tokenVerify] Moonshot Check (moon): ${moon}, Migration Check (ready): ${ready}`);
    
    const recommendedDex = (moon && !ready) ? 'Moonshot' : 'AbstractSwap';
    
    console.log(`[tokenVerify] Recommended DEX: ${recommendedDex}`);
    // ****************************

    return {
      address: tokenAddress,
      isMoonshotToken: !!moon,
      isReadyForMigration: !!ready,
      recommendedDex,
      verified: true
    };
  } catch (err) {
    console.error('[tokenVerify] getTokenVerificationInfoSelector error', err);
    return {
      address: tokenAddress,
      isMoonshotToken: false,
      isReadyForMigration: false,
      recommendedDex: 'AbstractSwap',
      verified: false,
      error: err.message || String(err)
    };
  }
}