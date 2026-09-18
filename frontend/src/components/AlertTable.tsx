'use client';

import { useState, useMemo }       from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { Filter }                  from 'lucide-react';
import { SecurityEvent, EventType } from '@/hooks/useSocData';

// ─────────────────────────────────────────────
// Types & constants
// ─────────────────────────────────────────────
type FilterKey = 'ALL' | 'SSH_FAILED' | 'FAIL2BAN_BLOCK' | 'SSH_SUCCESS';

const FILTERS: { key: FilterKey; label: string; color: string }[] = [
  { key: 'ALL',            label: 'All Events',    color: '#94a3b8' },
  { key: 'SSH_FAILED',     label: 'SSH Failed',    color: '#ff003c' },
  { key: 'FAIL2BAN_BLOCK', label: 'Fail2Ban',      color: '#f97316' },
  { key: 'SSH_SUCCESS',    label: 'SSH Success',   color: '#06b6d4' },
];

interface BadgeProps { type: EventType }
function EventBadge({ type }: BadgeProps) {
  const map: Record<EventType, string> = {
    SSH_FAILED       : 'badge-red',
    SSH_SUCCESS      : 'badge-cyan',
    FAIL2BAN_BLOCK   : 'badge-orange',
    FAIL2BAN_UNBLOCK : 'badge-yellow',
    UNKNOWN          : 'badge-gray',
  };
  return <span className={map[type] ?? 'badge-gray'}>{type.replace('_', ' ')}</span>;
}

interface RowGlowStyle { background?: string; borderLeft?: string }
function getRowStyle(type: EventType, isFirst: boolean): RowGlowStyle {
  if (!isFirst) return {};
  switch (type) {
    case 'SSH_FAILED'      : return { background: 'rgba(255,0,60,0.06)',   borderLeft: '2px solid rgba(255,0,60,0.5)' };
    case 'SSH_SUCCESS'     : return { background: 'rgba(6,182,212,0.06)', borderLeft: '2px solid rgba(6,182,212,0.5)' };
    case 'FAIL2BAN_BLOCK'  : return { background: 'rgba(249,115,22,0.06)', borderLeft: '2px solid rgba(249,115,22,0.5)' };
    case 'FAIL2BAN_UNBLOCK': return { background: 'rgba(234,179,8,0.06)',  borderLeft: '2px solid rgba(234,179,8,0.5)' };
    default: return {};
  }
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────
interface Props { events: SecurityEvent[] }

const MAX_ROWS = 50;

export default function AlertTable({ events }: Props) {
  const [activeFilter, setActiveFilter] = useState<FilterKey>('ALL');

  const filtered = useMemo(() => {
    const source = activeFilter === 'ALL'
      ? events
      : events.filter(e => e.event_type === activeFilter);
    return source.slice(0, MAX_ROWS);
  }, [events, activeFilter]);

  return (
    <div className="glass-panel rounded-xl flex flex-col h-full min-h-0">

      {/* ── Header ─────────────────────────────────── */}
      <div className="panel-header flex-shrink-0 flex-wrap gap-y-2">
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-500" />
          <span className="font-orbitron text-[10px] tracking-[0.2em] text-slate-400 uppercase">
            Unified Alert Console
          </span>
          <span
            className="font-mono text-[9px] text-slate-600 px-2 py-0.5 rounded"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            {filtered.length} / {events.length}
          </span>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className="px-3 py-1 rounded font-mono text-[10px] tracking-widest uppercase transition-all"
              style={{
                background : activeFilter === f.key ? `${f.color}20` : 'rgba(255,255,255,0.03)',
                border     : `1px solid ${activeFilter === f.key ? `${f.color}50` : 'rgba(255,255,255,0.06)'}`,
                color      : activeFilter === f.key ? f.color : '#64748b',
                boxShadow  : activeFilter === f.key ? `0 0 12px ${f.color}30` : 'none',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table ──────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10" style={{ background: 'rgba(2,8,23,0.95)' }}>
            <tr>
              {['Time', 'Event', 'IP Address', 'User', 'Country', 'City'].map(col => (
                <th
                  key={col}
                  className="px-4 py-2.5 text-left font-mono text-[9px] tracking-[0.2em] text-slate-600 uppercase"
                  style={{ borderBottom: '1px solid rgba(6,182,212,0.08)' }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center font-mono text-xs text-slate-700">
                  No events yet — waiting for data...
                </td>
              </tr>
            )}
            {filtered.map((event, idx) => (
              <tr
                key={event.id ?? idx}
                className="group transition-colors hover:bg-white/[0.02]"
                style={{
                  ...getRowStyle(event.event_type, idx === 0),
                  animation: idx === 0 ? 'slide-in 0.35s ease-out' : undefined,
                  borderBottom: '1px solid rgba(255,255,255,0.03)',
                }}
              >
                {/* Timestamp */}
                <td className="px-4 py-2 font-mono text-slate-500 tabular-nums whitespace-nowrap">
                  {(() => {
                    const parsed = event.timestamp ? new Date(event.timestamp) : new Date();
                    const validDate = isNaN(parsed.getTime()) ? new Date() : parsed;
                    return formatDistanceToNowStrict(validDate, { addSuffix: true });
                  })()}
                </td>

                {/* Event badge */}
                <td className="px-4 py-2 whitespace-nowrap">
                  <EventBadge type={event.event_type} />
                </td>

                {/* IP Address */}
                <td className="px-4 py-2 font-mono text-slate-300 tabular-nums whitespace-nowrap">
                  {event.ip_address}
                </td>

                {/* User */}
                <td className="px-4 py-2 font-mono text-slate-500 whitespace-nowrap">
                  {event.targeted_user ?? <span className="text-slate-700">—</span>}
                </td>

                {/* Country */}
                <td className="px-4 py-2 text-slate-400 whitespace-nowrap">
                  {event.country ?? <span className="text-slate-700 font-mono">—</span>}
                </td>

                {/* City */}
                <td className="px-4 py-2 text-slate-500 whitespace-nowrap">
                  {event.city ?? <span className="text-slate-700 font-mono">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
