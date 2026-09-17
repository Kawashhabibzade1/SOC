'use client';

import { useEffect, useState } from 'react';
import { Shield, Wifi, WifiOff, Activity } from 'lucide-react';

interface NavbarProps {
  isConnected : boolean;
  totalEvents : number;
}

export default function Navbar({ isConnected, totalEvents }: NavbarProps) {
  const [time, setTime] = useState('');

  useEffect(() => {
    const tick = () =>
      setTime(new Date().toLocaleTimeString('en-GB', { hour12: false }));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center justify-between px-6"
      style={{
        background  : 'rgba(2, 8, 23, 0.92)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(6, 182, 212, 0.15)',
        boxShadow   : '0 0 40px rgba(6, 182, 212, 0.08), 0 1px 0 rgba(6, 182, 212, 0.1)',
      }}
    >
      {/* ── Left: Logo + title ──────────────────────── */}
      <div className="flex items-center gap-4">
        {/* Animated icon */}
        <div className="relative flex items-center justify-center w-10 h-10">
          <div
            className="absolute inset-0 rounded-lg animate-pulse-glow"
            style={{
              background  : 'rgba(6, 182, 212, 0.1)',
              border      : '1px solid rgba(6, 182, 212, 0.3)',
              color       : '#06b6d4',
            }}
          />
          <Shield className="relative z-10 w-5 h-5 text-cyber-cyan" />
        </div>

        <div>
          <h1
            className="font-orbitron font-black text-xl tracking-widest glow-cyan"
            style={{ color: '#06b6d4', letterSpacing: '0.2em' }}
          >
            SOC COMMAND CENTER
          </h1>
          <p className="text-[10px] text-slate-500 tracking-[0.3em] font-mono uppercase mt-0.5">
            Security Operations · Real-Time Threat Intelligence
          </p>
        </div>
      </div>

      {/* ── Center: Event counter ────────────────────── */}
      <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-lg"
        style={{ background: 'rgba(6, 182, 212, 0.05)', border: '1px solid rgba(6, 182, 212, 0.1)' }}
      >
        <Activity className="w-3.5 h-3.5 text-cyber-cyan" />
        <span className="font-mono text-xs text-slate-400 tracking-widest">EVENTS</span>
        <span
          className="font-orbitron font-bold text-sm text-cyber-cyan glow-cyan"
          style={{ minWidth: '3rem', textAlign: 'center' }}
        >
          {totalEvents.toLocaleString()}
        </span>
      </div>

      {/* ── Right: Status + Clock ────────────────────── */}
      <div className="flex items-center gap-6">

        {/* Connection status */}
        <div className="flex items-center gap-2.5">
          {isConnected ? (
            <>
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyber-green opacity-60" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyber-green" style={{ boxShadow: '0 0 8px #10b981' }} />
              </span>
              <div className="flex items-center gap-1.5 text-cyber-green">
                <Wifi className="w-3.5 h-3.5" />
                <span className="font-mono text-xs font-medium tracking-widest glow-green">LIVE</span>
              </div>
            </>
          ) : (
            <>
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyber-red opacity-60" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyber-red" style={{ boxShadow: '0 0 8px #ff003c' }} />
              </span>
              <div className="flex items-center gap-1.5 text-cyber-red">
                <WifiOff className="w-3.5 h-3.5" />
                <span className="font-mono text-xs font-medium tracking-widest glow-red">OFFLINE</span>
              </div>
            </>
          )}
        </div>

        {/* Digital clock */}
        <div
          className="font-orbitron font-bold text-lg tracking-widest text-slate-200 tabular-nums"
          style={{ textShadow: '0 0 20px rgba(255,255,255,0.2)' }}
        >
          {time}
        </div>
      </div>
    </header>
  );
}
