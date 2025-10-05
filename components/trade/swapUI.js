import { el } from './dom.js';
import { PookieTheme } from './theme.js';
import { createSlippageControl } from './slippageControl.js';
import { createMiniTokenDropdown } from './tokenSelector.js';
import { tokenModalFactory } from './tokenModal.js';
import { showTokenDetailModal } from './detailToken.js';
import { createSlider } from './slider.js';
import { getChange24h, getNativePrice } from '../../func/prices.js';
import { state } from '../../func/state.js';

export const SwapUI = {
  // Create warning button
  createWarnButton(onClick) {
    const theme = PookieTheme;
    return el('button', {
      className: 'w-6 h-6 min-w-6 min-h-6 flex items-center justify-center p-0 border-0 cursor-pointer transform rotate-45 rounded shadow-sm bg-yellow-400 hover:bg-yellow-500 transition-colors mr-2',
      onclick: (e) => {
        e.stopPropagation();
        if (typeof onClick === 'function') onClick(e);
      },
      title: 'Info'
    },
      el('span', {
        className: 'inline-block transform -rotate-45 font-black text-sm leading-3 text-gray-800 select-none'
      }, '!')
    );
  },

  // Create market order modal
  createMarketOrderModal(swapState, onOrderTypeChange) {
    const theme = PookieTheme;

    const createOptionRow = (title, description, value, isSoon = false) => {
      const isSelected = swapState.orderType === value;

      return el('div', {
        className: `flex flex-col py-4 border-b border-gray-200 ${isSoon ? 'opacity-60' : 'cursor-pointer'}`,
        onClick: isSoon ? null : () => {
          swapState.orderType = value;
          modal.remove();
          onOrderTypeChange();
        }
      },
        el('div', { className: 'flex justify-between items-center' },
          el('div', { className: 'font-black text-white' }, title),
          el('div', { className: 'flex items-center gap-2' },
            isSoon ? el('span', {
              className: 'text-xs py-0.5 px-1.5 bg-gray-800 rounded border border-gray-600 text-gray-400'
            }, 'Soon') : null,
            el('div', {
              className: 'text-green-500 font-black text-lg w-5 text-right'
            }, isSelected ? '✓' : null)
          )
        ),
        el('div', { className: 'text-sm text-gray-400 mt-1 leading-relaxed' }, description)
      );
    };

    const modal = el('div', {
      className: 'fixed inset-0 bg-black/45 flex items-end justify-center z-[1200] p-0',
      onClick: (e) => { if (e.target === modal) modal.remove(); }
    });

    const content = el('div', {
      className: 'w-full max-w-[480px] bg-gray-900 rounded-t-2xl p-5 shadow-lg text-white'
    },
      el('div', {
        className: 'flex justify-between items-center text-xl font-black text-white mb-2.5 pb-2.5 border-b-2 border-gray-700'
      },
        'Order Type',
        el('span', {
          className: 'text-sm text-gray-400 cursor-help border border-gray-400 rounded-full w-5 h-5 flex justify-center items-center font-bold'
        }, 'i')
      ),

      el('div', { className: 'py-2.5' },
        createOptionRow('Limit', 'Buy or Sell at a specific price or better', 'Limit', true),
        createOptionRow('Market', 'Buy or Sell at the best available market price', 'Market', false),
        createOptionRow('Stop Limit', 'Triggers a Limit order when Stop price is reached.', 'StopLimit', true)
      )
    );

    modal.appendChild(content);
    document.body.appendChild(modal);
    return modal;
  },

  // Create slippage modal
  createSlippageModal(swapState, onSlippageChange) {
    const theme = PookieTheme;

    const modal = el('div', {
      className: 'fixed inset-0 bg-black/45 flex items-center justify-center z-[1200] p-5',
      onClick: (e) => { if (e.target === modal) modal.remove(); }
    });

    const slControl = createSlippageControl(swapState, (v) => {
      swapState.slippage = v;
      onSlippageChange();
    });

    const content = el('div', {
      className: 'w-full max-w-[380px] bg-gray-900 rounded-2xl p-5 shadow-lg text-white'
    },
      el('div', { className: 'text-lg font-bold text-white mb-3' }, 'Slippage Tolerance'),
      el('div', { className: 'text-sm leading-relaxed mb-5 text-gray-400' }, 
        'Your transaction will revert if the price changes unfavorably by more than this percentage.'),

      slControl.node,

      el('button', {
        className: 'w-full py-3.5 rounded-xl border-0 bg-green-500 hover:bg-green-600 text-gray-900 font-bold text-sm cursor-pointer mt-6 transition-colors',
        onClick: () => modal.remove()
      }, 'Close')
    );

    modal.appendChild(content);
    document.body.appendChild(modal);
    slControl.update();
    return modal;
  },

  // Render main UI
  renderMainUI(root, swapState, callbacks) {
    const theme = PookieTheme;
    const { fromToken, toToken, buyMode } = swapState;

    root.innerHTML = '';

    // Token for price change display
    const tokenForChange = buyMode ? toToken : fromToken;
    const priceChange = tokenForChange ? getChange24h(tokenForChange.symbol) : null;
    const priceChangeVal = priceChange != null && isFinite(priceChange) ? priceChange.toFixed(2) : '25.00';
    const impactColor = (priceChange != null && priceChange < 0) ? theme.brand.red : theme.brand.altGreen;

    // Calculate max available
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

    const avblLabel = buyMode ? 'ETH' : (fromToken?.symbol || 'Token');
    const displayToken = buyMode 
      ? (toToken?.symbol !== 'ETH' ? toToken : fromToken)
      : (fromToken?.symbol !== 'ETH' ? fromToken : toToken);

    // Main container
    const container = el('div', { 
      className: 'min-h-[70vh] p-4 sm:p-5 font-sans text-white' 
    });

    // Token selector
    const centerTokenSelector = createMiniTokenDropdown({
      token: displayToken || { symbol: 'POOKIE' },
      tokenModalFactory,
      onSelect: callbacks.onTokenSelect
    });

    const centerWarnBtn = this.createWarnButton(() => {
      if (displayToken && (displayToken.address || displayToken.symbol)) {
        showTokenDetailModal(displayToken);
      }
    });

    const dexBadge = swapState.recommendedDex ? el('div', {
      className: `text-xs py-1 px-2 rounded font-bold ml-1.5 ${
        swapState.recommendedDex === 'Moonshot' ? 'bg-yellow-400 text-gray-900' : 'bg-green-500 text-gray-900'
      }`
    }, swapState.recommendedDex) : null;

    // Header
    const headerGrid = el('div', {
      className: 'grid grid-cols-2 gap-2 sm:gap-3 items-center max-w-2xl mx-auto mb-3 sm:mb-4 px-2 sm:px-3'
    },
      el('div', { className: 'flex items-center gap-2' },
        centerWarnBtn,
        centerTokenSelector,
        el('div', { className: 'font-bold text-xs sm:text-sm', style: { color: impactColor } }, 
          `${priceChangeVal}%`)
      ),
      el('div', { className: 'flex justify-end' },
        el('button', {
          className: 'flex items-center gap-2 px-3 py-2 rounded-full border border-gray-300 bg-gray-200 hover:bg-gray-300 cursor-pointer transition-colors',
          onClick: callbacks.onSlippageClick
        },
          el('span', { className: 'sm:hidden text-xs font-bold text-gray-900' }, 'SLIP'),
          el('span', { className: 'hidden sm:inline text-xs sm:text-sm font-bold text-gray-900' }, 'SLIPPAGE'),
          el('span', { className: 'text-xs text-gray-900 font-bold' }, `${swapState.slippage}%`)
        )
      )
    );

    // Buy/Sell tabs
    const buyBtn = el('button', {
      className: `flex-1 py-3 sm:py-3.5 rounded-l-lg rounded-tr-[28px] font-black text-sm sm:text-base transition-colors ${
        swapState.buyMode 
          ? 'bg-green-500 text-white' 
          : 'bg-gray-200 text-gray-600'
      }`,
      onClick: () => callbacks.onModeSwitch(true)
    }, 'Buy');

    const sellBtn = el('button', {
      className: `flex-1 py-3 sm:py-3.5 rounded-r-lg rounded-tl-[28px] font-black text-sm sm:text-base transition-colors ${
        !swapState.buyMode 
          ? 'bg-red-500 text-white' 
          : 'bg-gray-200 text-gray-600'
      }`,
      onClick: () => callbacks.onModeSwitch(false)
    }, 'Sell');

    const tabs = el('div', { className: 'flex gap-2 mb-3 px-3 sm:px-6' }, buyBtn, sellBtn);

    // Market order dropdown
    const dropdownBtn = el('button', {
      className: 'w-full bg-gray-200 rounded-xl py-3 px-4 font-bold text-center text-gray-900 flex justify-center items-center gap-1.5 cursor-pointer border-0 shadow-sm min-w-[100px] text-sm sm:text-base',
      onclick: callbacks.onMarketOrderClick
    }, `${swapState.orderType} ▾`);

    const marketRow = el('div', { className: 'flex mb-3 items-center' }, 
      el('div', { className: 'relative w-full flex-shrink-0' }, dropdownBtn)
    );

    // Market price
    const rate = callbacks.getExchangeRate(fromToken, toToken);
    let marketPriceText = 'Select Tokens to view Price';
    if (fromToken && toToken) {
      if (buyMode) {
        const rateDisplay = rate ? callbacks.formatNumber(rate, 6) : '0';
        marketPriceText = `1 ${fromToken.symbol} = ${rateDisplay} ${toToken.symbol}`;
      } else {
        const priceNative = (fromToken && fromToken.symbol === 'ETH')
          ? 1
          : (fromToken ? getNativePrice(fromToken.address || fromToken.symbol) : null);
        const priceNativeDisplay = (priceNative != null && isFinite(priceNative))
          ? callbacks.formatNumber(priceNative, 12)
          : '0';
        marketPriceText = `1 ${fromToken.symbol} = ${priceNativeDisplay} ETH`;
      }
    }

    const marketPrice = el('div', { 
      className: 'bg-gray-200 rounded-xl p-4 sm:p-5 text-center text-gray-900 font-bold text-base sm:text-lg mb-3'
    }, marketPriceText);

    // Amount input
    const totalInput = el('input', {
      type: 'text',
      pattern: "[0-9]*[.]?[0-9]*",
      inputMode: "decimal",
      placeholder: '0.00',
      value: swapState.fromAmount || '',
      className: 'border-0 outline-none bg-transparent text-base sm:text-lg font-black text-gray-900 text-right w-32 sm:w-48',
      onInput: (e) => callbacks.onAmountChange(e.target.value)
    });

    const totalRow = el('div', { 
      className: 'flex items-center justify-between bg-gray-200 rounded-xl p-3 sm:p-4 mb-3'
    },
      el('div', { className: 'font-bold text-gray-600 text-sm sm:text-base' }, 'Total'),
      totalInput
    );

    // Stats
    const maxOutput = callbacks.calculateMaxOutput(maxAvailable, fromToken, toToken);
    const maxLabel = buyMode ? (toToken ? toToken.symbol : 'Token') : 'ETH';

    const stats = el('div', { className: 'flex justify-between text-xs sm:text-sm mt-3 mb-4' },
      el('div', { className: 'space-y-2' },
        el('div', { className: 'text-gray-400 font-bold underline decoration-dotted' }, 'Avbl'),
        el('div', { className: 'text-gray-400 font-bold underline decoration-dotted' }, 
          `Max ${buyMode ? 'Buy' : 'Sell'}`),
        el('div', { className: 'text-gray-400 font-bold underline decoration-dotted' }, 'Est. Fee')
      ),
      el('div', { 
        className: 'stats-values space-y-2 text-right'
      },
        el('div', { className: 'font-black text-white' }, 
          `${callbacks.formatNumber(maxAvailable, 6)} ${avblLabel}`),
        el('div', { className: 'font-black text-white' }, 
          `${callbacks.formatNumber(maxOutput, 6)} ${maxLabel}`),
        el('div', { className: 'font-black text-white' }, 
          swapState.estimatedFee 
            ? `~${callbacks.formatNumber(swapState.estimatedFee, 6)} ETH` 
            : '-- ETH'
        )
      )
    );

    // Swap button
    const getButtonText = () => {
      if (swapState.isSwapping) {
        return swapState.buyMode ? 'Buying...' : 'Selling...';
      }
      if (!state.connected) {
        return 'Connect Wallet';
      }
      if (!swapState.fromToken || !swapState.toToken) {
        return swapState.buyMode ? 'Buy Pookie' : 'Sell Pookie';
      }
      
      const cleanAmount = String(swapState.fromAmount).replace(/,/g, '');
      const numAmount = Number(cleanAmount);
      
      if (!cleanAmount || isNaN(numAmount) || numAmount <= 0) {
        return 'Enter Amount';
      }
      
      return 'Swap Now';
    };

    const cta = el('button', {
      className: `w-full py-4 rounded-xl font-black text-lg sm:text-xl text-white cursor-pointer mt-3.5 transition-all ${
        swapState.buyMode ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'
      } ${swapState.isSwapping ? 'opacity-70' : 'opacity-100'}`,
      onClick: callbacks.onSwapClick
    }, getButtonText());

    // Slider
    const sliderInstance = createSlider({
      getCurrentMax: () => maxAvailable,
      getCurrentValue: () => Number(swapState.fromAmount) || 0,
      onValueChange: callbacks.onSliderChange,
      formatValue: (v) => callbacks.formatNumber(v, 6)
    });

    // Assemble card
    const swapCard = el('div', { 
      className: 'max-w-2xl mx-auto bg-transparent rounded-2xl p-3 sm:p-4'
    },
      tabs,
      marketRow,
      marketPrice,
      totalRow,
      sliderInstance.element,
      stats,
      cta
    );

    container.appendChild(headerGrid);
    container.appendChild(swapCard);
    root.appendChild(container);

    return sliderInstance;
  }
};