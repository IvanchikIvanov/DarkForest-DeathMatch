'use client';

import GameCanvas from '../components/GameCanvas';

export default function Home() {
  return (
    <div className="w-full h-screen flex items-center justify-center bg-zinc-900 text-white overflow-hidden">
      <GameCanvas />
    </div>
  );
}
