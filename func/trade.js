// func/trade.js
// Smart trade executor dengan support ExactIn & ExactOut untuk Moonshot dan AbstractSwap
import { getTokenVerificationInfo } from './tokenVerify.js';
import { getEip1193, ensureAbstractChain } from './wallet.js';
import { state } from './state.js';
import { toast } from './utils.js';
import { showLoadingModal, updateLoadingMessage, hideLoadingModal, setLoadingType } from './loadingModal.js';

// Contract Addresses
const MOONSHOT_FACTORY = '0x0D6848e39114abE69054407452b8aaB82f8a44BA';
const UNISWAP_V2_ROUTER = '0xad1eCa41E6F772bE3cb5A48A6141f9bcc1AF9F7c';
const WETH_ADDRESS = '0x3439153EB7AF838Ad19d56E1571FBD09333C2809';

// Moonshot Factory Selectors
const MOONSHOT_SELECTORS = {
  buyExactIn: '0x758b647a',
  buyExactOut: '0xc68255a5',
  sellExactIn: '0x30a2aa20',
  sellExactOut: '0x94b6c160'
};

// Uniswap V2 Selectors (AbstractSwap)
const UNISWAP_SELECTORS = {
  swapExactETHForTokens: '0x7ff36ab5', 
  swapExactTokensForETH: '0x18cbafe5',
  swapETHForExactTokens: '0xfb3bdb41',
  swapTokensForExactETH: '0x4a25d94a',
  getAmountsOut: '0x0d4f3b6d',
  getAmountsIn: '0x7e7041a7'
};

export const DEX = {
  MOONSHOT: 'Moonshot',
  ABSTRACTSWAP: 'AbstractSwap'
};

// ================================================================
// HELPER: Get Gas Parameters (Dynamic)
// ================================================================
async function getGasParams(provider, txParams) {
    try {
        // Estimate gas limit
        const estimatedGas = await provider.request({
            method: 'eth_estimateGas',
            params: [txParams]
        });
        const gasWithBuffer = BigInt(estimatedGas) * 150n / 100n;
        const gasLimit = '0x' + gasWithBuffer.toString(16);
        
        console.log('[gas] Estimated:', estimatedGas, 'With buffer:', gasLimit);
        
        // Get gas price (try EIP-1559 first)
        let gasParams = { gas: gasLimit };
        
        try {
            const feeData = await provider.request({ 
                method: 'eth_feeHistory',
                params: [1, 'latest', [50]]
            });
            
            if (feeData?.baseFeePerGas?.[1]) {
                const baseFee = BigInt(feeData.baseFeePerGas[1]);
                const maxPriorityFee = BigInt(1);
                const maxFee = baseFee * 2n + maxPriorityFee;
                
                gasParams.maxFeePerGas = '0x' + maxFee.toString(16);
                gasParams.maxPriorityFeePerGas = '0x' + maxPriorityFee.toString(16);
                
                console.log('[gas] Using EIP-1559:', gasParams);
            } else {
                throw new Error('No fee data');
            }
        } catch (e) {
            // Fallback to legacy gasPrice
            const gasPrice = await provider.request({ method: 'eth_gasPrice' });
            gasParams.gasPrice = gasPrice;
            console.log('[gas] Using legacy gasPrice:', gasPrice);
        }
        
        return gasParams;
    } catch (err) {
        console.warn('[gas] Estimation failed, using defaults:', err);
        // Fallback defaults
        return {
            gas: '0x16E360', // 1.5M gas
            gasPrice: '0x2B29711' // 45.25 GWEI
        };
    }
}

function calculateMinAmountOut(amount, slippagePercent) {
  const amountBig = BigInt(amount);
  const slippageFactor = 10000n - BigInt(slippagePercent * 100);
  return (amountBig * slippageFactor) / 10000n;
}

function calculateMaxAmountIn(amount, slippagePercent) {
  const amountBig = BigInt(amount);
  const slippageFactor = 10000n + BigInt(slippagePercent * 100);
  return (amountBig * slippageFactor) / 10000n;
}

