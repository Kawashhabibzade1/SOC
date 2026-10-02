'use client';

import { useEffect, useState } from 'react';
import { Network, ShieldAlert, ShieldCheck, Activity } from 'lucide-react';

interface LanDevice {
  ip: string;
  mac: string;
  trusted: boolean;
  last_seen: number;
}

export default function LanMonitor() {
  const [devices, setDevices] = useState<LanDevice[]>([]);

  useEffect(() => {
    const fetchDevices = () => {
      const GATEWAY_URL = '';
      fetch(`${GATEWAY_URL}/api/lan/devices`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data) {
            setDevices(data.data);
          }
        })
        .catch(console.error);
    };

    fetchDevices();
    const int = setInterval(fetchDevices, 5000);
    return () => clearInterval(int);
  }, []);

  return (
    <div className="flex flex-col h-full bg-[#020817] rounded-xl border border-slate-800 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Network className="w-5 h-5 text-cyber-cyan" />
          <h2 className="text-cyber-cyan font-orbitron tracking-widest text-lg font-bold">LAN Radar</h2>
        </div>
        <div className="text-xs font-mono text-slate-500">
          DEVICES: {devices.length}
        </div>
      </div>

      <div className="flex-1 overflow-auto rounded-lg border border-slate-800 bg-slate-900/50">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-800/80 text-slate-400 font-mono text-[10px] tracking-widest uppercase">
              <th className="p-3">Status</th>
              <th className="p-3">IP Address</th>
              <th className="p-3">MAC Address</th>
              <th className="p-3">Last Seen</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((dev, i) => (
              <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                <td className="p-3">
                  {dev.trusted ? (
                    <div className="flex items-center gap-1.5 text-emerald-400">
                      <ShieldCheck className="w-4 h-4" />
                      <span className="text-[10px] uppercase font-mono tracking-wider">Trusted</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-rose-500 animate-pulse">
                      <ShieldAlert className="w-4 h-4" />
                      <span className="text-[10px] uppercase font-mono tracking-wider font-bold">Rogue</span>
                    </div>
                  )}
                </td>
                <td className="p-3 font-mono text-xs text-slate-300">{dev.ip}</td>
                <td className="p-3 font-mono text-[10px] text-slate-500">{dev.mac}</td>
                <td className="p-3 text-[10px] text-slate-500 font-mono">
                  {new Date(dev.last_seen).toLocaleTimeString()}
                </td>
              </tr>
            ))}
            {devices.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-slate-500 font-mono text-xs tracking-wider">
                  No devices detected on LAN
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
