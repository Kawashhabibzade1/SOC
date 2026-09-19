'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
export type EventType =
  | 'SSH_FAILED'
  | 'SSH_SUCCESS'
  | 'FAIL2BAN_BLOCK'
  | 'FAIL2BAN_UNBLOCK'
  | 'XRDP_FAILED'
  | 'FTP_FAILED'
  | 'SFTP_FAILED'
  | 'XRDP_SUCCESS'
  | 'FTP_SUCCESS'
  | 'SFTP_SUCCESS'
  | 'UNKNOWN';

export interface SecurityEvent {
  id?          : number;
  timestamp    : string;
  event_type   : EventType;
  ip_address   : string;
  targeted_user: string | null;
  country      : string | null;
  city         : string | null;
  latitude     : number | null;
  longitude    : number | null;
}

export interface ActiveSession {
  ip: string;
  service: string;
  country: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface SocStats {
  totalEvents      : number;
  failedLogins     : number;
  blocks           : number;
  successLogins    : number;
  uniqueCountries  : number;
}

export interface SocDataState {
  events         : SecurityEvent[];
  activeSessions : ActiveSession[];
  isConnected    : boolean;
  latestEvent    : SecurityEvent | null;
  stats          : SocStats;
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────
const GATEWAY_URL  = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3001';
const MAX_EVENTS   = 300; // Rolling buffer size
const FETCH_LIMIT  = 100; // Historical events to load on startup

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────
export function useSocData(): SocDataState {
  const [events,      setEvents]      = useState<SecurityEvent[]>([]);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [latestEvent, setLatestEvent] = useState<SecurityEvent | null>(null);
  const [stats,       setStats]       = useState<SocStats>({
    totalEvents: 0,
    failedLogins: 0,
    blocks: 0,
    successLogins: 0,
    uniqueCountries: 0,
  });
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
          setStats({
            totalEvents    : body.totalEvents ?? body.data.length,
            failedLogins   : body.totalFailed ?? 0,
            blocks         : body.totalBlocks ?? 0,
            successLogins  : body.totalSuccess ?? 0,
            uniqueCountries: body.totalCountries ?? 0,
          });
        }
      })
      .catch(err => console.error('[useSocData] History fetch failed:', err.message));

    // Initial fetch of active sessions
    const fetchActiveSessions = () => {
      fetch(`${GATEWAY_URL}/api/active-sessions`)
        .then(res => res.json())
        .then(body => {
          if (body.success && Array.isArray(body.data)) {
            setActiveSessions(body.data);
          }
        })
        .catch(err => console.error('[useSocData] Active sessions fetch failed:', err.message));
    };
    fetchActiveSessions();

    // Poll active sessions every 3 seconds
    const sessionInterval = setInterval(fetchActiveSessions, 3000);

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
      
      setStats(prev => {
        const isFailed = ['SSH_FAILED', 'XRDP_FAILED', 'FTP_FAILED', 'SFTP_FAILED'].includes(normalizedEvent.event_type);
        const isBlock = normalizedEvent.event_type === 'FAIL2BAN_BLOCK';
        const isSuccess = ['SSH_SUCCESS', 'XRDP_SUCCESS', 'FTP_SUCCESS', 'SFTP_SUCCESS'].includes(normalizedEvent.event_type);
        // Unique countries will be roughly estimated on the fly for new events, 
        // to avoid recalculating the entire set if it's large.
        const isNewCountry = normalizedEvent.country && !events.some(e => e.country === normalizedEvent.country) ? 1 : 0;
        
        return {
          totalEvents    : prev.totalEvents + 1,
          failedLogins   : prev.failedLogins + (isFailed ? 1 : 0),
          blocks         : prev.blocks + (isBlock ? 1 : 0),
          successLogins  : prev.successLogins + (isSuccess ? 1 : 0),
          uniqueCountries: prev.uniqueCountries + isNewCountry,
        };
      });
    });

    return () => {
      clearInterval(sessionInterval);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [pushEvent]);

  return { events, activeSessions, isConnected, latestEvent, stats };
}