// ================================================================
// Token Approval Helper
// ================================================================
// func/trade.js - FIXED APPROVAL SECTION ONLY
// Paste this into your existing trade.js, replacing the checkAndApproveToken function

async function checkAndApproveToken(tokenAddress, spender, amount) {
    try {
        const provider = await getEip1193();
        
        // Check current allowance
        const allowanceData = '0xdd62ed3e' + 
            state.address.slice(2).toLowerCase().padStart(64, '0') +
            spender.slice(2).toLowerCase().padStart(64, '0');
        
        const allowanceHex = await provider.request({
            method: 'eth_call',
            params: [{
                to: tokenAddress,
                data: allowanceData
            }, 'latest']
        });
        
        const currentAllowance = BigInt(allowanceHex);
        const requiredAmount = BigInt(amount);
        
        console.log('[approval] Check allowance:', {
            token: tokenAddress,
            spender: spender,
            current: currentAllowance.toString(),
            required: requiredAmount.toString(),
            sufficient: currentAllowance >= requiredAmount
        });
        
        // Skip if sufficient
        if (currentAllowance >= requiredAmount) {
            console.log('[approval] Allowance sufficient, skipping approve');
            return true;
        }
        
        // ✅ FIXED: Show loading properly
        showLoadingModal('Approving Token...', 'loading');
        updateLoadingMessage('Approving Token...', 'Please confirm in your wallet');
        
        // Approve MAX uint256
        const MAX_UINT256 = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
        const approveData = '0x095ea7b3' +
            spender.slice(2).toLowerCase().padStart(64, '0') +
            MAX_UINT256;
        
        console.log('[approval] Sending approve tx');
        
        // Estimate gas
        let gasLimit = '0x186A0'; // Default 100k
        
        try {
            const estimatedGas = await provider.request({
                method: 'eth_estimateGas',
                params: [{
                    from: state.address,
                    to: tokenAddress,
                    data: approveData
                }]
            });
            
            const gasWithBuffer = BigInt(estimatedGas) * 150n / 100n;
            gasLimit = '0x' + gasWithBuffer.toString(16);
        } catch (e) {
            console.warn('[approval] Gas estimation failed, using default');
        }
        
        // Build tx params
        let txParams = {
            from: state.address,
            to: tokenAddress,
            data: approveData,
            gas: gasLimit,
        };
        
        // Get gas price
        try {
            const feeData = await provider.request({ 
                method: 'eth_feeHistory',
                params: [1, 'latest', [50]]
            });
            
            if (feeData?.baseFeePerGas?.[1]) {
                const baseFee = BigInt(feeData.baseFeePerGas[1]);
                const maxPriorityFee = BigInt(1);
                const maxFee = baseFee * 2n + maxPriorityFee;
                
                txParams.maxFeePerGas = '0x' + maxFee.toString(16);
                txParams.maxPriorityFeePerGas = '0x' + maxPriorityFee.toString(16);
            } else {
                throw new Error('No fee data');
            }
        } catch (e) {
            const gasPrice = await provider.request({ method: 'eth_gasPrice' });
            txParams.gasPrice = gasPrice;
        }
        
        // Send transaction
        const approveTx = await provider.request({
            method: 'eth_sendTransaction',
            params: [txParams]
        });
        
        console.log('[approval] Tx sent:', approveTx);
        
        // ✅ FIXED: Update to success properly
        setLoadingType('success');
        updateLoadingMessage('Token Approved!', `TX: ${approveTx.slice(0, 10)}...`);
        
        // Wait then hide
        await new Promise(resolve => setTimeout(resolve, 2000));
        hideLoadingModal();
        
        return true;
        
    } catch (err) {
        console.error('[approval] Error:', err);
        
        let errorMsg = err.message || String(err);
        
        if (errorMsg.includes('user rejected') || errorMsg.includes('User denied')) {
            errorMsg = 'User rejected approval';
        } else if (errorMsg.includes('insufficient funds')) {
            errorMsg = 'Insufficient ETH for gas';
        } else if (errorMsg.includes('nonce')) {
            errorMsg = 'Transaction nonce error. Try again';
        }
        
        // ✅ FIXED: Show error properly
        setLoadingType('error');
        updateLoadingMessage('Approval Failed', errorMsg);
        
        // Auto-hide after 3s
        await new Promise(resolve => setTimeout(resolve, 3000));
        hideLoadingModal();
        
        throw new Error(`Token approval failed: ${errorMsg}`);
    }
}

