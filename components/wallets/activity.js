// components/wallets/activity.js
import { state } from '../../func/state.js';
import { $, fmt } from '../../func/utils.js';
import { refreshActivity } from '../../func/activity.js';

export const Activity = {
  async mount(root) {
    const sec = $('#activitySection', root);

    // Refresh activity before rendering
    try {
      await refreshActivity({}); // you can pass { lookbackBlocks, maxPerToken } if needed
    } catch (e) {
      console.warn('[activity] refresh failed:', e);
    }

    const data = state.activity || [];

    if (!data.length) {
      sec.innerHTML = `
        <div class="rounded-2xl border border-dashed border-[#1a1f25] bg-[#111418] p-6 text-center text-[#9aa4ad]">
          No transactions yet. Pookie is waiting for the token flow 🚀
        </div>`;
      return;
    }

    sec.innerHTML = data.map(a => {
      const isIn = a.type === 'in';
      const txUrl = a.hash && a.hash.startsWith('0x')
        ? `https://abscan.org/tx/${a.hash}` : '#';

      return `
        <div class="rounded-2xl border border-[#1a1f25] bg-[#111418] p-3">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl grid place-items-center ${isIn ? 'bg[rgba(61,220,151,0.12)]' : 'bg[rgba(255,107,107,0.12)]'}">
              ${isIn ? '✅' : '❌'}
            </div>
            <div class="flex-1 text-sm">
              <div class="font-semibold">${isIn ? 'Received' : 'Sent'} ${fmt(a.amount)} ${a.token}</div>
              <div class="text-xs text-[#9aa4ad]">
                ${isIn ? `from ${a.from}` : `to ${a.to || ''}`}
              </div>
            </div>
            <a href="${txUrl}" target="_blank" rel="noopener" class="text-xs g-gradient-text font-semibold">Explorer</a>
          </div>
        </div>
      `;
    }).join('');
  }
};
