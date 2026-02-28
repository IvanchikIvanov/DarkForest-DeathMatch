'use client';

import { useState } from 'react';
import GameCanvas from '../components/GameCanvas';
import SplashScreen from '../components/SplashScreen';

export default function Home() {
  const [started, setStarted] = useState(false);

  if (!started) {
    return <SplashScreen onStart={() => setStarted(true)} />;
  }

  return (
    <div className="w-full h-screen flex items-center justify-center bg-zinc-900 text-white overflow-hidden">
      <GameCanvas />
    </div>
  );
}