// ================================================================
// Moonshot DEX Call Helpers
// ================================================================

export async function executeMoonshotBuyExactIn(tokenAddress, ethAmount, tokenAmountOutMin) {
    const finalAmountOutMin = '0';

    const selector = MOONSHOT_SELECTORS.buyExactIn.slice(2);
    const encodedToken = tokenAddress.slice(2).toLowerCase().padStart(64, '0');
    const amountOutMinHex = BigInt(finalAmountOutMin).toString(16);
    const encodedAmountOutMin = amountOutMinHex.padStart(64, '0');
    const data = '0x' + selector + encodedToken + encodedAmountOutMin;

    try {
        const provider = await getEip1193();
        
        const baseTxParams = {
            from: state.address,
            to: MOONSHOT_FACTORY,
            data: data,
            value: '0x' + BigInt(ethAmount).toString(16),
        };
        
        const gasParams = await getGasParams(provider, baseTxParams);
        
        const txHash = await provider.request({
            method: 'eth_sendTransaction',
            params: [{ ...baseTxParams, ...gasParams }],
        });
        
        return txHash;
    } catch (err) {
        throw err;
    }
}

async function executeMoonshotBuyExactOut(tokenAddress, tokenAmount, maxCollateralAmount) {
    const selector = MOONSHOT_SELECTORS.buyExactOut.slice(2);
    const encodedToken = tokenAddress.slice(2).toLowerCase().padStart(64, '0');
    const encodedTokenAmount = BigInt(tokenAmount).toString(16).padStart(64, '0');
    const encodedMaxCollateral = BigInt(maxCollateralAmount).toString(16).padStart(64, '0');
    const data = '0x' + selector + encodedToken + encodedTokenAmount + encodedMaxCollateral;

    try {
        const provider = await getEip1193();
        
        const baseTxParams = {
            from: state.address,
            to: MOONSHOT_FACTORY,
            data: data,
            value: '0x' + BigInt(maxCollateralAmount).toString(16),
        };
        
        const gasParams = await getGasParams(provider, baseTxParams);
        
        const txHash = await provider.request({
            method: 'eth_sendTransaction',
            params: [{ ...baseTxParams, ...gasParams }],
        });
        
        return txHash;
    } catch (err) {
        throw err;
    }
}

async function executeMoonshotSellExactIn(tokenAddress, tokenAmount, ethAmountOutMin) {
    await checkAndApproveToken(tokenAddress, MOONSHOT_FACTORY, tokenAmount);
    
    const finalAmountOutMin = '0';

    const selector = MOONSHOT_SELECTORS.sellExactIn.slice(2);
    const encodedToken = tokenAddress.slice(2).toLowerCase().padStart(64, '0');
    const encodedTokenAmount = BigInt(tokenAmount).toString(16).padStart(64, '0');
    const amountOutMinHex = BigInt(finalAmountOutMin).toString(16);
    const encodedAmountOutMin = amountOutMinHex.padStart(64, '0');
    const data = '0x' + selector + encodedToken + encodedTokenAmount + encodedAmountOutMin;

    try {
        const provider = await getEip1193();
        
        const baseTxParams = {
            from: state.address,
            to: MOONSHOT_FACTORY,
            data: data,
        };
        
        const gasParams = await getGasParams(provider, baseTxParams);
        
        const txHash = await provider.request({
            method: 'eth_sendTransaction',
            params: [{ ...baseTxParams, ...gasParams }],
        });
        
        return txHash;
    } catch (err) {
        throw err;
    }
}

