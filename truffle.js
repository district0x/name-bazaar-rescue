module.exports = {
  networks: {
    ganache: {
      host: 'localhost',
      port: 8549,
      gas: 6e6,
      gasPrice: 20e9,
      network_id: '*'
    },
    parity: {
      host: 'localhost',
      port: 8545,
      gas: 6e6,
      gasPrice: 6e9,
      network_id: '*'
    }
  },
  mocha: {
    reporter: 'eth-gas-reporter',
    reporterOptions : {
      currency: 'USD',
      gasPrice: 1
    }
  },
/*  solc: {
    optimizer: {
      enabled: true,
      runs: 200
    }
  }*/
};
