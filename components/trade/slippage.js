// components/trade/slippage.js
export const Slippage = {
  value: 0.5,
  render() {
    const container = document.createElement('div');
    container.style.cssText = 'margin:10px 0;';

    const label = document.createElement('span');
    label.textContent = `Slippage: ${this.value}% `;
    container.appendChild(label);

    const input = document.createElement('input');
    input.type = 'number';
    input.value = this.value;
    input.min = 0.1;
    input.step = 0.1;
    input.style.cssText = 'width:60px;margin-left:8px;';
    input.onchange = (e) => {
      this.value = parseFloat(e.target.value);
      label.textContent = `Slippage: ${this.value}% `;
    };
    container.appendChild(input);

    return container;
  }
};
