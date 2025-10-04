// components/trade/tokenModal.js
import { el } from './dom.js';
import { refreshPrices } from '../../func/prices.js';
import { probeErc20 } from '../../func/erc20.js';
import { state } from '../../func/state.js';
import { toast } from '../../func/utils.js';
import { getChange24h } from '../../func/prices.js';
import { getTokenSummary } from '../../func/tokenInformation.js';

// LocalStorage key for custom tokens
const CUSTOM_TOKENS_KEY = 'pookie_custom_tokens';

// Load custom tokens from localStorage
function loadCustomTokens() {
  try {
    const saved = localStorage.getItem(CUSTOM_TOKENS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    console.error('[tokenModal] Failed to load custom tokens:', e);
    return [];
  }
}

// Save custom tokens to localStorage
function saveCustomTokens(tokens) {
  try {
    localStorage.setItem(CUSTOM_TOKENS_KEY, JSON.stringify(tokens));
    return true;
  } catch (e) {
    console.error('[tokenModal] Failed to save custom tokens:', e);
    return false;
  }
}

// Add token to localStorage permanently
function addCustomToken(token) {
  const customTokens = loadCustomTokens();
  
  // Check if already exists
  const exists = customTokens.some(t => 
    t.address?.toLowerCase() === token.address?.toLowerCase()
  );
  
  if (!exists) {
    customTokens.push({
      symbol: token.symbol,
      name: token.name,
      address: token.address,
      icon: token.icon || null,
      decimals: token.decimals || 18,
      addedAt: Date.now()
    });
    
    saveCustomTokens(customTokens);
    return true;
  }
  
  return false;
}

// Custom confirmation modal
function createConfirmModal(title, message, onConfirm, onCancel) {
  const confirmModal = el('div', {
    style: {
      position: 'fixed',
      inset: '0',
      background: 'rgba(0,0,0,0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1300,
      padding: '20px'
    }
  });

  const confirmContent = el('div', {
    style: {
      background: '#fff',
      borderRadius: '16px',
      padding: '24px',
      maxWidth: '400px',
      width: '100%',
      boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)'
    }
  },
    el('div', {
      style: {
        fontSize: '18px',
        fontWeight: '700',
        color: '#111',
        marginBottom: '8px'
      }
    }, title),
    el('div', {
      style: {
        fontSize: '14px',
        color: '#6b7280',
        lineHeight: '1.5',
        marginBottom: '20px'
      }
    }, message),
    el('div', {
      style: {
        display: 'flex',
        gap: '12px',
        justifyContent: 'flex-end'
      }
    },
      el('button', {
        style: {
          padding: '10px 20px',
          borderRadius: '8px',
          border: '1px solid #e6e7ea',
          background: '#fff',
          color: '#111',
          fontSize: '14px',
          fontWeight: '600',
          cursor: 'pointer',
          transition: 'all 0.2s'
        },
        onClick: () => {
          confirmModal.remove();
          if (typeof onCancel === 'function') onCancel();
        },
        onmouseenter: (e) => {
          e.target.style.background = '#f9fafb';
        },
        onmouseleave: (e) => {
          e.target.style.background = '#fff';
        }
      }, 'Cancel'),
      el('button', {
        style: {
          padding: '10px 20px',
          borderRadius: '8px',
          border: 'none',
          background: '#DC2626',
          color: '#fff',
          fontSize: '14px',
          fontWeight: '600',
          cursor: 'pointer',
          transition: 'all 0.2s'
        },
        onClick: () => {
          confirmModal.remove();
          if (typeof onConfirm === 'function') onConfirm();
        },
        onmouseenter: (e) => {
          e.target.style.background = '#B91C1C';
        },
        onmouseleave: (e) => {
          e.target.style.background = '#DC2626';
        }
      }, 'Remove')
    )
  );

  confirmModal.appendChild(confirmContent);
  document.body.appendChild(confirmModal);

  return confirmModal;
}

