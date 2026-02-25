'use client';

import React, { useState } from 'react';
import { formatEther } from 'viem';
import { MIN_BET, MAX_BET, TREASURY_FEE_PERCENT } from '../hooks/useDuelArena';

interface BetSelectorProps {
  onSelect: (betAmount: bigint) => void;
  disabled?: boolean;
  selectedBet?: bigint | null;
  showNoStake?: boolean;
}

const BetSelector: React.FC<BetSelectorProps> = ({ onSelect, disabled = false, selectedBet = null, showNoStake = false }) => {
  const [selected, setSelected] = useState<bigint | null>(selectedBet);

  const handleSelect = (betAmount: bigint) => {
    if (disabled) return;
    setSelected(betAmount);
    onSelect(betAmount);
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs tracking-widest uppercase" style={{ color: 'rgba(0,255,255,0.5)' }}>Select Wager</p>
      <div className="flex gap-3 flex-wrap">
        {showNoStake && (
          <button
            onClick={() => handleSelect(0n)}
            disabled={disabled}
            className={`flex-1 min-w-[100px] px-4 py-3 bet-option cursor-pointer ${selected === 0n ? 'bet-option-selected' : ''} ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
          >
            <div className="font-bold text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>0 ETH</div>
            <div className="text-[9px] mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>NO STAKE</div>
          </button>
        )}
        <button
          onClick={() => handleSelect(MIN_BET)}
          disabled={disabled}
          className={`flex-1 px-4 py-3 bet-option cursor-pointer ${
            selected === MIN_BET ? 'bet-option-selected' : ''
          } ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
        >
          <div className="font-bold text-sm neon-cyan">{formatEther(MIN_BET)} ETH</div>
          <div className="text-[9px] mt-1" style={{ color: 'rgba(0,255,255,0.4)' }}>LOW STAKE</div>
        </button>
        <button
          onClick={() => handleSelect(MAX_BET)}
          disabled={disabled}
          className={`flex-1 px-4 py-3 bet-option cursor-pointer ${
            selected === MAX_BET ? 'bet-option-selected' : ''
          } ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
        >
          <div className="font-bold text-sm neon-cyan">{formatEther(MAX_BET)} ETH</div>
          <div className="text-[9px] mt-1" style={{ color: 'rgba(0,255,255,0.4)' }}>HIGH STAKE</div>
        </button>
      </div>
      {selected !== null && selected > 0n && (
        <div className="p-2 text-[9px]" style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,255,255,0.06)' }}>
          <p>Pool: <span className="neon-green font-bold">{formatEther(selected * 2n)} ETH</span></p>
          <p className="mt-0.5">Winner takes: <span className="neon-green font-bold">{formatEther(selected * 2n - (selected * 2n * TREASURY_FEE_PERCENT / 100n))} ETH</span> <span style={{ color: 'rgba(255,255,255,0.25)' }}>(95%)</span></p>
        </div>
      )}
    </div>
  );
};

export default BetSelector;
