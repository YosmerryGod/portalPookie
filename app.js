// app.js (root)
import { state } from './func/state.js';
import { $ } from './func/utils.js';
import { tryRestoreSession, clearSession } from './func/wallet.js';
import { refreshBalances } from './func/balance.js';
import { refreshPrices } from './func/prices.js';
import { restoreCustomTokens } from './func/tokens.js';
import { refreshActivity } from './func/activity.js';

import { renderHeader } from './app/header.js';
import { renderBottomNav, setActiveNav } from './app/bottomNav.js';

import { Wallet }    from './components/wallets/wallet.js';
import { Dashboard } from './components/dashboard/dashboar.js';
import { Staking }   from './components/staking/staking.js';
import { Connect }   from './components/auth/connect.js';

import { Swap } from './components/trade/swap.js';


// ---------- Global balance loading overlay (like SendModal) ----------
let balanceLoadingEl = null;
let balanceLoadingTextEl = null;
let balanceLoadingDelayTimer = null;
let balanceLoadingLock = 0;

function ensureBalanceOverlay() {
  if (balanceLoadingEl) return;

  const el = document.createElement('div');
  el.id = 'balanceLoading';
  el.className = 'fixed inset-0 z-[60] hidden';
  el.innerHTML = `
    <div class="absolute inset-0 bg-black/60"></div>
    <div class="absolute inset-0 grid place-items-center p-4">
      <div class="rounded-2xl border border-[#1a1f25] bg-[#111418] px-6 py-5 flex flex-col items-center gap-3 shadow-xl">
        <div class="relative w-16 h-16">
          <img src="assets/pookieLogo.webp" alt="Pookie Logo" class="w-16 h-16 rounded-2xl shadow-glow-gold object-contain"/>
          <span class="pointer-events-none absolute inset-0 rounded-2xl border-4 border-transparent border-t-[#78e08f] border-r-[#FFD700] animate-spin"></span>
        </div>
        <p id="balanceLoadingText" class="text-sm text-[#cfd7df]">Updating balances…</p>
      </div>
    </div>
  `;
  document.body.appendChild(el);
  balanceLoadingEl = el;
  balanceLoadingTextEl = el.querySelector('#balanceLoadingText');
}

function showBalanceLoading(text = 'Updating balances…') {
  ensureBalanceOverlay();

  if (balanceLoadingDelayTimer) clearTimeout(balanceLoadingDelayTimer);
  balanceLoadingDelayTimer = setTimeout(() => {
    balanceLoadingEl.classList.remove('hidden');
  }, 200);

  if (balanceLoadingTextEl) balanceLoadingTextEl.textContent = text;
  balanceLoadingLock++;
}

function hideBalanceLoading() {
  if (balanceLoadingDelayTimer) {
    clearTimeout(balanceLoadingDelayTimer);
    balanceLoadingDelayTimer = null;
  }
  balanceLoadingLock = Math.max(0, balanceLoadingLock - 1);
  if (balanceLoadingLock === 0 && balanceLoadingEl) {
    balanceLoadingEl.classList.add('hidden');
  }
}

async function withBalanceLoading(promiseOrFn, text) {
  showBalanceLoading(text);
  try {
    const p = typeof promiseOrFn === 'function' ? promiseOrFn() : promiseOrFn;
    return await p;
  } finally {
    hideBalanceLoading();
  }
}

// ---------- Router table ----------
const routes = {
  auth: {
    mount: (root) => Connect.mount(root, async () => {
      await refreshAll();
      navigate('wallet');
    })
  },
  wallet:    Wallet,
  dashboard: Dashboard,
  swap:      Swap,
  staking:   Staking,
};

// ---------- Auto refresh timer ----------
let refreshTimer = null;
function startAutoRefresh() {
  stopAutoRefresh();
  refreshTimer = setInterval(async () => {
    if (state.connected && state.route === 'wallet') {
      await withBalanceLoading(refreshAll, 'Refreshing wallet…');
    }
  }, 60_000);
}
function stopAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = null;
}

// ---------- Actions ----------
function handleDisconnect() {
  stopAutoRefresh();
  state.connected = false;
  state.address   = null;
  state.chainId   = null;
  clearSession();
  navigate('auth'); // SPA navigation ke Connect
}

// ---------- Navigation ----------
async function navigate(route) {
  state.route = route;

  renderHeader();
  renderBottomNav(navigate);

  const appRoot = $('#app');
  appRoot.innerHTML = '';

  const container = document.createElement('div');
  container.className = "mx-auto w-full px-4 lg:px-0 lg:w-3/5 max-w-[1200px] pb-16";
  appRoot.appendChild(container);

  if (state.connected && route === 'wallet') {
    await withBalanceLoading(refreshAll, 'Updating balances…');
    startAutoRefresh();
  } else {
    stopAutoRefresh();
  }

    // call mount() if component exposes it; otherwise fallback ke render()
  const comp = routes[route];
  if (!comp) {
    console.error('Route not found:', route);
  } else if (typeof comp.mount === 'function') {
    await comp.mount(container);
  } else if (typeof comp.render === 'function') {
    // render may be synchronous; await if it returns a promise
    const r = comp.render(container);
    if (r && typeof r.then === 'function') await r;
  } else {
    console.error('Route component has no mount or render method:', route, comp);
  }


  if (state.connected) setActiveNav(route);
}

// ---------- Helpers ----------
async function refreshAll() {
  try {
    await refreshBalances();
    await refreshPrices();
    await refreshActivity?.();
  } catch (e) {
    console.warn('refreshAll failed:', e);
  }
}

// ---------- Bootstrap ----------
async function start() {
  const restored = await tryRestoreSession();

  try {
    await restoreCustomTokens?.();
  } catch (e) {
    console.warn('restoreCustomTokens failed:', e);
  }

  state.route = restored ? 'wallet' : 'auth';

  const body = document.body;
  body.className = "bg-[#0c0f13] text-white min-h-screen flex flex-col";

  const headerDiv = document.createElement('div');
  headerDiv.id = 'header';
  body.appendChild(headerDiv);

  const appDiv = document.createElement('main');
  appDiv.id = 'app';
  appDiv.className = "flex-1";
  body.appendChild(appDiv);

  const navDiv = document.createElement('div');
  navDiv.id = 'bottomNav';
  body.appendChild(navDiv);

  ensureBalanceOverlay();

  renderHeader();
  renderBottomNav(navigate);

  if (state.route === 'wallet' && restored) {
    await withBalanceLoading(() => navigate(state.route), 'Loading wallet…');
  } else {
    await navigate(state.route);
  }
}

document.addEventListener('DOMContentLoaded', start);

// ---------- Global Events ----------
document.addEventListener('requestDisconnect', handleDisconnect);
document.addEventListener('openSwitchChain', () => {
  alert('🔁 Switch chain: Soon!');
});

// SPA navigation dari provider events
document.addEventListener('navigate', (e) => {
  if (e?.detail) navigate(e.detail);
});
