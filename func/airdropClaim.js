// func/airdropClaim.js
// Uses global `ethers` from <script src="https://cdn.jsdelivr.net/npm/ethers@6.11.1/dist/ethers.umd.min.js"></script>

import { getUsdPrice, refreshPrices } from './prices.js'; // <-- new: gunakan harga dari prices.js

const CONTRACT_ADDRESS = "0xffC795b90Df484AdF7eC2e31A0569269007cBFBE";
const ABI = [
  "function claimAirdrop() external payable",
  "function airdropClaimed(address) view returns (bool)",
  "function AIRDROP_FEE() view returns (uint256)",
  "function AIRDROP_AMOUNT() view returns (uint256)",
  "function totalAirdropClaimed() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function airdropActive() view returns (bool)",
  "function decimals() view returns (uint8)"
];

async function _getBrowserProvider() {
  if (!window.ethereum) throw new Error("No injected wallet found (MetaMask / WalletConnect).");
  return new ethers.BrowserProvider(window.ethereum);
}

async function _getSignerAndContract() {
  const provider = await _getBrowserProvider();
  const signer = await provider.getSigner();
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
  return { provider, signer, contract };
}

/**
 * Fetch airdrop info. userAddress optional (if provided, will check claimed status).
 * Returns strings and BNs.
 */
export async function fetchAirdropInfo(userAddress = null) {
  const provider = await _getBrowserProvider();
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

  const [
    airdropAmountBN,
    airdropFeeBN,
    totalClaimedBN,
    contractBalanceBN,
    active,
    decimals
  ] = await Promise.all([
    contract.AIRDROP_AMOUNT(),
    contract.AIRDROP_FEE(),
    contract.totalAirdropClaimed(),
    contract.balanceOf(CONTRACT_ADDRESS),
    contract.airdropActive(),
    // decimals() may exist on token contract — keep for display use
    (async () => {
      try { return await contract.decimals(); } catch { return 18; }
    })()
  ]);

  const userClaimed = userAddress ? await contract.airdropClaimed(userAddress) : false;

  // --- Try to get ETH price (USD) from local prices module first ---
  let ethPriceUsd = null;
  try {
    // ask prices module to refresh quickly (it will use cache TTL)
    try { await refreshPrices(); } catch (e) { /* ignore refresh failure */ }
    const p = getUsdPrice('ETH');
    if (p != null && Number.isFinite(p)) ethPriceUsd = Number(p);
  } catch (e) {
    console.warn('prices module fallback error', e);
  }

  // Fallback: fetch CoinGecko if prices.js didn't give a value
  if (ethPriceUsd == null) {
    try {
      const resp = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
      const j = await resp.json();
      ethPriceUsd = Number(j?.ethereum?.usd) || null;
    } catch (e) {
      console.warn('coingecko fetch failed', e);
      ethPriceUsd = null;
    }
  }

  const airdropFeeEth = ethers.formatEther(airdropFeeBN);
  let airdropFeeUsd = null;
  try {
    if (ethPriceUsd != null && !Number.isNaN(Number(airdropFeeEth))) {
      airdropFeeUsd = (Number(airdropFeeEth) * Number(ethPriceUsd));
    }
  } catch (e) {
    airdropFeeUsd = null;
  }

  return {
    airdropAmountBN,
    airdropAmountStr: ethers.formatUnits(airdropAmountBN, Number(decimals ?? 18)),
    airdropFeeBN,
    airdropFeeEth,                 // string, e.g. "0.00045"
    airdropFeeUsd,                 // number in USD (may be null)
    totalClaimedBN,
    totalClaimedStr: ethers.formatUnits(totalClaimedBN, Number(decimals ?? 18)),
    contractBalanceBN,
    contractBalanceStr: ethers.formatUnits(contractBalanceBN, Number(decimals ?? 18)),
    active,
    userClaimed,
    decimals: Number(decimals ?? 18)
  };
}

/**
 * Calls claimAirdrop() with the fee extracted from the contract.
 * Assumes wallet already connected in the page (but will still work if not).
 * Returns txHash + receipt.
 */
export async function claimAirdrop() {
  const { signer, contract } = await _getSignerAndContract();

  const userAddr = await signer.getAddress();
  const already = await contract.airdropClaimed(userAddr);
  if (already) throw new Error("You have already claimed this airdrop.");

  const active = await contract.airdropActive();
  if (!active) throw new Error("Airdrop is not active.");

  const fee = await contract.AIRDROP_FEE();

  const tx = await contract.claimAirdrop({ value: fee });
  const receipt = await tx.wait();
  return { txHash: tx.hash, receipt };
}
