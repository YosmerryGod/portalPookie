// func/activity.js
import { state } from './state.js';
import { getEip1193 } from './wallet.js';
import {
  BrowserProvider,
  Contract,
  formatUnits
} from 'https://esm.sh/ethers@6';

const TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

/**
 * Fetch the last 5 ERC-20 transfer activities for tokens in state.tokens.
 * NOTE: This does not include native ETH transfers (since native has no Transfer event).
 * @param {object} opts
 *  - lookbackBlocks: how many blocks to look back (default 5000)
 *  - maxPerToken: limit items per token for performance (default 50)
 */
export async function refreshActivity(opts = {}) {
  if (!state.connected || !state.address) {
    state.activity = [];
    return;
  }

  const { lookbackBlocks = 5000, maxPerToken = 50 } = opts;

  const provider = new BrowserProvider(getEip1193());
  const me = state.address.toLowerCase();
  const latest = await provider.getBlockNumber();
  const fromBlock = Math.max(0, latest - lookbackBlocks);

  const items = [];

  // Loop through tokens that have an address (ERC-20)
  for (const t of state.tokens) {
    if (!t.address) continue;

    const contract = new Contract(
      t.address,
      ['event Transfer(address indexed from, address indexed to, uint256 value)'],
      provider
    );

    try {
      // Fetch logs for Transfer event in the given block range
      const logs = await provider.getLogs({
        address: t.address,
        topics: [TRANSFER_TOPIC],
        fromBlock,
        toBlock: latest
      });

      // Parse logs
      const picked = [];
      for (const log of logs) {
        const parsed = contract.interface.parseLog(log);
        const from = parsed.args.from.toLowerCase();
        const to   = parsed.args.to.toLowerCase();
        if (from !== me && to !== me) continue; // only transactions related to our address

        const decimals = Number(t.decimals ?? 18) || 18;
        const amount = formatUnits(parsed.args.value, decimals);

        picked.push({
          kind: 'erc20',
          type: to === me ? 'in' : 'out',
          token: t.symbol || 'TOKEN',
          amount,
          from: parsed.args.from,
          to: parsed.args.to,
          hash: log.transactionHash,
          blockNumber: log.blockNumber ?? 0,
          contract: t.address,
        });

        if (picked.length >= maxPerToken) break;
      }

      items.push(...picked);
    } catch (e) {
      console.warn('[activity] getLogs failed for', t.symbol, e?.message || e);
    }
  }

  // Sort by blockNumber desc (newest first) and keep only 5
  items.sort((a, b) => (b.blockNumber || 0) - (a.blockNumber || 0));
  const last5 = items.slice(0, 5);

  state.activity = last5;
  console.log('[activity] updated (ERC-20, last 5):', state.activity);
}
