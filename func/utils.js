// func/utils.js
export const $  = (sel, root=document) => root.querySelector(sel);
export const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

/** Formatter lama — dipertahankan agar tidak breaking */
export const fmt = (n, d = 2) => {
  const num = Number(n);
  if (!Number.isFinite(num)) return '—';
  return num.toLocaleString('en-US', { maximumFractionDigits: d });
};

/** ===== Formatter baru (presisi kecil & harga mikro) ===== */

/** Tampilkan jumlah token dengan presisi adaptif.
 *  - angka sangat kecil → '< 0.000001' (default 6 desimal)
 *  - tidak valid → '—'
 */
export function fmtAmount(x, max = 6) {
  const n = Number(x);
  if (!Number.isFinite(n)) return '—';
  if (n === 0) return '0';
  if (n > 0 && n < 10 ** (-max)) {
    return `< ${'0.'.padEnd(max, '0')}1`;
  }
  return n.toLocaleString(undefined, { maximumFractionDigits: max });
}

/** Format harga USD mikro dengan desimal adaptif */
export function fmtPriceUsd(p) {
  const n = Number(p);
  if (!Number.isFinite(n)) return '$-';
  const digits = n >= 1 ? 2 : n >= 0.01 ? 4 : n >= 0.0001 ? 6 : 8;
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: digits })}`;
}

/** Kalikan balance × price → nilai USD (null jika tak valid) */
export function calcUsd(balance, price) {
  const b = Number(balance), p = Number(price);
  if (!Number.isFinite(b) || !Number.isFinite(p)) return null;
  return b * p;
}

/** Format nilai USD, dengan presisi adaptif untuk nilai kecil */
export function fmtUsd(val, bigDigits = 2) {
  if (val == null) return '$-';
  const n = Number(val);
  if (!Number.isFinite(n)) return '$-';
  const digs = n >= 1 ? bigDigits : 4;
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: digs })}`;
}

/** Util kecil tambahan */
export const safeNum = (x, def = null) => {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
};
export const clamp = (x, min, max) => Math.min(Math.max(x, min), max);

/** Clipboard + toast */
export const copyText = async (text) => {
  try { await navigator.clipboard.writeText(text); toast('✅ Disalin'); }
  catch { toast('❌ Gagal menyalin'); }
};

/** Load script sekali */
export const ensureScript = (src) => new Promise((resolve, reject) => {
  if ([...document.scripts].some(s => s.src.includes(src))) return resolve();
  const s = document.createElement('script');
  s.src = src; s.onload = resolve; s.onerror = reject;
  document.head.appendChild(s);
});

/** Toast sederhana */
let toastTimer;
export const toast = (msg) => {
  let t = $('#__toast');
  if (!t) {
    t = document.createElement('div');
    t.id = '__toast';
    t.className = 'fixed left-1/2 -translate-x-1/2 bottom-24 z-[60]';
    t.innerHTML = `<div class="rounded-xl bg-[#111418] border border-[#1a1f25] px-4 py-2 text-sm shadow-glow">${msg}</div>`;
    document.body.appendChild(t);
  } else {
    t.firstElementChild.textContent = msg;
  }
  t.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.style.display = 'none'), 1600);
};
