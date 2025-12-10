import React, { useEffect, useState } from 'react';
import { checkWalletInstalled, connectWallet, disconnectWallet, checkConnection, getCurrentAddress, checkIsSepolia, switchToSepolia } from '../utils/web3';

interface WalletConnectProps {
  onConnect?: (address: string) => void;
  onDisconnect?: () => void;
}

const WalletConnect: React.FC<WalletConnectProps> = ({ onConnect, onDisconnect }) => {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [isSepolia, setIsSepolia] = useState<boolean | null>(null);

  useEffect(() => {
    setInstalled(checkWalletInstalled());
    checkConnection().then((connected) => {
      if (connected) {
        getCurrentAddress().then((addr) => {
          if (addr) {
            setAddress(addr);
            onConnect?.(addr);
          }
        });
      }
    });
    
    // Check network status (but don't auto-switch)
    if (checkWalletInstalled()) {
      checkIsSepolia().then(setIsSepolia);
    }
  }, [onConnect]);

  // Listen for chain changes
  useEffect(() => {
    if (checkWalletInstalled() && window.ethereum) {
      const handleChainChanged = async () => {
        const isSepoliaNetwork = await checkIsSepolia();
        setIsSepolia(isSepoliaNetwork);
        // Just reload on chain change, don't auto-switch (user might have switched intentionally)
        window.location.reload();
      };
      
      window.ethereum.on('chainChanged', handleChainChanged);
      return () => {
        window.ethereum?.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      // Automatically switch to Sepolia if needed (no alerts, just do it)
      const isSepoliaNetwork = await checkIsSepolia();
      if (!isSepoliaNetwork) {
        await switchToSepolia();
        // Wait for network switch
        let attempts = 0;
        while (attempts < 10) {
          await new Promise(resolve => setTimeout(resolve, 500));
          const nowSepolia = await checkIsSepolia();
          if (nowSepolia) {
            setIsSepolia(true);
            break;
          }
          attempts++;
        }
      }

      const addr = await connectWallet();
      if (addr) {
        setAddress(addr);
        setIsSepolia(true);
        onConnect?.(addr);
      }
    } catch (error: any) {
      console.error('Failed to connect wallet:', error);
      // Only show alert if it's a critical error (user rejection is handled silently)
      if (!error.message?.includes('rejected') && !error.message?.includes('User rejected')) {
        alert(error.message || 'Failed to connect wallet');
      }
    } finally {
      setConnecting(false);
    }
  };

  const handleSwitchNetwork = async () => {
    const switched = await switchToSepolia();
    if (switched) {
      setIsSepolia(true);
      // Wait for network switch to complete
      let attempts = 0;
      while (attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 500));
        const nowSepolia = await checkIsSepolia();
        if (nowSepolia) {
          setIsSepolia(true);
          break;
        }
        attempts++;
      }
    }
    // Don't show alert - network switch is handled automatically
  };

  const handleDisconnect = () => {
    disconnectWallet();
    setAddress(null);
    onDisconnect?.();
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (!installed) {
    return (
      <div className="bg-red-900/50 border border-red-700 rounded p-3 text-white text-sm">
        <p className="font-bold mb-1">Web3 Wallet Required</p>
        <p>Please install MetaMask or another Web3 wallet to continue.</p>
        <a 
          href="https://metamask.io/download/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-400 underline mt-2 inline-block"
        >
          Install MetaMask
        </a>
      </div>
    );
  }

  if (address) {
    return (
      <div className="flex items-center gap-2">
        {isSepolia === false && (
          <div className="bg-yellow-900/50 border border-yellow-700 rounded px-3 py-1 mr-2">
            <button
              onClick={handleSwitchNetwork}
              className="text-yellow-300 text-xs hover:text-yellow-200"
            >
              Switch to Sepolia
            </button>
          </div>
        )}
        <div className="flex items-center gap-2 bg-green-900/50 border border-green-700 rounded px-3 py-1.5">
          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
          <p className="text-white font-mono text-xs">{formatAddress(address)}</p>
          <button
            onClick={handleDisconnect}
            className="text-red-400 hover:text-red-300 text-xs ml-1"
            title="Disconnect"
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={handleConnect}
      disabled={connecting}
      className="px-4 py-2 bg-blue-700 hover:bg-blue-600 disabled:bg-gray-600 text-white font-bold rounded text-sm"
    >
      {connecting ? 'Connecting...' : 'Connect Wallet'}
    </button>
  );
};

export default WalletConnect;

