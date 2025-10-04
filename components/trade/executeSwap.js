// components/trade/executeSwap.js
export const ExecuteSwap = async ({ fromAmount, toAmount, slippage, address }) => {
  if (!address) {
    alert('Please connect wallet first!');
    return;
  }
  if (!fromAmount || parseFloat(fromAmount) <= 0) {
    alert('Invalid amount');
    return;
  }

  try {
    // TODO: ganti dengan logic DEX/router sesuai jaringan
    console.log('Executing swap:', {
      fromAmount,
      toAmount,
      slippage,
      address
    });
    alert(`Swap submitted!\nAmount: ${fromAmount}\nSlippage: ${slippage}%`);
  } catch (err) {
    console.error(err);
    alert('Swap failed: ' + err.message);
  }
};
