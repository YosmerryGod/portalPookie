// components/trade/detailToken.js
import { el } from './dom.js';
import { PookieTheme } from './theme.js';
import { getTokenSummary } from '../../func/tokenInformation.js';
import { fmtUsd } from '../../func/utils.js';

/**
 * Show a mobile-responsive modal with token details.
 * Accepts either a token address string or a token object { address, symbol, name, icon }
 */
export async function showTokenDetailModal(tokenOrAddress) {
  const theme = PookieTheme;
  const address = (typeof tokenOrAddress === 'string') ? tokenOrAddress : (tokenOrAddress && tokenOrAddress.address) || null;
  const preview = (typeof tokenOrAddress === 'object') ? tokenOrAddress : null;

  // Modal overlay - responsive padding
  const modal = el('div', {
    className: 'fixed inset-0 bg-black/50 z-[1500] flex items-center justify-center p-4 sm:p-5',
    onclick: (e) => { if (e.target === modal) modal.remove(); }
  });

  // Modal content - responsive width and max-height
  const content = el('div', {
    className: 'w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-gray-900 rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-2xl'
  });

  // Header - responsive layout
  const header = el('div', { 
    className: 'flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 mb-4 pb-4 border-b border-gray-800'
  },
    // Token info section
    el('div', { className: 'flex gap-3 items-center w-full sm:w-auto' },
      // Token icon - responsive size
      preview?.icon 
        ? el('img', { 
            src: preview.icon, 
            className: 'w-12 h-12 sm:w-14 sm:h-14 rounded-xl object-cover flex-shrink-0',
            onerror: function() { 
              this.style.display = 'none';
              const fallback = el('div', { 
                className: 'w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gray-700 flex items-center justify-center font-black text-white text-lg'
              }, (preview?.symbol || 'T').slice(0, 2));
              this.parentElement.insertBefore(fallback, this);
            }
          })
        : el('div', { 
            className: 'w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gray-700 flex items-center justify-center font-black text-white text-lg flex-shrink-0'
          }, (preview?.symbol || 'T').slice(0, 2)),
      
      // Token name and symbol
      el('div', { className: 'flex flex-col min-w-0' },
        el('div', { className: 'text-base sm:text-lg font-black text-white truncate' }, preview?.symbol || 'Unknown'),
        el('div', { className: 'text-xs sm:text-sm text-gray-400 truncate' }, preview?.name || 'Token')
      )
    ),
    
    // Action buttons - responsive sizing
    el('div', { className: 'flex gap-2 w-full sm:w-auto' },
      el('button', {
        className: 'flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white text-xs sm:text-sm font-semibold transition-colors',
        onclick: (e) => { 
          const btn = e.target;
          navigator.clipboard?.writeText(address || '')
            .then(() => { 
              const originalText = btn.textContent;
              btn.textContent = 'Copied!';
              btn.classList.remove('bg-green-500');
              btn.classList.add('bg-green-600');
              setTimeout(() => { 
                btn.textContent = originalText;
                btn.classList.remove('bg-green-600');
                btn.classList.add('bg-green-500');
              }, 1500);
            }) 
            .catch(() => { 
              btn.textContent = 'Failed';
              setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
            }); 
        }
      }, 'Copy'),
      el('button', {
        className: 'flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs sm:text-sm font-semibold transition-colors',
        onclick: () => modal.remove()
      }, 'Close')
    )
  );

  content.appendChild(header);

  // Loading placeholder
  const body = el('div', { 
    className: 'min-h-[120px] flex gap-4 items-start'
  },
    el('div', { className: 'flex-1' },
      el('div', { className: 'text-sm text-gray-400' }, 'Loading token data...')
    )
  );

  content.appendChild(body);
  modal.appendChild(content);
  document.body.appendChild(modal);

  // Validate address
  if (!address) {
    body.innerHTML = '';
    body.appendChild(el('div', { className: 'text-gray-400 text-sm' }, 'No token address provided.'));
    return;
  }

  try {
    const info = await getTokenSummary(address);

    if (!info || !info.success) {
      body.innerHTML = '';
      body.appendChild(el('div', { className: 'text-gray-400 text-sm' }, 
        `Failed to load token info: ${info?.error || 'unknown'}`));
      return;
    }

    // Update header icon if we got icon from API
    if (info.icon && !preview?.icon) {
      const headerIcon = header.querySelector('img, div.w-12');
      if (headerIcon && headerIcon.tagName !== 'IMG') {
        const img = el('img', { 
          src: info.icon, 
          className: 'w-12 h-12 sm:w-14 sm:h-14 rounded-xl object-cover',
          onerror: function() { this.style.display = 'none'; }
        });
        headerIcon.replaceWith(img);
      }
    }

    const price = isFinite(info.priceUsd) ? `$${Number(info.priceUsd).toFixed(6)}` : 'N/A';
    const change = isFinite(info.priceChange24h) 
      ? `${info.priceChange24h > 0 ? '+' : ''}${Number(info.priceChange24h).toFixed(2)}%` 
      : 'N/A';

    body.innerHTML = '';

    // Left Column - responsive flex layout
    const leftCol = el('div', { className: 'flex-1 space-y-4' },
      // Price section - responsive layout
      el('div', { className: 'flex flex-col sm:flex-row justify-between gap-3 sm:gap-4 items-start sm:items-center' },
        el('div', { className: 'flex flex-col' },
          el('div', { className: 'font-black text-base sm:text-lg text-white' }, 
            `${info.name} (${info.symbol})`),
          el('div', { className: 'text-xs text-gray-400 break-all mt-1' }, info.address)
        ),
        el('div', { className: 'text-right' },
          el('div', { className: 'font-black text-base sm:text-lg text-white' }, price),
          el('div', { 
            className: `text-xs sm:text-sm font-bold ${
              info.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'
            }` 
          }, change)
        )
      ),

      // Stats grid - responsive columns
      el('div', { className: 'grid grid-cols-2 gap-3 sm:gap-4' },
        // Market Cap
        el('div', { className: 'space-y-1' },
          el('div', { className: 'text-xs text-gray-400' }, 'Market Cap'),
          el('div', { className: 'text-xs sm:text-sm font-black text-white' }, 
            info.marketCap ? fmtUsd(info.marketCap) : 'N/A')
        ),
        // FDV
        el('div', { className: 'space-y-1' },
          el('div', { className: 'text-xs text-gray-400' }, 'FDV'),
          el('div', { className: 'text-xs sm:text-sm font-black text-white' }, 
            info.fdv ? fmtUsd(info.fdv) : 'N/A')
        ),
        // 24h Volume
        el('div', { className: 'space-y-1' },
          el('div', { className: 'text-xs text-gray-400' }, '24h Volume'),
          el('div', { className: 'text-xs sm:text-sm font-black text-white' }, 
            info.volume24h ? fmtUsd(info.volume24h) : 'N/A')
        ),
        // Liquidity
        el('div', { className: 'space-y-1' },
          el('div', { className: 'text-xs text-gray-400' }, 'Liquidity'),
          el('div', { className: 'text-xs sm:text-sm font-black text-white' }, 
            info.liquidity ? fmtUsd(info.liquidity) : 'N/A')
        )
      ),

      // Description
      el('div', { className: 'text-xs sm:text-sm text-gray-400 leading-relaxed' }, 
        info.name || 'No description available'
      )
    );

    // Right Column - responsive layout
    const rightCol = el('div', { className: 'flex-1 flex flex-col gap-3 sm:gap-4 mt-4 sm:mt-0' },
      // Pair Address
      el('div', { className: 'space-y-2' },
        el('div', { className: 'text-xs text-gray-400' }, 'Pair Address'),
        el('div', { className: 'text-xs font-mono font-black text-white break-all bg-gray-800 p-2 rounded' }, 
          info.pairAddress || 'N/A')
      ),
      
      // Action buttons
      el('div', { className: 'flex flex-wrap gap-2' },
        info.url ? el('a', { 
          href: info.url, 
          target: '_blank',
          className: 'inline-flex items-center px-3 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white text-xs font-semibold no-underline transition-colors'
        }, info.isMoonshot ? '🚀 Moonshot' : '📊 DexScreener') : null,
        el('a', { 
          href: `https://abscan.org/token/${info.address}`, 
          target: '_blank',
          className: 'inline-flex items-center px-3 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white text-xs font-semibold no-underline transition-colors'
        }, '🔍 Explorer')
      ),

      // Moonshot bonding curve progress bar
      info.isMoonshot && info.moonshotProgress ? el('div', { 
        className: 'mt-3 p-3 rounded-lg bg-gray-800'
      },
        el('div', { 
          className: 'flex justify-between items-center mb-2'
        },
          el('span', { className: 'text-xs text-gray-400' }, 'Bonding Curve Progress'),
          el('span', { className: 'text-xs font-black text-yellow-400' }, 
            `${Number(info.moonshotProgress).toFixed(2)}%`)
        ),
        el('div', { 
          className: 'w-full h-2 bg-gray-900 rounded-full overflow-hidden border border-gray-700'
        },
          el('div', { 
            className: 'h-full bg-gradient-to-r from-yellow-400 to-yellow-300 transition-all duration-300 shadow-[0_0_10px_rgba(255,215,0,0.5)]',
            style: { width: `${Math.min(Number(info.moonshotProgress) || 0, 100)}%` }
          })
        )
      ) : null,

      // Additional info - responsive text
      el('div', { className: 'space-y-1.5 text-xs text-gray-400' },
        el('div', {}, `Verified DEX: ${info.dex || 'Unknown'}`),
        el('div', {}, `Is Moonshot Token: ${info.isMoonshot ? 'Yes ✅' : 'No'}`)
      )
    );

    // Responsive wrapper - stacks on mobile, side-by-side on desktop
    const columnsWrapper = el('div', { 
      className: 'flex flex-col sm:flex-row gap-4 sm:gap-6' 
    }, leftCol, rightCol);

    body.appendChild(columnsWrapper);

  } catch (err) {
    console.error('[detailToken] error', err);
    body.innerHTML = '';
    body.appendChild(el('div', { className: 'text-red-400 text-sm' }, 
      `Error loading token details: ${err.message || err}`));
  }
}