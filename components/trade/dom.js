// components/trade/dom.js
export function el(tag, props = {}, ...children) {
  const element = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (k === 'className') element.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(element.style, v);
    else if (k.startsWith('on') && typeof v === 'function') element.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v !== null && v !== undefined) element.setAttribute(k, v);
  });
  children.flat().forEach(c => {
    if (c == null) return;
    if (typeof c === 'string' || typeof c === 'number') element.appendChild(document.createTextNode(String(c)));
    else if (c instanceof Node) element.appendChild(c);
  });
  return element;
}
