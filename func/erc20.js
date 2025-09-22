// func/erc20.js
import { getEip1193 } from './wallet.js';

const SIG = {
  name:     '0x06fdde03', // name()
  symbol:   '0x95d89b41', // symbol()
  decimals: '0x313ce567', // decimals()
};

// decode UTF-8 aman dari hex (tanpa 0x)
function hexToUtf8(hexNo0x) {
  try {
    const len = hexNo0x.length;
    const out = new Uint8Array(len / 2);
    for (let i = 0; i < out.length; i++) {
      out[i] = parseInt(hexNo0x.slice(i * 2, i * 2 + 2), 16);
    }
    const s = new TextDecoder('utf-8', { fatal: false }).decode(out);
    return s.replace(/[^\x20-\x7E]+/g, '').trim() || null;
  } catch { return null; }
}

/** Decode return data untuk string ERC-20:
 * - bytes32 legacy (66 chars: 0x + 64)
 * - dynamic ABI string: 0x + offset(32) + len(32) + data
 */
function decodeString(ret) {
  if (!ret || ret === '0x') return null;

  // bytes32 legacy
  if (ret.length === 66) {
    let no0x = ret.slice(2);
    // trim trailing 00
    while (no0x.endsWith('00')) no0x = no0x.slice(0, -2);
    return hexToUtf8(no0x);
  }

  // dynamic
  if (ret.length >= 130) {
    const no0x = ret.slice(2);
    const offset = parseInt(no0x.slice(0, 64), 16);
    const base   = 2 + offset * 2; // termasuk "0x"
    const len    = parseInt(ret.slice(base, base + 64), 16);
    const data   = ret.slice(base + 64, base + 64 + len * 2);
    return hexToUtf8(data);
  }

  // fallback kasar
  return hexToUtf8(ret.startsWith('0x') ? ret.slice(2) : ret);
}

async function callString(addr, sig) {
  const prov = await getEip1193();
  const ret = await prov.request({ method: 'eth_call', params: [{ to: addr, data: sig }, 'latest'] });
  return decodeString(ret);
}
async function callUint(addr, sig) {
  const prov = await getEip1193();
  const ret = await prov.request({ method: 'eth_call', params: [{ to: addr, data: sig }, 'latest'] });
  if (!ret || ret === '0x') return null;
  const n = parseInt(ret, 16);
  return Number.isFinite(n) ? n : null;
}

export async function probeErc20(address) {
  const [name, symbol, decimals] = await Promise.allSettled([
    callString(address, SIG.name),
    callString(address, SIG.symbol),
    callUint(address,   SIG.decimals),
  ]).then(r => r.map(x => x.status === 'fulfilled' ? x.value : null));

  return {
    name: (typeof name === 'string' && name.length) ? name : null,
    symbol: (typeof symbol === 'string' && symbol.length) ? symbol : null,
    decimals: Number.isFinite(decimals) ? decimals : null,
  };
}
