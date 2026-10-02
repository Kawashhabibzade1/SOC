import React, { useEffect, useState } from 'react';
import { Network, Activity, Monitor, Smartphone, Server } from 'lucide-react';

interface TailscalePeer {
  ID: string;
  HostName: string;
  OS: string;
  TailscaleIPs: string[];
  Active: boolean;
  TxBytes: number;
  RxBytes: number;
  LastSeen: string;
}

interface TailscaleData {
  Self: TailscalePeer;
  Peer: { [key: string]: TailscalePeer };
}

export default function VpnMesh() {
  const [data, setData] = useState<TailscaleData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTailscale = async () => {
    try {
      const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'https://heimserver.tail2ad9cd.ts.net';
      const res = await fetch(`${GATEWAY_URL}/api/tailscale`);
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch tailscale stats', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTailscale();
    const interval = setInterval(fetchTailscale, 10000);
    return () => clearInterval(interval);
  }, []);

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getDeviceIcon = (os: string) => {
    const l = os.toLowerCase();
    if (l.includes('ios') || l.includes('android')) return <Smartphone className="w-5 h-5" />;
    if (l.includes('linux')) return <Server className="w-5 h-5" />;
    return <Monitor className="w-5 h-5" />;
  };

  if (loading) {
    return <div className="p-6 text-cyber-cyan font-mono animate-pulse">Initializing VPN Mesh Radar...</div>;
  }

  if (!data) {
    return <div className="p-6 text-red-500 font-mono">No Tailscale data available. Make sure Tailscale is running on the host.</div>;
  }

  const peers = Object.values(data.Peer || {}).sort((a: any, b: any) => {
    if (a.Active && !b.Active) return -1;
    if (!a.Active && b.Active) return 1;
    return 0;
  });

  return (
    <div className="p-6 space-y-6 animate-fade-in h-full overflow-y-auto">
      <div className="flex items-center gap-3 mb-6">
        <Network className="w-8 h-8 text-cyber-cyan" />
        <h2 className="text-2xl font-orbitron font-bold text-slate-100">VPN Mesh Radar</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Self Node */}
        <div className="bg-cyber-cyan/10 border border-cyber-cyan/50 rounded-xl p-5 shadow-[0_0_20px_rgba(6,182,212,0.15)] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyber-cyan/20 blur-3xl rounded-full -mr-16 -mt-16 pointer-events-none" />
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div>
              <h3 className="font-bold text-lg text-cyber-cyan flex items-center gap-2">
                {getDeviceIcon(data.Self.OS)}
                {data.Self.HostName} (Local)
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-1">{data.Self.TailscaleIPs?.[0]}</p>
            </div>
            <div className="flex items-center gap-2 px-2 py-1 bg-green-500/10 border border-green-500/20 rounded text-green-400 text-xs font-mono">
              <Activity className="w-3 h-3" /> ONLINE
            </div>
          </div>
          <div className="space-y-2 font-mono text-xs mt-6 border-t border-cyber-cyan/20 pt-4">
            <div className="flex justify-between">
              <span className="text-slate-500">OS</span>
              <span className="text-slate-300 capitalize">{data.Self.OS}</span>
            </div>
          </div>
        </div>

        {/* Peer Nodes */}
        {peers.map((p) => {
          const isOnline = p.Active;
          return (
            <div key={p.ID} className={`bg-slate-900/50 border rounded-xl p-5 transition-all duration-300 ${isOnline ? 'border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.05)]' : 'border-slate-800'}`}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className={`font-bold text-lg flex items-center gap-2 ${isOnline ? 'text-slate-100' : 'text-slate-500'}`}>
                    {getDeviceIcon(p.OS)}
                    {p.HostName}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono mt-1">{p.TailscaleIPs?.[0]}</p>
                </div>
                {isOnline ? (
                  <div className="flex items-center gap-2 px-2 py-1 bg-green-500/10 border border-green-500/20 rounded text-green-400 text-xs font-mono">
                    <Activity className="w-3 h-3 animate-pulse" /> ONLINE
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-2 py-1 bg-slate-800 rounded text-slate-500 text-xs font-mono">
                    OFFLINE
                  </div>
                )}
              </div>
              <div className="space-y-2 font-mono text-xs mt-6 border-t border-slate-800 pt-4">
                <div className="flex justify-between">
                  <span className="text-slate-500">Last Seen</span>
                  <span className="text-slate-400">{isOnline ? 'Now' : new Date(p.LastSeen).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tx / Rx</span>
                  <span className={isOnline ? 'text-cyber-cyan' : 'text-slate-600'}>
                    {formatBytes(p.TxBytes)} / {formatBytes(p.RxBytes)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
