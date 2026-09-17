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
    
    // Core sphere (dark)
    const sphereGeometry = new THREE.SphereGeometry(globeRadius, 64, 64);
    const sphereMaterial = new THREE.MeshPhongMaterial({
      color: 0x020817,
      emissive: 0x051024,
      transparent: true,
      opacity: 0.9,
    });
    const globe = new THREE.Mesh(sphereGeometry, sphereMaterial);
    scene.add(globe);

    // Wireframe overlay for cyber look
    const wireframeGeometry = new THREE.WireframeGeometry(new THREE.SphereGeometry(globeRadius, 32, 32));
    const wireframeMaterial = new THREE.LineBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.1,
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

    const createMarkers = () => {
      // Clear old markers
      while(markersGroup.children.length > 0){ 
          const child = markersGroup.children[0];
          markersGroup.remove(child); 
      }

      events.forEach(event => {
        if (!event.latitude || !event.longitude) return;
        
        const pos = getCoordinates(event.latitude, event.longitude, globeRadius);
        
        let color = 0x6b7280; 
        if (event.event_type === 'SSH_FAILED') color = 0xff003c;
        if (event.event_type === 'SSH_SUCCESS') color = 0x06b6d4;
        if (event.event_type === 'FAIL2BAN_BLOCK') color = 0xf97316;
        if (event.event_type === 'FAIL2BAN_UNBLOCK') color = 0xeab308;

        const dotGeometry = new THREE.SphereGeometry(1.5, 8, 8);
        const dotMaterial = new THREE.MeshBasicMaterial({ color });
        const dot = new THREE.Mesh(dotGeometry, dotMaterial);
        
        dot.position.copy(pos);
        markersGroup.add(dot);
      });
    };
    
    createMarkers();


    // --- Animation Loop ---
    let animationFrameId: number;
    let rotationSpeed = 0.002;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      globe.rotation.y += rotationSpeed;
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

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', onMouseDown);
    dom.addEventListener('mousemove', onMouseMove);
    dom.addEventListener('mouseup', onMouseUp);
    dom.addEventListener('mouseleave', onMouseUp);

    // --- Cleanup ---
    return () => {
      window.removeEventListener('resize', handleResize);
      dom.removeEventListener('mousedown', onMouseDown);
      dom.removeEventListener('mousemove', onMouseMove);
      dom.removeEventListener('mouseup', onMouseUp);
      dom.removeEventListener('mouseleave', onMouseUp);
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
      
      <div className="absolute top-4 left-4 flex flex-col gap-1 pointer-events-none">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse glow-red" />
          <span className="font-mono text-[10px] text-red-500 tracking-widest uppercase">Attacks</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-500 glow-cyan" />
          <span className="font-mono text-[10px] text-cyan-500 tracking-widest uppercase">Success</span>
        </div>
      </div>
    </div>
  );
}
