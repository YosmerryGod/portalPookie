// components/trade/swap.js
import { state } from '../../func/state.js';
import { getEip1193, ensureAbstractChain } from '../../func/wallet.js';
import { refreshBalances } from '../../func/balance.js';
import { refreshPrices, getNativePrice, getChange24h } from '../../func/prices.js';
import { probeErc20 } from '../../func/erc20.js';
import { toast, fmtUsd } from '../../func/utils.js';

import { tradeExactIn, tradeExactOut, DEX } from '../../func/trade.js'; 
import { getTokenVerificationInfo } from '../../func/tokenVerify.js';
import { showLoadingModal, updateLoadingMessage, hideLoadingModal, setLoadingType } from '../../func/loadingModal.js';

import { PookieTheme } from './theme.js';
import { el } from './dom.js';
import { createTokenAvatar, createMiniTokenDropdown } from './tokenSelector.js';
import { tokenModalFactory } from './tokenModal.js';
import { createSlippageControl } from './slippageControl.js';
import { showTokenDetailModal } from './detailToken.js';
import { createSlider } from './slider.js';

// Tambahkan di bagian atas swap.js, setelah import
async function estimateTransactionFee(fromToken, toToken, amount, buyMode) {
  if (!amount || isNaN(amount) || Number(amount) <= 0) {
    return null;
  }

  try {
    const provider = await getEip1193();
    
    // Default gas limits untuk berbagai jenis transaksi
    let estimatedGas = 150000n; // Default 150k gas
    
    if (buyMode) {
      // Buy = ETH -> Token (lebih murah)
      estimatedGas = 150000n;
    } else {
      // Sell = Token -> ETH (butuh approval, lebih mahal)
      // Cek apakah perlu approval
      if (fromToken.address) {
        const spender = fromToken.moonshot 
          ? '0x0D6848e39114abE69054407452b8aaB82f8a44BA' // Moonshot Factory
          : '0xad1eCa41E6F772bE3cb5A48A6141f9bcc1AF9F7c'; // AbstractSwap Router
        
        const allowanceData = '0xdd62ed3e' + 
          state.address.slice(2).toLowerCase().padStart(64, '0') +
          spender.slice(2).toLowerCase().padStart(64, '0');
        
        const allowanceHex = await provider.request({
          method: 'eth_call',
          params: [{ to: fromToken.address, data: allowanceData }, 'latest']
        });
        
        const currentAllowance = BigInt(allowanceHex);
        
        if (currentAllowance === 0n) {
          // Butuh approval + swap
          estimatedGas = 250000n; // 100k approval + 150k swap
        } else {
          // Hanya swap
          estimatedGas = 150000n;
        }
      }
    }
    
    // Get gas price
    let gasPrice;
    try {
      const feeData = await provider.request({ 
        method: 'eth_feeHistory',
        params: [1, 'latest', [50]]
      });
      
      if (feeData?.baseFeePerGas?.[1]) {
        const baseFee = BigInt(feeData.baseFeePerGas[1]);
        const maxPriorityFee = BigInt(1);
        gasPrice = baseFee * 2n + maxPriorityFee;
      } else {
        throw new Error('No fee data');
      }
    } catch (e) {
      gasPrice = await provider.request({ method: 'eth_gasPrice' });
      gasPrice = BigInt(gasPrice);
    }
    
    // Calculate total fee in wei
    const totalFeeWei = estimatedGas * gasPrice;
    
    // Convert to ETH
    const feeInEth = Number(totalFeeWei) / 1e18;
    
    return feeInEth;
  } catch (err) {
    console.error('[fee] Estimation failed:', err);
    return null;
  }
}

