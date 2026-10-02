import React, { useEffect, useState } from 'react';
import { Play, Square, RotateCw, Terminal, Box } from 'lucide-react';

interface DockerContainer {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  ports: string;
  cpu: string;
  memory: string;
  memPerc: string;
}

export default function DockerRadar() {
  const [containers, setContainers] = useState<DockerContainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<{ [key: string]: string[] }>({});
  const [activeLog, setActiveLog] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || `http://${window.location.hostname}:3001`;
      const res = await fetch(`${GATEWAY_URL}/api/docker/stats`);
      const data = await res.json();
      if (data.success) {
        setContainers(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch docker stats', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleAction = async (action: 'start' | 'stop' | 'restart', container: string) => {
    try {
      const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || `http://${window.location.hostname}:3001`;
      await fetch(`${GATEWAY_URL}/api/docker/${action}/${container}`, { method: 'POST' });
      fetchStats(); // Refresh immediately
    } catch (err) {
      console.error(`Failed to ${action} ${container}`, err);
    }
  };

  const fetchLogs = async (container: string) => {
    try {
      const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || `http://${window.location.hostname}:3001`;
      const res = await fetch(`${GATEWAY_URL}/api/docker/logs/${container}`);
      const data = await res.json();
      if (data.success) {
        setLogs((prev) => ({ ...prev, [container]: data.data }));
        setActiveLog(container);
      }
    } catch (err) {
      console.error('Failed to fetch logs', err);
    }
  };

  if (loading) {
    return <div className="p-6 text-cyber-cyan font-mono animate-pulse">Initializing Docker Radar...</div>;
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <Box className="w-8 h-8 text-cyber-cyan" />
        <h2 className="text-2xl font-orbitron font-bold text-slate-100">Docker Container Radar</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {containers.map((c) => (
          <div key={c.id} className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-5 hover:border-cyber-cyan/30 transition-colors">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-lg text-slate-100 flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${c.state === 'running' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]' : 'bg-red-500'}`} />
                  {c.name}
                </h3>
                <p className="text-xs text-slate-400 font-mono truncate max-w-[200px]" title={c.image}>{c.image}</p>
              </div>
              <div className="flex gap-2">
                {c.state === 'running' ? (
                  <button onClick={() => handleAction('stop', c.name)} className="p-1.5 bg-red-500/10 text-red-400 rounded hover:bg-red-500/20" title="Stop">
                    <Square className="w-4 h-4" />
                  </button>
                ) : (
                  <button onClick={() => handleAction('start', c.name)} className="p-1.5 bg-green-500/10 text-green-400 rounded hover:bg-green-500/20" title="Start">
                    <Play className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => handleAction('restart', c.name)} className="p-1.5 bg-amber-500/10 text-amber-400 rounded hover:bg-amber-500/20" title="Restart">
                  <RotateCw className="w-4 h-4" />
                </button>
                <button onClick={() => fetchLogs(c.name)} className="p-1.5 bg-blue-500/10 text-blue-400 rounded hover:bg-blue-500/20" title="View Logs">
                  <Terminal className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Status</span>
                <span className="text-slate-300">{c.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">CPU</span>
                <span className="text-cyber-cyan">{c.cpu}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">RAM</span>
                <span className="text-emerald-400">{c.memory} ({c.memPerc})</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {activeLog && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-6 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-5xl h-[80vh] rounded-xl flex flex-col shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950 rounded-t-xl">
              <h3 className="font-mono text-cyber-cyan font-bold flex items-center gap-2">
                <Terminal className="w-5 h-5" />
                {activeLog} Logs
              </h3>
              <button onClick={() => setActiveLog(null)} className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 p-2 rounded">
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 font-mono text-xs text-slate-300 bg-[#0a0a0a] leading-relaxed">
              {logs[activeLog]?.length === 0 ? (
                <div className="text-slate-500 italic">No logs available.</div>
              ) : (
                logs[activeLog]?.map((line, i) => (
                  <div key={i} className="whitespace-pre-wrap break-all hover:bg-slate-800/30 px-1">{line}</div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
