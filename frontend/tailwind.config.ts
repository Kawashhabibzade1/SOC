import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'cyber-bg':     '#020817',
        'cyber-darker': '#010510',
        'cyber-red':    '#ff003c',
        'cyber-cyan':   '#06b6d4',
        'cyber-green':  '#10b981',
        'cyber-orange': '#f97316',
        'cyber-purple': '#8b5cf6',
        'cyber-yellow': '#eab308',
      },
      fontFamily: {
        orbitron: ['var(--font-orbitron)', 'sans-serif'],
        mono:     ['var(--font-mono)', 'monospace'],
        sans:     ['var(--font-inter)', 'sans-serif'],
      },
      backgroundImage: {
        'grid-pattern':
          'linear-gradient(rgba(6,182,212,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.04) 1px, transparent 1px)',
        'radial-glow':
          'radial-gradient(ellipse at center, rgba(6,182,212,0.08) 0%, transparent 70%)',
      },
      backgroundSize: {
        'grid': '40px 40px',
      },
      animation: {
        'pulse-glow':    'pulse-glow 2s ease-in-out infinite',
        'pulse-red':     'pulse-red 1.5s ease-in-out infinite',
        'slide-in':      'slide-in 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        'float':         'float 6s ease-in-out infinite',
        'cursor-blink':  'cursor-blink 1s step-end infinite',
        'scan-line':     'scan-line 4s linear infinite',
        'fade-in':       'fade-in 0.4s ease-out',
        'ring-enter':    'ring-enter 0.3s ease-out',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: '1',   boxShadow: '0 0 8px currentColor' },
          '50%':      { opacity: '0.6', boxShadow: '0 0 24px currentColor, 0 0 48px currentColor' },
        },
        'pulse-red': {
          '0%, 100%': { opacity: '1',   boxShadow: '0 0 8px #ff003c' },
          '50%':      { opacity: '0.5', boxShadow: '0 0 24px #ff003c, 0 0 48px #ff003c' },
        },
        'slide-in': {
          '0%':   { transform: 'translateY(12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',    opacity: '1' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)'   },
          '50%':      { transform: 'translateY(-8px)' },
        },
        'cursor-blink': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0' },
        },
        'scan-line': {
          '0%':   { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'ring-enter': {
          '0%':   { transform: 'scale(0.85)', opacity: '0' },
          '100%': { transform: 'scale(1)',    opacity: '1' },
        },
      },
      boxShadow: {
        'glow-cyan':   '0 0 20px rgba(6, 182, 212, 0.4)',
        'glow-red':    '0 0 20px rgba(255, 0, 60, 0.4)',
        'glow-green':  '0 0 20px rgba(16, 185, 129, 0.4)',
        'glow-orange': '0 0 20px rgba(249, 115, 22, 0.4)',
        'panel':       '0 4px 24px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
      },
    },
  },
  plugins: [],
};

export default config;
