// func/tokens.js
import { state } from './state.js';
import { refreshBalances } from './balance.js';
import { refreshPrices } from './prices.js';
import { probeErc20 } from './erc20.js';   // ← pakai probe asli

// key untuk localStorage
const LS_KEY = 'customTokens:v2'; // bump versi biar format baru aman

/** Ambil daftar token custom dari localStorage */
function loadCustomList() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    console.error('[tokens] gagal load list:', e);
    return [];
  }
}

/** Simpan daftar token custom ke localStorage */
function saveCustomList(list) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(list || []));
  } catch (e) {
    console.error('[tokens] gagal save list:', e);
  }
}

/** Cek apakah string alamat valid 0x */
function isHexAddress(addr) {
  return /^0x[a-fA-F0-9]{40}$/.test(addr || '');
}

/** Restore semua token custom dari localStorage ke state */
export function restoreCustomTokens() {
  const list = loadCustomList();
  if (!Array.isArray(list)) return;

  for (const item of list) {
    const address  = (item.address || '').toLowerCase();
    if (!isHexAddress(address)) continue;

    const exists = state.tokens.some(t => (t.address || '').toLowerCase() === address);
    if (!exists) {
      state.tokens.push({
        address,
        symbol: (item.symbol || 'TOKEN'),
        name: item.name || 'Custom Token',
        decimals: Number.isFinite(item.decimals) ? item.decimals : 18,
        icon: '🪙',
        balance: 0,
        usd: null,
        usdPrice: null,
        userAdded: true,
      });
    }
  }

  // Re-probe ringan di background untuk memperbaiki symbol/name yang kosong
  setTimeout(async () => {
    for (const t of state.tokens) {
      if (!t.userAdded) continue;
      try {
        const meta = await probeErc20(t.address);
        if (meta?.symbol && meta.symbol !== t.symbol) t.symbol = meta.symbol;
        if (meta?.name && meta.name !== t.name) t.name = meta.name;
        if (Number.isFinite(meta?.decimals) && meta.decimals !== t.decimals) t.decimals = meta.decimals;

        // update storage
        const listNow = loadCustomList().map(x =>
          x.address.toLowerCase() === t.address.toLowerCase()
            ? { ...x, symbol: t.symbol, name: t.name, decimals: t.decimals }
            : x
        );
        saveCustomList(listNow);
      } catch {}
    }
  }, 500);
}

/** Tambah token custom + persist + refresh */
export async function addCustomToken(address) {
  const addr = (address || '').trim();
  if (!isHexAddress(addr)) throw new Error('Masukkan alamat 0x… yang valid');

  // jangan duplikat (berdasarkan address)
  if (state.tokens.some(t => (t.address || '').toLowerCase() === addr.toLowerCase())) {
    throw new Error('Token sudah ada di daftar');
  }

  // probe metadata ERC20
  let meta = null;
  try {
    meta = await probeErc20(addr);
  } catch (e) {
    console.warn('[tokens] probeErc20 gagal (pakai fallback):', e);
  }

  const token = {
    address: addr.toLowerCase(),
    symbol: meta?.symbol ?? 'TOKEN',
    name: meta?.name ?? 'Custom Token',
    decimals: Number.isFinite(meta?.decimals) ? meta.decimals : 18,
    icon: '🪙',
    balance: 0,
    usd: null,
    usdPrice: null,
    userAdded: true,
  };

  // daftar ke state
  state.tokens.push(token);

  // persist ke localStorage (simpan nama & decimals juga)
  const list = loadCustomList();
  list.push({ address: token.address, symbol: token.symbol, name: token.name, decimals: token.decimals });
  saveCustomList(list);

  // re-probe ulang setelah 1–2 detik (kadang provider lambat)
  setTimeout(async () => {
    try {
      const again = await probeErc20(token.address);
      let changed = false;
      if (again?.symbol && again.symbol !== token.symbol) { token.symbol = again.symbol; changed = true; }
      if (again?.name && again.name !== token.name)       { token.name   = again.name;   changed = true; }
      if (Number.isFinite(again?.decimals) && again.decimals !== token.decimals) {
        token.decimals = again.decimals; changed = true;
      }
      if (changed) {
        const now = loadCustomList().map(x =>
          x.address.toLowerCase() === token.address ? { ...x, symbol: token.symbol, name: token.name, decimals: token.decimals } : x
        );
        saveCustomList(now);
      }
    } catch {}
  }, 1200);

  // update balance & harga
  await refreshBalances();
  await refreshPrices();
  return token;
}

/** Hapus token custom */
export function removeCustomToken(address) {
  const target = (address || '').toLowerCase();
  state.tokens = (state.tokens || []).filter(t => (t.address || '').toLowerCase() !== target);

  // update storage
  const list = loadCustomList().filter(t => (t.address || '').toLowerCase() !== target);
  saveCustomList(list);
}
