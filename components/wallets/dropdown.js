// components/wallets/dropdown.js
import { $, $$ } from '../../func/utils.js';

export function bindAddressDropdown(root) {
  const toggle = $('#addrMenuToggle', root);
  const menu   = $('#addrMenu', root);
  if (!toggle || !menu) return () => {};

  const close = () => {
    menu.classList.add('hidden');
    toggle.setAttribute('aria-expanded', 'false');
  };
  const open = () => {
    menu.classList.remove('hidden');
    toggle.setAttribute('aria-expanded', 'true');
  };

  const onToggle = (e) => {
    e.stopPropagation();
    const isOpen = !menu.classList.contains('hidden');
    isOpen ? close() : open();
  };
  const outside = (e) => {
    if (!menu.contains(e.target) && e.target !== toggle) close();
  };

  toggle.onclick = onToggle;
  document.addEventListener('click', outside, { capture: true });

  // return an unsubscribe/cleanup
  return () => document.removeEventListener('click', outside, { capture: true });
}
