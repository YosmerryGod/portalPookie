// components/wallets/send.js
import { state } from '../../func/state.js';
import { $, $$, fmtAmount, toast } from '../../func/utils.js';
import { refreshBalances } from '../../func/balance.js';

const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
];

// --- Block explorer helpers (edit base URLs di sini jika perlu) ---
const EXPLORERS = {
  // Ethereum
  1:   'https://etherscan.io/tx/',
  // BSC
  56:  'https://bscscan.com/tx/',
  // Polygon
  137: 'https://polygonscan.com/tx/',
  // Arbitrum One
  42161: 'https://arbiscan.io/tx/',
  // Base
  8453: 'https://basescan.org/tx/',
  // Abstract Mainnet (Chain ID 2741). Ganti ke domain explorer yang kamu pakai jika berbeda.
  2741: 'https://abscan.org/tx/',
};

function getExplorerTxUrl(txHash) {
  // chainId bisa dalam hex (0xab5) atau number. Utamakan state.chainId jika ada.
  let cid = state?.chainId;
  if (typeof cid === 'string' && cid.startsWith('0x')) {
    try { cid = parseInt(cid, 16); } catch { cid = undefined; }
  }
  if (typeof cid !== 'number' && window?.ethereum) {
    // fallback: baca dari provider
    const hex = window.ethereum.chainId;
    if (typeof hex === 'string' && hex.startsWith('0x')) {
      try { cid = parseInt(hex, 16); } catch {}
    }
  }
  const base = EXPLORERS[cid];
  return base ? `${base}${txHash}` : null;
}

