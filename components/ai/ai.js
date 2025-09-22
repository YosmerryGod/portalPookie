// components/ai/ai.js
export const AI = {
  mount(root) {
    root.innerHTML = `
      <section class="space-y-3">
        <div class="rounded-2xl border border-[#1a1f25] bg-[#111418] p-4">
          <h3 class="font-bold mb-2">🧠 Pookie AI</h3>
          <p class="text-sm text-[#9aa4ad]">Analyzer akan hadir di sini.</p>
        </div>
      </section>
    `;
  }
};
