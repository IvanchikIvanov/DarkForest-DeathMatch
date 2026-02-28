'use client';

import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';

export interface MenuBackgroundCanvasRef {
  spawnSplatter: (x: number, y: number) => void;
}

const MenuBackgroundCanvas = forwardRef<MenuBackgroundCanvasRef>(function MenuBackgroundCanvas(_, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const particlesRef = useRef<{ x: number; y: number; size: number; vx: number; vy: number; opacity: number; color?: string }[]>([]);
  const kennyRef = useRef({ x: -100, y: 0, speed: 3.5, active: true, timer: 0 });
  const rafRef = useRef<number | null>(null);
  const sizeRef = useRef({ w: 0, h: 0 });

  useImperativeHandle(ref, () => ({
    spawnSplatter(x: number, y: number) {
      const colors = ['#38bdf8', '#fbbf24', '#a3e635', '#f472b6', '#c084fc'];
      for (let i = 0; i < 40; i++) {
        const angle = Math.random() * Math.PI * 2;
        const force = 3 + Math.random() * 8;
        particlesRef.current.push({
          x, y,
          vx: Math.cos(angle) * force,
          vy: Math.sin(angle) * force,
          size: 4 + Math.random() * 8,
          opacity: 1,
          color: colors[Math.floor(Math.random() * colors.length)]
        });
      }
    }
  }), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    function resize() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w;
      canvas.height = h;
      sizeRef.current = { w, h };
    }
    resize();
    window.addEventListener('resize', resize);

    const particles = particlesRef.current;
    if (particles.length === 0) {
      for (let i = 0; i < 60; i++) {
        particles.push({
          x: Math.random() * sizeRef.current.w,
          y: Math.random() * sizeRef.current.h,
          size: Math.random() * 3 + 1,
          vx: (Math.random() - 0.5) * 0.5,
          vy: -Math.random() * 1.5 - 0.5,
          opacity: Math.random() * 0.5 + 0.2
        });
      }
    }

    kennyRef.current = { x: -100, y: sizeRef.current.h - 50, speed: 3.5, active: true, timer: 0 };

    function drawKenny(x: number, y: number, t: number) {
      ctx.save();
      ctx.translate(x, y);
      const hop = Math.abs(Math.sin(t * 15)) * 10;
      ctx.translate(0, -hop);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#0f172a';
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
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(-4, -28, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(4, -28, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function drawLogoText() {
      const { w } = sizeRef.current;
      ctx.save();
      ctx.translate(w / 2, 120);
      ctx.shadowBlur = 10;
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '900 100px "Chalkboard SE", "Comic Sans MS", sans-serif';
      ctx.fillStyle = '#fde047'; // yellow-300
      ctx.strokeStyle = '#0f172a'; // slate-900
      ctx.lineWidth = 14;
      ctx.lineJoin = 'round';

      // Draw offset text for 3D effect
      ctx.save();
      ctx.translate(0, 8);
      ctx.fillStyle = '#b45309'; // amber-700
      ctx.fillText('DarkForest', 0, 0);
      ctx.strokeText('DarkForest', 0, 0);
      ctx.restore();

      ctx.strokeText('DarkForest', 0, 0);
      ctx.fillText('DarkForest', 0, 0);

      // Subtitle
      ctx.font = '900 30px "Chalkboard SE", "Comic Sans MS", sans-serif';
      ctx.fillStyle = '#fbbf24';
      ctx.lineWidth = 8;
      ctx.translate(0, 70);
      ctx.strokeText('BATTLE ARENA', 0, 0);
      ctx.fillText('BATTLE ARENA', 0, 0);

      ctx.restore();
    }

    function update() {
      const { w, h } = sizeRef.current;
      ctx.clearRect(0, 0, w, h);

      // Starburst cartoon background
      ctx.save();
      ctx.translate(w / 2, h / 2);
      const timeOffset = frameRef.current * 0.2;
      const numRays = 16;
      ctx.fillStyle = '#0f766e'; // teal-700
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.fillStyle = '#14b8a6'; // teal-500
      for (let i = 0; i < numRays; i++) {
        const angle1 = (i / numRays) * Math.PI * 2 + timeOffset;
        const angle2 = ((i + 0.5) / numRays) * Math.PI * 2 + timeOffset;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(angle1) * Math.max(w, h), Math.sin(angle1) * Math.max(w, h));
        ctx.lineTo(Math.cos(angle2) * Math.max(w, h), Math.sin(angle2) * Math.max(w, h));
        ctx.closePath();
        ctx.fill();
      }
      // Inner glow/vignette
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(w, h) * 0.8);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.6)');
      ctx.fillStyle = grad;
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.restore();

      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;

        if (p.color) {
          // Confetti / spawned particles
          p.vy += 0.4; // gravity
          p.opacity -= 0.015;
          ctx.save();
          ctx.globalAlpha = Math.max(0, p.opacity);
          ctx.fillStyle = p.color;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.x * 0.05);
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          ctx.restore();
          if (p.opacity <= 0 || p.y > h + 50) particles.splice(i, 1);
        } else {
          // Background floating dust
          if (p.y < -20) {
            p.y = h + 20;
            p.x = Math.random() * w;
          }
          ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity * 0.5})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const kenny = kennyRef.current;
      if (kenny.active) {
        kenny.x += kenny.speed;
        if (kenny.x > w + 100) {
          kenny.active = false;
          kenny.timer = 0;
        }
        drawKenny(kenny.x, h - 40, frameRef.current);
      } else {
        kenny.timer += 0.016;
        if (kenny.timer > 4) {
          kenny.x = -100;
          kenny.active = true;
        }
      }

      drawLogoText();
      frameRef.current += 0.016;
      rafRef.current = requestAnimationFrame(update);
    }

    update();

    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-[1] pointer-events-none"
      style={{ display: 'block' }}
    />
  );
});

export default MenuBackgroundCanvas;
