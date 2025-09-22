// app/header.js
import { state } from '../func/state.js';
import { $ } from '../func/utils.js';

export function renderHeader() {
  if (state.route === 'auth') {
    $('#header').innerHTML = '';
    return;
  }

  const isAbstract = (state.chainId || '').toLowerCase() === '0xab5';

  // Reset root
  const headerRoot = $('#header');
  headerRoot.innerHTML = '';

  // Wrapper sticky
  const wrapper = document.createElement('div');
  wrapper.className =
    'w-full sticky top-0 z-50 bg-[#0c0f13]/80 backdrop-blur border-b border-[#1a1f25]';

  // Container responsif: 100% → 80% (md) → 60% (lg)
  const container = document.createElement('div');
  container.className =
    'mx-auto w-full px-4 md:w-4/5 lg:w-3/5 max-w-[1200px]';
  wrapper.appendChild(container);

  // Bar
  const bar = document.createElement('div');
  bar.className = 'h-16 flex items-center justify-between';
  container.appendChild(bar);

  // Kiri: Logo + Title + Badge
  const left = document.createElement('div');
  left.className = 'flex items-center gap-3';
  bar.appendChild(left);

  // Logo
  const logoBox = document.createElement('div');
  logoBox.className = 'relative w-10 h-10 rounded-2xl g-gradient p-[2px] shadow-glow';
  const logoInner = document.createElement('div');
  logoInner.className = 'w-full h-full rounded-2xl bg-[#111418] grid place-items-center overflow-hidden';
  const logoImg = document.createElement('img');
  logoImg.src = 'assets/pookieLogo.webp';
  logoImg.alt = 'Pookie Logo';
  logoImg.className = 'w-8 h-8 object-contain';
  logoInner.appendChild(logoImg);
  logoBox.appendChild(logoInner);
  left.appendChild(logoBox);

  // Title + Network badge
  const titleWrap = document.createElement('div');
  titleWrap.className = 'flex items-baseline gap-2';
  const title = document.createElement('h1');
  title.className = 'text-xl font-bold leading-tight';
  title.textContent = 'Pookie DApp';
  titleWrap.appendChild(title);

  if (state.connected) {
    const badge = document.createElement('span');
    badge.className =
      'text-sm ml-2 px-2 py-0.5 rounded-lg border border-[#1a1f25] bg-[#111418] ' +
      (isAbstract ? 'g-gradient-text font-semibold' : 'text-[#9aa4ad]');
    badge.textContent = isAbstract ? 'Abstract Mainnet (2741)' : `Chain ${state.chainId || '?'}`;
    titleWrap.appendChild(badge);
  }

  left.appendChild(titleWrap);

  // Kanan: (DIHAPUS) — tidak ada address lagi

  // Pasang ke root
  headerRoot.appendChild(wrapper);
}
