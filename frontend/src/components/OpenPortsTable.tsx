import React, { useEffect, useState } from 'react';
import { Server, Activity, ShieldCheck, AlertTriangle } from 'lucide-react';

interface OpenPort {
  protocol: string;
  port: number;
  address: string;
  state: string;
  process: string;
}

export default function OpenPortsTable() {
  const [ports, setPorts] = useState<OpenPort[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchPorts = async () => {
    try {
      const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3001';
      const res = await fetch(`${GATEWAY_URL}/api/open-ports`);
      const data = await res.json();
      if (data.success) {
        setPorts(data.data);
      } else {
        setError(data.error || 'Failed to fetch ports');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPorts();
    const interval = setInterval(fetchPorts, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="glass-panel rounded-xl flex flex-col h-full min-h-0 relative overflow-hidden">
      <div className="panel-header flex-shrink-0 flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <Server className="w-5 h-5 text-cyber-cyan" />
          <span className="font-orbitron text-sm tracking-widest text-slate-200 uppercase">
            Listening Ports
          </span>
        </div>
        {loading && <Activity className="w-4 h-4 text-cyber-cyan animate-spin" />}
      </div>

      <div className="flex-1 overflow-y-auto p-4 min-h-0">
        {error ? (
          <div className="flex flex-col items-center justify-center h-full text-red-500 gap-2 opacity-80">
            <AlertTriangle className="w-8 h-8" />
            <span className="font-mono text-xs text-center">{error}</span>
          </div>
        ) : (
          <div className="w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-700/50">
                  <th className="py-3 px-4 font-mono text-[10px] text-slate-500 uppercase tracking-widest font-normal">Protocol</th>
                  <th className="py-3 px-4 font-mono text-[10px] text-slate-500 uppercase tracking-widest font-normal">Port</th>
                  <th className="py-3 px-4 font-mono text-[10px] text-slate-500 uppercase tracking-widest font-normal">Address</th>
                  <th className="py-3 px-4 font-mono text-[10px] text-slate-500 uppercase tracking-widest font-normal text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {ports.map((port, idx) => (
                  <tr key={`${port.protocol}-${port.port}-${idx}`} className="border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-mono text-xs text-cyber-cyan uppercase">{port.protocol}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-sm text-slate-200">{port.port}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-xs text-slate-400">{port.address}</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <ShieldCheck className="w-3.5 h-3.5 text-cyber-green" />
                        <span className="font-mono text-[10px] text-cyber-green uppercase tracking-wider">{port.state}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {ports.length === 0 && !loading && (
              <div className="text-center py-8 text-slate-500 font-mono text-xs">
                No open ports detected.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
