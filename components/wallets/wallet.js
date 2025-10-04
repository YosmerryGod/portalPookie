// components/wallets/wallet.js
import { state } from '../../func/state.js';
import { $, $$, copyText, toast } from '../../func/utils.js';
import { addCustomToken } from '../../func/tokens.js';
import { refreshBalances } from '../../func/balance.js';
import { refreshPrices } from '../../func/prices.js';

import { TotalBalance } from './totalBalance.js';
import { bindAddressDropdown } from './dropdown.js';
import { TokenList } from './listToken.js';
import { Activity } from './activity.js';
import { ReceiveModal } from './receive.js';
import { SendModal } from './send.js';
import { Banner } from './banner.js';

export const Wallet = {
  async mount(root) {
    // ---------- Shell ----------
    root.innerHTML = `
      <div id="walletShell">
        <!-- SummaryCard inserted by TotalBalance -->
        <div id="bannerMount" class="mb-3"></div>

        <div id="tabsHead" class="flex items-center justify-between mb-2">
          <nav id="tabsNav" class="grid grid-cols-2 gap-2">
            <button id="tabTokens" class="py-2.5 px-3 rounded-xl border border-[#1a1f25] bg-[#111418] font-semibold">Tokens</button>
            <button id="tabActivity" class="py-2.5 px-3 rounded-xl border border-[#1a1f25] bg-[#111418] text-[#9aa4ad]">Activity</button>
          </nav>
          <button id="btnAddToken" class="py-2 px-3 rounded-xl border border-[#1a1f25] bg-[#0f141a] hover:border-[#78e08f] text-sm">＋ Add Token</button>
        </div>

        <section id="tokensSection" class="space-y-3"></section>
        <section id="activitySection" class="hidden space-y-3"></section>

        <!-- Add Token Modal -->
        <div id="modalAdd" class="fixed inset-0 z-50 hidden">
          <div class="absolute inset-0 bg-black/70" data-close-add></div>
          <div class="absolute inset-x-0 bottom-0 max-w-md mx-auto p-4">
            <div class="rounded-2xl border border-[#1a1f25] bg-[#111418] p-4">
              <div class="flex items-center justify-between mb-3">
                <h3 class="text-lg font-bold">Add Custom Token</h3>
                <button class="p-2 rounded-xl bg-[#0b0d0f] border border-[#1a1f25]" data-close-add>✕</button>
              </div>
              <label class="text-xs text-[#9aa4ad]">Token Contract Address (Abstract)</label>
              <input id="inputTokenAddr" class="w-full mt-1 rounded-xl bg-[#0b0d0f] border border-[#1a1f25] p-3 text-sm outline-none focus:border-[#78e08f]" placeholder="0x..." />
              <div class="flex items-center justify-end gap-2 mt-3">
                <button class="py-2 px-3 rounded-xl border border-[#1a1f25] bg-[#111418]" data-close-add>Cancel</button>
                <button id="confirmAdd" class="py-2 px-3 rounded-xl g-gradient text-black font-semibold">Add Token</button>
              </div>
              <p class="text-[11px] text-[#9a9fa6] mt-3">Make sure the address is an ERC-20 contract on Abstract. Symbol and name will be fetched automatically on-chain.</p>
            </div>
          </div>
        </div>
      </div>
    `;

    // ---------- Summary / Receive / Send ----------
    TotalBalance.mount(root, {
      onReceive: () => ReceiveModal.open(root),
      onSend:    () => SendModal.open(root),
      onCopy:    () => state.address && copyText(state.address),
      onSwitchChain: () => document.dispatchEvent(new CustomEvent('openSwitchChain')),
      onDisconnect:  () => document.dispatchEvent(new CustomEvent('requestDisconnect')),
    });

    // Mount Banner


    // Dropdown
    const cleanupDropdown = bindAddressDropdown(root);
    ReceiveModal.mount(root);
    SendModal.mount(root);

    // ---------- Tabs ----------
    const setTab = (tab) => {
      $('#tokensSection', root).classList.toggle('hidden', tab !== 'tokens');
      $('#activitySection', root).classList.toggle('hidden', tab !== 'activity');
      $('#tabTokens', root).classList.toggle('text-[#9aa4ad]', tab !== 'tokens');
      $('#tabActivity', root).classList.toggle('text-[#9aa4ad]', tab !== 'activity');
      $('#tabTokens', root).classList.toggle('border-[#78e08f]', tab === 'tokens');
      $('#tabActivity', root).classList.toggle('border-[#78e08f]', tab === 'activity');
    };
    $('#tabTokens', root).onclick   = () => setTab('tokens');
    $('#tabActivity', root).onclick = () => setTab('activity');
    setTab('tokens');

    TokenList.mount(root, {
      onSendToken: (symbol) => SendModal.open(root, { preselectSymbol: symbol })
    });
    Activity.mount(root);

    // ---------- Add Token Modal ----------
    const openAdd  = () => $('#modalAdd', root).classList.remove('hidden');
    const closeAdd = () => $('#modalAdd', root).classList.add('hidden');
    $('#btnAddToken', root).onclick = openAdd;
    $$.call(root, '[data-close-add]').forEach(el => el.onclick = closeAdd);

    $('#confirmAdd', root).onclick = async () => {
      const addr = $('#inputTokenAddr', root).value.trim();
      try {
        $('#confirmAdd', root).disabled = true;
        await addCustomToken(addr);
        closeAdd();
        toast('✅ Token added');
        await refreshBalances();
        await refreshPrices();
        TokenList.mount(root, { onSendToken: (s) => SendModal.open(root, { preselectSymbol: s }) });
        this.mount(root);
      } catch (e) {
        toast(`⚠️ ${e.message || e}`);
      } finally {
        $('#confirmAdd', root).disabled = false;
      }
    };

    // ---------- Disconnect SPA ----------
    document.addEventListener('requestDisconnect', async () => {
      const { disconnectWallet } = await import('../../func/wallet.js');
      disconnectWallet();
    });

    // Cleanup
    this._cleanup = () => cleanupDropdown && cleanupDropdown();
  },

  unmount() {
    if (this._cleanup) this._cleanup();
  }
};
