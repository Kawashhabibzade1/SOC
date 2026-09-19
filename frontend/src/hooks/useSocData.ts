'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
export type EventType =
  | 'SSH_FAILED'
  | 'SSH_SUCCESS'
  | 'SFTP_FAILED'
  | 'SFTP_SUCCESS'
  | 'FTP_FAILED'
  | 'FTP_SUCCESS'
  | 'XRDP_FAILED'
  | 'XRDP_SUCCESS'
  | 'FAIL2BAN_BLOCK'
  | 'FAIL2BAN_UNBLOCK'
  | 'UNKNOWN';

export interface SecurityEvent {
  id           : number;
  timestamp    : string;
  event_type   : EventType;
  ip_address   : string;
  targeted_user: string | null;
  country      : string | null;
  city         : string | null;
  latitude     : number | null;
  longitude    : number | null;
}

export interface SocStats {
  totalEvents      : number;
  failedLogins     : number;
  blocks           : number;
  successLogins    : number;
  uniqueCountries  : number;
}

export interface SocDataState {
  events      : SecurityEvent[];
  isConnected : boolean;
  latestEvent : SecurityEvent | null;
  stats       : SocStats;
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────
const GATEWAY_URL  = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3001';
const MAX_EVENTS   = 300; // Rolling buffer size
const FETCH_LIMIT  = 100; // Historical events to load on startup
const FAILED_LOGIN_EVENTS: EventType[] = ['SSH_FAILED', 'SFTP_FAILED', 'FTP_FAILED', 'XRDP_FAILED'];
const SUCCESS_LOGIN_EVENTS: EventType[] = ['SSH_SUCCESS', 'SFTP_SUCCESS', 'FTP_SUCCESS', 'XRDP_SUCCESS'];

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────
export function useSocData(): SocDataState {
  const [events,      setEvents]      = useState<SecurityEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [latestEvent, setLatestEvent] = useState<SecurityEvent | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const pushEvent = useCallback((event: SecurityEvent) => {
    setEvents(prev => [event, ...prev].slice(0, MAX_EVENTS));
    setLatestEvent(event);
  }, []);

  useEffect(() => {
    // ── 1. Fetch historical data ───────────────────────────
    fetch(`${GATEWAY_URL}/api/events/recent?limit=${FETCH_LIMIT}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(body => {
        if (body.success && Array.isArray(body.data)) {
          setEvents(body.data);
        }
      })
      .catch(err => console.error('[useSocData] History fetch failed:', err.message));

    // ── 2. Establish Socket.io connection ─────────────────
    const socket = io(GATEWAY_URL, {
      transports       : ['websocket', 'polling'],
      reconnection     : true,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      timeout          : 5000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket.io] Connected:', socket.id);
      setIsConnected(true);
    });

    socket.on('disconnect', reason => {
      console.warn('[Socket.io] Disconnected:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', err => {
      console.warn('[Socket.io] Connection error:', err.message);
      setIsConnected(false);
    });

    socket.on('new_event', (rawEvent: Partial<SecurityEvent> & { receivedAt?: string }) => {
      const normalizedEvent: SecurityEvent = {
        id           : rawEvent.id || Date.now(),
        timestamp    : rawEvent.timestamp || rawEvent.receivedAt || new Date().toISOString(),
        event_type   : (rawEvent.event_type as EventType) || 'UNKNOWN',
        ip_address   : rawEvent.ip_address || '0.0.0.0',
        targeted_user: rawEvent.targeted_user || null,
        country      : rawEvent.country || null,
        city         : rawEvent.city || null,
        latitude     : rawEvent.latitude != null ? Number(rawEvent.latitude) : null,
        longitude    : rawEvent.longitude != null ? Number(rawEvent.longitude) : null,
      };
      pushEvent(normalizedEvent);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [pushEvent]);

  // ── Derived stats (computed from current events array) ──
  const stats: SocStats = {
    totalEvents    : events.length,
    failedLogins   : events.filter(e => FAILED_LOGIN_EVENTS.includes(e.event_type)).length,
    blocks         : events.filter(e => e.event_type === 'FAIL2BAN_BLOCK').length,
    successLogins  : events.filter(e => SUCCESS_LOGIN_EVENTS.includes(e.event_type)).length,
    uniqueCountries: new Set(events.map(e => e.country).filter(Boolean)).size,
  };

  return { events, isConnected, latestEvent, stats };
}
