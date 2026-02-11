'use client';

import React from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';

interface WalletConnectProps {
  onConnect?: (address: string) => void;
  onDisconnect?: () => void;
}

const WalletConnect: React.FC<WalletConnectProps> = ({ onConnect, onDisconnect }) => {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  React.useEffect(() => {
    if (isConnected && address) {
      onConnect?.(address);
    }
  }, [isConnected, address, onConnect]);

  const handleConnect = () => {
    const connector = connectors[0];
    if (connector) {
      connect({ connector });
    }
  };

  const handleDisconnect = () => {
    disconnect();
    onDisconnect?.();
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
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
      disabled={isPending}
      className="px-4 py-2 bg-blue-700 hover:bg-blue-600 disabled:bg-gray-600 text-white font-bold rounded text-sm"
    >
      {isPending ? 'Connecting...' : 'Connect Wallet'}
    </button>
  );
};

export default WalletConnect;
