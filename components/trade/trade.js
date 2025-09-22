// components/trade/trade.js
export const Trade = {
  mount(root) {
    root.innerHTML = `
      <section class="space-y-3">
        <div class="rounded-2xl border border-[#1a1f25] bg-[#111418] p-4">
          <h3 class="font-bold mb-2">♻️ Swap</h3>
          <p class="text-sm text-[#9aa4ad]">Trading akan tersedia di Pookie Swap. Placeholder UI.</p>
          <div class="mt-3 grid grid-cols-1 gap-2">
            <input disabled placeholder="From (token)" class="rounded-xl bg-[#0b0d0f] border border-[#1a1f25] p-3 text-sm" />
            <input disabled placeholder="To (token)"   class="rounded-xl bg-[#0b0d0f] border border-[#1a1f25] p-3 text-sm" />
            <button disabled class="py-2 rounded-xl g-gradient text-black font-semibold opacity-60">Open Pookie Swap</button>
          </div>
        </div>
      </section>
    `;
  }
};
