'use client';

import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';

export interface MenuBackgroundCanvasRef {
  spawnSplatter: (x: number, y: number) => void;
}

const MenuBackgroundCanvas = forwardRef<MenuBackgroundCanvasRef>(function MenuBackgroundCanvas(_, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const particlesRef = useRef<{ x: number; y: number; size: number; vx: number; vy: number; opacity: number }[]>([]);
  const bloodDropsRef = useRef<{ x: number; y: number; vy: number; size: number; length: number }[]>([]);
  const bloodPuddlesRef = useRef<{ x: number; y: number; radius: number; maxRadius: number; growSpeed: number; opacity: number }[]>([]);
  const splattersRef = useRef<{ x: number; y: number; vx: number; vy: number; size: number; life: number; decay: number; gravity: number; color: string }[]>([]);
  const kennyRef = useRef({ x: -100, y: 0, speed: 3.5, active: true, timer: 0 });
  const rafRef = useRef<number | null>(null);
  const sizeRef = useRef({ w: 0, h: 0 });

  useImperativeHandle(ref, () => ({
    spawnSplatter(x: number, y: number) {
      for (let i = 0; i < 90; i++) {
        const angle = Math.random() * Math.PI * 2;
        const force = 4 + Math.random() * 15;
        splattersRef.current.push({
          x, y,
          vx: Math.cos(angle) * force,
          vy: Math.sin(angle) * force,
          size: 2 + Math.random() * 10,
          life: 1.0,
          decay: 0.008 + Math.random() * 0.015,
          gravity: 0.35,
          color: Math.random() > 0.3 ? '#7f1d1d' : '#450a0a'
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
      for (let i = 0; i < 150; i++) {
        particles.push({
          x: Math.random() * sizeRef.current.w,
          y: Math.random() * sizeRef.current.h,
          size: Math.random() * 2 + 0.5,
          vx: (Math.random() - 0.5) * 0.4,
          vy: -Math.random() * 0.8 - 0.1,
          opacity: Math.random() * 0.5
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
      const { w } = sizeRef.current;
      const x = (w / 2 - 450) + Math.random() * 900;
      bloodDropsRef.current.push({
        x,
        y: 60 + Math.random() * 60,
        vy: 3 + Math.random() * 5,
        size: 4 + Math.random() * 5,
        length: 15 + Math.random() * 20
      });
    }

    function drawLogoText() {
      const { w } = sizeRef.current;
      ctx.save();
      ctx.translate(w / 2, 80);
      const flicker = Math.random() > 0.97 ? 0.6 : 1;
      ctx.shadowBlur = 80 * flicker;
      ctx.shadowColor = '#991b1b';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '130px "Arial Black"';
      ctx.fillStyle = '#000';
      ctx.fillText('DarkForest', 0, 5);
      const grad = ctx.createLinearGradient(0, -60, 0, 60);
      grad.addColorStop(0, '#1e293b');
      grad.addColorStop(0.4, '#7f1d1d');
      grad.addColorStop(0.6, '#450a0a');
      grad.addColorStop(1, '#1a0505');
      ctx.fillStyle = grad;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 6;
      ctx.strokeText('DarkForest', 0, 0);
      ctx.fillText('DarkForest', 0, 0);
      ctx.restore();
    }

    function update() {
      const { w, h } = sizeRef.current;
      ctx.clearRect(0, 0, w, h);

      const bgGrad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h));
      bgGrad.addColorStop(0, '#0f172a');
      bgGrad.addColorStop(0.7, '#020617');
      bgGrad.addColorStop(1, '#000');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      for (const p of particles) {
        p.y += p.vy;
        p.x += p.vx;
        if (p.y < -20) {
          p.y = h + 20;
          p.x = Math.random() * w;
        }
        ctx.fillStyle = `rgba(153, 27, 27, ${p.opacity})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      const splatters = splattersRef.current;
      for (let i = splatters.length - 1; i >= 0; i--) {
        const s = splatters[i];
        s.x += s.vx;
        s.y += s.vy;
        s.vy += s.gravity;
        s.life -= s.decay;
        ctx.globalAlpha = s.life;
        ctx.fillStyle = s.color;
        ctx.beginPath();
        const stretch = 1 + Math.abs(s.vy) * 0.15;
        ctx.ellipse(s.x, s.y, s.size, s.size * stretch, Math.atan2(s.vy, s.vx), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        if (s.life <= 0 || s.y > h) splatters.splice(i, 1);
      }

      const bloodPuddles = bloodPuddlesRef.current;
      for (let i = bloodPuddles.length - 1; i >= 0; i--) {
        const p = bloodPuddles[i];
        p.radius += p.growSpeed;
        p.opacity -= 0.0008;
        if (p.radius > p.maxRadius) p.growSpeed = 0;
        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = '#2d0606';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.radius, p.radius * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        if (p.opacity <= 0) bloodPuddles.splice(i, 1);
      }

      if (Math.random() > 0.7) createBloodDrop();

      const bloodDrops = bloodDropsRef.current;
      for (let i = bloodDrops.length - 1; i >= 0; i--) {
        const d = bloodDrops[i];
        d.y += d.vy;
        ctx.fillStyle = '#7f1d1d';
        ctx.beginPath();
        ctx.moveTo(d.x - d.size / 2, d.y - d.length);
        ctx.lineTo(d.x + d.size / 2, d.y - d.length);
        ctx.lineTo(d.x, d.y);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
        ctx.fill();
        if (d.y > h - 15) {
          bloodPuddles.push({
            x: d.x,
            y: d.y,
            radius: 2,
            maxRadius: 30 + Math.random() * 40,
            growSpeed: 0.4,
            opacity: 1.0
          });
          bloodDrops.splice(i, 1);
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
