// components/trade/listToken.js
export const TokenListModal = {
  tokens: [
    { symbol: 'POOKIE', address: '0x...' },
    { symbol: 'EDGE', address: '0x...' }
  ],

  render() {
    const container = document.createElement('div');
    container.style.cssText = 'margin-top:12px;';

    const btn = document.createElement('button');
    btn.textContent = 'Select Token';
    btn.style.cssText = 'padding:8px 12px;background:#444;color:#fff;border-radius:8px;border:none;cursor:pointer;';
    btn.onclick = () => this.show();
    container.appendChild(btn);

    return container;
  },

  show() {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position:fixed;top:0;left:0;width:100%;height:100%;
      background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;
    `;

    const content = document.createElement('div');
    content.style.cssText = 'background:#111;padding:20px;border-radius:12px;width:300px;max-height:400px;overflow:auto;';

    this.tokens.forEach(t => {
      const row = document.createElement('div');
      row.textContent = `${t.symbol} (${t.address.slice(0,6)}...)`;
      row.style.cssText = 'padding:6px;cursor:pointer;';
      row.onclick = () => {
        alert(`Selected ${t.symbol}`);
        document.body.removeChild(modal);
      };
      content.appendChild(row);
    });

    // Input custom token
    const input = document.createElement('input');
    input.placeholder = 'Paste token address';
    input.style.cssText = 'width:100%;margin-top:12px;padding:8px;';
    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        this.tokens.push({ symbol: 'Custom', address: input.value });
        alert(`Imported token ${input.value}`);
        document.body.removeChild(modal);
      }
    };
    content.appendChild(input);

    modal.appendChild(content);
    document.body.appendChild(modal);
  }
};
