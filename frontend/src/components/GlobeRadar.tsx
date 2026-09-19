'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { SecurityEvent } from '@/hooks/useSocData';
import * as THREE from 'three';

// Import Globe dynamically to avoid SSR issues
const Globe = dynamic(() => import('react-globe.gl'), { ssr: false });

interface GlobeRadarProps {
  events: SecurityEvent[];
  latestEvent: SecurityEvent | null;
}

const HQ_LAT = 50.1109; // Frankfurt HQ
const HQ_LON = 8.6821;

export default function GlobeRadar({ events, latestEvent }: GlobeRadarProps) {
  const globeRef = useRef<any>();
  const [countries, setCountries] = useState<any>({ features: [] });
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    // Fetch a highly detailed GeoJSON map of world countries
    fetch('https://raw.githubusercontent.com/vasturiano/react-globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson')
      .then(res => res.json())
      .then(setCountries)
      .catch(err => console.error("Could not load countries dataset:", err));
  }, []);

  useEffect(() => {
    if (globeRef.current) {
      globeRef.current.controls().autoRotate = true;
      globeRef.current.controls().autoRotateSpeed = 0.4;
      globeRef.current.pointOfView({ altitude: 2.5, lat: 20, lng: 0 }, 2000);
    }
  }, [globeRef.current, isClient]);

  // Use Memo for data calculations so globe doesn't stutter on every re-render
  const { arcsData, pointsData, ringsData } = useMemo(() => {
    const arcs = [];
    const points = [];
    const rings = [];

    // Base HQ Ring
    rings.push({
      lat: HQ_LAT,
      lng: HQ_LON,
      maxR: 4,
      propagationSpeed: 2,
      repeatPeriod: 1000,
      color: '#06b6d4'
    });
    
    points.push({
      lat: HQ_LAT,
      lng: HQ_LON,
      size: 0.8,
      color: '#06b6d4',
      label: 'SOC HQ'
    });

    events.forEach((e, idx) => {
      let lat = Number(e.latitude);
      let lon = Number(e.longitude);

      if (isNaN(lat) || isNaN(lon) || (lat === 0 && lon === 0)) {
        // Fallback offset near HQ
        const angle = ((e.id || idx) * 137.5) * (Math.PI / 180);
        const dist = 1.5 + ((e.id || idx) % 5) * 0.8;
        lat = HQ_LAT + Math.sin(angle) * dist;
        lon = HQ_LON + Math.cos(angle) * dist;
      }

      let color = '#64748b';
      if (e.event_type === 'SSH_FAILED')      color = '#ff003c';
      if (e.event_type === 'SSH_SUCCESS')     color = '#06b6d4';
      if (e.event_type === 'FAIL2BAN_BLOCK')  color = '#f97316';
      if (e.event_type === 'FAIL2BAN_UNBLOCK') color = '#eab308';
      if (e.event_type === 'XRDP_FAILED')     color = '#d946ef';
      if (e.event_type === 'FTP_FAILED')      color = '#ec4899';

      points.push({ lat, lng: lon, size: 0.3, color });

      const distToHQ = Math.sqrt(Math.pow(lat - HQ_LAT, 2) + Math.pow(lon - HQ_LON, 2));
      if (distToHQ > 5) {
        arcs.push({
          startLat: lat,
          startLng: lon,
          endLat: HQ_LAT,
          endLng: HQ_LON,
          color,
          dashAnimateTime: e.event_type === 'SSH_FAILED' ? 1000 : 2500,
          opacity: 0.6
        });
      }

      if (e.event_type === 'SSH_FAILED' || e.event_type === 'FAIL2BAN_BLOCK') {
        rings.push({
          lat,
          lng: lon,
          maxR: 3,
          propagationSpeed: 1.5,
          repeatPeriod: 1500,
          color
        });
      }
    });

    return { arcsData: arcs, pointsData: points, ringsData: rings };
  }, [events]);

  if (!isClient) return <div className="w-full h-full min-h-[300px] bg-[#020817]" />;

  return (
    <div className="relative w-full h-full min-h-[300px] flex items-center justify-center bg-transparent cursor-move">
      <Globe
        ref={globeRef}
        // Background and Globe Appearance
        backgroundColor="rgba(0,0,0,0)"
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        
        // Extremely Detailed Country Polygons (GeoJSON)
        polygonsData={countries.features}
        polygonAltitude={0.01}
        polygonCapColor={() => 'rgba(6, 182, 212, 0.04)'}
        polygonSideColor={() => 'rgba(6, 182, 212, 0.08)'}
        polygonStrokeColor={() => 'rgba(6, 182, 212, 0.6)'}
        polygonsTransitionDuration={300}
        
        // Data Layers
        arcsData={arcsData}
        arcColor={(d: any) => d.color}
        arcDashLength={0.4}
        arcDashGap={0.2}
        arcDashAnimateTime={(d: any) => d.dashAnimateTime}
        arcAltitudeAutoScale={0.2}
        
        pointsData={pointsData}
        pointColor={(d: any) => d.color}
        pointAltitude={0.02}
        pointRadius={(d: any) => d.size}
        
        ringsData={ringsData}
        ringColor={(d: any) => d.color}
        ringMaxRadius={(d: any) => d.maxR}
        ringPropagationSpeed={(d: any) => d.propagationSpeed}
        ringRepeatPeriod={(d: any) => d.repeatPeriod}
      />
      
      <div className="absolute top-3 left-3 sm:top-4 sm:left-4 flex flex-col gap-1.5 pointer-events-none bg-black/40 backdrop-blur-md px-3 py-2 rounded-xl border border-cyan-500/20">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          <span className="font-mono text-[10px] text-cyan-400 font-bold tracking-widest uppercase">SOC HQ: ACTIVE</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse glow-red" />
          <span className="font-mono text-[10px] text-red-400 tracking-widest uppercase">Threat Arcs: {arcsData.filter(a => a.color === '#ff003c' || a.color === '#f97316').length}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-500 glow-cyan" />
          <span className="font-mono text-[10px] text-slate-400 tracking-widest uppercase">Verified: {pointsData.filter(p => p.color === '#06b6d4').length - 1}</span>
        </div>
      </div>
    </div>
  );
}
