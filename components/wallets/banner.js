// components/wallets/banner.js
import { Airdrop } from './airdrop.js';
import { state } from '../../func/state.js';

export const Banner = {
  mount(root) {
    const sec = document.createElement('section');
    sec.id = 'bannerSection';
    sec.className = 'mb-4';

    sec.innerHTML = `
      <div class="overflow-hidden rounded-2xl">
        <div class="swiper-container relative w-full">
          <div class="swiper-wrapper">
            <div class="swiper-slide">
              <img src="assets/banner/banner1.webp"
                   alt="Banner 1"
                   class="w-full h-auto md:h-40 lg:h-48 object-contain rounded-2xl cursor-pointer" />
            </div>
            <div class="swiper-slide">
              <img src="assets/banner/banner2.webp"
                   alt="Banner 2"
                   class="w-full h-auto md:h-40 lg:h-48 object-contain rounded-2xl" />
            </div>
          </div>

          <!-- Pagination dots -->
          <div class="absolute bottom-2 left-0 right-0 flex justify-center gap-1 z-10">
            <button class="dot w-2 h-2 rounded-full bg-white/40" aria-label="slide-1"></button>
            <button class="dot w-2 h-2 rounded-full bg-white/40" aria-label="slide-2"></button>
          </div>
        </div>
      </div>
    `;

    const shell = root.querySelector('#walletShell');
    if (shell) {
      shell.insertBefore(sec, shell.querySelector('#tabsHead'));
    } else {
      root.appendChild(sec);
    }

    // Slider logic
    const slides = sec.querySelectorAll('.swiper-slide');
    const dots = sec.querySelectorAll('.dot');
    const container = sec.querySelector('.swiper-container');
    let idx = 0;
    let timer = null;

    function showSlide(i) {
      slides.forEach((s, n) => s.classList.toggle('hidden', n !== i));
      dots.forEach((d, n) => {
        d.classList.toggle('bg-white', n === i);
        d.classList.toggle('bg-white/40', n !== i);
      });
      idx = i;
    }

    function startAuto() {
      stopAuto();
      timer = setInterval(() => {
        idx = (idx + 1) % slides.length;
        showSlide(idx);
      }, 5000);
    }

    function stopAuto() {
      if (timer) clearInterval(timer);
      timer = null;
    }

    if (slides.length) {
      slides.forEach((s, n) => { if (n !== 0) s.classList.add('hidden'); });
      showSlide(0);
      startAuto();
    }

    container.addEventListener('mouseenter', stopAuto);
    container.addEventListener('mouseleave', startAuto);

    dots.forEach((dot, n) => dot.addEventListener('click', () => showSlide(n)));

    // Click banner1 to open Airdrop modal
    const banner1Img = sec.querySelector('.swiper-slide:first-child img');
    if (banner1Img) {
      banner1Img.addEventListener('click', () => {
        stopAuto();
        Airdrop.open();

        const modal = document.querySelector('#airdropModal');
        if (!modal) return;

        const observer = new MutationObserver((mutations, obs) => {
          if (modal.classList.contains('hidden')) {
            startAuto();
            obs.disconnect();
          }
        });
        observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
      });
    }
  }
};
