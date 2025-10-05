import { state } from '../../func/state.js';
import { refreshBalances } from '../../func/balance.js';
import { refreshPrices } from '../../func/prices.js';
import { SwapLogic } from './swapLogic.js';
import { SwapUI } from './swapUI.js';
import { toast } from '../../func/utils.js';

export const Swap = {
  // Internal state
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
  root: null,

  // Initialize and render
  async render(root) {
    this.root = root;

    // Set default tokens
    if (!this._state.fromToken && Array.isArray(state.tokens)) {
      this._state.fromToken = state.tokens.find(t => (t.symbol || '').toUpperCase() === 'ETH');
    }
    if (!this._state.toToken && Array.isArray(state.tokens)) {
      this._state.toToken = state.tokens.find(t => (t.symbol || '').toUpperCase() === 'POOKIE');
    }

    try {
      // Refresh data
      await refreshBalances().catch(e => console.warn('[swap] refreshBalances fail', e));
      await refreshPrices().catch(e => console.warn('[swap] refreshPrices fail', e));
      
      // Update tokens with fresh data
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
        await SwapLogic.verifyToken(this._state, tokenToVerify);
      }
      
      // Recalculate if amount exists
      if (this._state.fromAmount) {
        await SwapLogic.recalculateAmounts(this._state, this._state.fromAmount);
      }
    } catch (e) {
      console.warn('[swap] init fetch failed', e);
    }

    this.renderUI();
  },

  // Render UI
  renderUI() {
    if (!this.root) return;
    
    // Cleanup old slider
    if (this._sliderInstance && this._sliderInstance.destroy) {
      this._sliderInstance.destroy();
      this._sliderInstance = null;
    }

    const callbacks = {
      // Token selection
      onTokenSelect: async (tok) => {
        if (tok.symbol === 'ETH') {
          toast('ETH cannot be selected as the trading token');
          return;
        }
        
        const ethToken = (state.tokens || []).find(t => (t.symbol || '').toUpperCase() === 'ETH');
        
        if (this._state.buyMode) {
          this._state.fromToken = ethToken;
          this._state.toToken = tok;
        } else {
          this._state.fromToken = tok;
          this._state.toToken = ethToken;
        }
        
        // Verify new token
        if (tok.address) {
          await SwapLogic.verifyToken(this._state, tok.address);
        }
        
        await SwapLogic.recalculateAmounts(this._state, this._state.fromAmount);
        
        // Refresh prices & balances
        await refreshPrices().catch(e => console.warn('[swap] refresh prices fail', e));
        await refreshBalances().catch(e => console.warn('[swap] refresh balances fail', e));
        
        this.renderUI();
      },

      // Mode switch (Buy/Sell)
      onModeSwitch: async (buyMode) => {
        if (this._state.buyMode !== buyMode) {
          const ethToken = (state.tokens || []).find(t => (t.symbol || '').toUpperCase() === 'ETH');
          const selectedToken = this._state.buyMode 
            ? this._state.toToken 
            : this._state.fromToken;
          
          if (buyMode) {
            // Switch to Buy
            this._state.fromToken = ethToken || this._state.fromToken;
            this._state.toToken = selectedToken?.symbol !== 'ETH' ? selectedToken : this._state.toToken;
          } else {
            // Switch to Sell
            this._state.fromToken = selectedToken?.symbol !== 'ETH' ? selectedToken : this._state.fromToken;
            this._state.toToken = ethToken || this._state.toToken;
          }
          
          // Verify token when switching
          const tokenToVerify = buyMode 
            ? this._state.toToken?.address 
            : this._state.fromToken?.address;
          
          if (tokenToVerify) {
            await SwapLogic.verifyToken(this._state, tokenToVerify);
          }
          
          this._state.buyMode = buyMode;
          this._state.fromAmount = '';
          this._state.toAmount = '';
        }
        this.renderUI();
      },

      // Amount input change
      onAmountChange: async (value) => {
        const val = value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
        this._state.fromAmount = val;
        
        await SwapLogic.recalculateAmounts(this._state, val);
        
        // Update slider
        if (this._sliderInstance) {
          this._sliderInstance.setValue(Number(val) || 0);
        }
        
        // Update stats display
        this.updateStatsDisplay();
      },

      // Slider change
      onSliderChange: async (value, isComplete) => {
        this._state.fromAmount = value;
        await SwapLogic.recalculateAmounts(this._state, value);
        
        // Update input field
        const totalInput = this.root.querySelector('input[type="text"]');
        if (totalInput) {
          totalInput.value = value;
        }
        
        this.updateStatsDisplay();
      },

      // Slippage modal
      onSlippageClick: () => {
        SwapUI.createSlippageModal(this._state, () => this.renderUI());
      },

      // Market order modal
      onMarketOrderClick: () => {
        SwapUI.createMarketOrderModal(this._state, () => this.renderUI());
      },

      // Execute swap
      onSwapClick: async () => {
        const success = await SwapLogic.executeSwap(this._state);
        if (success) {
          this._state.fromAmount = '';
          this._state.toAmount = '';
        }
        this.renderUI();
      },

      // Helper functions
      getExchangeRate: (from, to) => SwapLogic.getExchangeRate(from, to),
      formatNumber: (num, decimals) => SwapLogic.formatNumber(num, decimals),
      calculateMaxOutput: (maxAvail, from, to) => {
        const amountToUse = from?.symbol === 'ETH' ? maxAvail * 0.99 : maxAvail;
        const calculated = SwapLogic.calculateToAmount(amountToUse, from, to);
        return calculated ? Number(String(calculated).replace(/,/g, '')) : 0;
      }
    };

    // Render main UI
    this._sliderInstance = SwapUI.renderMainUI(this.root, this._state, callbacks);
  },

  // Update stats display without full re-render
  updateStatsDisplay() {
    const { fromToken, toToken, buyMode } = this._state;
    const statsContainer = this.root?.querySelector('.stats-values');
    
    if (!statsContainer) return;

    let maxAvailable = 0;
    if (buyMode) {
      const ethBalance = fromToken?.symbol === 'ETH' 
        ? Number(fromToken.balance) || 0 
        : Number(state.balance) || 0;
      maxAvailable = ethBalance;
    } else {
      if (fromToken) {
        maxAvailable = fromToken.symbol === 'ETH' 
          ? Number(fromToken.balance) || Number(state.balance) || 0
          : Number(fromToken.balance) || 0;
      }
    }

    const amountToUse = fromToken?.symbol === 'ETH' ? maxAvailable * 0.99 : maxAvailable;
    const calculatedMaxOutput = SwapLogic.calculateToAmount(amountToUse, fromToken, toToken);
    const maxOutput = calculatedMaxOutput ? Number(String(calculatedMaxOutput).replace(/,/g, '')) : 0;

    const avblLabel = buyMode ? 'ETH' : (fromToken?.symbol || 'Token');
    const maxLabel = buyMode ? (toToken?.symbol || 'Token') : 'ETH';

    // Update stats values
    const statsValues = statsContainer.querySelectorAll('div');
    if (statsValues.length >= 3) {
      statsValues[0].textContent = `${SwapLogic.formatNumber(maxAvailable, 6)} ${avblLabel}`;
      statsValues[1].textContent = `${SwapLogic.formatNumber(maxOutput, 6)} ${maxLabel}`;
      statsValues[2].textContent = this._state.estimatedFee 
        ? `~${SwapLogic.formatNumber(this._state.estimatedFee, 6)} ETH` 
        : '-- ETH';
    }
  }
};