// Create token preview card for import
function createTokenPreviewCard(tokenData, onImport, onCancel) {
  const themeBorder = '#e6e7ea';
  
  const avatar = tokenData.icon 
    ? el('img', { 
        src: tokenData.icon, 
        style: { 
          width: '64px', 
          height: '64px', 
          objectFit: 'cover', 
          borderRadius: '50%',
          border: `2px solid ${themeBorder}`
        } 
      })
    : el('div', { 
        style: { 
          width: '64px', 
          height: '64px', 
          borderRadius: '50%', 
          background: '#ddd', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          color: '#111', 
          fontWeight: '700',
          fontSize: '24px',
          border: `2px solid ${themeBorder}`
        } 
      }, (tokenData.symbol || '?').slice(0, 2));

  const priceChangeVal = tokenData.priceChange24h != null && isFinite(tokenData.priceChange24h) 
    ? tokenData.priceChange24h.toFixed(2) 
    : null;
  const changeColor = (tokenData.priceChange24h != null && tokenData.priceChange24h < 0) ? '#EF4444' : '#10B981';
  const changeBg = (tokenData.priceChange24h != null && tokenData.priceChange24h < 0) ? '#FEE2E2' : '#D1FAE5';

  return el('div', {
    style: {
      padding: '16px',
      border: `2px solid ${themeBorder}`,
      borderRadius: '16px',
      background: '#fafafa',
      marginBottom: '12px'
    }
  },
    el('div', {
      style: {
        display: 'flex',
        gap: '16px',
        alignItems: 'center',
        marginBottom: '16px'
      }
    },
      avatar,
      el('div', {
        style: {
          flex: 1
        }
      },
        el('div', {
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '4px'
          }
        },
          el('span', {
            style: {
              fontSize: '20px',
              fontWeight: '700',
              color: '#111'
            }
          }, tokenData.symbol),
          priceChangeVal ? el('span', {
            style: {
              fontSize: '14px',
              fontWeight: '700',
              color: changeColor,
              padding: '4px 8px',
              borderRadius: '6px',
              background: changeBg
            }
          }, `${priceChangeVal}%`) : null
        ),
        el('div', {
          style: {
            fontSize: '14px',
            color: '#6b7280',
            marginBottom: '4px'
          }
        }, tokenData.name || 'Unknown Token'),
        tokenData.priceUsd ? el('div', {
          style: {
            fontSize: '16px',
            fontWeight: '600',
            color: '#111'
          }
        }, `$${tokenData.priceUsd < 0.01 ? tokenData.priceUsd.toExponential(4) : tokenData.priceUsd.toFixed(6)}`) : null
      )
    ),
    
    tokenData.marketCap || tokenData.volume24h ? el('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '12px',
        padding: '12px',
        background: '#fff',
        borderRadius: '8px',
        marginBottom: '16px',
        fontSize: '13px'
      }
    },
      tokenData.marketCap ? el('div', {},
        el('div', { style: { color: '#6b7280', marginBottom: '4px' } }, 'Market Cap'),
        el('div', { style: { fontWeight: '600', color: '#111' } }, 
          `$${tokenData.marketCap >= 1e6 ? (tokenData.marketCap / 1e6).toFixed(2) + 'M' : tokenData.marketCap.toFixed(0)}`
        )
      ) : null,
      tokenData.volume24h ? el('div', {},
        el('div', { style: { color: '#6b7280', marginBottom: '4px' } }, 'Volume 24h'),
        el('div', { style: { fontWeight: '600', color: '#111' } }, 
          `$${tokenData.volume24h >= 1e6 ? (tokenData.volume24h / 1e6).toFixed(2) + 'M' : tokenData.volume24h.toFixed(0)}`
        )
      ) : null
    ) : null,
    
    el('div', {
      style: {
        fontSize: '12px',
        color: '#6b7280',
        wordBreak: 'break-all',
        marginBottom: '16px',
        padding: '8px',
        background: '#fff',
        borderRadius: '6px',
        fontFamily: 'monospace'
      }
    }, tokenData.address),
    
    el('div', {
      style: {
        display: 'flex',
        gap: '12px'
      }
    },
      el('button', {
        style: {
          flex: 1,
          padding: '12px',
          borderRadius: '10px',
          border: `1px solid ${themeBorder}`,
          background: '#fff',
          color: '#111',
          fontSize: '14px',
          fontWeight: '600',
          cursor: 'pointer',
          transition: 'all 0.2s'
        },
        onClick: onCancel,
        onmouseenter: (e) => {
          e.target.style.background = '#f9fafb';
        },
        onmouseleave: (e) => {
          e.target.style.background = '#fff';
        }
      }, 'Cancel'),
      el('button', {
        style: {
          flex: 1,
          padding: '12px',
          borderRadius: '10px',
          border: 'none',
          background: '#28c76f',
          color: '#fff',
          fontSize: '14px',
          fontWeight: '600',
          cursor: 'pointer',
          transition: 'all 0.2s'
        },
        onClick: onImport,
        onmouseenter: (e) => {
          e.target.style.background = '#24b564';
        },
        onmouseleave: (e) => {
          e.target.style.background = '#28c76f';
        }
      }, 'Import Token')
    )
  );
}

