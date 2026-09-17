'use client';

import dynamic from 'next/dynamic';
import { useSocData } from '@/hooks/useSocData';
import Navbar         from '@/components/Navbar';
import MetricsRow     from '@/components/MetricsRow';
import TerminalFeed   from '@/components/TerminalFeed';
import AlertTable     from '@/components/AlertTable';

// ── Dynamic import — react-globe.gl is NOT SSR-compatible ──────────────────
const GlobeRadar = dynamic(() => import('@/components/GlobeRadar'), {
  ssr    : false,
  loading: () => (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <div
        className="w-20 h-20 rounded-full border-2 animate-spin"
        style={{
          borderColor: 'rgba(6,182,212,0.2)',
          borderTopColor: '#06b6d4',
        }}
      />
      <p className="font-mono text-xs text-cyber-cyan/50 tracking-[0.3em] animate-pulse uppercase">
        Initializing Radar...
      </p>
    </div>
  ),
});

// ─────────────────────────────────────────────
// Dashboard Page
// ─────────────────────────────────────────────
export default function DashboardPage() {
  const { events, isConnected, latestEvent, stats } = useSocData();

  return (
    <>
      {/* CRT scan-line decorative overlay */}
      <div className="scan-overlay" aria-hidden="true" />

      {/* Background: grid + radial glow */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          background: '#020817',
          backgroundImage: `
            linear-gradient(rgba(6,182,212,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(6,182,212,0.03) 1px, transparent 1px),
            radial-gradient(ellipse at 50% 40%, rgba(6,182,212,0.06) 0%, transparent 65%)
          `,
          backgroundSize: '40px 40px, 40px 40px, 100% 100%',
        }}
      />

      {/* ── Top Navbar ──────────────────────────────────────── */}
      <Navbar isConnected={isConnected} totalEvents={events.length} />

      {/* ── Main Dashboard Layout ───────────────────────────── */}
      <main
        className="flex flex-col gap-3 p-3"
        style={{
          height    : '100vh',
          paddingTop: 'calc(64px + 0.75rem)', // clear navbar height
          overflow  : 'hidden',
        }}
      >

        {/* ─ Row 1: Metrics rings ──────────── */}
        <MetricsRow stats={stats} />

        {/* ─ Row 2: Globe + Terminal ──────── */}
        <div className="flex gap-3 flex-1 min-h-0">

          {/* Globe — takes 65% of width */}
          <div
            className="glass-panel rounded-xl overflow-hidden"
            style={{ flex: '0 0 65%', minHeight: 0 }}
          >
            <GlobeRadar events={events} latestEvent={latestEvent} />
          </div>

          {/* Terminal feed — takes remaining 35% */}
          <div style={{ flex: '1 1 0', minHeight: 0, minWidth: 0 }}>
            <TerminalFeed events={events} />
          </div>

        </div>

        {/* ─ Row 3: Alert table ───────────── */}
        <div style={{ flex: '0 0 280px', minHeight: 0 }}>
          <AlertTable events={events} />
        </div>

      </main>
    </>
  );
}
