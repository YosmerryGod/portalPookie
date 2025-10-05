import { state } from '../../func/state.js';
import { getEip1193 } from '../../func/wallet.js';
import { refreshBalances } from '../../func/balance.js';
import { refreshPrices, getNativePrice, getChange24h } from '../../func/prices.js';
import { probeErc20 } from '../../func/erc20.js';
import { toast } from '../../func/utils.js';
import { tradeExactIn, DEX } from '../../func/trade.js';
import { getTokenVerificationInfo } from '../../func/tokenVerify.js';
import { showLoadingModal, updateLoadingMessage, hideLoadingModal, setLoadingType } from '../../func/loadingModal.js';

export const SwapLogic = {
  // Calculate exchange rate between two tokens
  getExchangeRate(fromToken, toToken) {
    if (!fromToken || !toToken || fromToken.symbol === toToken.symbol) return null;

    const nativePriceFrom = fromToken.symbol === 'ETH'
      ? 1
      : getNativePrice(fromToken.address || fromToken.symbol);

    const nativePriceTo = toToken.symbol === 'ETH'
      ? 1
      : getNativePrice(toToken.address || toToken.symbol);

    if (!nativePriceFrom || !nativePriceTo) return null;
    return nativePriceFrom / nativePriceTo;
  },

  // Format number with max decimals
  formatNumber(num, maxDecimals = 6) {
    if (num === null || num === undefined || isNaN(num)) return '0';
    const n = Number(num);
    if (!isFinite(n)) return '0';
    if (n === 0) return '0';
    const abs = Math.abs(n);
    if (abs < 1) return n.toFixed(maxDecimals).replace(/\.?0+$/, '');
    return n.toFixed(maxDecimals).replace(/\.?0+$/, '');
  },

  // Calculate output amount
  calculateToAmount(fromAmount, fromToken, toToken) {
    if (!fromAmount || isNaN(fromAmount)) return '';
    const rate = this.getExchangeRate(fromToken, toToken);
    if (!rate) return '';
    return this.formatNumber(Number(fromAmount) * rate);
  },

  // Calculate price impact
  calculatePriceImpact(fromAmount) {
    if (!fromAmount || isNaN(fromAmount)) return 0;
    const amount = Number(fromAmount);
    if (amount < 100) return 0.01;
    if (amount < 1000) return 0.1;
    if (amount < 10000) return 0.5;
    return Math.min(15, Math.log10(amount) * 2);
  },

  // Estimate transaction fee
  async estimateTransactionFee(fromToken, toToken, amount, buyMode) {
    if (!amount || isNaN(amount) || Number(amount) <= 0) return null;

    try {
      const provider = await getEip1193();
      let estimatedGas = 150000n;

      if (!buyMode && fromToken.address) {
        const spender = fromToken.moonshot 
          ? '0x0D6848e39114abE69054407452b8aaB82f8a44BA'
          : '0xad1eCa41E6F772bE3cb5A48A6141f9bcc1AF9F7c';
        
        const allowanceData = '0xdd62ed3e' + 
          state.address.slice(2).toLowerCase().padStart(64, '0') +
          spender.slice(2).toLowerCase().padStart(64, '0');
        
        const allowanceHex = await provider.request({
          method: 'eth_call',
          params: [{ to: fromToken.address, data: allowanceData }, 'latest']
        });
        
        const currentAllowance = BigInt(allowanceHex);
        if (currentAllowance === 0n) estimatedGas = 250000n;
      }
      
      let gasPrice;
      try {
        const feeData = await provider.request({ 
          method: 'eth_feeHistory',
          params: [1, 'latest', [50]]
        });
        
        if (feeData?.baseFeePerGas?.[1]) {
          const baseFee = BigInt(feeData.baseFeePerGas[1]);
          gasPrice = baseFee * 2n + 1n;
        } else {
          throw new Error('No fee data');
        }
      } catch (e) {
        gasPrice = await provider.request({ method: 'eth_gasPrice' });
        gasPrice = BigInt(gasPrice);
      }
      
      const totalFeeWei = estimatedGas * gasPrice;
      return Number(totalFeeWei) / 1e18;
    } catch (err) {
      console.error('[fee] Estimation failed:', err);
      return null;
    }
  },

  // Recalculate amounts when input changes
  async recalculateAmounts(state, fromAmount) {
    const newFromAmount = Number(fromAmount);
    state.fromAmount = newFromAmount > 0 ? String(fromAmount) : '';

    if (!state.fromToken || !state.toToken || !newFromAmount || isNaN(newFromAmount) || newFromAmount <= 0) {
      state.toAmount = '';
      state.priceImpact = 0;
      state.estimatedFee = null;
      return;
    }

    const calculatedTo = this.calculateToAmount(newFromAmount, state.fromToken, state.toToken);
    state.toAmount = calculatedTo;
    state.priceImpact = this.calculatePriceImpact(newFromAmount);
    state.estimatedFee = await this.estimateTransactionFee(
      state.fromToken, 
      state.toToken, 
      newFromAmount, 
      state.buyMode
    );
  },

  // Verify token and get DEX recommendation
  async verifyToken(state, tokenAddress) {
    if (!tokenAddress || tokenAddress === 'ETH') {
      state.tokenVerified = false;
      state.recommendedDex = null;
      return;
    }

    try {
      const verifyInfo = await getTokenVerificationInfo(tokenAddress);
      
      if (verifyInfo.verified) {
        state.tokenVerified = true;
        state.recommendedDex = verifyInfo.recommendedDex;
        console.log('[swap] Token verified:', verifyInfo);
      } else {
        state.tokenVerified = false;
        state.recommendedDex = DEX.ABSTRACTSWAP;
        console.warn('[swap] Token verification failed');
      }
    } catch (err) {
      console.error('[swap] Token verification error:', err);
      state.tokenVerified = false;
      state.recommendedDex = DEX.ABSTRACTSWAP;
    }
  },

  // Execute swap transaction
  async executeSwap(swapState) {
    if (!state.connected || !state.address) {
      toast('Please connect your wallet first');
      return false;
    }

    const { fromToken, toToken, fromAmount, buyMode, slippage } = swapState;

    if (!fromToken || !toToken) {
      toast('Please select both tokens');
      return false;
    }

    const cleanAmount = String(fromAmount).replace(/,/g, '');
    const numAmount = Number(cleanAmount);

    if (!cleanAmount || isNaN(numAmount) || numAmount <= 0) {
      toast('Please enter a valid amount');
      return false;
    }

    swapState.fromAmount = cleanAmount;

    try {
      await refreshBalances();
    } catch (e) {
      console.warn('[swap] Failed to refresh balances:', e);
    }

    // Get fresh token data
    let updatedFromToken = fromToken;
    if (Array.isArray(state.tokens)) {
      if (fromToken.symbol !== 'ETH' && fromToken.address) {
        const found = state.tokens.find(t => 
          t.address?.toLowerCase() === fromToken.address.toLowerCase()
        );
        if (found) updatedFromToken = found;
      }
    }

    swapState.fromToken = updatedFromToken;

    // Balance check
    let fromBalance = 0;
    if (updatedFromToken.symbol === 'ETH') {
      fromBalance = parseFloat(state.balance) || parseFloat(updatedFromToken.balance) || 0;
    } else {
      fromBalance = parseFloat(updatedFromToken.balance) || 0;
      
      if (fromBalance === 0 && updatedFromToken.address) {
        try {
          const probeResult = await probeErc20(updatedFromToken.address);
          if (probeResult?.balance) {
            fromBalance = parseFloat(probeResult.balance);
            updatedFromToken.balance = probeResult.balance;
            swapState.fromToken = updatedFromToken;
          }
        } catch (e) {
          console.error('[swap] Probe failed:', e);
        }
      }
    }

    const effectiveBalance = updatedFromToken.symbol === 'ETH' 
      ? fromBalance * 0.99 
      : fromBalance;

    if (numAmount > effectiveBalance) {
      toast(`Insufficient balance. Have: ${fromBalance.toFixed(6)} ${updatedFromToken.symbol}`);
      return false;
    }

    swapState.isSwapping = true;

    try {
      const tokenAddress = buyMode 
        ? (toToken.symbol !== 'ETH' ? toToken.address : null)
        : (fromToken.symbol !== 'ETH' ? fromToken.address : null);

      if (!tokenAddress) throw new Error('Invalid token selection');

      showLoadingModal('Verifying Token...', 'loading');
      const verificationResult = await getTokenVerificationInfo(tokenAddress);

      if (verificationResult.verified) {
        swapState.tokenVerified = true;
        swapState.recommendedDex = verificationResult.recommendedDex;
      } else {
        swapState.tokenVerified = false;
        swapState.recommendedDex = DEX.ABSTRACTSWAP;
      }
      
      const dexName = verificationResult.recommendedDex || DEX.ABSTRACTSWAP;
      
      await new Promise(resolve => setTimeout(resolve, 500));
      updateLoadingMessage(`Trading on ${dexName}...`, 'Preparing transaction...');

      const fromDecimals = updatedFromToken.decimals || 18;
      const toDecimals = toToken.decimals || 18;
      const amountWei = BigInt(Math.floor(numAmount * Math.pow(10, fromDecimals))).toString();

      const estimatedOutputRaw = swapState.toAmount ? 
        String(swapState.toAmount).replace(/,/g, '') : null;
      
      let estimatedOutputWei = null;
      if (estimatedOutputRaw && !isNaN(estimatedOutputRaw)) {
        estimatedOutputWei = BigInt(
          Math.floor(parseFloat(estimatedOutputRaw) * Math.pow(10, toDecimals))
        ).toString();
      }

      const tradeType = buyMode ? 'buy' : 'sell';

      const result = await tradeExactIn(
        tokenAddress,
        amountWei,
        tradeType,
        slippage,
        estimatedOutputWei,
        dexName
      );

      if (result && result.success) {
        setLoadingType('success');
        updateLoadingMessage('Trade Successful!', `TX: ${result.txHash.slice(0, 10)}...`);
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        hideLoadingModal();
        
        const explorerUrl = `https://abscan.org/tx/${result.txHash}`;
        toast(`Trade successful! View TX: ${explorerUrl}`, 20000);
        
        Promise.all([
          refreshBalances().catch(e => console.warn('[swap] refresh balance error:', e)),
          refreshPrices().catch(e => console.warn('[swap] refresh price error:', e))
        ]);
        
        return true;
      } else {
        throw new Error(result?.error || 'Transaction failed');
      }

    } catch (err) {
      console.error('[swap] Execute swap error:', err);
      
      let errorMsg = err.message || String(err);
      
      if (errorMsg.includes('insufficient funds')) {
        errorMsg = 'Insufficient funds for transaction + gas';
      } else if (errorMsg.includes('user rejected')) {
        errorMsg = 'Transaction rejected by user';
      } else if (errorMsg.includes('allowance')) {
        errorMsg = 'Token approval failed. Please try again';
      }
      
      setLoadingType('error');
      updateLoadingMessage('Trade Failed', errorMsg);
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      hideLoadingModal();
      
      return false;
    } finally {
      swapState.isSwapping = false;
    }
  }
};
