'use client';

import React, { useEffect, useRef, useCallback } from 'react';

interface SplashScreenProps {
  onStart: () => void;
}

interface BloodDrop {
  x: number;
  y: number;
  vy: number;
  size: number;
  length: number;
}

interface BloodPuddle {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  growSpeed: number;
  opacity: number;
}

export default function SplashScreen({ onStart }: SplashScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const particlesRef = useRef<{ x: number; y: number; size: number; vx: number; vy: number; opacity: number }[]>([]);
  const bloodDropsRef = useRef<BloodDrop[]>([]);
  const bloodPuddlesRef = useRef<BloodPuddle[]>([]);
  const kennyRef = useRef({ x: -100, y: 0, speed: 4, active: true, timer: 0 });
  const rafRef = useRef<number | null>(null);

  const handleStart = useCallback(() => {
    onStart();
  }, [onStart]);

  useEffect(() => {
    const onKey = () => handleStart();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleStart]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = 1000;
    const H = 500;
    canvas.width = W;
    canvas.height = H;

    const particles = particlesRef.current;
    if (particles.length === 0) {
      for (let i = 0; i < 70; i++) {
        particles.push({
          x: Math.random() * W,
          y: Math.random() * H,
          size: Math.random() * 2 + 0.5,
          vx: (Math.random() - 0.5) * 1,
          vy: -Math.random() * 1.5 - 0.5,
          opacity: Math.random()
        });
      }
    }

    kennyRef.current = { x: -100, y: H - 50, speed: 4, active: true, timer: 0 };
    bloodDropsRef.current = [];
    bloodPuddlesRef.current = [];

    function drawKenny(x: number, y: number, t: number) {
      ctx.save();
      ctx.translate(x, y);
      const hop = Math.abs(Math.sin(t * 15)) * 10;
      ctx.translate(0, -hop);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#000';
      ctx.fillStyle = '#78350f';
      ctx.beginPath();
      ctx.ellipse(-12, 12, 10, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(12, 12, 10, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(-20, -15, 40, 30, [15, 15, 4, 4]);
      } else {
        ctx.rect(-20, -15, 40, 30);
      }
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#78350f';
      ctx.beginPath();
      ctx.arc(0, -25, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.arc(0, -25, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#7c2d12';
      ctx.beginPath();
      ctx.ellipse(0, -25, 18, 20, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fecaca';
      ctx.beginPath();
      ctx.ellipse(0, -25, 15, 17, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(-6, -28, 8, 10, 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(6, -28, 8, 10, -0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(-4, -28, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(4, -28, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function createBloodDrop() {
      const x = (W / 2 - 400) + Math.random() * 800;
      bloodDropsRef.current.push({
        x,
        y: 180 + Math.random() * 60,
        vy: 2 + Math.random() * 3,
        size: 3 + Math.random() * 3,
        length: 8 + Math.random() * 12
      });
    }

    function drawLogoText(t: number) {
      ctx.save();
      ctx.translate(W / 2, H / 2 - 20);
      const flicker = Math.random() > 0.98 ? 0.8 : 1;
      ctx.shadowBlur = 50 * flicker;
      ctx.shadowColor = 'rgba(153, 27, 27, 0.9)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '145px "Arial Black"';
      ctx.fillStyle = '#0f172a';
      ctx.fillText('DarkForest', 0, 0);
      const grad = ctx.createLinearGradient(0, -60, 0, 60);
      grad.addColorStop(0, '#1e293b');
      grad.addColorStop(0.3, '#450a0a');
      grad.addColorStop(0.7, '#991b1b');
      grad.addColorStop(1, '#450a0a');
      ctx.fillStyle = grad;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 5;
      ctx.strokeText('DarkForest', 0, 0);
      ctx.fillText('DarkForest', 0, 0);
      ctx.restore();
    }

    function update() {
      ctx.clearRect(0, 0, W, H);

      const bgGrad = ctx.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, 600);
      bgGrad.addColorStop(0, '#0f172a');
      bgGrad.addColorStop(1, '#020617');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      for (const p of particles) {
        p.y += p.vy;
        p.x += p.vx;
        if (p.y < -20) {
          p.y = H + 20;
          p.x = Math.random() * W;
        }
        ctx.fillStyle = `rgba(30, 41, 59, ${p.opacity})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      const bloodPuddles = bloodPuddlesRef.current;
      for (let i = bloodPuddles.length - 1; i >= 0; i--) {
        const p = bloodPuddles[i];
        p.radius += p.growSpeed;
        p.opacity -= 0.002;
        if (p.radius > p.maxRadius) p.growSpeed = 0;
        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = '#7f1d1d';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.radius, p.radius * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        if (p.opacity <= 0) bloodPuddles.splice(i, 1);
      }

      if (Math.random() > 0.82) createBloodDrop();

      const bloodDrops = bloodDropsRef.current;
      for (let i = bloodDrops.length - 1; i >= 0; i--) {
        const d = bloodDrops[i];
        d.y += d.vy;
        ctx.fillStyle = '#991b1b';
        ctx.beginPath();
        ctx.moveTo(d.x - d.size / 2, d.y - d.length);
        ctx.lineTo(d.x + d.size / 2, d.y - d.length);
        ctx.lineTo(d.x, d.y);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
        ctx.fill();
        if (d.y > H - 15) {
          bloodPuddles.push({
            x: d.x,
            y: d.y,
            radius: 2,
            maxRadius: 10 + Math.random() * 20,
            growSpeed: 0.2,
            opacity: 1.0
          });
          bloodDrops.splice(i, 1);
        }
      }

      const kenny = kennyRef.current;
      if (kenny.active) {
        kenny.x += kenny.speed;
        if (kenny.x > W + 100) {
          kenny.active = false;
          kenny.timer = 0;
        }
        drawKenny(kenny.x, kenny.y, frameRef.current);
      } else {
        kenny.timer += 0.016;
        if (kenny.timer > 4) {
          kenny.x = -100;
          kenny.active = true;
        }
      }

      drawLogoText(frameRef.current);
      frameRef.current += 0.016;
      rafRef.current = requestAnimationFrame(update);
    }

    update();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div
      className="min-h-screen bg-[#020617] text-slate-100 flex flex-col items-center justify-center overflow-hidden cursor-pointer"
      onClick={handleStart}
      onKeyDown={handleStart}
      role="button"
      tabIndex={0}
      style={{ fontFamily: "'Arial Black', sans-serif" }}
    >
      <canvas
        ref={canvasRef}
        className="bg-[#020617] border-4 border-slate-800 rounded-2xl"
        style={{ maxWidth: '95vw', boxShadow: '0 0 100px rgba(153, 27, 27, 0.3)' }}
      />
      <div
        className="mt-8 text-xl font-bold uppercase animate-pulse"
        style={{ color: '#475569', letterSpacing: '0.2em', animationDuration: '2s' }}
      >
        Press Start to Play
      </div>
    </div>
  );
}
