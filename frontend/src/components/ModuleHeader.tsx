import React from 'react';
import { Info } from 'lucide-react';

interface ModuleHeaderProps {
  title: string;
  description: string;
}

export default function ModuleHeader({ title, description }: ModuleHeaderProps) {
  return (
    <div className="glass-panel rounded-xl p-4 mb-4 border border-cyber-cyan/30 bg-cyber-cyan/5">
      <div className="flex items-start gap-3">
        <Info className="w-5 h-5 text-cyber-cyan mt-0.5 shrink-0" />
        <div>
          <h2 className="font-orbitron text-lg font-bold text-cyber-cyan tracking-widest mb-1 uppercase">
            {title}
          </h2>
          <p className="font-mono text-sm text-slate-300 leading-relaxed">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}
