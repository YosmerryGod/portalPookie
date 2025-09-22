export const state = {
  // App routing & session
  route: 'auth',
  connected: false,
  address: null,
  chainId: null,         
  providerType: null,    

  // ===== Portfolio data awal =====
  tokens: [
    { 
      symbol: 'POOKIE', 
      name: 'Pookie Token', 
      address: '0xF0A8cD95Ac4Cb016Bd31335B417e3A1c8aB3Cc91', // <--- tambahkan address di sini
      balance: 1234567.89, 
      decimals: 18, 
      icon: 'assets/pookieLogo.webp', 
      usd: null 
    },
    { 
      symbol: 'ETH',    
      name: 'Ethereum (Abstract)', 
      balance: 12.05, 
      decimals: 18, 
      icon: 'assets/ETH.webp', 
      usd: null 
    },
  ],

  // ===== Mock activity =====
  activity: [
    { type: 'in',  token: 'POOKIE', amount: 100, from: '0x1234...eF90', hash: '0x3a9d9f5c2a0b...001' },
    { type: 'out', token: 'ETH',    amount: 0.25, to:   '0x9F1e...42A7', hash: '0x9c77e5bd83aa...def' },
  ],

  // ===== Trending tokens =====
  trending: [
    { symbol: 'POOKIE', change: +12.4 },
    { symbol: 'ETH',    change: +4.2  },
  ],
};
