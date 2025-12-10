import React from 'react';
import GameCanvas from './components/GameCanvas';

const App: React.FC = () => {
  return (
    <div className="w-full h-screen flex items-center justify-center bg-zinc-900 text-white overflow-hidden">
      <GameCanvas />
    </div>
  );
};

export default App;