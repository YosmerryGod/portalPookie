// components/wallets/totalBalance.js
import { state } from '../../func/state.js';
import { $, fmtUsd, calcUsd, copyText } from '../../func/utils.js';
import { disconnectWallet } from '../../func/wallet.js';

export const TotalBalance = {
  template() {
    return `
      <section class="rounded-2xl border border-[#1a1f25] bg-[#111418] p-4 mb-5" id="summaryCard">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs text-[#9aa4ad] mb-1">Total Assets (USD)</p>
            <div class="flex items-end gap-2">
              <span id="totalUsd" class="text-2xl font-extrabold">—</span>
            </div>
          </div>

          <!-- Address + dropdown -->
          <div class="relative text-right">
            <p class="text-xs text-[#9aa4ad]">Address</p>
            <div class="inline-flex items-center gap-1">
              <button id="copyAddrTop" class="text-sm g-gradient-text font-semibold" title="Copy address"></button>

              <button id="addrMenuToggle"
                      class="ml-1 p-1 rounded-lg border border-[#1a1f25] bg-[#111418]"
                      aria-haspopup="true" aria-expanded="false" title="More">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <defs>
                    <linearGradient id="addrGrad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                      <stop offset="0" stop-color="#78e08f"/>
                      <stop offset="1" stop-color="#FFD700"/>
                    </linearGradient>
                  </defs>
                  <path d="M6 9l6 6 6-6"
                        stroke="url(#addrGrad)" stroke-width="1.8"
                        stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>

            <!-- Dropdown -->
            <div id="addrMenu"
                 class="hidden absolute right-0 mt-2 w-44 rounded-xl border border-[#1a1f25] bg-[#111418] shadow-lg overflow-hidden z-10">
              <button id="optSwitchChain"
                      class="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-[#0f141a]">
                <span>🔁 Switch Chain</span>
                <span class="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-[#222831] text-[#9aa4ad]">Soon</span>
              </button>
              <button id="optDisconnect"
                      class="w-full text-left px-3 py-2 text-sm text-[#ff6b6b] hover:bg-[#0f141a]">🔌 Disconnect</button>
            </div>
          </div>
        </div>

        <div class="mt-4 grid grid-cols-2 gap-3">
          <button id="btnReceive" class="py-3 rounded-2xl g-gradient text-black font-semibold shadow-glow hover:opacity-95 active:scale-[0.99] transition">Receive ✨</button>
          <button id="btnSend" class="py-3 rounded-2xl g-gradient text-black font-semibold shadow-glow-gold hover:opacity-95 active:scale-[0.99] transition">🚀 Send</button>
        </div>
      </section>
    `;
  },

  mount(root, { onReceive, onSend } = {}) {
    root.insertAdjacentHTML('afterbegin', this.template());

    // Address text
    $('#copyAddrTop', root).textContent = state.address
      ? state.address.slice(0, 6) + '…' + state.address.slice(-4)
      : '—';

    // Total USD
    const totalUsd = state.tokens.reduce((s, t) => s + (calcUsd(t.balance, t.usdPrice) ?? 0), 0);
    $('#totalUsd', root).textContent = Number.isFinite(totalUsd) ? fmtUsd(totalUsd, 2) : '—';

    // Buttons
    if (onReceive) $('#btnReceive', root).onclick = onReceive;
    if (onSend)    $('#btnSend', root).onclick    = onSend;
    $('#copyAddrTop', root).onclick = () => state.address && copyText(state.address);

    // Dropdown handlers
    const toggle = $('#addrMenuToggle', root);
    const menu   = $('#addrMenu', root);

    const close = () => {
      menu.classList.add('hidden');
      toggle.setAttribute('aria-expanded', 'false');
    };
    const open = () => {
      menu.classList.remove('hidden');
      toggle.setAttribute('aria-expanded', 'true');
    };

    toggle.onclick = (e) => {
      e.stopPropagation();
      const isOpen = !menu.classList.contains('hidden');
      isOpen ? close() : open();
    };

    document.addEventListener('click', (e) => {
      if (!menu.contains(e.target) && e.target !== toggle) close();
    }, { capture: true });

    // Menu actions
    $('#optSwitchChain', root).onclick = () => {
      close();
      alert('Switch Chain coming soon ✨');
    };

    $('#optDisconnect', root).onclick = () => {
      close();
      disconnectWallet();
    };
  }
};
