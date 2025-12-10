import React, { useState } from 'react';
import { MIN_BET, MAX_BET } from '../utils/web3';
import { ethers } from 'ethers';

interface BetSelectorProps {
  onSelect: (betAmount: bigint) => void;
  disabled?: boolean;
  selectedBet?: bigint | null;
}

const BetSelector: React.FC<BetSelectorProps> = ({ onSelect, disabled = false, selectedBet = null }) => {
  const [selected, setSelected] = useState<bigint | null>(selectedBet);

  const handleSelect = (betAmount: bigint) => {
    if (disabled) return;
    setSelected(betAmount);
    onSelect(betAmount);
  };

  const formatEth = (wei: bigint) => {
    return ethers.formatEther(wei);
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-white text-sm font-bold">Select Bet Amount:</p>
      <div className="flex gap-3">
        <button
          onClick={() => handleSelect(MIN_BET)}
          disabled={disabled}
          className={`flex-1 px-4 py-3 rounded border-2 transition-all ${
            selected === MIN_BET
              ? 'bg-green-700 border-green-500 text-white'
              : 'bg-zinc-800 border-zinc-600 text-gray-300 hover:border-zinc-500'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <div className="font-bold text-lg">{formatEth(MIN_BET)} ETH</div>
          <div className="text-xs mt-1">Low Stake</div>
        </button>
        <button
          onClick={() => handleSelect(MAX_BET)}
          disabled={disabled}
          className={`flex-1 px-4 py-3 rounded border-2 transition-all ${
            selected === MAX_BET
              ? 'bg-green-700 border-green-500 text-white'
              : 'bg-zinc-800 border-zinc-600 text-gray-300 hover:border-zinc-500'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <div className="font-bold text-lg">{formatEth(MAX_BET)} ETH</div>
          <div className="text-xs mt-1">High Stake</div>
        </button>
      </div>
      {selected && (
        <div className="bg-zinc-800/50 border border-zinc-600 rounded p-2 text-xs text-gray-300">
          <p>Selected: <span className="font-bold text-white">{formatEth(selected)} ETH</span></p>
          <p className="mt-1">Winner receives: <span className="font-bold text-green-400">{formatEth(selected * 2n - (selected * 2n * 5n / 100n))} ETH</span> (95%)</p>
          <p>Platform fee: <span className="font-bold text-yellow-400">{formatEth(selected * 2n * 5n / 100n)} ETH</span> (5%)</p>
        </div>
      )}
    </div>
  );
};

export default BetSelector;

