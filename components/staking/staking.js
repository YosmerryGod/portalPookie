// components/staking/staking.js
export const Staking = {
  mount(root) {
    root.innerHTML = `
      <section class="space-y-3">
        <div class="rounded-2xl border border-[#1a1f25] bg-[#111418] p-4">
          <h3 class="font-bold mb-2">🏦 Staking</h3>
          <p class="text-sm text-[#9aa4ad]">Stake token kamu untuk mendapatkan reward. Placeholder UI.</p>
          <div class="mt-3 grid grid-cols-1 gap-2">
            <input disabled placeholder="Amount to stake" class="rounded-xl bg-[#0b0d0f] border border-[#1a1f25] p-3 text-sm" />
            <div class="grid grid-cols-2 gap-2">
              <button disabled class="py-2 rounded-xl border border-[#1a1f25] bg-[#111418]">Stake</button>
              <button disabled class="py-2 rounded-xl g-gradient text-black font-semibold opacity-60">Unstake</button>
            </div>
          </div>
        </div>
      </section>
    `;
  }
};
