// func/airdropClaim.js
// Uses global `ethers` from <script src="https://cdn.jsdelivr.net/npm/ethers@6.11.1/dist/ethers.umd.min.js"></script>

const CONTRACT_ADDRESS = "0xF0A8cD95Ac4Cb016Bd31335B417e3A1c8aB3Cc91";
const ABI = [
  "function claimAirdrop() external payable",
  "function airdropClaimed(address) view returns (bool)",
  "function AIRDROP_FEE() view returns (uint256)",
  "function AIRDROP_AMOUNT() view returns (uint256)",
  "function totalAirdropClaimed() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function airdropActive() view returns (bool)"
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
    active
  ] = await Promise.all([
    contract.AIRDROP_AMOUNT(),
    contract.AIRDROP_FEE(),
    contract.totalAirdropClaimed(),
    contract.balanceOf(CONTRACT_ADDRESS),
    contract.airdropActive()
  ]);

  const userClaimed = userAddress ? await contract.airdropClaimed(userAddress) : false;

  return {
    airdropAmountBN,
    airdropAmountStr: ethers.formatUnits(airdropAmountBN, 18),
    airdropFeeBN,
    airdropFeeEth: ethers.formatEther(airdropFeeBN),
    totalClaimedBN,
    totalClaimedStr: ethers.formatUnits(totalClaimedBN, 18),
    contractBalanceBN,
    contractBalanceStr: ethers.formatUnits(contractBalanceBN, 18),
    active,
    userClaimed
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

  const fee = await contract.AIRDROP_FEE();

  const tx = await contract.claimAirdrop({ value: fee });
  const receipt = await tx.wait();
  return { txHash: tx.hash, receipt };
}
