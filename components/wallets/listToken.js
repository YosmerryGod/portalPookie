// components/wallets/listToken.js
import { state } from '../../func/state.js';
import { $, $$, fmtAmount, fmtUsd, calcUsd } from '../../func/utils.js';
import { removeCustomToken } from '../../func/tokens.js';

function pctBadge(pct) {
  if (pct == null || !isFinite(pct)) return '';
  const pos  = Number(pct) >= 0;
  const sign = pos ? '+' : '';
  const cls  = pos
    ? 'bg-emerald-500/10 text-emerald-400'
    : 'bg-rose-500/10 text-rose-400';
  return `<span class="ml-2 inline-flex items-center px-2 py-[1px] rounded-md text-[11px] ${cls}">
    ${sign}${Number(pct).toFixed(2)}%
  </span>`;
}

function safeSymbol(t) {
  const sym = (t.symbol || '').trim();
  if (sym) return sym.toUpperCase();
  const addr = (t.address || '').toLowerCase();
  return addr ? `${addr.slice(0,6)}…${addr.slice(-4)}` : 'TOKEN';
}

// accept image URLs even with query strings
function isImg(src) {
  return typeof src === 'string'
    && (/\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(src) || src.startsWith('http') || src.startsWith('data:image'));
}
function renderIcon(t) {
  const src = t.icon || '';
  if (isImg(src)) {
    return `<img src="${src}" alt="${t.symbol}" class="w-10 h-10 object-contain" />`;
  }
  return `<span class="text-2xl">${t.icon || '🪙'}</span>`;
}

function mountSwipeToDelete(root, onDeleted) {
  // Only active for items with data-addr & data-useradded="1"
  const rows = $$('#tokensSection .token-row', root);

  rows.forEach(row => {
    const canSwipe = row.getAttribute('data-useradded') === '1' && row.getAttribute('data-addr');
    if (!canSwipe) return;

    let startX = 0, currentX = 0, dragging = false;
    const threshold = 96; // px to trigger delete
    const maxShift  = 140;

    const content = row.querySelector('.token-content');
    const trash   = row.querySelector('.token-trash');

    function setX(x) {
      const clamped = Math.max(0, Math.min(x, maxShift));
      content.style.transform = `translateX(${clamped}px)`;
      const opacity = Math.min(1, clamped / threshold);
      trash.style.opacity = opacity;
      trash.style.transform = `scale(${0.9 + 0.1 * opacity})`;
    }

    function onPointerDown(e) {
      dragging = true;
      startX = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
      currentX = startX;
      row.setPointerCapture?.(e.pointerId);
    }

    function onPointerMove(e) {
      if (!dragging) return;
      const x = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
      currentX = x;
      const delta = currentX - startX;
      if (delta > 0) setX(delta);
      else setX(0);
    }

    async function onPointerUp() {
      if (!dragging) return;
      dragging = false;
      const delta = currentX - startX;

      if (delta >= threshold) {
        // delete token
        const addr = row.getAttribute('data-addr');
        try {
          // small animation first
          content.style.transition = 'transform 160ms ease-out';
          setX(maxShift);
          setTimeout(() => {
            content.style.transition = '';
          }, 180);

          removeCustomToken(addr);
          if (typeof onDeleted === 'function') onDeleted(addr);
        } catch (e) {
          console.warn('remove token failed', e);
          // reset position
          content.style.transition = 'transform 180ms ease-out';
          setX(0);
          setTimeout(() => (content.style.transition = ''), 180);
        }
      } else {
        // reset back
        content.style.transition = 'transform 180ms ease-out';
        setX(0);
        setTimeout(() => (content.style.transition = ''), 180);
      }
    }

    // Use Pointer Events (with touch/mouse fallback)
    row.addEventListener('pointerdown', onPointerDown, { passive: true });
    row.addEventListener('pointermove', onPointerMove, { passive: true });
    row.addEventListener('pointerup', onPointerUp, { passive: true });
    row.addEventListener('pointercancel', onPointerUp, { passive: true });
    // iOS Safari touch fallback:
    row.addEventListener('touchstart', onPointerDown, { passive: true });
    row.addEventListener('touchmove', onPointerMove, { passive: true });
    row.addEventListener('touchend', onPointerUp, { passive: true });
  });
}

export const TokenList = {
  mount(root, { onSendToken } = {}) {
    const sec = $('#tokensSection', root);

    // 🚫 exclude USDT
    const tokens = (state.tokens || []).filter(
      t => (t.symbol || '').toUpperCase() !== 'USDT'
    );

    sec.innerHTML = tokens.map(t => {
      const price   = Number(t.usdPrice);
      const bal     = Number(t.balance ?? 0);
      const usdVal  = calcUsd(bal, price);
      const hasUsd  = usdVal != null && Number.isFinite(usdVal);
      const change  = pctBadge(t.change24h);
      const priceLn = Number.isFinite(price) ? fmtUsd(price) : '$-';
      const sym     = safeSymbol(t);

      // small card/badge next to symbol (only if t.card exists)
      const cardHtml = t.card ? `<span class="ml-2 inline-flex items-center px-2 py-[2px] rounded-md text-[11px] border border-[#1f2428] bg-[#0b0f12] text-[#9aa4ad] min-w-[36px] justify-center">${String(t.card)}</span>` : '';

      // enable swipe only if token is user-added and has an address
      const canDelete = t.userAdded && t.address;

      return `
        <div 
          class="relative token-row"
          data-addr="${t.address || ''}"
          data-useradded="${canDelete ? '1' : '0'}"
        >
          <!-- background area with trash icon -->
          <div class="absolute inset-0 rounded-2xl bg-[#12171c] flex items-center pl-4 pointer-events-none">
            <div class="token-trash flex items-center justify-center w-9 h-9 rounded-xl bg-rose-600/20 text-rose-400 border border-rose-700/40 opacity-0 transition-all">
              🗑️
            </div>
          </div>

          <!-- card content (swipeable) -->
          <div class="token-content relative rounded-2xl border border-[#1a1f25] bg-[#111418] p-3 will-change-transform">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-2xl overflow-hidden bg-[#0b0d0f] flex items-center justify-center">
                ${renderIcon(t)}
              </div>

              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between">
                  <!-- left: symbol + card + % + price -->
                  <div class="flex flex-col">
                    <div class="font-semibold flex items-center leading-tight" title="${sym}">
                      ${sym} ${cardHtml} ${change}
                    </div>
                    <div class="text-xs text-[#9aa4ad] leading-tight">${priceLn}</div>
                  </div>

                  <!-- right: Send button + balance + USD -->
                  <div class="text-right">
                    <button 
                      class="px-3 py-1 rounded-xl text-xs border border-[#1a1f25] bg-[#0b0d0f] 
                             hover:border-[#78e08f]" 
                      data-send="${sym}">
                      Send
                    </button>
                    <div class="text-lg font-bold mt-1">${fmtAmount(bal, 6)}</div>
                    <div class="text-sm ${hasUsd ? 'text-[#e8edf1]' : 'text-[#9aa4ad]'}">
                      ${hasUsd ? `≈ ${fmtUsd(usdVal)}` : (bal > 0 ? '≈ $-' : '≈ $0')}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // quick-send
    if (onSendToken) {
      $$('#tokensSection [data-send]', root).forEach(btn => {
        btn.onclick = () => onSendToken(btn.getAttribute('data-send'));
      });
    }

    // enable swipe-to-delete; re-render list after deletion
    mountSwipeToDelete(root, () => {
      this.mount(root, { onSendToken });
    });
  }
};
