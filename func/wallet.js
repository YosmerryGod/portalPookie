import { state } from './state.js';

export const ABSTRACT = {
  chainIdHex: '0xAB5', // 2741
  chainName: 'Abstract Mainnet',
  rpcUrls: ['https://api.mainnet.abs.xyz'],
  blockExplorerUrls: ['https://abscan.org/'],
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcWsUrl: 'wss://api.mainnet.abs.xyz/ws',
};

export const STORAGE_KEY = 'pookie_session_v1';

export function getEip1193() {
  return (typeof window !== 'undefined' && window.ethereum) ? window.ethereum : null;
}

export function getAGW() {
  if (typeof window === 'undefined') return null;
  if (window.abstract) return window.abstract;
  const eth = window.ethereum;
  if (!eth) return null;
  if (Array.isArray(eth.providers)) {
    return eth.providers.find(p => p?.isAbstract || p?.providerName === 'Abstract' || p?.name === 'Abstract') || null;
  }
  return eth?.isAbstract ? eth : null;
}

// ---------- Storage ----------
export function saveSession() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      connected: state.connected,
      address: state.address,
      chainId: state.chainId,
      providerType: state.providerType,
    }));
  } catch {}
}

export function loadSession() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}

export function clearSession() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

// ---------- Chain Ensurer ----------
async function ensureAbstractChain(provider) {
  if (!provider?.request) throw new Error('Provider not available');

  const target = ABSTRACT.chainIdHex.toLowerCase();
  const current = await provider.request({ method: 'eth_chainId' }).catch(() => null);

  if (current?.toLowerCase() === target) return;

  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: ABSTRACT.chainIdHex }] });
  } catch (err) {
    if (err?.code === 4902 || err?.code === -32603) {
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: ABSTRACT.chainIdHex,
          chainName: ABSTRACT.chainName,
          rpcUrls: ABSTRACT.rpcUrls,
          blockExplorerUrls: ABSTRACT.blockExplorerUrls,
          nativeCurrency: ABSTRACT.nativeCurrency,
        }],
      });
      await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: ABSTRACT.chainIdHex }] });
    } else throw err;
  }
}

// ---------- Generic Connector ----------
async function connectWallet(provider, type, ensureChain = false) {
  if (!provider) throw new Error(`${type} not detected. Please install/enable the extension.`);
  if (ensureChain) await ensureAbstractChain(provider);

  const accounts = await provider.request({ method: 'eth_requestAccounts' });
  if (!accounts?.length) throw new Error('No accounts available.');
  const [address] = accounts;

  const chainId = await provider.request({ method: 'eth_chainId' });

  state.connected    = true;
  state.address      = address;
  state.chainId      = chainId;
  state.providerType = type;
  bindProviderEvents(provider, type);
  saveSession();
  return { address, chainId };
}

// ---------- Connectors ----------
export const connectMetaMask   = (opts) => connectWallet(getEip1193(), 'metamask', opts?.ensureAbstract);
export const connectAGW       = (opts) => connectWallet(getAGW(), 'agw', opts?.ensureAbstract);
export const connectBitget    = (opts) => connectWallet(window.bitget, 'bitget', opts?.ensureAbstract);
export const connectSafePal   = (opts) => connectWallet(window.safepal, 'safepal', opts?.ensureAbstract);
export const connectTrustWallet = (opts) => connectWallet(window.trustwallet, 'trustwallet', opts?.ensureAbstract);

// ---------- Session Restore ----------
export async function tryRestoreSession() {
  const sess = loadSession();
  if (!sess?.connected) return false;

  let provider = null;
  switch (sess.providerType) {
    case 'agw': provider = getAGW(); break;
    case 'metamask': provider = getEip1193(); break;
    case 'bitget': provider = window.bitget; break;
    case 'safepal': provider = window.safepal; break;
    case 'trustwallet': provider = window.trustwallet; break;
  }
  if (!provider) return false;

  const accounts = await provider.request({ method: 'eth_accounts' }).catch(() => []);
  if (!accounts?.length) { clearSession(); return false; }

  state.connected = true;
  state.address = accounts[0];
  state.chainId = await provider.request({ method: 'eth_chainId' }).catch(() => sess.chainId || null);
  state.providerType = sess.providerType;
  bindProviderEvents(provider, sess.providerType);
  saveSession();
  return true;
}

// ---------- Disconnect ----------
export function disconnectWallet() {
  state.connected = false;
  state.address = null;
  state.chainId = null;
  state.providerType = null;
  clearSession();
  document.dispatchEvent(new CustomEvent('navigate', { detail: 'auth' }));
}

// ---------- Events ----------
function bindProviderEvents(provider, providerType) {
  if (!provider || provider.__pookieBound) return;
  provider.__pookieBound = true;

  provider.on?.('accountsChanged', (accs) => {
    if (accs?.length) { 
      state.address = accs[0]; 
      state.connected = true; 
    } else { 
      disconnectWallet(); 
    }
    saveSession();
  });

  provider.on?.('chainChanged', (_chainId) => { 
    state.chainId = _chainId; 
    saveSession(); 
  });

  provider.on?.('disconnect', () => { 
    disconnectWallet(); 
  });

  provider.__pookieType = providerType;
}
