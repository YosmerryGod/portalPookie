// components/dashboard/dashboar.js
import { state } from '../../func/state.js';
import { fmt } from '../../func/utils.js';

export const Dashboard = {
  mount(root) {
    root.innerHTML = `
      <section class="space-y-3">
        <div class="rounded-2xl border border-[#1a1f25] bg-[#111418] p-4">
          <h3 class="font-bold mb-2">🔥 Trending Tokens</h3>
          <div id="trendingList" class="space-y-2 text-sm"></div>
        </div>
      </section>
    `;
    const tl = root.querySelector('#trendingList');
    tl.innerHTML = state.trending.map(t => `
      <div class="g-gradient p-[1px] rounded-xl">
        <div class="flex items-center justify-between rounded-[10px] border border-[#1a1f25] bg-[#0b0d0f] p-2">
          <span class="font-semibold">${t.symbol}</span>
          <span class="text-xs ${t.change >= 0 ? 'text-[#3ddc97]' : 'text-[#ff6b6b]'}">
            ${t.change >= 0 ? '+' : ''}${fmt(t.change,1)}%
          </span>
        </div>
      </div>
    `).join('');
  }
};
