// components/wallets/airdrop.js
import { state } from '../../func/state.js';
import { fetchAirdropInfo, claimAirdrop } from '../../func/airdropClaim.js';

export const Airdrop = {
  open: async function() {
    let modal = document.querySelector('#airdropModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'airdropModal';
      modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm';
      document.body.appendChild(modal);
    }

    modal.innerHTML = ''; // bersihkan modal

    // --- Loading overlay --- 
    const loading = document.createElement('div');
    loading.className = 'absolute inset-0 flex items-center justify-center bg-black/50 z-50';
    loading.innerHTML = `
      <div class="relative w-16 h-16">
        <img src="assets/pookieLogo.webp" class="w-16 h-16 rounded-full animate-spin-slow"/>
        <span class="absolute inset-0 rounded-full border-4 border-t-green-400 border-r-yellow-400 animate-spin"></span>
      </div>
    `;
    modal.appendChild(loading);

    // Kontainer utama
    const content = document.createElement('div');
    content.className = 'relative bg-[#0f1115] rounded-2xl w-[420px] border border-[#1f242d] shadow-2xl overflow-hidden z-10';
    modal.appendChild(content);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✖';
    closeBtn.className = 'absolute top-3 right-3 p-1 text-gray-400 hover:text-white hover:bg-gray-700/40 rounded-lg z-20';
    closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
    content.appendChild(closeBtn);

    const innerContent = document.createElement('div');
    innerContent.id = 'airdropContent';
    innerContent.className = 'p-6';
    content.appendChild(innerContent);

    modal.classList.remove('hidden');

    // Mount actual content
    await this.mount(innerContent);

    // Hilangkan loading overlay setelah content siap
    loading.remove();
  },

  mount: async function(root) {
    root.innerHTML = `<div class="py-8 text-center text-sm text-gray-400 animate-pulse">Loading airdrop info...</div>`;

    try {
      let userAddr = state.address || null;
      if (!userAddr && window.ethereum) {
        try {
          const provider = new ethers.BrowserProvider(window.ethereum);
          const accounts = await provider.listAccounts();
          if (accounts?.length) userAddr = accounts[0];
        } catch {}
      }

      const info = await fetchAirdropInfo(userAddr);
      const poolTotal = 50_000_000;
      const distributed = Number(info.totalClaimedStr) || 0;
      const percent = poolTotal > 0 ? Math.min(100, (distributed / poolTotal) * 100) : 0;

      // Build modal content (sama seperti sebelumnya)
      root.innerHTML = '';

      // Header
      const header = document.createElement('div');
      header.className = 'text-center mb-5';
      header.innerHTML = `
        <h2 class="text-2xl font-bold text-white">🎁 Pookie Airdrop</h2>
        <p class="text-sm text-gray-400">Claim your free POOKIE tokens</p>
      `;
      root.appendChild(header);

      // Progress bar
      const progressWrap = document.createElement('div');
      progressWrap.className = 'bg-[#14181d] border border-[#1f242d] rounded-xl p-4 mb-5';
      progressWrap.innerHTML = `
        <div class="flex justify-between text-xs text-gray-400 mb-1">
          <span>${distributed.toLocaleString()} Claimed</span>
          <span>${poolTotal.toLocaleString()} Pool</span>
        </div>
        <div class="w-full h-2 rounded-full bg-gray-700 overflow-hidden">
          <div class="h-2 bg-gradient-to-r from-green-500 to-emerald-600" style="width:${percent}%"></div>
        </div>
      `;
      root.appendChild(progressWrap);

      // Info detail
      const infoWrap = document.createElement('div');
      infoWrap.className = 'space-y-2 mb-4 text-sm';
      infoWrap.innerHTML = `
        <div class="flex justify-between">
          <span class="text-gray-400">Airdrop amount</span>
          <span class="font-semibold text-white">${info.airdropAmountStr} POOKIE</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-400">Contract pool</span>
          <span class="font-semibold text-white">${poolTotal.toLocaleString()} POOKIE</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-400">Airdrop active</span>
          <span class="${info.active ? 'text-green-400' : 'text-red-400'} font-semibold">${info.active ? '✅ Active' : '❌ Inactive'}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-400">Your status</span>
          <span class="${info.userClaimed ? 'text-green-400' : 'text-red-400'} font-semibold">${info.userClaimed ? '✅ Claimed' : '❌ Not claimed'}</span>
        </div>
      `;
      root.appendChild(infoWrap);

      // How to claim toggle
      const howWrap = document.createElement('div');
      howWrap.className = 'mb-4';

      const howBtn = document.createElement('button');
      howBtn.id = 'howToClaimBtn';
      howBtn.className = 'w-full text-left px-3 py-2 bg-[#0b1220] border border-[#1f242d] rounded-lg hover:bg-[#0e1624] transition flex items-center justify-between';
      howBtn.innerHTML = `
        <div>
          <div class="text-sm font-semibold text-indigo-300">📘 How To Claim</div>
          <div class="text-xs text-gray-400">Tap to view step-by-step instructions</div>
        </div>
        <svg id="howToChevron" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400 transition-transform" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clip-rule="evenodd" />
        </svg>
      `;
      howWrap.appendChild(howBtn);

      const howText = document.createElement('div');
      howText.id = 'howToClaimText';
      howText.className = 'mt-3 hidden opacity-0 transform scale-95 transition-all duration-200';
      howText.innerHTML = `
        <div class="bg-[#0e1419] border border-[#1f242d] rounded-lg p-3 text-sm text-gray-300 space-y-2">
          <div>1. Make sure your wallet is connected to this DApp.</div>
          <div>2. Ensure you have enough ETH for gas.</div>
          <div>3. Make sure your wallet is on the ETH Abstract Chain (switch/bridge if needed).</div>
          <div>4. Click the Claim Airdrop button below.</div>
          <div>5. Confirm the transaction in your wallet and wait for confirmation.</div>
          <div>6. After success, tokens will appear in your wallet.</div>
        </div>
      `;
      howWrap.appendChild(howText);

      howBtn.addEventListener('click', () => {
        const isHidden = howText.classList.contains('hidden');
        if (isHidden) {
          howText.classList.remove('hidden');
          requestAnimationFrame(() => {
            howText.classList.remove('opacity-0', 'scale-95');
            howText.classList.add('opacity-100', 'scale-100');
          });
          howBtn.querySelector('svg').style.transform = 'rotate(180deg)';
        } else {
          howText.classList.add('opacity-0', 'scale-95');
          howText.classList.remove('opacity-100', 'scale-100');
          setTimeout(() => howText.classList.add('hidden'), 200);
          howBtn.querySelector('svg').style.transform = '';
        }
      });

      root.appendChild(howWrap);

      // Status and claim button
      const statusDiv = document.createElement('div');
      statusDiv.id = 'airdropStatus';
      statusDiv.className = 'text-xs text-center text-gray-400 mb-3';
      root.appendChild(statusDiv);

      const btn = document.createElement('button');
      btn.id = 'airdropAction';
      btn.className = `w-full py-3 rounded-xl font-semibold transition text-white ${
        info.userClaimed ? 'bg-gray-600 cursor-not-allowed' : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:opacity-90'
      }`;
      btn.textContent = info.userClaimed ? 'Already Claimed' : 'Claim Airdrop';
      root.appendChild(btn);

      btn.addEventListener('click', async () => {
        try {
          if (info.userClaimed) {
            alert('You have already claimed the airdrop.');
            return;
          }
          if (!window.ethereum) {
            alert('Wallet not found. Please open the DApp with your wallet connected.');
            return;
          }
          if (!info.active) {
            alert('Airdrop is not active.');
            return;
          }

          statusDiv.textContent = '⏳ Sending transaction...';
          btn.disabled = true;
          btn.classList.add('opacity-70', 'cursor-not-allowed');

          const res = await claimAirdrop();
          statusDiv.textContent = `✅ Transaction confirmed: ${res.txHash}`;

          setTimeout(() => this.mount(root), 1000);
        } catch (err) {
          console.error('Claim error', err);
          const msg = err?.message || String(err);
          statusDiv.textContent = `❌ Error: ${msg}`;
          alert('Claim failed: ' + msg);
          btn.disabled = false;
          btn.classList.remove('opacity-70', 'cursor-not-allowed');
        }
      });

    } catch (err) {
      console.error('Failed to load airdrop info', err);
      root.innerHTML = `
        <div class="p-6 text-center text-sm text-red-400">
          ⚠️ Failed to load airdrop info: ${err.message || err}
        </div>
      `;
    }
  }
};
