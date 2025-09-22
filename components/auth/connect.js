// components/auth/connect.js
import { connectMetaMask, connectBitget, connectSafePal, connectTrustWallet } from '../../func/wallet.js';

function h(tag, props = {}, ...children) {
  const svgTags = ['svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'g'];
  const isSvg = svgTags.includes(tag);

  const el = isSvg
    ? document.createElementNS('http://www.w3.org/2000/svg', tag)
    : document.createElement(tag);

  if (props.class) el.setAttribute('class', props.class);
  if (props.id) el.id = props.id;

  Object.entries(props).forEach(([k, v]) => {
    if (k.startsWith('on') && typeof v === 'function') {
      el.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (v != null && k !== 'class' && k !== 'id') {
      el.setAttribute(k, v);
    }
  });

  children.flat().forEach(c => {
    if (c == null) return;
    if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  });
  return el;
}

function iconPicture(baseName, alt, size = 'w-6 h-6') {
  const pic = document.createElement('picture');
  const srcWebp = document.createElement('source');
  srcWebp.type = 'image/webp';
  srcWebp.srcset = `./assets/${baseName}.webp`;
  const srcSvg = document.createElement('source');
  srcSvg.type = 'image/svg+xml';
  srcSvg.srcset = `./assets/${baseName}.svg`;
  const img = document.createElement('img');
  img.src = `./assets/${baseName}.svg`;
  img.alt = alt;
  img.className = `${size} object-contain`;
  pic.appendChild(srcWebp);
  pic.appendChild(srcSvg);
  pic.appendChild(img);
  return pic;
}

// tombol wallet gradient → hitam
function walletBtn({ id, label, iconBase, color = '#F6851B', onClick }) {
  const style = `background: linear-gradient(90deg, ${color}, #000000); color: white;`;
  return h('button', {
    id,
    class: `w-full py-3 px-4 rounded-2xl font-semibold flex items-center justify-center gap-3`,
    style,
    onClick
  },
    h('span', { class: 'w-6 h-6 grid place-items-center shrink-0' },
      iconPicture(iconBase, `${label} logo`, 'w-6 h-6')
    ),
    h('span', { class: 'leading-none' }, label)
  );
}

export const Connect = {
  _cleanup: null,

  mount(root, onConnected) {
    const section = h('section', { class: 'max-w-md mx-auto w-full px-4 sm:px-0' });

    const card = h('div', {
      class: 'rounded-2xl border border-[#1a1f25] bg-[#111418] p-5 shadow-glow'
    });

    const header = h('div', { class: 'flex items-center gap-3 mb-4' },
      h('div', { class: 'w-12 h-12 rounded-2xl g-gradient grid place-items-center shrink-0' },
        h('svg', {
          xmlns: 'http://www.w3.org/2000/svg',
          fill: 'none',
          viewBox: '0 0 24 24',
          stroke: 'black',
          'stroke-width': '1.5',
          class: 'w-7 h-7'
        },
          h('path', {
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round',
            d: 'M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3'
          })
        )
      ),
      h('div', { class: 'min-w-0' },
        h('h2', { class: 'text-xl font-bold leading-tight' }, 'Connect Wallet'),
        h('p', { class: 'text-sm text-[#9aa4ad] truncate' }, 'Sign in before using Pookie Wallet')
      )
    );

    // tombol create/import disabled
    const walletActions = h('div', { class: 'flex gap-3 mb-4' },
      h('button', {
        class: 'flex-1 py-3 rounded-2xl border border-[#1a1f25] bg-[#2c2f33] text-sm font-semibold text-[#9aa4ad] cursor-not-allowed',
        disabled: true
      }, h('span', {}, '➕ Create Wallet '), h('span', { class: 'text-[10px] text-[#9aa4ad] ml-1' }, 'SOON')),

      h('button', {
        class: 'flex-1 py-3 rounded-2xl border border-[#1a1f25] bg-[#2c2f33] text-sm font-semibold text-[#9aa4ad] cursor-not-allowed',
        disabled: true
      }, h('span', {}, '📥 Import Wallet '), h('span', { class: 'text-[10px] text-[#9aa4ad] ml-1' }, 'SOON'))
    );

    const separator = h('div', { class: 'relative my-4' },
      h('div', { class: 'absolute inset-0 flex items-center' },
        h('div', { class: 'w-full border-t border-[#1a1f25]' })
      ),
      h('div', { class: 'relative flex justify-center text-xs' },
        h('span', { class: 'px-2 bg-[#111418] text-[#9aa4ad]' }, 'or Connect Wallet')
      )
    );

    const btnWrap = h('div', { class: 'space-y-3' },
      walletBtn({ id: 'btnMM', label: 'MetaMask', iconBase: 'metamaskLogo', color: '#F6851B', onClick: () => connectMetaMask().then(() => onConnected?.()) }),
      walletBtn({ id: 'btnBitget', label: 'Bitget Wallet', iconBase: 'bittgetWalletLogo', color: '#0066FF', onClick: () => connectBitget().then(() => onConnected?.()) }),
      walletBtn({ id: 'btnSafepal', label: 'SafePal', iconBase: 'safepalLogo', color: '#0C65E4', onClick: () => connectSafePal().then(() => onConnected?.()) }),
      walletBtn({ id: 'btnTrust', label: 'TrustWallet', iconBase: 'twtLogo', color: '#337D2D', onClick: () => connectTrustWallet().then(() => onConnected?.()) })
    );

    const tip = h('p', { class: 'text-xs text-[#9aa4ad] mt-4' },
      'Tip: Make sure your wallet extension is active. MetaMask: ',
      h('a', { class: 'g-gradient-text underline', href: 'https://metamask.io/', target: '_blank' }, 'metamask.io'),
      '.'
    );

    card.append(header, walletActions, separator, btnWrap, tip);
    section.appendChild(card);

    root.innerHTML = '';
    root.appendChild(section);
  },

  unmount() {
    if (this._cleanup) {
      try { this._cleanup(); } catch {}
      this._cleanup = null;
    }
  }
};
