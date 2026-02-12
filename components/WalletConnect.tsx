'use client';

import React from 'react';
import { useAccount, useConnect, useDisconnect, useBalance } from 'wagmi';
import { formatEther } from 'viem';

interface WalletConnectProps {
  onConnect?: (address: string) => void;
  onDisconnect?: () => void;
}

const WalletConnect: React.FC<WalletConnectProps> = ({ onConnect, onDisconnect }) => {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: balance } = useBalance({
    address: address,
    query: { enabled: !!address, refetchInterval: 10000 },
  });

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

  const formatBal = (val: bigint | undefined) => {
    if (val === undefined) return '...';
    const str = formatEther(val);
    // Show up to 5 decimal places
    const parts = str.split('.');
    if (parts.length === 1) return str;
    return parts[0] + '.' + parts[1].slice(0, 5);
  };

  if (isConnected && address) {
    return (
      <div className="flex flex-col items-end gap-1">
        {/* Address row */}
        <div className="flex items-center gap-2 px-3 py-1.5" style={{
          background: 'rgba(0,0,0,0.6)',
          border: '1px solid rgba(0,255,255,0.15)',
          clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))',
        }}>
          <div className="w-2 h-2 rounded-full status-dot" style={{ background: '#39ff14', boxShadow: '0 0 6px #39ff14' }} />
          <p className="font-mono text-[11px] neon-cyan">{formatAddress(address)}</p>
          <button
            onClick={handleDisconnect}
            className="text-[10px] ml-1 cursor-pointer"
            style={{ color: 'rgba(255,23,68,0.6)' }}
            title="Disconnect"
          >
            ✕
          </button>
        </div>
        {/* Balance row */}
        <div className="flex items-center gap-2 px-3 py-1" style={{
          background: 'rgba(0,0,0,0.4)',
          border: '1px solid rgba(0,255,255,0.08)',
        }}>
          <span className="text-[9px] tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>BAL</span>
          <span className="font-mono text-[12px] font-bold neon-green">
            {formatBal(balance?.value)} ETH
          </span>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={handleConnect}
      disabled={isPending}
      className="cyber-btn px-4 py-2 font-bold text-xs tracking-widest cursor-pointer"
    >
      {isPending ? 'CONNECTING...' : 'CONNECT WALLET'}
    </button>
  );
};

export default WalletConnect;
