import React from 'react';
import { LayoutDashboard, Globe2, Network, Shield, Menu, X, Activity, FolderOpen } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export default function Sidebar({ activeTab, setActiveTab, isOpen, setIsOpen }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'radar', label: 'Globe Radar', icon: Globe2 },
    { id: 'system', label: 'System Metrics', icon: Activity },
    { id: 'explorer', label: 'File Explorer', icon: FolderOpen },
    { id: 'ports', label: 'Open Ports', icon: Network },
    { id: 'blocked_ips', label: 'Blocked IPs', icon: Shield },
  ];

  return (
    <>
      {/* Mobile Toggle Button */}
      <button 
        className="lg:hidden fixed bottom-4 right-4 z-[60] p-3 rounded-full bg-cyber-cyan text-[#020817] shadow-[0_0_15px_rgba(6,182,212,0.5)]"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Sidebar Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-[55] lg:hidden backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-[55] w-64 bg-[#020817]/90 backdrop-blur-xl border-r border-cyan-500/10 flex flex-col
        transition-transform duration-300 ease-in-out lg:bg-transparent lg:border-none lg:backdrop-blur-none
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}
      style={{ paddingTop: '64px' }} // clear navbar height
      >
        <div className="p-4 border-b border-slate-700/50 flex items-center gap-3">
          <Shield className="w-5 h-5 text-cyber-cyan" />
          <span className="font-orbitron font-bold tracking-widest text-sm text-slate-200">MODULES</span>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsOpen(false); // Auto close on mobile
                }}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
                  ${isActive 
                    ? 'bg-cyber-cyan/10 border border-cyber-cyan/30 text-cyber-cyan shadow-[inset_0_0_15px_rgba(6,182,212,0.1)]' 
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent'}
                `}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-cyber-cyan drop-shadow-[0_0_5px_rgba(6,182,212,0.8)]' : ''}`} />
                <span className="font-mono text-xs uppercase tracking-wider">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
}
