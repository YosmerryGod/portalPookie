// app/bottomNav.js
import { state } from '../func/state.js';
import { $ } from '../func/utils.js';

export function renderBottomNav(navigate) {
  const mount = $('#bottom-nav');
  if (!state.connected) {
    mount.innerHTML = '';
    return;
  }

  mount.innerHTML = `
    <div class="safe-bottom max-w-md mx-auto px-6 pb-3">
      <div class="rounded-2xl border border-[#1a1f25] bg-[#0c1117]/95 backdrop-blur 
                  px-3 py-2 flex items-center justify-between shadow-glow">

        <!-- Dashboard (SOON) -->
        <div class="relative group">
          <button class="navbtn relative flex items-center justify-center w-10 h-10 rounded-xl
                         text-[#9aa4ad] transition" data-soon="true" aria-disabled="true" type="button">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/>
              <path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            </svg>
            <div class="absolute inset-0 flex items-center justify-center rounded-xl 
                        bg-gradient-to-r from-[#78e08f] to-[#FFD700] 
                        text-black text-[10px] font-bold opacity-0 
                        group-hover:opacity-90 transition">Soon</div>
          </button>
        </div>

        <!-- AI (SOON) -->
        <div class="relative group">
          <button class="navbtn relative flex items-center justify-center w-10 h-10 rounded-xl
                         text-[#9aa4ad] transition" data-soon="true" aria-disabled="true" type="button">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 6V2H8"/><path d="M15 11v2"/><path d="M2 12h2"/><path d="M20 12h2"/>
              <path d="M20 16a2 2 0 0 1-2 2H8.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 4 20.286V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z"/>
              <path d="M9 11v2"/>
            </svg>
            <div class="absolute inset-0 flex items-center justify-center rounded-xl 
                        bg-gradient-to-r from-[#78e08f] to-[#FFD700] 
                        text-black text-[10px] font-bold opacity-0 
                        group-hover:opacity-90 transition">Soon</div>
          </button>
        </div>

        <!-- Swap -->
        <button data-route="swap" type="button"
          class="navbtn flex items-center justify-center w-10 h-10 rounded-xl
                 text-[#9aa4ad] hover:text-white transition">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>
          </svg>
        </button>

        <!-- Staking (SOON) -->
        <div class="relative group">
          <button class="navbtn relative flex items-center justify-center w-10 h-10 rounded-xl
                         text-[#9aa4ad] transition" data-soon="true" aria-disabled="true" type="button">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 17h3v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-3a3.16 3.16 0 0 0 2-2h1a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-1a5 5 0 0 0-2-4V3a4 4 0 0 0-3.2 1.6l-.3.4H11a6 6 0 0 0-6 6v1a5 5 0 0 0 2 4v3a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1z"/>
              <path d="M16 10h.01"/><path d="M2 8v1a2 2 0 0 0 2 2h1"/>
            </svg>
            <div class="absolute inset-0 flex items-center justify-center rounded-xl 
                        bg-gradient-to-r from-[#78e08f] to-[#FFD700] 
                        text-black text-[10px] font-bold opacity-0 
                        group-hover:opacity-90 transition">Soon</div>
          </button>
        </div>

        <!-- Wallet -->
        <button data-route="wallet" type="button"
          class="navbtn flex items-center justify-center w-10 h-10 rounded-xl
                 text-[#9aa4ad] hover:text-white transition">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/>
            <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>
          </svg>
        </button>

      </div>
    </div>
  `;

  // hanya tombol routeable yang bisa diklik
  mount.querySelectorAll('.navbtn[data-route]').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.getAttribute('data-route')));
  });

  // blok klik untuk tombol SOON
  mount.querySelectorAll('.navbtn[data-soon="true"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
    }, { capture: true });
  });

  setActiveNav(state.route);
}

function styleBtn(btn, isActive) {
  // reset
  btn.classList.remove(
    'rounded-full', 'w-12', 'h-12', 'g-gradient', 'text-black',
    'shadow-glow-gold', 'border', 'border-[#1a1f25]'
  );
  btn.classList.remove('rounded-xl', 'w-10', 'h-10', 'text-[#9aa4ad]', 'hover:text-white');

  if (isActive) {
    btn.classList.add(
      'rounded-full', 'w-12', 'h-12',
      'g-gradient', 'text-black', 'shadow-glow-gold',
      'border', 'border-[#1a1f25]'
    );
  } else {
    btn.classList.add('rounded-xl', 'w-10', 'h-10', 'text-[#9aa4ad]', 'hover:text-white');
  }
}

export function setActiveNav(route) {
  const mount = $('#bottom-nav');
  if (!mount) return;
  mount.querySelectorAll('.navbtn[data-route]').forEach(btn => {
    const isActive = btn.getAttribute('data-route') === route;
    styleBtn(btn, isActive);
  });
}
