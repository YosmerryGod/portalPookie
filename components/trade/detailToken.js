// components/trade/detailToken.js
import { el } from './dom.js';
import { PookieTheme } from './theme.js';
import { getTokenSummary } from '../../func/tokenInformation.js';
import { fmtUsd } from '../../func/utils.js';

/**
 * Show a modal with token details.
 * Accepts either a token address string or a token object { address, symbol, name, icon }
 */
export async function showTokenDetailModal(tokenOrAddress) {
  const theme = PookieTheme;
  const address = (typeof tokenOrAddress === 'string') ? tokenOrAddress : (tokenOrAddress && tokenOrAddress.address) || null;
  const preview = (typeof tokenOrAddress === 'object') ? tokenOrAddress : null;

  const modal = el('div', {
    style: {
      position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.5)', zIndex: 1500,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
    },
    onclick: (e) => { if (e.target === modal) modal.remove(); }
  });

  const content = el('div', {
    style: {
      width: '100%', maxWidth: '720px', borderRadius: '12px', padding: '18px',
      background: theme.bg.card || '#0f0f0f', color: theme.text.primary, boxShadow: theme.shadow.soft
    }
  });

  const header = el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '8px' } },
    el('div', { style: { display: 'flex', gap: '12px', alignItems: 'center' } },
      // Token icon - show image if available, fallback to symbol
      preview?.icon 
        ? el('img', { 
            src: preview.icon, 
            style: { width: '44px', height: '44px', borderRadius: '10px', objectFit: 'cover' },
            onerror: function() { 
              // If image fails, hide it and show fallback
              this.style.display = 'none';
              const fallback = el('div', { 
                style: { 
                  width: '44px', height: '44px', borderRadius: '10px', 
                  background: theme.bg.input, display: 'flex', 
                  alignItems: 'center', justifyContent: 'center', fontWeight: 800 
                } 
              }, (preview?.symbol || 'T').slice(0, 2));
              this.parentElement.insertBefore(fallback, this);
            }
          })
        : el('div', { 
            style: { 
              width: '44px', height: '44px', borderRadius: '10px', 
              background: theme.bg.input, display: 'flex', 
              alignItems: 'center', justifyContent: 'center', fontWeight: 800 
            } 
          }, (preview?.symbol || 'T').slice(0, 2)),
      el('div', { style: { display: 'flex', flexDirection: 'column' } },
        el('div', { style: { fontSize: '16px', fontWeight: 900 } }, preview?.symbol || 'Unknown'),
        el('div', { style: { fontSize: '12px', color: theme.text.muted } }, preview?.name || 'Token')
      )
    ),
    el('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
      el('button', {
        style: { padding: '8px 12px', borderRadius: '8px', border: 'none', background: theme.brand.green, cursor: 'pointer', color: '#fff', fontWeight: 600 },
        onclick: (e) => { 
          const btn = e.target;
          navigator.clipboard?.writeText(address || '')
            .then(() => { 
              const originalText = btn.textContent;
              btn.textContent = 'Copied!';
              btn.style.background = theme.brand.altGreen || '#00ff00';
              setTimeout(() => { 
                btn.textContent = originalText;
                btn.style.background = theme.brand.green;
              }, 1500);
            }) 
            .catch(() => { 
              btn.textContent = 'Failed';
              setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
            }); 
        }
      }, 'Copy Address'),
      el('button', {
        style: { padding: '8px 12px', borderRadius: '8px', border: 'none', background: theme.brand.red, color: '#fff', cursor: 'pointer', fontWeight: 600 },
        onclick: () => modal.remove()
      }, 'Close')
    )
  );

  content.appendChild(header);

  // loading placeholder
  const body = el('div', { style: { minHeight: '120px', display: 'flex', gap: '16px', alignItems: 'flex-start' } },
    el('div', { style: { flex: 1 } },
      el('div', { style: { fontSize: '14px', color: theme.text.muted } }, 'Loading token data...')
    )
  );

  content.appendChild(body);
  modal.appendChild(content);
  document.body.appendChild(modal);

  // If we don't have an address, attempt to use preview.address or fail
  if (!address) {
    body.innerHTML = '';
    body.appendChild(el('div', { style: { color: theme.text.muted } }, 'No token address provided.'));
    return;
  }

  try {
    const info = await getTokenSummary(address);

    if (!info || !info.success) {
      body.innerHTML = '';
      body.appendChild(el('div', { style: { color: theme.text.muted } }, `Failed to load token info: ${info?.error || 'unknown'}`));
      return;
    }

    // Update header icon if we got icon from API
    if (info.icon && !preview?.icon) {
      const headerIcon = header.querySelector('img, div[style*="44px"]');
      if (headerIcon && headerIcon.tagName !== 'IMG') {
        const img = el('img', { 
          src: info.icon, 
          style: { width: '44px', height: '44px', borderRadius: '10px', objectFit: 'cover' },
          onerror: function() { this.style.display = 'none'; }
        });
        headerIcon.replaceWith(img);
      }
    }

    const price = isFinite(info.priceUsd) ? `$${Number(info.priceUsd).toFixed(6)}` : 'N/A';
    const change = isFinite(info.priceChange24h) ? `${info.priceChange24h > 0 ? '+' : ''}${Number(info.priceChange24h).toFixed(2)}%` : 'N/A';

    body.innerHTML = '';

    const leftCol = el('div', { style: { flex: '1 1 55%' } },
      el('div', { style: { display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' } },
        el('div', { style: { display: 'flex', flexDirection: 'column' } },
          el('div', { style: { fontWeight: 900, fontSize: '18px' } }, `${info.name} (${info.symbol})`),
          el('div', { style: { fontSize: '12px', color: theme.text.muted } }, info.address)
        ),
        el('div', { style: { textAlign: 'right' } },
          el('div', { style: { fontWeight: 900, fontSize: '18px' } }, price),
          el('div', { style: { fontSize: '12px', color: info.priceChange24h >= 0 ? theme.brand.altGreen : theme.brand.red } }, change)
        )
      ),

      el('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '14px' } },
        el('div', { style: { fontSize: '12px', color: theme.text.muted } }, 'Market Cap'),
        el('div', { style: { fontSize: '12px', textAlign: 'right', fontWeight: 800 } }, info.marketCap ? fmtUsd(info.marketCap) : 'N/A'),

        el('div', { style: { fontSize: '12px', color: theme.text.muted } }, 'FDV'),
        el('div', { style: { fontSize: '12px', textAlign: 'right', fontWeight: 800 } }, info.fdv ? fmtUsd(info.fdv) : 'N/A'),

        el('div', { style: { fontSize: '12px', color: theme.text.muted } }, '24h Volume'),
        el('div', { style: { fontSize: '12px', textAlign: 'right', fontWeight: 800 } }, info.volume24h ? fmtUsd(info.volume24h) : 'N/A'),

        el('div', { style: { fontSize: '12px', color: theme.text.muted } }, 'Liquidity'),
        el('div', { style: { fontSize: '12px', textAlign: 'right', fontWeight: 800 } }, info.liquidity ? fmtUsd(info.liquidity) : 'N/A')
      ),

      el('div', { style: { marginTop: '14px', fontSize: '13px', color: theme.text.muted } }, 
        info.name || 'No description available'
      )
    );

    const rightCol = el('div', { style: { flex: '1 1 40%', display: 'flex', flexDirection: 'column', gap: '10px' } },
      el('div', { style: { fontSize: '12px', color: theme.text.muted } }, 'Pair Address'),
      el('div', { style: { fontSize: '12px', wordBreak: 'break-all', fontWeight: 800 } }, info.pairAddress || 'N/A'),
      el('div', { style: { display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' } },
        // Dynamic button: Moonshot if isMoonshot, DexScreener otherwise
        info.url ? el('a', { 
          href: info.url, 
          target: '_blank', 
          style: { 
            padding: '8px 10px', 
            borderRadius: '8px', 
            border: 'none', 
            background: theme.brand.green, 
            textDecoration: 'none', 
            color: '#fff', 
            fontWeight: 600,
            fontSize: '12px'
          } 
        }, info.isMoonshot ? 'Moonshot' : 'DexScreener') : null,
        el('a', { 
          href: `https://abscan.org/token/${info.address}`, 
          target: '_blank', 
          style: { 
            padding: '8px 10px', 
            borderRadius: '8px', 
            border: 'none', 
            background: theme.brand.green, 
            textDecoration: 'none', 
            color: '#fff', 
            fontWeight: 600,
            fontSize: '12px'
          } 
        }, 'View on Explorer')
      ),

      // Moonshot bonding curve progress bar
      info.isMoonshot && info.moonshotProgress ? el('div', { 
        style: { 
          marginTop: '12px', 
          padding: '10px', 
          borderRadius: '8px', 
          background: theme.bg.input 
        } 
      },
        el('div', { 
          style: { 
            fontSize: '11px', 
            color: theme.text.muted, 
            marginBottom: '6px',
            display: 'flex',
            justifyContent: 'space-between'
          } 
        },
          el('span', {}, 'Bonding Curve Progress'),
          el('span', { style: { fontWeight: 800, color: '#ffd700' } }, `${Number(info.moonshotProgress).toFixed(2)}%`)
        ),
        el('div', { 
          style: { 
            width: '100%', 
            height: '8px', 
            background: '#1a1a1a', 
            borderRadius: '4px',
            overflow: 'hidden',
            border: '1px solid #333'
          } 
        },
          el('div', { 
            style: { 
              width: `${Math.min(Number(info.moonshotProgress) || 0, 100)}%`, 
              height: '100%', 
              background: 'linear-gradient(90deg, #ffd700 0%, #ffed4e 100%)',
              transition: 'width 0.3s ease',
              boxShadow: '0 0 10px rgba(255, 215, 0, 0.5)'
            } 
          })
        )
      ) : null,

      el('div', { style: { marginTop: '8px', fontSize: '12px', color: theme.text.muted } }, `Verified DEX: ${info.dex || 'Unknown'}`),
      el('div', { style: { marginTop: '6px', fontSize: '12px', color: theme.text.muted } }, `Is Moonshot Token: ${info.isMoonshot ? 'Yes' : 'No'}`)
    );

    body.appendChild(leftCol);
    body.appendChild(rightCol);

  } catch (err) {
    console.error('[detailToken] error', err);
    body.innerHTML = '';
    body.appendChild(el('div', { style: { color: theme.text.muted } }, `Error loading token details: ${err.message || err}`));
  }
}