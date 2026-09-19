'use client';

import { useEffect, useRef } from 'react';
import { format }            from 'date-fns';
import { SecurityEvent, EventType } from '@/hooks/useSocData';

// ─────────────────────────────────────────────
// Styling helpers
// ─────────────────────────────────────────────
const TYPE_STYLE: Record<EventType, { tag: string; color: string; dim: string }> = {
  SSH_FAILED       : { tag: 'FAIL ', color: '#ff003c', dim: '#7f0022' },
  SSH_SUCCESS      : { tag: 'AUTH ', color: '#06b6d4', dim: '#035c6e' },
  FAIL2BAN_BLOCK   : { tag: 'BAN  ', color: '#f97316', dim: '#7c3912' },
  FAIL2BAN_UNBLOCK : { tag: 'UNBAN', color: '#eab308', dim: '#75590e' },
  XRDP_FAILED      : { tag: 'XRDP ', color: '#d946ef', dim: '#7a1f8a' },
  FTP_FAILED       : { tag: 'FTP  ', color: '#ec4899', dim: '#8b1a54' },
  SFTP_FAILED      : { tag: 'SFTP ', color: '#14b8a6', dim: '#0d6e67' },
  XRDP_SUCCESS     : { tag: 'XRDP+', color: '#d946ef', dim: '#06b6d4' },
  FTP_SUCCESS      : { tag: 'FTP+ ', color: '#ec4899', dim: '#06b6d4' },
  SFTP_SUCCESS     : { tag: 'SFTP+', color: '#14b8a6', dim: '#06b6d4' },
  UNKNOWN          : { tag: '?????', color: '#6b7280', dim: '#374151' },
};

function formatLine(event: SecurityEvent): string {
  const parts: string[] = [];

  if (event.ip_address)   parts.push(event.ip_address.padEnd(16));
  if (event.targeted_user) parts.push(`→ ${event.targeted_user}`);

  const loc = [event.city, event.country].filter(Boolean).join(', ');
  if (loc) parts.push(`[${loc}]`);

  return parts.join(' ');
}

function parseUtcDate(timestamp?: string | null): Date {
  if (!timestamp) return new Date();
  let clean = String(timestamp).trim();
  if (clean.includes(' ') && !clean.includes('T')) {
    clean = clean.replace(' ', 'T');
  }
  if (!clean.endsWith('Z') && !/[+-]\d{2}(?::?\d{2})?$/.test(clean)) {
    clean += 'Z';
  }
  const d = new Date(clean);
  return isNaN(d.getTime()) ? new Date() : d;
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────
interface Props {
  events: SecurityEvent[];
}

const MAX_LINES = 80;

export default function TerminalFeed({ events }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const display   = events.slice(0, MAX_LINES);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events.length]);

  return (
    <div
      className="glass-panel rounded-xl flex flex-col h-full min-h-0"
      style={{ overflow: 'hidden' }}
    >
      {/* Header */}
      <div className="panel-header flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-cyber-green font-mono text-xs glow-green">▶</span>
          <span className="font-orbitron text-[10px] tracking-[0.2em] text-slate-400 uppercase">
            Live Terminal Feed
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Traffic-light dots */}
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
        </div>
      </div>

      {/* Terminal body */}
      <div
        className="flex-1 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed space-y-0.5"
        style={{ minHeight: 0 }}
      >
        {/* Boot message */}
        <div className="text-slate-600 mb-2 pb-2 border-b border-slate-800/50">
          <span className="text-cyber-cyan/40">SOC-RADAR</span>
          <span className="text-slate-700"> v1.0.0 — Security Log Parser Online</span>
        </div>

        {/* Reversed so newest is at bottom */}
        {[...display].reverse().map((event, idx) => {
          const style = TYPE_STYLE[event.event_type] ?? TYPE_STYLE.UNKNOWN;
          const validDate = parseUtcDate(event.timestamp);
          const ts        = format(validDate, 'HH:mm:ss.SSS');

          return (
            <div
              key={event.id ?? idx}
              className="flex gap-2 items-start group hover:bg-white/[0.02] rounded px-1 -mx-1 transition-colors"
              style={{ animation: idx === 0 ? 'fade-in 0.3s ease-out' : undefined }}
            >
              {/* Timestamp */}
              <span className="text-slate-700 flex-shrink-0 tabular-nums">
                {ts}
              </span>

              {/* Event type tag */}
              <span
                className="flex-shrink-0 font-bold"
                style={{ color: style.color, textShadow: `0 0 8px ${style.color}` }}
              >
                [{style.tag}]
              </span>

              {/* Payload */}
              <span style={{ color: style.dim }} className="truncate flex-1 min-w-0">
                {formatLine(event)}
              </span>
            </div>
          );
        })}

        {/* Blinking cursor at bottom */}
        <div className="flex items-center gap-2 pt-1">
          <span className="text-cyber-green font-bold">root@soc-radar:~$</span>
          <span className="w-2 h-4 bg-cyber-green/80 animate-cursor-blink inline-block" />
        </div>

        {/* Scroll anchor */}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
