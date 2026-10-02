'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useSocData } from '@/hooks/useSocData';
import Navbar         from '@/components/Navbar';
import MetricsRow     from '@/components/MetricsRow';
import TerminalFeed   from '@/components/TerminalFeed';
import AlertTable     from '@/components/AlertTable';
import ActiveSessions from '@/components/ActiveSessions';

import Sidebar from '@/components/Sidebar';
import OpenPortsTable from '@/components/OpenPortsTable';
import BlockedIpsTable from '@/components/BlockedIpsTable';
import SystemMetrics from '@/components/SystemMetrics';
import DockerRadar from '@/components/DockerRadar';
import VpnMesh from '@/components/VpnMesh';
import LanMonitor from '@/components/LanMonitor';
import TrafficAnalyzer from '@/components/TrafficAnalyzer';
import SecurityScanner from '@/components/SecurityScanner';
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
  const { events, activeSessions, isConnected, latestEvent, stats, isLockdown } = useSocData();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [explorerPath, setExplorerPath] = useState('SAMBA');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="flex flex-col gap-3 h-full overflow-y-auto pb-12">
            <MetricsRow stats={stats} />
            <div className="flex flex-col lg:flex-row gap-4 flex-none">
              <div className="order-2 lg:order-1 lg:w-2/3 flex flex-col h-[400px] lg:h-[450px]">
                <AlertTable events={events} />
              </div>
              <div className="order-1 lg:order-2 lg:w-1/3 flex flex-col h-[300px] lg:h-[450px]">
                <ActiveSessions sessions={activeSessions} />
              </div>
            </div>
            <div className="h-[300px] sm:h-[400px] min-h-[300px]">
              <TerminalFeed events={events} />
            </div>
          </div>
        );
      case 'radar':
        return (
          <div className="h-full w-full glass-panel rounded-xl overflow-hidden min-h-[500px]">
            <GlobeRadar events={events} latestEvent={latestEvent} />
          </div>
        );
      case 'system':
        return (
          <div className="h-full w-full min-h-[500px]">
            <SystemMetrics />
          </div>
        );
      case 'lan_monitor':
        return (
          <div className="h-full w-full min-h-[500px]">
            <LanMonitor />
          </div>
        );
      case 'traffic':
        return (
          <div className="h-full w-full min-h-[500px]">
            <TrafficAnalyzer />
          </div>
        );
      case 'cve_scanner':
        return (
          <div className="h-full w-full min-h-[500px]">
            <SecurityScanner />
          </div>
        );

      case 'ports':
        return (
          <div className="h-full w-full min-h-[500px]">
            <OpenPortsTable />
          </div>
        );
      case 'docker':
        return (
          <div className="h-full w-full min-h-[500px]">
            <DockerRadar />
          </div>
        );
      case 'vpn_mesh':
        return (
          <div className="h-full w-full min-h-[500px]">
            <VpnMesh />
          </div>
        );
      case 'blocked_ips':
        return (
          <div className="h-full w-full min-h-[500px]">
            <BlockedIpsTable />
          </div>
        );
      default:
        return null;
    }
  };

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
      <div className="flex h-screen overflow-hidden">
        
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          isOpen={isSidebarOpen} 
          setIsOpen={setIsSidebarOpen} 
        />

        <main
          className="flex-1 flex flex-col p-2 sm:p-4 overflow-y-auto"
          style={{
            paddingTop: 'calc(64px + 0.75rem)', // clear navbar height
          }}
        >
          {/* Animated content wrapper */}
          <div className="flex-1 animate-in fade-in zoom-in-95 duration-300 h-full relative">
            {renderContent()}

            {/* Lockdown Overlay */}
            {isLockdown && (
              <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-red-950/80 backdrop-blur-md rounded-xl border border-red-500 shadow-[0_0_50px_rgba(239,68,68,0.5)]">
                <div className="animate-pulse flex flex-col items-center">
                  <div className="text-red-500 font-orbitron font-black text-6xl tracking-widest mb-4 drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]">
                    LOCKDOWN
                  </div>
                  <div className="font-mono text-red-400 text-lg tracking-widest mb-8 text-center uppercase">
                    Total Network Isolation Engaged
                  </div>
                  <button 
                    onClick={async () => {
                      const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'https://heimserver.tail2ad9cd.ts.net';
                      await fetch(`${GATEWAY_URL}/api/firewall/unlock`, { method: 'POST' });
                    }}
                    className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-orbitron text-xl font-bold uppercase tracking-widest rounded-lg transition-colors border border-red-400 shadow-[0_0_20px_rgba(239,68,68,0.5)]"
                  >
                    Release System
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
