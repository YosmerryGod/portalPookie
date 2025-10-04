// func/balance.js
import { state } from './state.js';
import { getEip1193 } from './wallet.js';

import {
  BrowserProvider,
  JsonRpcProvider,
  Contract,
  isAddress,
  getAddress,
  formatEther,
  formatUnits,
} from 'https://esm.sh/ethers@6';

// ====== KONFIG ======
const ADDR = {
  POOKIE_Mainnet: '0x4ad9e272fc02afc518f402317ca9eeaebed96614',
  Pookie_Airdrop: '0xffC795b90Df484AdF7eC2e31A0569269007cBFBE'
};
const ABSTRACT_DEC = 2741;
const ABSTRACT_HEX = '0xAB5';

// ====== Provider helper ======
function makeProvider(override) {
  if (override instanceof JsonRpcProvider || override instanceof BrowserProvider) return override;
  if (typeof override === 'string') return new JsonRpcProvider(override);
  const eip1193 = override || getEip1193();
  if (!eip1193) throw new Error('Wallet (EIP-1193) tidak tersedia.');
  return new BrowserProvider(eip1193);
}

async function ensureAbstract(provider) {
  try {
    const net = await provider.getNetwork();
    if (Number(net.chainId) !== ABSTRACT_DEC && window?.ethereum) {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: ABSTRACT_HEX }],
      });
    }
  } catch (e) {
    console.warn('[balance] ensureAbstract:', e?.message || e);
  }
}

// ====== ETH native ======
export async function getEthBalance(address, providerOverride) {
  if (!isAddress(address)) throw new Error('❌ Address tidak valid');
  const provider = makeProvider(providerOverride);
  await ensureAbstract(provider);

  const net = await provider.getNetwork();
  console.log("[getEthBalance] chainId:", net.chainId.toString());
  console.log("[getEthBalance] addr:", getAddress(address));

  const wei = await provider.getBalance(getAddress(address));
  console.log("[getEthBalance] raw balance:", wei.toString());

  return formatEther(wei);
}


// ====== ERC20 ======
export async function getErc20Balance(address, tokenAddress, providerOverride, decimalsHint) {
  if (!isAddress(address)) throw new Error('address tidak valid (erc20)');
  if (!isAddress(tokenAddress)) throw new Error('tokenAddress tidak valid');

  const provider = makeProvider(providerOverride);
  await ensureAbstract(provider);

  const normAddr = getAddress(address);
  const normTok  = getAddress(tokenAddress);

  const c = new Contract(normTok, [
    'function balanceOf(address) view returns (uint256)',
    'function decimals() view returns (uint8)'
  ], provider);

  try {
    const raw = await c['balanceOf(address)'](normAddr);
    let decimals = Number(decimalsHint);
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
      decimals = await c.decimals().catch(() => 18);
    }
    return formatUnits(raw, decimals);
  } catch (e) {
    console.warn('[balance] ERC20 read fail', tokenAddress, e?.message || e);
    return '0';
  }
}

// ====== Refresh semua ======
export async function refreshBalances(providerOverride) {
  if (!state.connected || !isAddress(state.address)) {
    console.warn('[balance] skip: belum connected / address invalid', state.address);
    return;
  }

  for (const token of state.tokens) {
    token.balance = token.balance ?? '0';

    try {
      if (token.symbol === 'ETH' || token.native === true || !token.address) {
        token.balance = await getEthBalance(state.address, providerOverride);
      } else if (token.address) {
        token.balance = await getErc20Balance(
          state.address, token.address, providerOverride, token.decimals
        );
      }
    } catch (e) {
      console.warn(`[balance] ${token.symbol} gagal:`, e?.message || e);
      token.balance = token.balance ?? '0';
    }
  }

  console.log('[balance] updated:', state.tokens.map(t => `${t.symbol}:${t.balance}`).join(', '));
}
