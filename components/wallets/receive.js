// components/wallets/receive.js
import { state } from '../../func/state.js';
import { $, $$, ensureScript, copyText } from '../../func/utils.js';

export const ReceiveModal = {
  mount(root) {
    root.insertAdjacentHTML('beforeend', `
      <div id="modalReceive" class="fixed inset-0 z-50 hidden">
        <div class="absolute inset-0 bg-black/70" data-close-receive></div>
        <div class="absolute inset-x-0 bottom-0 max-w-md mx-auto p-4">
          <div class="rounded-2xl border border-[#1a1f25] bg-[#111418] p-4">
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-lg font-bold">Receive</h3>
              <button class="p-2 rounded-xl bg-[#0b0d0f] border border-[#1a1f25]" data-close-receive>✕</button>
            </div>
            <div class="grid place-items-center mb-3">
              <div id="qrBox" class="p-2 rounded-xl bg-[#0b0d0f] border border-[#1a1f25]"></div>
            </div>
            <div class="rounded-xl bg-[#0b0d0f] border border-[#1a1f25] p-3 font-mono text-sm break-all select-all" id="addrBox">—</div>
            <div class="grid grid-cols-2 gap-3 mt-3">
              <button id="btnCopyAddr" class="py-2 rounded-xl border border-[#1a1f25] bg-[#111418] hover:border-[#78e08f] font-semibold">Copy Address</button>
              <button id="btnShareAddr" class="py-2 rounded-xl border border-[#1a1f25] bg-[#111418] hover:border-[#78e08f] font-semibold">Share</button>
            </div>
            <p class="text-xs text-[#9aa4ad] mt-3">
              Only send assets compatible with Abstract Mainnet to this address 🐴✨
            </p>
          </div>
        </div>
      </div>
    `);

    // Close handlers
    $$.call(root, '[data-close-receive]').forEach(el => el.onclick = () => this.close(root));

    $('#btnCopyAddr', root).onclick = () => {
      if (state.address) copyText(state.address);
    };

    $('#btnShareAddr', root).onclick = async () => {
      if (!state.address) return;
      if (navigator.share) {
        try {
          await navigator.share({ title: 'My Pookie Address', text: state.address });
        } catch {
          /* ignore if user cancels */
        }
      } else {
        copyText(state.address);
      }
    };
  },

  async open(root) {
    if (typeof QRCode === 'undefined') {
      await ensureScript('https://unpkg.com/qrcodejs@1.0.0/qrcode.min.js');
    }
    $('#addrBox', root).textContent = state.address || '—';
    $('#qrBox', root).innerHTML = '';
    if (state.address) {
      // eslint-disable-next-line no-undef
      new QRCode($('#qrBox', root), {
        text: state.address,
        width: 196,
        height: 196,
        colorDark: '#e8edf1',
        colorLight: '#0b0d0f'
      });
    }
    $('#modalReceive', root).classList.remove('hidden');
  },

  close(root) {
    $('#modalReceive', root).classList.add('hidden');
  }
};
