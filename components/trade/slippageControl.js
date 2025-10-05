// components/trade/slippageControl.js
import { el } from './dom.js';

export function createSlippageControl(stateObj, onChange) {
  // stateObj is object that contains slippage property reference (e.g. Swap._state)
  const container = el('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } });

  const presets = [0.1, 0.5, 1];
  const btns = [];
  presets.forEach(p => {
    const b = el('button', {
      style: {
        padding: '6px 10px', 
        borderRadius: '999px', 
        border: `1px solid #e6e7ea`, 
        cursor: 'pointer',
        background: stateObj.slippage === p ? '#16a34a' : '#f3f4f6', 
        color: stateObj.slippage === p ? '#000000ff' : '#000', 
        fontWeight: 700
      },
      onClick: () => {
        stateObj.slippage = p;
        updateUI();
        if (typeof onChange === 'function') onChange(p);
      }
    }, `${p}%`);
    btns.push(b);
    container.appendChild(b);
  });

  const input = el('input', {
    type: 'number', 
    step: '0.1', 
    min: '0', 
    max: '50', 
    value: stateObj.slippage,
    style: { 
      width: '70px', 
      padding: '6px 8px', 
      borderRadius: '8px', 
      border: `1px solid #e6e7ea`, 
      background: '#f3f4f6', 
      color: '#000' 
    },
    onInput: (e) => {
      const v = Number(e.target.value);
      if (!isNaN(v) && v >= 0 && v <= 50) {
        stateObj.slippage = v;
        updateUI();
        if (typeof onChange === 'function') onChange(v);
      }
    }
  });

  container.appendChild(input);

  function updateUI() {
    btns.forEach((b, i) => {
      const p = presets[i];
      Object.assign(b.style, {
        background: stateObj.slippage === p ? '#16a34a' : '#f3f4f6',
        color: stateObj.slippage === p ? '#fff' : '#000'
      });
    });
    input.value = stateObj.slippage;
  }

  return { node: container, update: updateUI, input };
}