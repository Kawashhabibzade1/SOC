import React, { useEffect, useState } from 'react';
import { Activity, Cpu, HardDrive, MemoryStick, Server, Clock } from 'lucide-react';

interface SystemData {
  cpu: { load: number };
  mem: { total: number; used: number; free: number; active: number };
  disk: Array<{ fs: string; type: string; size: number; used: number; available: number; use: number; mount: string }>;
  os: { platform: string; distro: string; uptime: number };
}

export default function SystemMetrics() {
  const [data, setData] = useState<SystemData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchMetrics = async () => {
    try {
      const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3001';
      const res = await fetch(`${GATEWAY_URL}/api/system-metrics`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        setError('');
      } else {
        setError(json.error || 'Failed to fetch metrics');
      }
    } catch (err: any) {
      setError('Network Error fetching metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 3000); // Poll every 3s
    return () => clearInterval(interval);
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${d}d ${h}h ${m}m`;
  };

  const getUsageColor = (percent: number) => {
    if (percent < 50) return 'text-cyber-green bg-cyber-green/20';
    if (percent < 80) return 'text-yellow-500 bg-yellow-500/20';
    return 'text-red-500 bg-red-500/20';
  };

  const getProgressColor = (percent: number) => {
    if (percent < 50) return 'bg-cyber-green shadow-[0_0_10px_rgba(0,255,170,0.5)]';
    if (percent < 80) return 'bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)]';
    return 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]';
  };

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 min-h-[500px] glass-panel rounded-xl">
        <Activity className="w-8 h-8 text-cyber-cyan animate-pulse" />
        <span className="font-mono text-xs text-cyber-cyan tracking-[0.3em] uppercase">Scanning Systems...</span>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 min-h-[500px] glass-panel rounded-xl text-red-500">
        <Server className="w-12 h-12 opacity-50" />
        <span className="font-mono text-sm uppercase">{error}</span>
      </div>
    );
  }

  if (!data) return null;

  const memPercent = (data.mem.active / data.mem.total) * 100;
  const mainDisk = data.disk.find(d => d.mount === '/') || data.disk[0];

  return (
    <div className="h-full min-h-0 flex flex-col gap-4 overflow-y-auto pb-8">
      {/* Top Header */}
      <div className="glass-panel rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyber-cyan/5 blur-[100px] rounded-full pointer-events-none" />
        <div className="flex items-center gap-4 z-10">
          <div className="p-3 bg-cyber-cyan/10 rounded-lg border border-cyber-cyan/20">
            <Server className="w-6 h-6 text-cyber-cyan" />
          </div>
          <div>
            <h2 className="font-orbitron font-bold text-lg text-slate-100 tracking-wider">
              {data.os.distro || data.os.platform}
            </h2>
            <div className="flex items-center gap-2 text-slate-400 mt-1">
              <Clock className="w-3.5 h-3.5" />
              <span className="font-mono text-xs uppercase">Uptime: {formatUptime(data.os.uptime)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 z-10">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyber-cyan opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-cyber-cyan"></span>
          </span>
          <span className="font-mono text-xs text-cyber-cyan tracking-widest uppercase">Live Sync</span>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        
        {/* CPU Panel */}
        <div className="glass-panel rounded-xl p-6 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-cyber-cyan/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-start justify-between mb-8 relative z-10">
            <div className="flex items-center gap-3">
              <Cpu className="w-5 h-5 text-slate-400" />
              <span className="font-orbitron tracking-widest text-sm text-slate-200">CPU LOAD</span>
            </div>
            <span className={`px-2 py-1 rounded font-mono text-xs font-bold ${getUsageColor(data.cpu.load)}`}>
              {data.cpu.load.toFixed(1)}%
            </span>
          </div>
          <div className="relative h-4 bg-slate-800/50 rounded-full overflow-hidden border border-slate-700/50 z-10">
            <div 
              className={`absolute top-0 left-0 h-full transition-all duration-1000 ease-out ${getProgressColor(data.cpu.load)}`}
              style={{ width: `${Math.min(100, Math.max(0, data.cpu.load))}%` }}
            />
          </div>
        </div>

        {/* RAM Panel */}
        <div className="glass-panel rounded-xl p-6 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-start justify-between mb-8 relative z-10">
            <div className="flex items-center gap-3">
              <MemoryStick className="w-5 h-5 text-slate-400" />
              <span className="font-orbitron tracking-widest text-sm text-slate-200">MEMORY</span>
            </div>
            <span className={`px-2 py-1 rounded font-mono text-xs font-bold ${getUsageColor(memPercent)}`}>
              {memPercent.toFixed(1)}%
            </span>
          </div>
          <div className="relative h-4 bg-slate-800/50 rounded-full overflow-hidden border border-slate-700/50 z-10 mb-3">
            <div 
              className={`absolute top-0 left-0 h-full transition-all duration-1000 ease-out ${getProgressColor(memPercent)}`}
              style={{ width: `${memPercent}%` }}
            />
          </div>
          <div className="flex justify-between font-mono text-[10px] text-slate-400 uppercase z-10 relative">
            <span>{formatBytes(data.mem.active)} Used</span>
            <span>{formatBytes(data.mem.total)} Total</span>
          </div>
        </div>

        {/* Disk Panel */}
        {mainDisk && (
          <div className="glass-panel rounded-xl p-6 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-start justify-between mb-8 relative z-10">
              <div className="flex items-center gap-3">
                <HardDrive className="w-5 h-5 text-slate-400" />
                <span className="font-orbitron tracking-widest text-sm text-slate-200">STORAGE ({mainDisk.mount})</span>
              </div>
              <span className={`px-2 py-1 rounded font-mono text-xs font-bold ${getUsageColor(mainDisk.use)}`}>
                {mainDisk.use.toFixed(1)}%
              </span>
            </div>
            <div className="relative h-4 bg-slate-800/50 rounded-full overflow-hidden border border-slate-700/50 z-10 mb-3">
              <div 
                className={`absolute top-0 left-0 h-full transition-all duration-1000 ease-out ${getProgressColor(mainDisk.use)}`}
                style={{ width: `${mainDisk.use}%` }}
              />
            </div>
            <div className="flex justify-between font-mono text-[10px] text-slate-400 uppercase z-10 relative">
              <span>{formatBytes(mainDisk.used)} Used</span>
              <span>{formatBytes(mainDisk.size)} Total</span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
