import React, { useEffect, useState } from 'react';
import { ShieldX, Activity, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function BlockedIpsTable() {
  const [ips, setIps] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unblockingIp, setUnblockingIp] = useState<string | null>(null);

  const fetchBlockedIps = async () => {
    try {
      const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3001';
      const res = await fetch(`${GATEWAY_URL}/api/blocked-ips`);
      const data = await res.json();
      if (data.success) {
        setIps(data.data);
      } else {
        setError(data.error || 'Failed to fetch blocked IPs');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlockedIps();
    const interval = setInterval(fetchBlockedIps, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, []);

  const handleUnblockIp = async (ip: string) => {
    if (!confirm(`Are you sure you want to unblock IP ${ip}?`)) return;
    setUnblockingIp(ip);
    try {
      const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3001';
      const res = await fetch(`${GATEWAY_URL}/api/unblock-ip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip })
      });
      const data = await res.json();
      if (data.success) {
        // Refresh the list
        fetchBlockedIps();
      } else {
        alert(`Failed to unblock ${ip}: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Error unblocking IP: ${err.message}`);
    } finally {
      setUnblockingIp(null);
    }
  };

  return (
    <div className="glass-panel rounded-xl flex flex-col h-full min-h-0 relative overflow-hidden">
      <div className="panel-header flex-shrink-0 flex items-center justify-between p-4 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <ShieldX className="w-5 h-5 text-red-500" />
          <span className="font-orbitron text-sm tracking-widest text-slate-200 uppercase">
            Blocked IPs
          </span>
          {loading && <Activity className="w-4 h-4 text-red-500 animate-spin" />}
        </div>
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
                  <th className="py-3 px-4 font-mono text-[10px] text-slate-500 uppercase tracking-widest font-normal">IP Address</th>
                  <th className="py-3 px-4 font-mono text-[10px] text-slate-500 uppercase tracking-widest font-normal text-right">Status</th>
                  <th className="py-3 px-4 font-mono text-[10px] text-slate-500 uppercase tracking-widest font-normal text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {ips.map((ip, idx) => (
                  <tr key={`${ip}-${idx}`} className="border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-mono text-sm text-slate-200">{ip}</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <ShieldX className="w-3.5 h-3.5 text-red-500" />
                        <span className="font-mono text-[10px] text-red-500 uppercase tracking-wider">Blocked</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleUnblockIp(ip)}
                        disabled={unblockingIp === ip}
                        className="px-2 py-1 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 rounded border border-yellow-500/30 font-mono text-[9px] uppercase transition-colors disabled:opacity-50"
                      >
                        {unblockingIp === ip ? 'Wait...' : 'Unblock'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {ips.length === 0 && !loading && (
              <div className="text-center py-8 text-slate-500 font-mono text-xs flex flex-col items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-cyber-green/50" />
                <span>No IPs are currently blocked.</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