// tokenModalFactory(onSelect) -> creates and appends modal to body; returns modal element
export function tokenModalFactory(onSelect) {
  const themeBorder = '#e6e7ea';

  const modal = el('div', {
    style: {
      position: 'fixed', 
      inset: '0', 
      background: 'rgba(0,0,0,0.45)',
      display: 'flex', 
      alignItems: 'center',
      justifyContent: 'center', 
      zIndex: 1200,
      padding: '20px'
    }
  });

  const content = el('div', {
    style: {
      width: '100%', 
      maxWidth: '560px', 
      maxHeight: '80vh',
      overflow: 'auto',
      background: '#fff', 
      borderRadius: '16px',
      padding: '12px', 
      boxSizing: 'border-box'
    }
  });

  const input = el('input', {
    type: 'search',
    placeholder: 'Search token by name, symbol or paste address...',
    style: {
      width: '100%', 
      padding: '10px 12px', 
      borderRadius: '10px', 
      border: `1px solid ${themeBorder}`, 
      background: '#fafafa', 
      fontSize: '14px',
      color: '#111'
    }
  });

  const closeBtn = el('button', {
    style: { 
      marginLeft: '8px', 
      padding: '10px 12px', 
      borderRadius: '10px', 
      border: 'none', 
      background: '#28c76f', 
      color: '#fff', 
      cursor: 'pointer', 
      fontWeight: '600' 
    },
    onClick: () => modal.remove()
  }, 'Close');

  const header = el('div', { 
    style: { 
      display: 'flex', 
      gap: '8px', 
      marginBottom: '12px', 
      alignItems: 'center' 
    } 
  }, input, closeBtn);

  const listWrap = el('div', { 
    style: { 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '8px', 
      maxHeight: '64vh', 
      overflow: 'auto' 
    } 
  });

  content.appendChild(header);
  content.appendChild(listWrap);
  modal.appendChild(content);
  document.body.appendChild(modal);

  // ✅ CHANGED: Load custom tokens and merge with tokens_trade
  const customTokens = loadCustomTokens();
  if (customTokens.length > 0 && Array.isArray(state.tokens_trade)) {
    customTokens.forEach(ct => {
      const exists = state.tokens_trade.some(t => 
        t.address?.toLowerCase() === ct.address?.toLowerCase()
      );
      if (!exists) {
        state.tokens_trade.push(ct);
      }
    });
  }

  refreshPrices().catch(() => {});

  let fetchingToken = false;
  let currentFetchAddress = null;

  const render = async (q = '') => {
    listWrap.innerHTML = '';
    const ql = (q || '').trim().toLowerCase();
    // ✅ CHANGED: Use tokens_trade
    const tokens = Array.isArray(state.tokens_trade) ? state.tokens_trade.slice() : [];

    const matches = tokens.filter(t => {
      if (!ql) return true;
      const sym = (t.symbol || '').toLowerCase();
      const name = (t.name || '').toLowerCase();
      const addr = (t.address || '').toLowerCase();
      return sym.includes(ql) || name.includes(ql) || addr.includes(ql);
    });

    const isValidAddress = /^0x[0-9a-fA-F]{40}$/.test(ql);

    if (isValidAddress && matches.length === 0 && !fetchingToken) {
      fetchingToken = true;
      currentFetchAddress = ql;
      
      listWrap.appendChild(
        el('div', {
          style: {
            padding: '20px',
            textAlign: 'center',
            color: '#6b7280',
            fontSize: '14px'
          }
        }, 'Fetching token information...')
      );

      try {
        console.log('[tokenModal] Fetching token summary for:', ql);
        const tokenSummary = await getTokenSummary(ql);
        
        if (currentFetchAddress !== ql) {
          fetchingToken = false;
          return;
        }

        if (tokenSummary.success) {
          listWrap.innerHTML = '';
          
          const tokenData = {
            address: ql,
            symbol: tokenSummary.symbol,
            name: tokenSummary.name,
            icon: tokenSummary.icon,
            priceUsd: tokenSummary.priceUsd,
            priceChange24h: tokenSummary.priceChange24h,
            marketCap: tokenSummary.marketCap,
            volume24h: tokenSummary.volume24h,
            decimals: 18
          };

          const previewCard = createTokenPreviewCard(
            tokenData,
            async () => {
              try {
                const meta = await probeErc20(ql).catch(() => null);
                if (meta && meta.decimals) {
                  tokenData.decimals = meta.decimals;
                }

                const tokenObj = {
                  symbol: tokenData.symbol,
                  name: tokenData.name,
                  address: tokenData.address,
                  icon: tokenData.icon,
                  balance: 0,
                  decimals: tokenData.decimals
                };

                // ✅ CHANGED: Add to tokens_trade
                if (Array.isArray(state.tokens_trade)) {
                  const exists = state.tokens_trade.some(t => 
                    t.address?.toLowerCase() === ql.toLowerCase()
                  );
                  if (!exists) {
                    state.tokens_trade.push(tokenObj);
                  }
                }

                const saved = addCustomToken(tokenObj);
                
                if (saved) {
                  toast(`${tokenData.symbol} imported and saved permanently`);
                } else {
                  toast(`${tokenData.symbol} imported (already in list)`);
                }

                window.dispatchEvent(new CustomEvent('tokenImported', { 
                  detail: tokenObj 
                }));

                onSelect(tokenObj);
                modal.remove();
              } catch (err) {
                console.error('[tokenModal] Import error:', err);
                toast('Failed to import token');
              }
            },
            () => {
              input.value = '';
              fetchingToken = false;
              currentFetchAddress = null;
              render('');
            }
          );

          listWrap.appendChild(previewCard);
        } else {
          listWrap.innerHTML = '';
          listWrap.appendChild(
            el('div', {
              style: {
                padding: '20px',
                textAlign: 'center',
                color: '#DC2626',
                fontSize: '14px'
              }
            }, `Failed to fetch token info: ${tokenSummary.error || 'Unknown error'}`)
          );
        }
      } catch (err) {
        console.error('[tokenModal] Fetch error:', err);
        listWrap.innerHTML = '';
        listWrap.appendChild(
          el('div', {
            style: {
              padding: '20px',
              textAlign: 'center',
              color: '#DC2626',
              fontSize: '14px'
            }
          }, 'Error fetching token information')
        );
      } finally {
        fetchingToken = false;
      }

      return;
    }

    if (!isValidAddress || matches.length > 0) {
      fetchingToken = false;
      currentFetchAddress = null;
    }

    for (const t of matches) {
      const avatar = el('div', { 
        style: { 
          width: '40px', 
          height: '40px', 
          borderRadius: '50%', 
          background: '#ddd', 
          flexShrink: 0, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          color: '#111', 
          fontWeight: '700' 
        } 
      },
        (t.icon && typeof t.icon === 'string') 
          ? el('img', { 
              src: t.icon, 
              style: { 
                width: '100%', 
                height: '100%', 
                objectFit: 'cover', 
                borderRadius: '50%' 
              } 
            }) 
          : (t.symbol || '?').slice(0,3)
      );

      const priceChange = getChange24h(t.symbol);
      const priceChangeVal = priceChange != null && isFinite(priceChange) ? priceChange.toFixed(2) : null;
      const changeColor = (priceChange != null && priceChange < 0) ? '#EF4444' : '#10B981';

      // ✅ CHANGED: Protect WETH and ETH from deletion
      const canDelete = t.symbol !== 'ETH' && t.symbol !== 'WETH' && t.symbol !== 'POOKIE';
      const deleteBtn = canDelete ? el('button', {
        style: {
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          border: 'none',
          background: '#FEE2E2',
          color: '#DC2626',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '16px',
          marginLeft: '8px',
          flexShrink: 0,
          transition: 'background 0.2s'
        },
        onClick: (e) => {
          e.stopPropagation();
          createConfirmModal(
            'Remove Token',
            `Are you sure you want to remove ${t.symbol} from your token list? This action cannot be undone.`,
            () => {
              // ✅ CHANGED: Remove from tokens_trade
              if (Array.isArray(state.tokens_trade)) {
                const idx = state.tokens_trade.findIndex(token => 
                  token.address === t.address || token.symbol === t.symbol
                );
                if (idx !== -1) {
                  state.tokens_trade.splice(idx, 1);
                }
              }
              
              const customTokens = loadCustomTokens();
              const filteredTokens = customTokens.filter(ct => 
                ct.address?.toLowerCase() !== t.address?.toLowerCase()
              );
              saveCustomTokens(filteredTokens);
              
              toast(`${t.symbol} removed permanently`);
              render(q);
            }
          );
        },
        onmouseenter: (e) => e.target.style.background = '#FCA5A5',
        onmouseleave: (e) => e.target.style.background = '#FEE2E2'
      }, '🗑️') : null;

      const item = el('button', {
        style: {
          display: 'flex', 
          gap: '12px', 
          alignItems: 'center', 
          padding: '12px',
          border: `1px solid ${themeBorder}`, 
          borderRadius: '12px', 
          background: '#fff', 
          cursor: 'pointer', 
          textAlign: 'left'
        },
        onClick: () => { onSelect(t); modal.remove(); }
      },
        avatar,
        el('div', { style: { flex: '1 1 auto', minWidth: 0 } },
          el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
            el('span', { style: { fontWeight: 700, color: '#111' } }, t.symbol),
            priceChangeVal ? el('span', { 
              style: { 
                fontSize: '12px', 
                fontWeight: 700, 
                color: changeColor,
                padding: '2px 6px',
                borderRadius: '4px',
                background: priceChange < 0 ? '#FEE2E2' : '#D1FAE5'
              } 
            }, `${priceChangeVal}%`) : null
          ),
          el('div', { 
            style: { 
              fontSize: '12px', 
              color: '#6b7280', 
              overflow: 'hidden', 
              textOverflow: 'ellipsis', 
              whiteSpace: 'nowrap' 
            } 
          }, t.name || t.address || '')
        ),
        deleteBtn
      );
      listWrap.appendChild(item);
    }
  };

  render('');

  let debounce = 0;
  input.addEventListener('input', (e) => {
    clearTimeout(debounce);
    debounce = setTimeout(() => render(e.target.value), 300);
  });

  modal.addEventListener('click', (e) => { 
    if (e.target === modal) modal.remove(); 
  });

  return modal;
}