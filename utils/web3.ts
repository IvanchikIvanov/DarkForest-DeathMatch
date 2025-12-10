import { ethers } from 'ethers';

declare global {
  interface Window {
    ethereum?: ethers.Eip1193Provider;
  }
}

export const MIN_BET = ethers.parseEther("0.001");
export const MAX_BET = ethers.parseEther("0.005");
export const SEPOLIA_CHAIN_ID = 11155111n; // Sepolia testnet

export interface Web3State {
  provider: ethers.BrowserProvider | null;
  signer: ethers.JsonRpcSigner | null;
  address: string | null;
  connected: boolean;
}

let web3State: Web3State = {
  provider: null,
  signer: null,
  address: null,
  connected: false,
};

export const getWeb3State = (): Web3State => web3State;

export const checkWalletInstalled = (): boolean => {
  return typeof window !== 'undefined' && typeof window.ethereum !== 'undefined';
};

export const requestAccount = async (): Promise<string | null> => {
  if (!checkWalletInstalled()) {
    throw new Error('MetaMask or other Web3 wallet is not installed');
  }

  try {
    // Check and switch to Sepolia if needed (but don't fail if user rejects)
    const isSepolia = await checkIsSepolia();
    if (!isSepolia) {
      // Try to switch, but don't throw error if user rejects
      await switchToSepolia();
      // Wait a bit for network switch to complete (if user approved)
      let attempts = 0;
      while (attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 500));
        const nowSepolia = await checkIsSepolia();
        if (nowSepolia) {
          break;
        }
        attempts++;
      }
    }

    const provider = new ethers.BrowserProvider(window.ethereum!);
    const accounts = await provider.send('eth_requestAccounts', []);
    
    if (accounts.length === 0) {
      return null;
    }

    const signer = await provider.getSigner();
    const address = await signer.getAddress();

    // Verify network, but don't fail if not on Sepolia (contract is optional now)
    const network = await provider.getNetwork();
    if (network.chainId !== SEPOLIA_CHAIN_ID) {
      // Try to switch again silently
      await switchToSepolia();
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    web3State = {
      provider,
      signer,
      address,
      connected: true,
    };

    return address;
  } catch (error) {
    console.error('Error connecting wallet:', error);
    throw error;
  }
};

export const connectWallet = async (): Promise<string | null> => {
  return await requestAccount();
};

export const disconnectWallet = (): void => {
  web3State = {
    provider: null,
    signer: null,
    address: null,
    connected: false,
  };
};

export const getProvider = (): ethers.BrowserProvider | null => {
  if (web3State.provider) {
    return web3State.provider;
  }

  if (checkWalletInstalled()) {
    const provider = new ethers.BrowserProvider(window.ethereum!);
    web3State.provider = provider;
    return provider;
  }

  return null;
};

export const getSigner = async (): Promise<ethers.JsonRpcSigner | null> => {
  if (web3State.signer) {
    return web3State.signer;
  }

  const provider = getProvider();
  if (!provider) {
    return null;
  }

  try {
    const signer = await provider.getSigner();
    web3State.signer = signer;
    const address = await signer.getAddress();
    web3State.address = address;
    web3State.connected = true;
    return signer;
  } catch (error) {
    console.error('Error getting signer:', error);
    return null;
  }
};

export const getCurrentAddress = async (): Promise<string | null> => {
  if (web3State.address) {
    return web3State.address;
  }

  const signer = await getSigner();
  if (!signer) {
    return null;
  }

  return await signer.getAddress();
};

export const getChainId = async (): Promise<bigint | null> => {
  if (!checkWalletInstalled()) {
    return null;
  }

  try {
    const provider = getProvider();
    if (!provider) {
      return null;
    }

    const network = await provider.getNetwork();
    return network.chainId;
  } catch (error) {
    console.error('Error getting chain ID:', error);
    return null;
  }
};

export const checkIsSepolia = async (): Promise<boolean> => {
  const chainId = await getChainId();
  return chainId === SEPOLIA_CHAIN_ID;
};

export const switchToSepolia = async (): Promise<boolean> => {
  if (!checkWalletInstalled()) {
    return false;
  }

  try {
    // First try to switch to Sepolia
    try {
      await window.ethereum!.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0xaa36a7' }], // Sepolia chain ID in hex
      });
      return true;
    } catch (switchError: any) {
      // Error code 4902 means the chain is not added to MetaMask
      if (switchError.code === 4902) {
        // Add Sepolia network automatically (this will show a popup to user)
        try {
          await window.ethereum!.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: '0xaa36a7',
                chainName: 'Sepolia',
                nativeCurrency: {
                  name: 'ETH',
                  symbol: 'ETH',
                  decimals: 18,
                },
                rpcUrls: ['https://rpc.sepolia.org'],
                blockExplorerUrls: ['https://sepolia.etherscan.io'],
              },
            ],
          });
          // After adding, try to switch again
          try {
            await window.ethereum!.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: '0xaa36a7' }],
            });
            return true;
          } catch (retryError: any) {
            // User might have rejected the switch after adding
            if (retryError.code === 4001) {
              console.log('User rejected switching to Sepolia after adding');
              return false;
            }
            return false;
          }
        } catch (addError: any) {
          // User rejected the request to add network
          if (addError.code === 4001) {
            console.log('User rejected adding Sepolia network');
            return false;
          }
          console.error('Error adding Sepolia network:', addError);
          return false;
        }
      }
      // User rejected the switch request
      if (switchError.code === 4001) {
        console.log('User rejected switching to Sepolia');
        return false;
      }
      // Don't log as error if it's just network not available
      if (switchError.code !== 4902) {
        console.warn('Error switching to Sepolia:', switchError.message || switchError);
      }
      return false;
    }
  } catch (error) {
    console.error('Unexpected error switching to Sepolia:', error);
    return false;
  }
};

export const checkConnection = async (): Promise<boolean> => {
  if (!checkWalletInstalled()) {
    return false;
  }

  try {
    const provider = getProvider();
    if (!provider) {
      return false;
    }

    const accounts = await provider.send('eth_accounts', []);
    if (accounts.length === 0) {
      disconnectWallet();
      return false;
    }

    // Don't auto-switch here, just check connection
    // Auto-switching should only happen when user explicitly connects

    const signer = await getSigner();
    if (signer) {
      const address = await signer.getAddress();
      web3State.address = address;
      web3State.connected = true;
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error checking connection:', error);
    disconnectWallet();
    return false;
  }
};

// Listen for account changes
if (typeof window !== 'undefined' && window.ethereum) {
  window.ethereum.on('accountsChanged', (accounts: string[]) => {
    if (accounts.length === 0) {
      disconnectWallet();
    } else {
      // Reconnect with new account
      requestAccount();
    }
  });

  window.ethereum.on('chainChanged', () => {
    // Reload page on chain change
    window.location.reload();
  });
}