async function executeMoonshotSellExactOut(tokenAddress, ethAmount, maxTokenAmount) {
    await checkAndApproveToken(tokenAddress, MOONSHOT_FACTORY, maxTokenAmount);
    
    const selector = MOONSHOT_SELECTORS.sellExactOut.slice(2);
    const encodedToken = tokenAddress.slice(2).toLowerCase().padStart(64, '0');
    const encodedEthAmount = BigInt(ethAmount).toString(16).padStart(64, '0');
    const encodedMaxTokenAmount = BigInt(maxTokenAmount).toString(16).padStart(64, '0');
    const data = '0x' + selector + encodedToken + encodedEthAmount + encodedMaxTokenAmount;

    try {
        const provider = await getEip1193();
        
        const baseTxParams = {
            from: state.address,
            to: MOONSHOT_FACTORY,
            data: data,
        };
        
        const gasParams = await getGasParams(provider, baseTxParams);
        
        const txHash = await provider.request({
            method: 'eth_sendTransaction',
            params: [{ ...baseTxParams, ...gasParams }],
        });
        
        return txHash;
    } catch (err) {
        throw err;
    }
}

// ================================================================
// AbstractSwap DEX Call Helpers (Uniswap V2 style)
// ================================================================

function getDeadline() {
  return Math.floor(Date.now() / 1000) + (60 * 20);
}

async function executeAbstractSwapBuyExactIn(tokenAddress, ethAmountIn, amountOutMin, to) {
  const deadline = getDeadline();
  
  const data = UNISWAP_SELECTORS.swapExactETHForTokens + 
               BigInt(amountOutMin).toString(16).padStart(64, '0') +
               '0000000000000000000000000000000000000000000000000000000000000080' +
               to.slice(2).toLowerCase().padStart(64, '0') +
               BigInt(deadline).toString(16).padStart(64, '0') +
               '0000000000000000000000000000000000000000000000000000000000000002' +
               WETH_ADDRESS.slice(2).toLowerCase().padStart(64, '0') + 
               tokenAddress.slice(2).toLowerCase().padStart(64, '0');
  
  const provider = await getEip1193();
  
  const baseTxParams = {
    from: state.address,
    to: UNISWAP_V2_ROUTER,
    data: data,
    value: '0x' + BigInt(ethAmountIn).toString(16),
  };
  
  const gasParams = await getGasParams(provider, baseTxParams);
  
  const txHash = await provider.request({
    method: 'eth_sendTransaction',
    params: [{ ...baseTxParams, ...gasParams }],
  });
  
  return txHash;
}

async function executeAbstractSwapSellExactIn(tokenAddress, tokenAmountIn, amountOutMin, to) {
  await checkAndApproveToken(tokenAddress, UNISWAP_V2_ROUTER, tokenAmountIn);
  
  const deadline = getDeadline();
  
  const data = UNISWAP_SELECTORS.swapExactTokensForETH + 
               BigInt(tokenAmountIn).toString(16).padStart(64, '0') +
               BigInt(amountOutMin).toString(16).padStart(64, '0') +
               '00000000000000000000000000000000000000000000000000000000000000a0' +
               to.slice(2).toLowerCase().padStart(64, '0') +
               BigInt(deadline).toString(16).padStart(64, '0') +
               '0000000000000000000000000000000000000000000000000000000000000002' +
               tokenAddress.slice(2).toLowerCase().padStart(64, '0') + 
               WETH_ADDRESS.slice(2).toLowerCase().padStart(64, '0');
  
  const provider = await getEip1193();
  
  const baseTxParams = {
    from: state.address,
    to: UNISWAP_V2_ROUTER,
    data: data,
  };
  
  const gasParams = await getGasParams(provider, baseTxParams);
  
  const txHash = await provider.request({
    method: 'eth_sendTransaction',
    params: [{ ...baseTxParams, ...gasParams }],
  });
  
  return txHash;
}

async function executeAbstractSwapBuyExactOut(tokenAddress, tokenAmountOut, ethAmountInMax, to) {
  throw new Error('AbstractSwap ExactOut Buy not implemented in this version.');
}

