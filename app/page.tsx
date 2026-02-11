'use client';

import { useEffect } from 'react';
import { useMiniKit } from '@coinbase/onchainkit/minikit';
import GameCanvas from '../components/GameCanvas';

export default function Home() {
  const { setFrameReady, isFrameReady } = useMiniKit();

  useEffect(() => {
    if (!isFrameReady) {
      setFrameReady();
    }
  }, [setFrameReady, isFrameReady]);

  return (
    <div className="w-full h-screen flex items-center justify-center bg-zinc-900 text-white overflow-hidden">
      <GameCanvas />
    </div>
  );
}