export const Swap = {
_state: {
  buyMode: true,
  fromToken: null,
  toToken: null,
  fromAmount: '',
  toAmount: '',
  slippage: 0.5,
  deadline: 20,
  isSwapping: false,
  priceImpact: 0,
  orderType: 'Market',
  tokenVerified: false,
  recommendedDex: null,
  estimatedFee: null
},

  

  _sliderInstance: null,

  formatNumber(num, maxDecimals = 6) {
  if (num === null || num === undefined || isNaN(num)) return '0';
  const n = Number(num);
  if (!isFinite(n)) return '0';
  if (n === 0) return '0';

  const abs = Math.abs(n);

  if (abs < 1) {
    return n.toFixed(maxDecimals).replace(/\.?0+$/, '');
  }

  // ✅ PERBAIKAN: Hapus locale formatting (tanpa koma)
  return n.toFixed(maxDecimals).replace(/\.?0+$/, '');
},


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

  calculateToAmount(fromAmount, fromToken, toToken) {
    if (!fromAmount || isNaN(fromAmount)) return '';
    const rate = this.getExchangeRate(fromToken, toToken);
    if (!rate) return '';
    return this.formatNumber(Number(fromAmount) * rate);
  },

  calculatePriceImpact(fromAmount) {
    if (!fromAmount || isNaN(fromAmount)) return 0;
    const amount = Number(fromAmount);
    if (amount < 100) return 0.01;
    if (amount < 1000) return 0.1;
    if (amount < 10000) return 0.5;
    return Math.min(15, Math.log10(amount) * 2);
  },

  async recalculateAmounts(fromAmount) {
  const { fromToken, toToken, buyMode } = this._state;

  const newFromAmount = Number(fromAmount);
  this._state.fromAmount = newFromAmount > 0 ? String(fromAmount) : '';

  if (!fromToken || !toToken || !newFromAmount || isNaN(newFromAmount) || newFromAmount <= 0) {
    this._state.toAmount = '';
    this._state.priceImpact = 0;
    this._state.estimatedFee = null;
    return;
  }

  const calculatedTo = this.calculateToAmount(newFromAmount, fromToken, toToken);
  this._state.toAmount = calculatedTo;
  this._state.priceImpact = this.calculatePriceImpact(newFromAmount);
  
  // Estimate fee
  this._state.estimatedFee = await estimateTransactionFee(fromToken, toToken, newFromAmount, buyMode);
},

  /**
   * Verify token and update state with DEX recommendation
   */
  async verifyToken(tokenAddress) {
    if (!tokenAddress || tokenAddress === 'ETH') {
      this._state.tokenVerified = false;
      this._state.recommendedDex = null;
      return;
    }

    try {
      const verifyInfo = await getTokenVerificationInfo(tokenAddress);
      
      if (verifyInfo.verified) {
        this._state.tokenVerified = true;
        this._state.recommendedDex = verifyInfo.recommendedDex;
        
        console.log('[swap] Token verified:', {
          address: tokenAddress,
          dex: verifyInfo.recommendedDex,
          isMoonshot: verifyInfo.isMoonshotToken,
          isReadyForMigration: verifyInfo.isReadyForMigration
        });
      } else {
        this._state.tokenVerified = false;
        this._state.recommendedDex = DEX.ABSTRACTSWAP; // Default fallback
        console.warn('[swap] Token verification failed, using AbstractSwap');
      }
    } catch (err) {
      console.error('[swap] Token verification error:', err);
      this._state.tokenVerified = false;
      this._state.recommendedDex = DEX.ABSTRACTSWAP;
    }
  },

  // ... (Fungsi UI: createWarnButton, createMarketOrderModal, createSlippageModal tetap sama) ...
  createWarnButton(onClick) {
    const theme = PookieTheme;
    const btn = el('button', {
      style: {
        width: '22px',
        height: '22px',
        minWidth: '22px',
        minHeight: '22px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0',
        border: 'none',
        cursor: 'pointer',
        transform: 'rotate(45deg)',
        borderRadius: '4px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
        background: '#FFD24D',
        marginRight: '8px',
      },
      onclick: (e) => {
        e.stopPropagation();
        if (typeof onClick === 'function') onClick(e);
      },
      title: 'Info'
    },
      el('span', {
        style: {
          display: 'inline-block',
          transform: 'rotate(-45deg)',
          fontWeight: 900,
          fontSize: '12px',
          lineHeight: '12px',
          color: '#2e2d2d',
          userSelect: 'none'
        }
      }, '!')
    );

    btn.setAttribute('aria-label', 'Info / Warning');

    return btn;
  },

  createMarketOrderModal() {
    const theme = PookieTheme;

    const createOptionRow = (title, description, value, isSoon = false) => {
      const isSelected = this._state.orderType === value;

      const row = el('div', {
        style: {
          display: 'flex',
          flexDirection: 'column',
          padding: '16px 0',
          cursor: isSoon ? 'default' : 'pointer',
          borderBottom: `1px solid ${theme.border.primary}`,
          opacity: isSoon ? 0.6 : 1,
        },
        onClick: isSoon ? null : () => {
          this._state.orderType = value;
          modal.remove();
          this.renderUI();
        }
      },
        el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
          el('div', { style: { fontWeight: 800, color: '#ffffff' } }, title),
          el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
            isSoon ? el('span', {
              style: {
                fontSize: '11px',
                padding: '2px 6px',
                background: theme.bg.card,
                borderRadius: '6px',
                color: theme.text.muted,
                border: `1px solid ${theme.text.muted}`
              }
            }, 'Soon') : null,
            el('div', {
              style: {
                color: theme.brand.green,
                fontWeight: 900,
                fontSize: '18px',
                width: '20px',
                textAlign: 'right'
              }
            }, isSelected ? '✓' : null)
          )
        ),
        el('div', { style: { fontSize: '14px', color: theme.text.muted, marginTop: '4px', lineHeight: '1.4' } }, description)
      );

      return row;
    };

    const modal = el('div', {
      style: {
        position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1200,
        padding: '0'
      },
      onClick: (e) => {
        if (e.target === modal) modal.remove();
      }
    });

    const content = el('div', {
      style: {
        width: '100%',
        maxWidth: '480px',
        background: theme.bg.card || '#111',
        borderRadius: '16px 16px 0 0',
        padding: '20px',
        boxShadow: theme.shadow.soft,
        color: '#ffffffff',
      }
    },
      el('div', {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '20px',
          fontWeight: 800,
          color: '#ffffff',
          marginBottom: '10px',
          paddingBottom: '10px',
          borderBottom: `2px solid ${theme.border.primary}`
        }
      },
        'Order Type',
        el('span', {
          style: {
            fontSize: '14px',
            color: theme.text.muted,
            cursor: 'help',
            border: `1px solid ${theme.text.muted}`,
            borderRadius: '50%',
            width: '20px',
            height: '20px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            fontWeight: 700
          }
        }, 'i')
      ),

      el('div', { style: { padding: '10px 0' } },
        createOptionRow('Limit', 'Buy or Sell at a specific price or better', 'Limit', true),
        createOptionRow('Market', 'Buy or Sell at the best available market price', 'Market', false),
        createOptionRow('Stop Limit', 'Triggers a Limit order when Stop price is reached.', 'StopLimit', true)
      )
    );

    modal.appendChild(content);
    document.body.appendChild(modal);
  },

  createSlippageModal() {
    const theme = PookieTheme;

    const modal = el('div', {
      style: {
        position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200,
        padding: '20px'
      },
      onClick: (e) => { if (e.target === modal) modal.remove(); }
    });

    const slControl = createSlippageControl(this._state, (v) => {
      this._state.slippage = v;
      this.renderUI();
    });

    const content = el('div', {
      style: {
        width: '100%',
        maxWidth: '380px',
        background: theme.bg.card || '#111',
        borderRadius: '16px',
        padding: '20px',
        boxShadow: theme.shadow.soft,
        color: '#ffffffff'
      }
    },

      el('div', {
        style: {
          fontSize: '18px',
          fontWeight: 700,
          color: theme.text.primary,
          marginBottom: '12px'
        }
      }, 'Slippage Tolerance'),

      el('div', {
        style: {
          fontSize: '14px',
          lineHeight: '1.5',
          marginBottom: '20px',
          color: theme.text.muted
        }
      }, 'Your transaction will revert if the price changes unfavorably by more than this percentage.'),

      slControl.node,

      el('button', {
        style: {
          width: '100%',
          padding: '14px',
          borderRadius: '12px',
          border: 'none',
          background: theme.brand.green,
          color: '#2e2d2dff',
          fontWeight: 700,
          fontSize: '15px',
          cursor: 'pointer',
          marginTop: '24px',
          transition: 'background 0.2s ease'
        },
        onmouseenter: (e) => e.target.style.background = theme.brand.greenHover || '#2eb872',
        onmouseleave: (e) => e.target.style.background = theme.brand.green,
        onClick: () => modal.remove()
      }, 'Close')

    );

    modal.appendChild(content);
    document.body.appendChild(modal);
    slControl.update();
  },

  /**
   * Execute real swap transaction using trade.js
   * FUNGSI INI SUDAH DIPERBAIKI LOGIKA ROUTINGNYA
   */
 // Perbaikan executeSwap() - Fokus Market Order Only
