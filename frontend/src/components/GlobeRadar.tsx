'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { SecurityEvent } from '@/hooks/useSocData';

interface GlobeRadarProps {
  events: SecurityEvent[];
  latestEvent: SecurityEvent | null;
}

export default function GlobeRadar({ events, latestEvent }: GlobeRadarProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient || !mountRef.current) return;
    const mountNode = mountRef.current;

    // --- Scene Setup ---
    const width = mountNode.clientWidth;
    const height = mountNode.clientHeight;

    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 250;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    mountNode.appendChild(renderer.domElement);

    // --- Globe ---
    const globeRadius = 100;
    
    // Core sphere (dark with high-res texture)
    const textureLoader = new THREE.TextureLoader();
    const earthTexture = textureLoader.load('https://unpkg.com/three-globe/example/img/earth-dark.jpg');
    const bumpMap = textureLoader.load('https://unpkg.com/three-globe/example/img/earth-topology.png');

    const sphereGeometry = new THREE.SphereGeometry(globeRadius, 64, 64);
    const sphereMaterial = new THREE.MeshPhongMaterial({
      map: earthTexture,
      bumpMap: bumpMap,
      bumpScale: 1.5,
      color: 0xffffff,
      emissive: 0x020817,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.95,
    });
    const globe = new THREE.Mesh(sphereGeometry, sphereMaterial);
    scene.add(globe);

    // Wireframe overlay for cyber look
    const wireframeGeometry = new THREE.WireframeGeometry(new THREE.SphereGeometry(globeRadius + 0.5, 32, 32));
    const wireframeMaterial = new THREE.LineBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.05,
    });
    const wireframe = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);
    globe.add(wireframe);

    // Glow effect (Atmosphere)
    const glowGeometry = new THREE.SphereGeometry(globeRadius * 1.15, 32, 32);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.05,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    });
    const atmosphere = new THREE.Mesh(glowGeometry, glowMaterial);
    scene.add(atmosphere);

    // --- Lights ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 1, 1).normalize();
    scene.add(directionalLight);
    
    const blueLight = new THREE.PointLight(0x06b6d4, 1.5, 300);
    blueLight.position.set(-100, 50, 150);
    scene.add(blueLight);


    // --- Data Markers Group ---
    const markersGroup = new THREE.Group();
    globe.add(markersGroup);

    // Helper: lat/lon to Vector3
    const getCoordinates = (lat: number, lon: number, radius: number) => {
      const phi = (90 - lat) * (Math.PI / 180);
      const theta = (lon + 180) * (Math.PI / 180);
      
      const x = -(radius * Math.sin(phi) * Math.cos(theta));
      const z = (radius * Math.sin(phi) * Math.sin(theta));
      const y = (radius * Math.cos(phi));
      return new THREE.Vector3(x, y, z);
    };

    const HQ_LAT = 50.1109;
    const HQ_LON = 8.6821;
    const hqPos  = getCoordinates(HQ_LAT, HQ_LON, globeRadius);

    // Dynamic pulse rings array to animate in render loop
    const pulsingRings: { mesh: THREE.Mesh; baseScale: number; speed: number }[] = [];

    const createMarkers = () => {
      // Clear old markers
      while (markersGroup.children.length > 0) {
        const child = markersGroup.children[0];
        markersGroup.remove(child);
      }
      pulsingRings.length = 0;

      // 1. Plot SOC Gateway HQ Base (Cyan beacon with pulsing wave)
      const hqDotGeo = new THREE.SphereGeometry(3.5, 16, 16);
      const hqDotMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
      const hqDot = new THREE.Mesh(hqDotGeo, hqDotMat);
      hqDot.position.copy(hqPos);
      markersGroup.add(hqDot);

      // HQ Vertical Beacon Spike
      const hqNormal = hqPos.clone().normalize();
      const hqSpikeEnd = hqPos.clone().add(hqNormal.clone().multiplyScalar(18));
      const hqSpikeGeo = new THREE.BufferGeometry().setFromPoints([hqPos, hqSpikeEnd]);
      const hqSpikeMat = new THREE.LineBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.9 });
      markersGroup.add(new THREE.Line(hqSpikeGeo, hqSpikeMat));

      // HQ Pulse Ring
      const hqRingGeo = new THREE.RingGeometry(2, 4, 32);
      const hqRingMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, side: THREE.DoubleSide, transparent: true, opacity: 0.7 });
      const hqRing = new THREE.Mesh(hqRingGeo, hqRingMat);
      hqRing.position.copy(hqPos.clone().add(hqNormal.clone().multiplyScalar(0.5)));
      hqRing.lookAt(hqPos.clone().add(hqNormal));
      markersGroup.add(hqRing);
      pulsingRings.push({ mesh: hqRing, baseScale: 1, speed: 0.03 });

      // 2. Plot Events
      events.forEach((event, idx) => {
        let lat = Number(event.latitude);
        let lon = Number(event.longitude);

        // Fallback for internal / private IPs: cluster near HQ with slight jitter
        if (isNaN(lat) || isNaN(lon) || (lat === 0 && lon === 0)) {
          const angle = ((event.id || idx) * 137.5) * (Math.PI / 180);
          const dist  = 1.5 + ((event.id || idx) % 5) * 0.8;
          lat = HQ_LAT + Math.sin(angle) * dist;
          lon = HQ_LON + Math.cos(angle) * dist;
        }

        const pos = getCoordinates(lat, lon, globeRadius);
        const normal = pos.clone().normalize();

        let color = 0x64748b;
        if (event.event_type === 'SSH_FAILED')      color = 0xff003c;
        if (event.event_type === 'SSH_SUCCESS')     color = 0x06b6d4;
        if (event.event_type === 'FAIL2BAN_BLOCK')  color = 0xf97316;
        if (event.event_type === 'FAIL2BAN_UNBLOCK') color = 0xeab308;
        if (event.event_type === 'XRDP_FAILED')     color = 0xd946ef;
        if (event.event_type === 'FTP_FAILED')      color = 0xec4899;

        // Core dot
        const dotGeo = new THREE.SphereGeometry(2.5, 12, 12);
        const dotMat = new THREE.MeshBasicMaterial({ color });
        const dot = new THREE.Mesh(dotGeo, dotMat);
        dot.position.copy(pos);
        markersGroup.add(dot);

        // Vertical laser beacon
        const spikeHeight = event.event_type === 'SSH_FAILED' ? 14 : 9;
        const spikeEnd = pos.clone().add(normal.clone().multiplyScalar(spikeHeight));
        const spikeGeo = new THREE.BufferGeometry().setFromPoints([pos, spikeEnd]);
        const spikeMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8 });
        markersGroup.add(new THREE.Line(spikeGeo, spikeMat));

        // 3. Draw 3D curved parabolic attack arc to HQ
        const distance = pos.distanceTo(hqPos);
        if (distance > 15) { // Only draw trajectory arcs if not right on top of HQ
          const midPoint = new THREE.Vector3().addVectors(pos, hqPos).multiplyScalar(0.5);
          const arcAltitude = globeRadius + Math.min(distance * 0.4, 50);
          midPoint.setLength(arcAltitude);

          const curve = new THREE.QuadraticBezierCurve3(pos, midPoint, hqPos);
          const points = curve.getPoints(40);
          const arcGeo = new THREE.BufferGeometry().setFromPoints(points);
          const arcMat = new THREE.LineBasicMaterial({
            color,
            transparent: true,
            opacity: event.event_type === 'SSH_FAILED' ? 0.65 : 0.4,
          });
          const arcLine = new THREE.Line(arcGeo, arcMat);
          markersGroup.add(arcLine);
        }
      });
    };

    createMarkers();


    // --- Animation Loop ---
    let animationFrameId: number;
    let rotationSpeed = 0.002;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      globe.rotation.y += rotationSpeed;

      // Animate pulsing radar waves
      pulsingRings.forEach(r => {
        r.baseScale += r.speed;
        if (r.baseScale > 3.0) {
          r.baseScale = 1.0;
        }
        r.mesh.scale.set(r.baseScale, r.baseScale, 1);
        (r.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.8 - (r.baseScale - 1) / 2.5);
      });

      renderer.render(scene, camera);
    };
    animate();

    // --- Resize Handler ---
    const handleResize = () => {
      if (!mountNode) return;
      const newWidth = mountNode.clientWidth;
      const newHeight = mountNode.clientHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };
    window.addEventListener('resize', handleResize);

    // --- Simple Interaction (Mouse drag to rotate) ---
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };

    const onMouseDown = () => { isDragging = true; };
    const onMouseUp = () => { isDragging = false; };
    const onMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const deltaMove = {
          x: e.offsetX - previousMousePosition.x,
          y: e.offsetY - previousMousePosition.y
        };
        globe.rotation.y += deltaMove.x * 0.005;
        globe.rotation.x += deltaMove.y * 0.005;
      }
      previousMousePosition = { x: e.offsetX, y: e.offsetY };
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        isDragging = true;
        const touch = e.touches[0];
        const rect = dom.getBoundingClientRect();
        previousMousePosition = { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
      }
    };
    const onTouchEnd = () => { isDragging = false; };
    const onTouchMove = (e: TouchEvent) => {
      if (isDragging && e.touches.length === 1) {
        const touch = e.touches[0];
        const rect = dom.getBoundingClientRect();
        const curX = touch.clientX - rect.left;
        const curY = touch.clientY - rect.top;
        const deltaMove = {
          x: curX - previousMousePosition.x,
          y: curY - previousMousePosition.y
        };
        globe.rotation.y += deltaMove.x * 0.005;
        globe.rotation.x += deltaMove.y * 0.005;
        previousMousePosition = { x: curX, y: curY };
      }
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', onMouseDown);
    dom.addEventListener('mousemove', onMouseMove);
    dom.addEventListener('mouseup', onMouseUp);
    dom.addEventListener('mouseleave', onMouseUp);
    dom.addEventListener('touchstart', onTouchStart, { passive: true });
    dom.addEventListener('touchmove', onTouchMove, { passive: true });
    dom.addEventListener('touchend', onTouchEnd);

    // --- Cleanup ---
    return () => {
      window.removeEventListener('resize', handleResize);
      dom.removeEventListener('mousedown', onMouseDown);
      dom.removeEventListener('mousemove', onMouseMove);
      dom.removeEventListener('mouseup', onMouseUp);
      dom.removeEventListener('mouseleave', onMouseUp);
      dom.removeEventListener('touchstart', onTouchStart);
      dom.removeEventListener('touchmove', onTouchMove);
      dom.removeEventListener('touchend', onTouchEnd);
      cancelAnimationFrame(animationFrameId);
      
      if (mountNode && dom) {
        mountNode.removeChild(dom);
      }
      renderer.dispose();
      sphereGeometry.dispose();
      sphereMaterial.dispose();
    };
  }, [isClient, events]);

  if (!isClient) return <div className="w-full h-full min-h-[300px] flex items-center justify-center bg-[#020817]" />;

  return (
    <div className="relative w-full h-full min-h-[300px] flex items-center justify-center bg-transparent">
      <div ref={mountRef} className="absolute inset-0 cursor-move" />
      
      <div className="absolute top-3 left-3 sm:top-4 sm:left-4 flex flex-col gap-1.5 pointer-events-none bg-black/40 backdrop-blur-md px-3 py-2 rounded-xl border border-cyan-500/20">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          <span className="font-mono text-[10px] text-cyan-400 font-bold tracking-widest uppercase">SOC HQ: ACTIVE</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse glow-red" />
          <span className="font-mono text-[10px] text-red-400 tracking-widest uppercase">Threat Arcs: {events.filter(e => e.event_type === 'SSH_FAILED' || e.event_type === 'FAIL2BAN_BLOCK' || e.event_type === 'XRDP_FAILED' || e.event_type === 'FTP_FAILED').length}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-500 glow-cyan" />
          <span className="font-mono text-[10px] text-slate-400 tracking-widest uppercase">Verified: {events.filter(e => e.event_type === 'SSH_SUCCESS').length}</span>
        </div>
      </div>
    </div>
  );
}
