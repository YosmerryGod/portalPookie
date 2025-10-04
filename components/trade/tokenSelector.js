// components/trade/tokenSelector.js
import { el } from './dom.js';

// Simple avatar creator (image or initials)
export function createTokenAvatar(token, size = 36) {
  const wrap = el('div', { style: {
    width: `${size}px`, height: `${size}px`, minWidth: `${size}px`,
    borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: Math.max(12, Math.floor(size/2.5)) + 'px', fontWeight: '700',
    overflow: 'hidden', flexShrink: 0, background: '#ddd', color: '#111'
  }});
  if (token && token.icon && (typeof token.icon === 'string')) {
    const img = el('img', { src: token.icon, style: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' }});
    wrap.appendChild(img);
    return wrap;
  }
  const label = (token && token.symbol) ? token.symbol.slice(0,3) : '?';
  wrap.appendChild(document.createTextNode(label));
  return wrap;
}

// Mini token dropdown: avatar + symbol, opens provided tokenModalFactory when clicked
export function createMiniTokenDropdown({ token = null, tokenModalFactory, onSelect }) {
  if (typeof tokenModalFactory !== 'function') {
    throw new Error('tokenModalFactory required');
  }

  // Gaya Tombol Asli (sesuai snippet awal Anda)
  const btnStyle = {
    display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '9px 15px',
    borderRadius: '10px',
    border: `1px solid rgba(255,255,255,0.06)`,
    background: 'transparent',
    cursor: 'pointer', fontWeight: '800', 
    color: '#E8EDF1' // Menggunakan warna teks standar tema (jika tombol di luar input)
  };
  
  const btn = el('button', {
    style: btnStyle,
    onClick: () => {
      const modal = tokenModalFactory((t) => {
        if (typeof onSelect === 'function') onSelect(t);
        modal && modal.remove && modal.remove();
      });
    }
  },
    createTokenAvatar(token || { symbol: 'POOKIE' }, 28),
    el('span', { style: { fontSize: '16px', fontWeight: '800' } }, token ? token.symbol : 'POOKIE')
  );

  return btn;
}