async executeSwap() {
  if (!state.connected || !state.address) { 
    toast('Please connect your wallet first'); 
    return; 
  }

  const { fromToken, toToken, fromAmount, buyMode, slippage } = this._state;

  // Validate inputs
  if (!fromToken || !toToken) { 
    toast('Please select both tokens'); 
    return; 
  }
  
  // Remove comma dan validasi
  const cleanAmount = String(fromAmount).replace(/,/g, '');
  const numAmount = Number(cleanAmount);
  
  console.log('[swap] Amount validation:', {
    raw: fromAmount,
    clean: cleanAmount,
    number: numAmount,
    isValid: !isNaN(numAmount) && numAmount > 0
  });
  
  if (!cleanAmount || isNaN(numAmount) || numAmount <= 0) { 
    toast('Please enter a valid amount'); 
    return; 
  }

  // Update state dengan clean amount
  this._state.fromAmount = cleanAmount;
  
  // Refresh balance
  console.log('[swap] Refreshing balances before swap...');
  try {
    await refreshBalances();
  } catch (e) {
    console.warn('[swap] Failed to refresh balances:', e);
  }

  // Get fresh token data
  let updatedFromToken = fromToken;
  let updatedToToken = toToken;
  
  if (Array.isArray(state.tokens)) {
    if (fromToken.symbol !== 'ETH' && fromToken.address) {
      const found = state.tokens.find(t => 
        t.address?.toLowerCase() === fromToken.address.toLowerCase()
      );
      if (found) {
        updatedFromToken = found;
        console.log('[swap] Updated fromToken balance:', found.balance);
      }
    }
    if (toToken.symbol !== 'ETH' && toToken.address) {
      const found = state.tokens.find(t => 
        t.address?.toLowerCase() === toToken.address.toLowerCase()
      );
      if (found) updatedToToken = found;
    }
  }

  this._state.fromToken = updatedFromToken;
  this._state.toToken = updatedToToken;

  // Balance check
  let fromBalance = 0;
  
  if (updatedFromToken.symbol === 'ETH') {
    fromBalance = parseFloat(state.balance) || 
                  parseFloat(updatedFromToken.balance) || 
                  0;
  } else {
    fromBalance = parseFloat(updatedFromToken.balance) || 0;
    
    if (fromBalance === 0 && updatedFromToken.address) {
      console.log('[swap] Balance 0, probing contract...');
      try {
        const probeResult = await probeErc20(updatedFromToken.address);
        if (probeResult?.balance) {
          fromBalance = parseFloat(probeResult.balance);
          console.log('[swap] Probed balance:', fromBalance);
          updatedFromToken.balance = probeResult.balance;
          this._state.fromToken = updatedFromToken;
        }
      } catch (e) {
        console.error('[swap] Probe failed:', e);
      }
    }
  }
  
  const inputAmount = numAmount;

  console.log('[swap] Balance check:', {
    symbol: updatedFromToken.symbol,
    balance: fromBalance,
    inputAmount: inputAmount,
    mode: buyMode ? 'BUY' : 'SELL'
  });

  const effectiveBalance = updatedFromToken.symbol === 'ETH' 
    ? fromBalance * 0.99 
    : fromBalance;

  if (inputAmount > effectiveBalance) {
    toast(`Insufficient balance. Have: ${fromBalance.toFixed(6)} ${updatedFromToken.symbol}, Need: ${inputAmount.toFixed(6)}`);
    return;
  }

  this._state.isSwapping = true;
  this.renderUI();

  try {
    const tokenAddress = buyMode 
      ? (updatedToToken.symbol !== 'ETH' ? updatedToToken.address : null)
      : (updatedFromToken.symbol !== 'ETH' ? updatedFromToken.address : null);

    if (!tokenAddress) {
      throw new Error('Invalid token selection');
    }

    // ✅ FIXED: Show loading modal
    showLoadingModal('Verifying Token...', 'loading');
    const verificationResult = await getTokenVerificationInfo(tokenAddress);

    if (verificationResult.verified) {
      this._state.tokenVerified = true;
      this._state.recommendedDex = verificationResult.recommendedDex;
    } else {
      this._state.tokenVerified = false;
      this._state.recommendedDex = DEX.ABSTRACTSWAP;
    }
    
    const dexName = verificationResult.recommendedDex || DEX.ABSTRACTSWAP;
    
    // ✅ FIXED: Update message with proper delay
    await new Promise(resolve => setTimeout(resolve, 500));
    updateLoadingMessage(`Trading on ${dexName}...`, 'Preparing transaction...');

    const fromDecimals = updatedFromToken.decimals || 18;
    const toDecimals = updatedToToken.decimals || 18;
    
    const amountWei = BigInt(Math.floor(inputAmount * Math.pow(10, fromDecimals))).toString();

    const estimatedOutputRaw = this._state.toAmount ? 
      String(this._state.toAmount).replace(/,/g, '') : null;
    
    let estimatedOutputWei = null;
    if (estimatedOutputRaw && !isNaN(estimatedOutputRaw)) {
      estimatedOutputWei = BigInt(
        Math.floor(parseFloat(estimatedOutputRaw) * Math.pow(10, toDecimals))
      ).toString();
    }

    const tradeType = buyMode ? 'buy' : 'sell';
    
    console.log('[swap] Executing MARKET order:', {
      tokenAddress,
      amountWei,
      tradeType,
      slippage,
      estimatedOutputWei,
      dex: dexName,
      from: updatedFromToken.symbol,
      to: updatedToToken.symbol
    });

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
  
  // ✅ Show toast dengan link
  const explorerUrl = `https://abscan.org/tx/${result.txHash}`;
  toast(`Trade successful! View TX: ${explorerUrl}`, 20000); // 5 detik
  
  Promise.all([
    refreshBalances().catch(e => console.warn('[swap] refresh balance error:', e)),
    refreshPrices().catch(e => console.warn('[swap] refresh price error:', e))
  ]);
  
  this.renderUI();
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
    
    // ✅ FIXED: Use setLoadingType + proper await
    setLoadingType('error');
    updateLoadingMessage('Trade Failed', errorMsg);
    
    // ✅ FIXED: Wait then hide
    await new Promise(resolve => setTimeout(resolve, 3000));
    hideLoadingModal();
    
  } finally {
    // ✅ FIXED: Remove setTimeout, direct call
    this._state.isSwapping = false;
    this.renderUI();
  }
},
  
  // ... (Fungsi render, renderUI, dan semua fungsi lain tetap sama) ...
  async render(root) {
    if (!this._state.fromToken && Array.isArray(state.tokens)) {
      this._state.fromToken = state.tokens.find(t => (t.symbol || '').toUpperCase() === 'ETH');
    }
    if (!this._state.toToken && Array.isArray(state.tokens)) {
      this._state.toToken = state.tokens.find(t => (t.symbol || '').toUpperCase() === 'POOKIE');
    }

    this.root = root;

    try {
      await refreshBalances().catch(e => console.warn('[swap] refreshBalances fail', e));
      await refreshPrices().catch(e => console.warn('[swap] refreshPrices fail', e));
      
      if (this._state.fromToken && Array.isArray(state.tokens)) {
        const updatedFrom = state.tokens.find(t => 
          t.address === this._state.fromToken.address || t.symbol === this._state.fromToken.symbol
        );
        if (updatedFrom) this._state.fromToken = updatedFrom;
      }
      if (this._state.toToken && Array.isArray(state.tokens)) {
        const updatedTo = state.tokens.find(t => 
          t.address === this._state.toToken.address || t.symbol === this._state.toToken.symbol
        );
        if (updatedTo) this._state.toToken = updatedTo;
      }
      
      // Verify token on initial render
      const tokenToVerify = this._state.buyMode 
        ? (this._state.toToken?.symbol !== 'ETH' ? this._state.toToken?.address : null)
        : (this._state.fromToken?.symbol !== 'ETH' ? this._state.fromToken?.address : null);
      
      if (tokenToVerify) {
        await this.verifyToken(tokenToVerify);
      }
      
      if (this._state.fromAmount) this.recalculateAmounts(this._state.fromAmount);
    } catch (e) {
      console.warn('[swap] init fetch failed', e);
    }

    this.renderUI();
  },

  renderUI() {
    const root = this.root;
    if (!root) return;
    
    if (this._sliderInstance && this._sliderInstance.destroy) {
      this._sliderInstance.destroy();
      this._sliderInstance = null;
    }
    
    root.innerHTML = '';

    const theme = PookieTheme;
    const { fromToken, toToken, buyMode } = this._state;

    const tokenForChange = buyMode ? toToken : fromToken;
    const priceChange = tokenForChange ? getChange24h(tokenForChange.symbol) : null;
    const priceChangeVal = priceChange != null && isFinite(priceChange) ? priceChange.toFixed(2) : '25.00';
    const impactColor = (priceChange != null && priceChange < 0) ? theme.brand.red : theme.brand.altGreen;

    const rate = this.getExchangeRate(fromToken, toToken);
    const rateDisplay = rate
      ? this.formatNumber(rate, 6)
      : (fromToken && toToken ? '0' : 'Select Tokens');

    let maxAvailable = 0;
    let maxOutput = 0;

    if (buyMode) {
      const ethBalance = fromToken?.symbol === 'ETH' 
        ? Number(fromToken.balance) || 0 
        : Number(state.balance) || 0;
      maxAvailable = ethBalance;
      
      // Konsisten: Menggunakan 0.99 (1% buffer)
      const amountToUse = ethBalance * 0.99;
      const calculatedMaxOutput = (fromToken && toToken) ? this.calculateToAmount(amountToUse, fromToken, toToken) : 0;
      maxOutput = calculatedMaxOutput ? Number(String(calculatedMaxOutput).replace(/,/g, '')) : 0;
    } else {
      if (fromToken) {
        if (fromToken.symbol === 'ETH') {
          const ethBalance = Number(fromToken.balance) || Number(state.balance) || 0;
          maxAvailable = ethBalance;
        } else {
          maxAvailable = Number(fromToken.balance) || 0;
        }
      } else {
        maxAvailable = 0;
      }
      
      // Konsisten: Menggunakan 0.99 (1% buffer)
      const amountToUse = (fromToken && fromToken.symbol === 'ETH') ? (maxAvailable * 0.99) : maxAvailable;
      const calculatedMaxOutput = (fromToken && toToken) ? this.calculateToAmount(amountToUse, fromToken, toToken) : 0;
      maxOutput = calculatedMaxOutput ? Number(String(calculatedMaxOutput).replace(/,/g, '')) : 0;
    }

    const avblLabel = buyMode ? 'ETH' : (fromToken?.symbol || 'Token');
    const maxLabel = buyMode ? (toToken ? toToken.symbol : 'Token') : 'ETH';
    const feeLabel = 'ETH';

    const container = el('div', { style: { minHeight: '70vh', padding: '18px', fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', color: theme.text.primary } });

    const displayToken = buyMode 
      ? (toToken?.symbol !== 'ETH' ? toToken : fromToken)
      : (fromToken?.symbol !== 'ETH' ? fromToken : toToken);
    
    const centerTokenSelector = createMiniTokenDropdown({
      token: displayToken || { symbol: 'POOKIE' },
      tokenModalFactory,
      onSelect: async (tok) => {
        if (tok.symbol === 'ETH') {
          toast('ETH cannot be selected as the trading token');
          return;
        }
        
        const ethToken = (state.tokens || []).find(t => (t.symbol || '').toUpperCase() === 'ETH');
        
        if (buyMode) {
          this._state.fromToken = ethToken;
          this._state.toToken = tok;
        } else {
          this._state.fromToken = tok;
          this._state.toToken = ethToken;
        }
        
        // Verify new token
        if (tok.address) {
          await this.verifyToken(tok.address);
        }
        
        this.recalculateAmounts(this._state.fromAmount);
        
        // Refresh prices & balances for new token
        await refreshPrices().catch(e => console.warn('[swap] refresh prices fail', e));
        await refreshBalances().catch(e => console.warn('[swap] refresh balances fail', e));
        
        this.renderUI();
      }
    });

    const centerWarnBtn = this.createWarnButton(() => {
      if (displayToken && (displayToken.address || displayToken.symbol)) {
        showTokenDetailModal(displayToken);
      } else {
        toast('Info: token utama untuk perdagangan.');
      }
    });

    // Show DEX badge if token is verified
    const dexBadge = this._state.recommendedDex ? el('div', {
      style: {
        fontSize: '11px',
        padding: '4px 8px',
        borderRadius: '6px',
        background: this._state.recommendedDex === DEX.MOONSHOT ? '#FFD24D' : theme.brand.green,
        color: '#2e2d2d',
        fontWeight: 700,
        marginLeft: '6px'
      }
    }, this._state.recommendedDex) : null;

    const wrappedCenterTokenSelector = el('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } }, 
      centerWarnBtn, 
      centerTokenSelector,
      dexBadge
    );

    const slippageButton = el('button', {
      style: {
        padding: '6px 12px', borderRadius: '999px', border: `1px solid ${theme.border.primary}`,
        background: theme.bg.input, color: theme.text.dark, fontWeight: 700, cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: '4px'
      },
      onClick: () => this.createSlippageModal()
    },
      el('span', {}, 'SLIPPAGE'),
      el('span', { style: { color: theme.text.muted, fontSize: '12px' } }, `${this._state.slippage}%`)
    );

    const headerGrid = el('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        alignItems: 'center',
        gap: '8px',
        maxWidth: '640px',
        margin: '0 auto 12px auto',
        padding: '0 14px'
      }
    },
      el('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          justifySelf: 'start',
        }
      },
        wrappedCenterTokenSelector,
        el('div', { style: { color: impactColor, fontWeight: 700 } }, `${priceChangeVal}%`)
      ),

      el('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          justifySelf: 'end'
        }
      }, slippageButton)
    );

    const buyBtn = el('button', {
  style: {
    flex: '1 1 0', 
    padding: '14px', 
    borderRadius: '8px 28px 28px 8px',
    border: 'none', 
    fontWeight: 800, 
    fontSize: '16px',
    color: this._state.buyMode ? '#fff' : theme.text.muted, 
    background: this._state.buyMode ? theme.brand.green : theme.bg.input, 
    cursor: 'pointer'
  },onClick: async () => { 
        if (!this._state.buyMode) {
          const ethToken = (state.tokens || []).find(t => (t.symbol || '').toUpperCase() === 'ETH');
          const selectedToken = this._state.fromToken?.symbol !== 'ETH' 
            ? this._state.fromToken 
            : this._state.toToken;
          
          this._state.fromToken = ethToken || this._state.fromToken;
          this._state.toToken = selectedToken || this._state.toToken;
          
          // Verify token when switching to buy mode
          if (selectedToken?.address) {
            await this.verifyToken(selectedToken.address);
          }
        }
        this._state.buyMode = true;
        this._state.fromAmount = '';
        this._state.toAmount = '';
        this.renderUI(); 
      }
    }, 'Buy');

    const sellBtn = el('button', {
  style: {
    flex: '1 1 0', 
    padding: '14px', 
    borderRadius: '28px 8px 8px 28px',
    border: 'none', 
    fontWeight: 800, 
    fontSize: '16px',
    color: !this._state.buyMode ? '#fff' : theme.text.muted, 
    background: !this._state.buyMode ? theme.brand.red : theme.bg.input, 
    cursor: 'pointer'
  },
      onClick: async () => { 
        if (this._state.buyMode) {
          const ethToken = (state.tokens || []).find(t => (t.symbol || '').toUpperCase() === 'ETH');
          const selectedToken = this._state.toToken?.symbol !== 'ETH' 
            ? this._state.toToken 
            : this._state.fromToken;
          
          this._state.fromToken = selectedToken || this._state.fromToken;
          this._state.toToken = ethToken || this._state.toToken;
          
          // Verify token when switching to sell mode
          if (selectedToken?.address) {
            await this.verifyToken(selectedToken.address);
          }
        }
        this._state.buyMode = false;
        this._state.fromAmount = '';
        this._state.toAmount = '';
        this.renderUI(); 
      }
    }, 'Sell');

    const tabs = el('div', { 
  style: { 
    display: 'flex', 
    gap: '8px', 
    marginBottom: '12px', 
    maxWidth: '640px', 
    marginLeft: 'auto', 
    marginRight: 'auto', 
    padding: '0 24px'
  } 
}, buyBtn, sellBtn);

    const dropdownWrapper = el('div', { style: { position: 'relative', width: '100%', flexShrink: 0 } });
    const dropdownBtn = el('button', {
      style: {
        width: '100%',
        background: theme.bg.input,
        borderRadius: '10px',
        padding: '12px 14px',
        fontWeight: '700',
        textAlign: 'center',
        color: theme.text.dark,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '6px',
        cursor: 'pointer',
        border: 'none',
        boxShadow: theme.shadow.soft,
        minWidth: '100px'
      },
      onclick: () => this.createMarketOrderModal()
    }, `${this._state.orderType} ▾`);

    dropdownWrapper.append(dropdownBtn);
    const marketRow = el('div', { style: { display: 'flex', marginBottom: '12px', alignItems: 'center' } }, dropdownWrapper);

    let marketPriceText = 'Select Tokens to view Price';
    if (fromToken && toToken) {
      if (buyMode) {
        marketPriceText = `1 ${fromToken.symbol} = ${rateDisplay} ${toToken.symbol}`;
      } else {
        const priceNative = (fromToken && fromToken.symbol === 'ETH')
          ? 1
          : (fromToken ? getNativePrice(fromToken.address || fromToken.symbol) : null);

        const priceNativeDisplay = (priceNative != null && isFinite(priceNative))
          ? this.formatNumber(priceNative, 12)
          : '0';

        marketPriceText = `1 ${fromToken.symbol} = ${priceNativeDisplay} ETH`;
      }
    }

    const marketPrice = el('div', { style: { background: theme.bg.input, borderRadius: '12px', padding: '18px', textAlign: 'center', color: theme.text.secondary, fontWeight: 700, fontSize: '18px', marginBottom: '12px' } },
      marketPriceText
    );

    const totalInput = el('input', {
      type: 'text',
      pattern: "[0-9]*[.]?[0-9]*",
      inputMode: "decimal",
      placeholder: '0.00',
      value: this._state.fromAmount || '',
      style: {
        border: 'none',
        outline: 'none',
        background: 'transparent',
        fontSize: '16px',
        fontWeight: 800,
        color: theme.text.dark,
        textAlign: 'right',
        width: '200px'
      },
      onInput: (e) => {
        const val = e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
        e.target.value = val;
        this._state.fromAmount = val;
        this.recalculateAmounts(val);
        
        if (this._sliderInstance) {
          this._sliderInstance.setValue(Number(val) || 0);
        }
        
        const statsContainer = root.querySelector('.stats-values');
        if (statsContainer) {
          const calculatedMaxOutput = (fromToken && toToken) ? this.calculateToAmount(maxAvailable * (fromToken.symbol === 'ETH' ? 0.99 : 1), fromToken, toToken) : 0;
          const newMaxOutput = calculatedMaxOutput ? Number(String(calculatedMaxOutput).replace(/,/g, '')) : 0;
          
          const currentAvblLabel = buyMode ? 'ETH' : (fromToken ? fromToken.symbol : 'Token');
          const currentMaxLabel = buyMode ? (toToken ? toToken.symbol : 'Token') : 'ETH';
          
          statsContainer.innerHTML = '';
          statsContainer.appendChild(el('div', { style: { fontWeight: 800 } }, `${this.formatNumber(maxAvailable, 6)} ${currentAvblLabel}`));
          statsContainer.appendChild(el('div', { style: { fontWeight: 800 } }, `${this.formatNumber(newMaxOutput, 6)} ${currentMaxLabel}`));
          statsContainer.appendChild(el('div', { style: { fontWeight: 800 } }, `-- ETH`));
        }
      }
    });

    const totalRow = el('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: theme.bg.input, borderRadius: '12px', padding: '14px 16px', marginBottom: '12px' } },
      el('div', { style: { fontWeight: 700, color: theme.text.muted } }, 'Total'),
      totalInput
    );

    this._sliderInstance = createSlider({
      getCurrentMax: () => maxAvailable,
      getCurrentValue: () => Number(this._state.fromAmount) || 0,
      onValueChange: (value, isComplete) => {
        this._state.fromAmount = value;
        this.recalculateAmounts(value);
        
        if (totalInput) {
          totalInput.value = value;
        }
        
        const statsContainer = root.querySelector('.stats-values');
        if (statsContainer) {
          const calculatedMaxOutput = (fromToken && toToken) ? this.calculateToAmount(maxAvailable * (fromToken.symbol === 'ETH' ? 0.99 : 1), fromToken, toToken) : 0;
          const newMaxOutput = calculatedMaxOutput ? Number(String(calculatedMaxOutput).replace(/,/g, '')) : 0;
          
          const currentAvblLabel = buyMode ? 'ETH' : (fromToken ? fromToken.symbol : 'Token');
          const currentMaxLabel = buyMode ? (toToken ? toToken.symbol : 'Token') : 'ETH';
          
          statsContainer.innerHTML = '';
          statsContainer.appendChild(el('div', { style: { fontWeight: 800 } }, `${this.formatNumber(maxAvailable, 6)} ${currentAvblLabel}`));
          statsContainer.appendChild(el('div', { style: { fontWeight: 800 } }, `${this.formatNumber(newMaxOutput, 6)} ${currentMaxLabel}`));
          statsContainer.appendChild(el('div', { style: { fontWeight: 800 } }, `-- ETH`));
        }
      },
      formatValue: (v) => this.formatNumber(v, 6)
    });

    // Di bagian stats, ganti baris Est. Fee