async function executeAbstractSwapSellExactOut(tokenAddress, ethAmountOut, maxTokenAmountIn) {
  throw new Error('AbstractSwap ExactOut Sell not implemented in this version.');
}

// ================================================================
// Core Execution Logic
// ================================================================

async function executeTrade(tokenAddress, amount, tradeType, mode, slippagePercent, estimatedOutput, estimatedInput, dex = DEX.ABSTRACTSWAP) {
  
  if (mode !== 'exactIn' && mode !== 'exactOut') {
    throw new Error('Mode must be "exactIn" or "exactOut"');
  }

  try {
    const to = state.address;
    let txHash = null;
    let ethAmount = null;
    let tokenAmount = null;

    if (tradeType === 'buy') {
      ethAmount = amount;
      tokenAmount = estimatedOutput;
      
      if (dex === DEX.MOONSHOT) {
        if (mode === 'exactIn') {
          const finalAmountOutMin = 0; 
          txHash = await executeMoonshotBuyExactIn(tokenAddress, ethAmount, finalAmountOutMin);
        } else {
          const amountInMax = estimatedInput 
            ? calculateMaxAmountIn(estimatedInput, slippagePercent).toString() 
            : amount;
          txHash = await executeMoonshotBuyExactOut(tokenAddress, tokenAmount, amountInMax);
        }
      } else {
        if (mode === 'exactIn') {
          const amountOutMin = estimatedOutput 
            ? calculateMinAmountOut(estimatedOutput, slippagePercent).toString() 
            : '0';
          txHash = await executeAbstractSwapBuyExactIn(tokenAddress, ethAmount, amountOutMin, to);
        } else {
          const amountInMax = estimatedInput 
            ? calculateMaxAmountIn(estimatedInput, slippagePercent).toString() 
            : amount;
          txHash = await executeAbstractSwapBuyExactOut(tokenAddress, tokenAmount, amountInMax, to);
        }
      }
    } else {
      tokenAmount = amount;
      ethAmount = estimatedOutput;
      
      if (dex === DEX.MOONSHOT) {
        if (mode === 'exactIn') {
          const amountOutMin = estimatedOutput 
            ? calculateMinAmountOut(estimatedOutput, slippagePercent).toString() 
            : '0';
          txHash = await executeMoonshotSellExactIn(tokenAddress, tokenAmount, amountOutMin);
        } else {
          const maxTokenAmount = estimatedInput 
            ? calculateMaxAmountIn(estimatedInput, slippagePercent).toString() 
            : amount;
          txHash = await executeMoonshotSellExactOut(tokenAddress, ethAmount, maxTokenAmount);
        }
      } else {
        if (mode === 'exactIn') {
          const amountOutMin = estimatedOutput 
            ? calculateMinAmountOut(estimatedOutput, slippagePercent).toString() 
            : '0';
          txHash = await executeAbstractSwapSellExactIn(tokenAddress, tokenAmount, amountOutMin, to);
        } else {
          const maxTokenAmount = estimatedInput 
            ? calculateMaxAmountIn(estimatedInput, slippagePercent).toString() 
            : amount;
          txHash = await executeAbstractSwapSellExactOut(tokenAddress, ethAmount, maxTokenAmount);
        }
      }
    }
    
    return {
      success: true,
      txHash,
      dex,
      tradeType,
      mode,
      tokenAddress,
      amount
    };

  } catch (err) {
    return {
      success: false,
      error: err.message || String(err)
    };
  }
}

export async function tradeExactIn(tokenAddress, amount, tradeType, slippagePercent = 1, estimatedOutput = null, dex = DEX.ABSTRACTSWAP) {
  return await executeTrade(tokenAddress, amount, tradeType, 'exactIn', slippagePercent, estimatedOutput, null, dex);
}

export async function tradeExactOut(tokenAddress, amount, tradeType, slippagePercent = 1, estimatedInput = null, dex = DEX.ABSTRACTSWAP) {
  return await executeTrade(tokenAddress, amount, tradeType, 'exactOut', slippagePercent, null, estimatedInput, dex);
}