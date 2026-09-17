'use client';

import { SocStats } from '@/hooks/useSocData';

interface RingProps {
  label    : string;
  value    : number;
  max      : number;
  sublabel : string;
  color    : string;        // stroke color
  trackColor: string;       // track circle color
  glowColor: string;        // CSS box shadow color
  icon     : string;        // emoji/ascii icon
}

function MetricsRing({ label, value, max, sublabel, color, trackColor, glowColor, icon }: RingProps) {
  const radius      = 36;
  const strokeWidth = 6;
  const circumference = 2 * Math.PI * radius;
  const progress      = Math.min(value / Math.max(max, 1), 1);
  const dashOffset    = circumference * (1 - progress);

  return (
    <div
      className="glass-panel rounded-xl p-4 flex flex-col items-center gap-2 animate-ring-enter"
      style={{ minWidth: 0 }}
    >
      {/* Label */}
      <p className="font-mono text-[10px] tracking-[0.2em] text-slate-500 uppercase truncate w-full text-center">
        {icon} {label}
      </p>

      {/* SVG Ring */}
      <div className="relative flex items-center justify-center">
        <svg
          width="96" height="96"
          viewBox="0 0 96 96"
          style={{ transform: 'rotate(-90deg)' }}
        >
          {/* Glow filter */}
          <defs>
            <filter id={`glow-${label.replace(/\s/g, '')}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Track */}
          <circle
            cx="48" cy="48"
            r={radius}
            fill="none"
            stroke={trackColor}
            strokeWidth={strokeWidth}
          />

          {/* Progress arc */}
          <circle
            cx="48" cy="48"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            filter={`url(#glow-${label.replace(/\s/g, '')})`}
            style={{
              transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        </svg>

        {/* Center value */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-orbitron font-black text-xl tabular-nums"
            style={{ color, textShadow: `0 0 16px ${glowColor}` }}
          >
            {value.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Sublabel */}
      <p className="font-mono text-[9px] text-slate-600 tracking-widest uppercase text-center">
        {sublabel}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────
// MetricsRow — assembles 4 rings
// ─────────────────────────────────────────────
interface MetricsRowProps {
  stats: SocStats;
}

export default function MetricsRow({ stats }: MetricsRowProps) {
  const rings: RingProps[] = [
    {
      label     : 'Total Events',
      value     : stats.totalEvents,
      max       : Math.max(stats.totalEvents, 200),
      sublabel  : 'in session',
      color     : '#06b6d4',
      trackColor: 'rgba(6,182,212,0.1)',
      glowColor : 'rgba(6,182,212,0.6)',
      icon      : '◈',
    },
    {
      label     : 'Failed Logins',
      value     : stats.failedLogins,
      max       : Math.max(stats.totalEvents, 1),
      sublabel  : 'ssh_failed',
      color     : '#ff003c',
      trackColor: 'rgba(255,0,60,0.1)',
      glowColor : 'rgba(255,0,60,0.6)',
      icon      : '⚠',
    },
    {
      label     : 'Active Blocks',
      value     : stats.blocks,
      max       : Math.max(stats.failedLogins, 1),
      sublabel  : 'fail2ban',
      color     : '#f97316',
      trackColor: 'rgba(249,115,22,0.1)',
      glowColor : 'rgba(249,115,22,0.6)',
      icon      : '⊘',
    },
    {
      label     : 'Countries',
      value     : stats.uniqueCountries,
      max       : 50,
      sublabel  : 'unique origins',
      color     : '#10b981',
      trackColor: 'rgba(16,185,129,0.1)',
      glowColor : 'rgba(16,185,129,0.6)',
      icon      : '◎',
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-3 flex-shrink-0">
      {rings.map(ring => (
        <MetricsRing key={ring.label} {...ring} />
      ))}
    </div>
  );
}
