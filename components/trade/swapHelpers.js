export const SwapHelpers = {
  // Validate swap input
  validateSwapInput(swapState) {
    const { fromToken, toToken, fromAmount } = swapState;
    
    if (!fromToken || !toToken) {
      return { valid: false, error: 'Please select both tokens' };
    }

    const cleanAmount = String(fromAmount).replace(/,/g, '');
    const numAmount = Number(cleanAmount);

    if (!cleanAmount || isNaN(numAmount) || numAmount <= 0) {
      return { valid: false, error: 'Please enter a valid amount' };
    }

    return { valid: true, amount: numAmount };
  },

  // Get token balance
  async getTokenBalance(token) {
    if (!token) return 0;

    if (token.symbol === 'ETH') {
      return Number(state.balance) || Number(token.balance) || 0;
    }

    let balance = Number(token.balance) || 0;

    // Probe if balance is 0
    if (balance === 0 && token.address) {
      try {
        const { probeErc20 } = await import('../../func/erc20.js');
        const probeResult = await probeErc20(token.address);
        if (probeResult?.balance) {
          balance = parseFloat(probeResult.balance);
        }
      } catch (e) {
        console.error('[helper] Probe failed:', e);
      }
    }

    return balance;
  },

  // Calculate slippage amount
  calculateSlippageAmount(amount, slippage) {
    const slippageMultiplier = 1 - (slippage / 100);
    return amount * slippageMultiplier;
  },

  // Format transaction hash
  formatTxHash(hash, length = 10) {
    if (!hash || hash.length <= length) return hash;
    return `${hash.slice(0, length)}...`;
  },

  // Check if token needs approval
  async checkTokenApproval(tokenAddress, spenderAddress, amount) {
    try {
      const { getEip1193 } = await import('../../func/wallet.js');
      const provider = await getEip1193();

      const allowanceData = '0xdd62ed3e' + 
        state.address.slice(2).toLowerCase().padStart(64, '0') +
        spenderAddress.slice(2).toLowerCase().padStart(64, '0');

      const allowanceHex = await provider.request({
        method: 'eth_call',
        params: [{ to: tokenAddress, data: allowanceData }, 'latest']
      });

      const currentAllowance = BigInt(allowanceHex);
      const requiredAmount = BigInt(amount);

      return currentAllowance >= requiredAmount;
    } catch (e) {
      console.error('[helper] Check approval failed:', e);
      return false;
    }
  }
};