const stats = el('div', { style: { display: 'flex', justifyContent: 'space-between', marginTop: '12px', alignItems: 'flex-start' } },
  el('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
    el('div', { style: { color: theme.text.muted, fontWeight: 700, textDecoration: 'underline', textDecorationStyle: 'dotted' } }, 'Avbl'),
    el('div', { style: { color: theme.text.muted, fontWeight: 700, textDecoration: 'underline', textDecorationStyle: 'dotted' } }, `Max ${buyMode ? 'Buy' : 'Sell'}`),
    el('div', { style: { color: theme.text.muted, fontWeight: 700, textDecoration: 'underline', textDecorationStyle: 'dotted' } }, 'Est. Fee')
  ),
  el('div', { 
    className: 'stats-values',
    style: { display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'right' } 
  },
    el('div', { style: { fontWeight: 800 } }, `${this.formatNumber(maxAvailable, 6)} ${avblLabel}`),
    el('div', { style: { fontWeight: 800 } }, `${this.formatNumber(maxOutput, 6)} ${maxLabel}`),
    el('div', { style: { fontWeight: 800 } }, 
      this._state.estimatedFee 
        ? `~${this.formatNumber(this._state.estimatedFee, 6)} ETH` 
        : '-- ETH'
    )
  )
);

    const cta = el('button', {
  style: {
    width: '100%', padding: '18px', borderRadius: '14px', border: 'none',
    fontSize: '20px', fontWeight: 900, color: '#fff', cursor: 'pointer', marginTop: '14px',
    background: this._state.buyMode ? theme.brand.green : theme.brand.red, 
    opacity: this._state.isSwapping ? 0.7 : 1
  },
  onClick: () => this.executeSwap()
}, (() => {
  if (this._state.isSwapping) {
    return this._state.buyMode ? 'Buying...' : 'Selling...';
  }
  if (!state.connected) {
    return 'Connect Wallet';
  }
  if (!this._state.fromToken || !this._state.toToken) {
    return this._state.buyMode ? 'Buy Pookie' : 'Sell Pookie';
  }
  
  // ✅ PERBAIKAN: Clean amount dan validasi dengan benar
  const cleanAmount = String(this._state.fromAmount).replace(/,/g, '');
  const numAmount = Number(cleanAmount);
  
  if (!cleanAmount || isNaN(numAmount) || numAmount <= 0) {
    return 'Enter Amount';
  }
  
  // Valid amount
  return 'Swap Now';
})());

    const swapCard = el('div', { style: { maxWidth: '640px', margin: '0 auto', background: 'transparent', borderRadius: '18px', padding: '14px', boxShadow: 'none' } },
      tabs,
      marketRow,
      marketPrice,
      totalRow,
      this._sliderInstance.element,
      stats,
      cta
    );

    container.appendChild(headerGrid);
    container.appendChild(swapCard);
    root.appendChild(container);
  }
};