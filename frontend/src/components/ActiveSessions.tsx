import React from 'react';
import { ActiveSession } from '@/hooks/useSocData';
import { Network, Server, MonitorSmartphone, Monitor } from 'lucide-react';

interface ActiveSessionsProps {
  sessions: ActiveSession[];
}

export default function ActiveSessions({ sessions }: ActiveSessionsProps) {
  return (
    <div className="glass-panel rounded-xl flex flex-col h-full min-h-0">
      <div className="panel-header flex-shrink-0 flex items-center justify-between p-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyber-cyan opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyber-cyan" style={{ boxShadow: '0 0 8px #06b6d4' }} />
          </span>
          <span className="font-orbitron text-[10px] tracking-[0.2em] text-slate-400 uppercase">
            Live Connections
          </span>
        </div>
        <span className="text-[10px] font-mono text-cyber-cyan">{sessions.length} ACTIVE</span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 min-h-0 space-y-2">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2 opacity-50 p-4">
            <Network className="w-8 h-8" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-center">No External Devices<br/>Currently Connected</span>
          </div>
        ) : (
          sessions.map((session, idx) => (
            <div key={`${session.ip}-${session.service}-${idx}`} className="flex items-center justify-between p-3 rounded-lg border border-slate-700/50 bg-slate-800/20 hover:bg-slate-800/40 transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded bg-slate-900/50 text-cyber-cyan">
                  {session.service === 'XRDP' ? <Monitor className="w-4 h-4" /> : 
                   session.service === 'FTP' ? <Server className="w-4 h-4" /> : 
                   <MonitorSmartphone className="w-4 h-4" />}
                </div>
                <div className="flex flex-col">
                  <span className="font-mono text-xs text-slate-200">{session.ip}</span>
                  <span className="font-mono text-[9px] text-slate-500 uppercase tracking-widest">
                    {session.service} • {session.country || 'UNKNOWN'} {session.city ? `/ ${session.city}` : ''}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono text-cyber-green uppercase tracking-wider">Connected</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
