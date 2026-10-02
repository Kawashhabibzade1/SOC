'use client';

import { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';

interface IfaceTraffic {
  iface: string;
  rxSpeed: number;
  txSpeed: number;
  totalRx: number;
  totalTx: number;
}

export default function TrafficAnalyzer() {
  const [traffic, setTraffic] = useState<IfaceTraffic[]>([]);

  useEffect(() => {
    const fetchTraffic = () => {
      const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || `http://${window.location.hostname}:3001`;
      fetch(`${GATEWAY_URL}/api/network/traffic`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data) {
            setTraffic(data.data);
          }
        })
        .catch(console.error);
    };

    fetchTraffic();
    const int = setInterval(fetchTraffic, 2000);
    return () => clearInterval(int);
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="flex flex-col h-full bg-[#020817] rounded-xl border border-slate-800 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-cyber-green" />
          <h2 className="text-cyber-green font-orbitron tracking-widest text-lg font-bold">Traffic Analyzer</h2>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 overflow-auto">
        {traffic.map((t, idx) => (
          <div key={idx} className="bg-slate-900/50 border border-slate-800 rounded-lg p-4 flex flex-col gap-2">
            <h3 className="font-mono font-bold text-slate-200 text-sm">{t.iface}</h3>
            <div className="flex justify-between items-center bg-slate-950/50 p-2 rounded">
              <span className="font-mono text-xs text-slate-400">DOWNLOAD</span>
              <span className="font-orbitron text-sm text-cyan-400 font-bold">{formatBytes(t.rxSpeed)}/s</span>
            </div>
            <div className="flex justify-between items-center bg-slate-950/50 p-2 rounded">
              <span className="font-mono text-xs text-slate-400">UPLOAD</span>
              <span className="font-orbitron text-sm text-fuchsia-400 font-bold">{formatBytes(t.txSpeed)}/s</span>
            </div>
            <div className="flex justify-between items-center mt-2 border-t border-slate-800 pt-2">
              <span className="font-mono text-[10px] text-slate-500">TOTAL RX: {formatBytes(t.totalRx)}</span>
              <span className="font-mono text-[10px] text-slate-500">TOTAL TX: {formatBytes(t.totalTx)}</span>
            </div>
          </div>
        ))}
        {traffic.length === 0 && (
          <div className="col-span-full p-8 text-center text-slate-500 font-mono text-xs tracking-wider border border-dashed border-slate-800 rounded-lg">
            Awaiting traffic data...
          </div>
        )}
      </div>
    </div>
  );
}