export const SendModal = {
  selectedToken: null,
  step: 1,

  // Scanner state
  _scanStream: null,
  _scanRAF: null,

  // ---------- UI helpers ----------
  isImg(src) {
    return typeof src === 'string'
      && (/\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(src) || src.startsWith('http') || src.startsWith('data:image'));
  },
  renderIcon(t) {
    const src = t.icon || '';
    if (this.isImg(src)) return `<img src="${src}" alt="${t.symbol}" class="w-9 h-9 object-contain" />`;
    return `<span class="text-lg">${t.icon || '🪙'}</span>`;
  },

  showLoading(root, on, text = 'Waiting for signature…') {
    const ov = $('#txOverlay', root);
    const st = $('#txStatus', root);
    const link = $('#txLink', root);
    if (!ov) return;
    ov.classList.toggle('hidden', !on);
    if (st) {
      st.textContent = text;
    }
    if (link) {
      link.classList.add('hidden');
      link.removeAttribute('href');
    }
  },
  setStatus(root, text) {
    const st = $('#txStatus', root);
    if (st) st.textContent = text;
  },

  // ---------- EVM helpers ----------
  async getSigner() {
    if (!window?.ethereum) throw new Error('No wallet found. Please use MetaMask or another EIP-1193 wallet.');
    const { ethers } = window;
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer   = await provider.getSigner();
    return { provider, signer };
  },

  async estimateFee(token, to, amountFloat) {
    try {
      const { ethers } = window;
      const { provider, signer } = await this.getSigner();

      let gas;
      if (!token.address) {
        gas = await provider.estimateGas({
          from: await signer.getAddress(),
          to,
          value: ethers.parseEther(String(amountFloat)),
        });
      } else {
        const decimals = Number(token.decimals ?? 18);
        const amount   = ethers.parseUnits(String(amountFloat), decimals);
        const contract = new ethers.Contract(token.address, ERC20_ABI, signer);
        gas = await contract.estimateGas.transfer(to, amount);
      }

      const feeData  = await provider.getFeeData();
      const gasPrice = feeData.gasPrice ?? 0n;  // bigint
      const fee      = gas * gasPrice;
      return `${window.ethers.formatEther(fee)} ETH`;
    } catch (e) {
      console.warn('estimateFee failed', e);
      return '—';
    }
  },

  async sendNative(to, amountFloat, onStatus) {
    const { ethers } = window;
    const { provider, signer } = await this.getSigner();
    const value = ethers.parseEther(String(amountFloat));
    const tx    = await signer.sendTransaction({ to, value });

    onStatus?.(`Submitted: ${tx.hash.slice(0,10)}… waiting confirmation`);
    const receipt = await provider.waitForTransaction(tx.hash, 1);
    return { tx, receipt };
  },

  async sendERC20(token, to, amountFloat, onStatus) {
    const { ethers } = window;
    const { provider, signer } = await this.getSigner();
    const decimals = Number(token.decimals ?? 18);
    const amount   = ethers.parseUnits(String(amountFloat), decimals);
    const contract = new ethers.Contract(token.address, ERC20_ABI, signer);
    const tx = await contract.transfer(to, amount);

    onStatus?.(`Submitted: ${tx.hash.slice(0,10)}… waiting confirmation`);
    const receipt = await provider.waitForTransaction(tx.hash, 1);
    return { tx, receipt };
  },

  // ---------- QR Scanner ----------
  async startScan(root) {
    if (!window.jsQR) {
      toast('QR library not loaded');
      return;
    }
    try {
      const video = $('#scanVideo', root);
      const overlay = $('#scanOverlay', root);
      const closeBtn = $('#scanClose', root);

      // Show modal
      overlay.classList.remove('hidden');

      // Start camera (prefer environment/back camera)
      this._scanStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false
      });
      video.srcObject = this._scanStream;
      await video.play();

      // Start loop
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      const tick = () => {
        if (!video.videoWidth) {
          this._scanRAF = requestAnimationFrame(tick);
          return;
        }
        canvas.width  = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        const qr = window.jsQR(imgData.data, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' });
        if (qr && qr.data) {
          const addr = this._extractAddress(qr.data);
          if (addr) {
            $('#toAddress', root).value = addr;
            toast('Recipient address scanned ✅');
            this.stopScan(root);
            // Trigger validation to enable Review
            const evt = new Event('input', { bubbles: true });
            $('#toAddress', root).dispatchEvent(evt);
            return;
          }
        }
        this._scanRAF = requestAnimationFrame(tick);
      };
      this._scanRAF = requestAnimationFrame(tick);

      closeBtn.onclick = () => this.stopScan(root);
    } catch (err) {
      console.error(err);
      toast('Unable to open camera. Please allow camera permission.');
      this.stopScan(root);
    }
  },

  stopScan(root) {
    const overlay = $('#scanOverlay', root);
    overlay?.classList.add('hidden');
    if (this._scanRAF) cancelAnimationFrame(this._scanRAF);
    this._scanRAF = null;
    if (this._scanStream) {
      this._scanStream.getTracks().forEach(t => t.stop());
      this._scanStream = null;
    }
    const video = $('#scanVideo', root);
    if (video) video.srcObject = null;
  },

  _extractAddress(data) {
    // Support plain address or EIP-681 like "ethereum:0xabc...def?value=..."
    // Try to find a 0x + 40 hex characters sequence.
    const m = String(data).match(/0x[a-fA-F0-9]{40}/);
    return m ? m[0] : null;
  },

  // ---------- Mount ----------
  mount(root) {
    root.insertAdjacentHTML('beforeend', `
      <div id="modalSend" class="fixed inset-0 z-50 hidden">
        <div class="absolute inset-0 bg-black/70" data-close-send></div>
        <div class="absolute inset-x-0 bottom-0 max-w-md mx-auto p-4">
          <div id="sendCard" class="relative rounded-2xl border border-[#1a1f25] bg-[#111418] p-4">

            <!-- TX Loading overlay -->
            <div id="txOverlay" class="hidden absolute inset-0 rounded-2xl bg-black/70 grid place-items-center">
              <div class="flex flex-col items-center gap-2">
                <div class="relative w-16 h-16">
                  <img src="assets/pookieLogo.webp" alt="Pookie Logo" class="w-16 h-16 rounded-2xl shadow-glow-gold object-contain"/>
                  <span class="pointer-events-none absolute inset-0 rounded-2xl border-4 border-transparent border-t-[#78e08f] border-r-[#FFD700] animate-spin"></span>
                </div>
                <p id="txStatus" class="text-sm text-[#cfd7df]">Waiting for signature…</p>
                <a id="txLink" class="text-xs underline text-[#78e08f] hidden" href="#" target="_blank" rel="noopener">View on explorer</a>
              </div>
            </div>

            <!-- QR Scan overlay -->
            <div id="scanOverlay" class="hidden absolute inset-0 rounded-2xl bg-black/80">
              <div class="absolute inset-0 grid place-items-center p-4">
                <div class="w-full max-w-sm rounded-2xl overflow-hidden border border-[#1a1f25] bg-[#0b0d0f]">
                  <div class="flex items-center justify-between px-3 py-2 border-b border-[#1a1f25]">
                    <h4 class="text-sm font-semibold">Scan QR Code</h4>
                    <button id="scanClose" class="px-2 py-1 rounded-lg border border-[#1a1f25] bg-[#111418] hover:bg-[#151a20]">Close</button>
                  </div>
                  <div class="relative">
                    <video id="scanVideo" class="w-full aspect-[3/4] object-cover bg-black"></video>
                    <div class="pointer-events-none absolute inset-0 border-2 border-[#78e08f]/50 rounded-xl m-6"></div>
                  </div>
                  <div class="p-3 text-xs text-[#9aa4ad]">Point the camera at a QR containing an Ethereum address.</div>
                </div>
              </div>
            </div>

            <div class="flex items-center justify-between mb-3">
              <h3 class="text-lg font-bold">Send</h3>
              <button class="p-2 rounded-xl bg-[#0b0d0f] border border-[#1a1f25]" data-close-send>✕</button>
            </div>

            <div class="flex items-center gap-2 mb-4 text-xs">
              <div class="stepDot w-6 h-6 rounded-full grid place-items-center bg-[#0b0d0f] border border-[#1a1f25]">1</div>
              <div class="h-px flex-1 bg-[#1a1f25]"></div>
              <div class="stepDot w-6 h-6 rounded-full grid place-items-center bg-[#0b0d0f] border border-[#1a1f25]">2</div>
              <div class="h-px flex-1 bg-[#1a1f25]"></div>
              <div class="stepDot w-6 h-6 rounded-full grid place-items-center bg-[#0b0d0f] border border-[#1a1f25]">3</div>
            </div>

            <div id="sendStep1" class="space-y-3">
              <p class="text-sm text-[#9aa4ad]">Choose the token you want to send</p>
              <div id="sendTokenGrid" class="grid grid-cols-2 gap-3"></div>
              <button id="toStep2" disabled class="w-full mt-1 py-2 rounded-xl border border-[#1a1f25] bg-[#111418] text-[#9aa4ad]">Continue</button>
            </div>

            <div id="sendStep2" class="hidden space-y-3">
              <div class="rounded-xl border border-[#1a1f25] p-3">
                <label class="text-xs text-[#9aa4ad]">From address</label>
                <div class="font-mono text-sm break-all" id="fromAddr">—</div>
              </div>
              <div class="grid gap-3">
                <div>
                  <label class="text-xs text-[#9aa4ad]">Recipient address</label>
                  <div class="flex gap-2 mt-1">
                    <input id="toAddress" class="flex-1 rounded-xl bg-[#0b0d0f] border border-[#1a1f25] p-3 text-sm outline-none focus:border-[#78e08f]" placeholder="0x… recipient address" />
                    <!-- Scan button with your SVG icon -->
                    <button id="btnScan" aria-label="Scan QR"
                      class="px-3 rounded-xl border border-[#1a1f25] bg-[#111418] hover:border-[#78e08f] grid place-items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5">
                        <path d="M12 9a3.75 3.75 0 1 0 0 7.5A3.75 3.75 0 0 0 12 9Z" />
                        <path fill-rule="evenodd" d="M9.344 3.071a49.52 49.52 0 0 1 5.312 0c.967.052 1.83.585 2.332 1.39l.821 1.317c.24.383.645.643 1.11.71.386.054.77.113 1.152.177 1.432.239 2.429 1.493 2.429 2.909V18a3 3 0 0 1-3 3h-15a3 3 0 0 1-3-3V9.574c0-1.416.997-2.67 2.429-2.909.382-.064.766-.123 1.151-.178a1.56 1.56 0 0 0 1.11-.71l.822-1.315a2.942 2.942 0 0 1 2.332-1.39ZM6.75 12.75a5.25 5.25 0 1 1 10.5 0 5.25 5.25 0 0 1-10.5 0Zm12-1.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clip-rule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div>
                  <label class="text-xs text-[#9aa4ad]">Amount</label>
                  <div class="flex gap-2 mt-1">
                    <input id="sendAmount" type="number" min="0" step="any" class="flex-1 rounded-xl bg-[#0b0d0f] border border-[#1a1f25] p-3 text-sm outline-none focus:border-[#78e08f]" placeholder="0.0" />
                    <button id="btnMax" class="px-3 rounded-xl border border-[#1a1f25] bg-[#111418] hover:border-[#78e08f] text-sm font-semibold">MAX</button>
                  </div>
                  <div class="text-xs text-[#9aa4ad] mt-1" id="availText">Available: —</div>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <button id="backTo1" class="py-2 rounded-xl border border-[#1a1f25] bg-[#111418]">Back</button>
                <button id="toStep3" disabled class="py-2 rounded-xl g-gradient text-black font-semibold">Review</button>
              </div>
            </div>

            <div id="sendStep3" class="hidden space-y-3">
              <div class="rounded-xl border border-[#1a1f25] p-3 text-sm">
                <div class="flex justify-between"><span class="text-[#9aa4ad]">Token</span> <span id="revToken">—</span></div>
                <div class="flex justify-between"><span class="text-[#9aa4ad]">To</span> <span id="revTo">—</span></div>
                <div class="flex justify-between"><span class="text-[#9aa4ad]">Amount</span> <span id="revAmt">—</span></div>
                <div class="flex justify-between"><span class="text-[#9aa4ad]">Estimated Fee</span> <span id="revFee">—</span></div>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <button id="backTo2" class="py-2 rounded-xl border border-[#1a1f25] bg-[#111418]">Back</button>
                <button id="confirmSend" class="py-2 rounded-xl g-gradient text-black font-semibold">Confirm ✨</button>
              </div>
              <p class="text-[11px] text-[#9aa4ad]">Make sure the address is correct. Transactions cannot be reversed.</p>
            </div>
          </div>
        </div>
      </div>
    `);

    $$.call(root, '[data-close-send]').forEach(el => el.onclick = () => this.close(root));
  },

  // ---------- Open ----------
  open(root, { preselectSymbol } = {}) {
    this.step = 1;
    this.selectedToken = null;

    const dots = $$('.stepDot', root);
    const updateDots = () => {
      dots.forEach((d, i) => {
        const active = (i + 1) <= this.step;
        d.style.borderColor = active ? '#78e08f' : '#1a1f25';
        d.style.background  = active ? 'linear-gradient(135deg,#78e08f 0%,#FFD700 100%)' : '#0b0d0f';
        d.style.color       = active ? '#111418' : '#9aa4ad';
      });
      $('#sendStep1', root).classList.toggle('hidden', this.step !== 1);
      $('#sendStep2', root).classList.toggle('hidden', this.step !== 2);
      $('#sendStep3', root).classList.toggle('hidden', this.step !== 3);
    };
    updateDots();

    // Token grid
    const grid = $('#sendTokenGrid', root);
    grid.innerHTML = '';
    state.tokens.forEach((t) => {
      const btn = document.createElement('button');
      btn.className = 'rounded-2xl border border-[#1a1f25] bg-[#0b0d0f] hover:border-[#78e08f] p-3 text-left';
      btn.innerHTML = `
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl overflow-hidden bg-[#111418] grid place-items-center">
            ${this.renderIcon(t)}
          </div>
          <div class="flex-1">
            <div class="font-semibold">${(t.symbol || '').toUpperCase()}</div>
            <div class="text-xs text-[#9aa4ad]">Balance: ${fmtAmount(t.balance ?? 0, 6)}</div>
          </div>
        </div>`;
      btn.onclick = () => {
        this.selectedToken = t;
        $$('#sendTokenGrid > *', root).forEach(c => c.classList.remove('shadow-glow'));
        btn.classList.add('shadow-glow');
        $('#toStep2', root).disabled = false;
      };
      grid.appendChild(btn);
    });

    if (preselectSymbol) {
      const idx = state.tokens.findIndex(t => (t.symbol || '').toUpperCase() === preselectSymbol.toUpperCase());
      const choice = grid.children[idx];
      if (choice) choice.click();
    }

    // Step 2 validation
    const isAddress = (a) => /^0x[a-fA-F0-9]{40}$/.test(a);
    const validate = () => {
      const to  = $('#toAddress', root).value.trim();
      const amt = parseFloat($('#sendAmount', root).value);
      const addrOk = isAddress(to);
      const bal = parseFloat(this.selectedToken?.balance ?? 0);
      const amtOk  = !isNaN(amt) && amt > 0 && this.selectedToken && amt <= bal;
      $('#toStep3', root).disabled = !(addrOk && amtOk);
    };

    $('#toStep2', root).onclick = () => {
      if (!this.selectedToken) return;
      this.step = 2; updateDots();
      $('#fromAddr', root).textContent = state.address || '—';
      $('#availText', root).textContent = `Available: ${fmtAmount(this.selectedToken.balance ?? 0, 6)} ${(this.selectedToken.symbol || '').toUpperCase()}`;
    };
    $('#backTo1', root).onclick = () => { this.step = 1; updateDots(); };

    $('#btnMax', root).onclick = () => {
      if (!this.selectedToken) return;
      $('#sendAmount', root).value = this.selectedToken.balance ?? 0;
      validate();
    };
    $('#toAddress', root).oninput = validate;
    $('#sendAmount', root).oninput = validate;

    // Scan button
    $('#btnScan', root).onclick = () => this.startScan(root);

    $('#toStep3', root).onclick = async () => {
      const to  = $('#toAddress', root).value.trim();
      const amt = parseFloat($('#sendAmount', root).value);
      this.step = 3; updateDots();
      $('#revToken', root).textContent = (this.selectedToken.symbol || '').toUpperCase();
      $('#revTo', root).textContent    = to.length > 20 ? `${to.slice(0, 10)}…${to.slice(-6)}` : to;
      $('#revAmt', root).textContent   = `${fmtAmount(amt, 6)} ${(this.selectedToken.symbol || '').toUpperCase()}`;
      $('#revFee', root).textContent   = await this.estimateFee(this.selectedToken, to, amt);
    };

    $('#backTo2', root).onclick   = () => { this.step = 2; updateDots(); };
    $('#confirmSend', root).onclick = () => this._doConfirm(root);

    $('#modalSend', root).classList.remove('hidden');
  },

  // ---------- Confirm ----------
  async _doConfirm(root) {
    if (!this.selectedToken) return;
    const to  = $('#toAddress', root).value.trim();
    const amt = parseFloat($('#sendAmount', root).value);

    const btn = $('#confirmSend', root);
    const back = $('#backTo2', root);
    const setBusy = (on, msg) => {
      btn.disabled = on; back.disabled = on;
      btn.textContent = on ? 'Sending…' : 'Confirm ✨';
      this.showLoading(root, on, msg ?? (on ? 'Waiting for signature…' : ''));
    };

    try {
      setBusy(true, 'Awaiting wallet signature…');

      let res;
      if (!this.selectedToken.address) {
        res = await this.sendNative(to, amt, (t) => this.setStatus(root, t));
      } else {
        res = await this.sendERC20(this.selectedToken, to, amt, (t) => this.setStatus(root, t));
      }

      if (res?.receipt && (res.receipt.status === 1 || res.receipt.status === 1n)) {
        const txHash = res.tx.hash;
        const link = getExplorerTxUrl(txHash);
        this.setStatus(root, `Confirmed ✅ Block ${res.receipt.blockNumber}`);
        const a = $('#txLink', root);
        if (a && link) {
          a.href = link;
          a.classList.remove('hidden');
        }
        toast(link ? `✅ Success: ${txHash.slice(0, 10)}… (tap to open explorer)` : `✅ Success: ${txHash.slice(0, 10)}…`);
      } else {
        throw new Error('Transaction failed or status unknown');
      }

      try { await refreshBalances(); } catch {}
      setTimeout(() => this.close(root), 900);
    } catch (err) {
      console.error(err);
      const msg = err?.shortMessage || err?.reason || err?.message || String(err);
      this.setStatus(root, `Failed: ${msg}`);
      toast(`❌ Failed: ${msg}`);
    } finally {
      setBusy(false);
      // If scanner was open, ensure camera stops
      this.stopScan(root);
    }
  },

  close(root) {
    $('#modalSend', root).classList.add('hidden');
    // safety: stop camera if any
    this.stopScan(root);
  }
};
