'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const { events, isConnected, latestEvent, stats } = useSocData();

  useEffect(() => {
    const auth = typeof window !== 'undefined' ? localStorage.getItem('soc_auth') : null;
    if (!auth) {
      router.replace('/login');
    } else {
      setIsAuthenticated(true);
    }
  }, [router]);

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#020817] gap-4">
        <div
          className="w-16 h-16 rounded-full border-2 animate-spin"
          style={{
            borderColor: 'rgba(6,182,212,0.2)',
            borderTopColor: '#06b6d4',
          }}
        />
        <p className="font-mono text-xs text-cyber-cyan tracking-[0.3em] animate-pulse uppercase">
          Verifying Security Clearance...
        </p>
      </div>
    );
  }

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
        className="flex flex-col gap-3 p-2 sm:p-3 min-h-screen lg:h-screen lg:overflow-hidden overflow-y-auto"
        style={{
          paddingTop: 'calc(64px + 0.75rem)', // clear navbar height
        }}
      >

        {/* ─ Row 1: Metrics rings ──────────── */}
        <MetricsRow stats={stats} />

        {/* ─ Row 2: Globe + Terminal ──────── */}
        <div className="flex flex-col lg:flex-row gap-3 flex-1 min-h-0">

          {/* Globe — takes 65% on desktop, dedicated height on mobile */}
          <div
            className="glass-panel rounded-xl overflow-hidden h-[340px] sm:h-[420px] lg:h-auto lg:flex-[0_0_65%] min-h-0"
          >
            <GlobeRadar events={events} latestEvent={latestEvent} />
          </div>

          {/* Terminal feed — takes remaining 35% on desktop, dedicated height on mobile */}
          <div className="h-[280px] lg:h-auto lg:flex-1 min-h-0 min-w-0">
            <TerminalFeed events={events} />
          </div>

        </div>

        {/* ─ Row 3: Alert table ───────────── */}
        <div className="h-[320px] lg:h-auto lg:flex-[0_0_280px] min-h-0">
          <AlertTable events={events} />
        </div>

      </main>
    </>
  );
}
