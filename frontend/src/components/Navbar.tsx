'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Wifi, WifiOff, Activity, LogOut, Settings, X, Lock, Eye, EyeOff, Check, AlertCircle } from 'lucide-react';

interface NavbarProps {
  isConnected : boolean;
  totalEvents : number;
}

export default function Navbar({ isConnected, totalEvents }: NavbarProps) {
  const router = useRouter();
  const [time, setTime] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [is2faSet, setIs2faSet] = useState<boolean | null>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Password change modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

  useEffect(() => {
    const tick = () =>
      setTime(new Date().toLocaleTimeString('en-GB', { hour12: false }));
    tick();
    const interval = setInterval(tick, 1000);

    const fetchStatus = async () => {
      try {
        const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3001';
        const res = await fetch(`${GATEWAY_URL}/api/auth/status`);
        const data = await res.json();
        if (data.success) {
          setIs2faSet(data.isSetup);
        }
      } catch (e) {
        // ignore
      }
    };
    fetchStatus();

    // click outside handler
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      clearInterval(interval);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handlePasswordChange = async () => {
    setPwError('');
    setPwSuccess('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPwError('All fields are required.');
      return;
    }
    if (newPassword.length < 6) {
      setPwError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('Passwords do not match.');
      return;
    }

    setPwLoading(true);
    try {
      const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3001';
      const res = await fetch(`${GATEWAY_URL}/api/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        setPwSuccess('Password changed successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => {
          setShowPasswordModal(false);
          setPwSuccess('');
        }, 2000);
      } else {
        setPwError(data.error || 'Failed to change password.');
      }
    } catch {
      setPwError('Connection error. Server unreachable.');
    } finally {
      setPwLoading(false);
    }
  };

  const closePasswordModal = () => {
    setShowPasswordModal(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPwError('');
    setPwSuccess('');
    setShowCurrentPw(false);
    setShowNewPw(false);
  };

  return (
    <>
    <header
      className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center justify-between px-3 sm:px-6"
      style={{
        background  : 'rgba(2, 8, 23, 0.92)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(6, 182, 212, 0.15)',
        boxShadow   : '0 0 40px rgba(6, 182, 212, 0.08), 0 1px 0 rgba(6, 182, 212, 0.1)',
      }}
    >
      {/* ── Left: Logo + title ──────────────────────── */}
      <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
        {/* Animated icon */}
        <div className="relative flex-shrink-0 flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10">
          <div
            className="absolute inset-0 rounded-lg animate-pulse-glow"
            style={{
              background  : 'rgba(6, 182, 212, 0.1)',
              border      : '1px solid rgba(6, 182, 212, 0.3)',
              color       : '#06b6d4',
            }}
          />
          <Shield className="relative z-10 w-4 h-4 sm:w-5 sm:h-5 text-cyber-cyan" />
        </div>

        <div className="min-w-0">
          <h1
            className="font-orbitron font-black text-xs sm:text-base md:text-xl tracking-wider sm:tracking-widest glow-cyan truncate"
            style={{ color: '#06b6d4' }}
          >
            Kawash&apos;s Heimserver
          </h1>
          <p className="hidden sm:block text-[9px] sm:text-[10px] text-slate-500 tracking-[0.2em] sm:tracking-[0.3em] font-mono uppercase mt-0.5 truncate">
            Security Operation Center
          </p>
        </div>
      </div>

      {/* ── Center: Event counter ────────────────────── */}
      <div className="hidden lg:flex items-center gap-2 px-4 py-2 rounded-lg"
        style={{ background: 'rgba(6, 182, 212, 0.05)', border: '1px solid rgba(6, 182, 212, 0.1)' }}
      >
        <Activity className="w-3.5 h-3.5 text-cyber-cyan" />
        <span className="font-mono text-xs text-slate-400 tracking-widest">EVENTS</span>
        <span
          className="font-orbitron font-bold text-sm text-cyber-cyan glow-cyan"
          style={{ minWidth: '3rem', textAlign: 'center' }}
        >
          {totalEvents.toLocaleString()}
        </span>
      </div>

      {/* ── Right: Status + Clock + Logout ────────────────────── */}
      <div className="flex items-center gap-2.5 sm:gap-5 flex-shrink-0">

        {/* Connection status */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          {isConnected ? (
            <>
              <span className="relative flex h-2 w-2 sm:h-2.5 sm:w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyber-green opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 sm:h-2.5 sm:w-2.5 bg-cyber-green" style={{ boxShadow: '0 0 8px #10b981' }} />
              </span>
              <div className="flex items-center gap-1 text-cyber-green">
                <Wifi className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span className="font-mono text-[10px] sm:text-xs font-medium tracking-widest glow-green">LIVE</span>
              </div>
            </>
          ) : (
            <>
              <span className="relative flex h-2 w-2 sm:h-2.5 sm:w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyber-red opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 sm:h-2.5 sm:w-2.5 bg-cyber-red" style={{ boxShadow: '0 0 8px #ff003c' }} />
              </span>
              <div className="flex items-center gap-1 text-cyber-red">
                <WifiOff className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span className="font-mono text-[10px] sm:text-xs font-medium tracking-widest glow-red">OFFLINE</span>
              </div>
            </>
          )}
        </div>

        {/* Settings Dropdown */}
        <div className="relative" ref={settingsRef}>
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className={`p-1.5 sm:p-2 rounded-lg transition-colors ${showSettings ? 'text-cyber-cyan bg-cyber-cyan/10' : 'text-slate-400 hover:text-cyber-cyan hover:bg-cyber-cyan/10'}`}
            title="Settings"
          >
            <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          
          {showSettings && (
            <div className="absolute right-0 mt-3 w-64 rounded-xl border border-slate-700/50 bg-[#020817]/95 backdrop-blur-2xl shadow-2xl overflow-hidden py-1 z-50">
              <div className="px-4 py-3 border-b border-slate-700/50">
                <span className="font-orbitron text-[10px] tracking-widest text-slate-300 uppercase">System Settings</span>
              </div>
              <div className="px-4 py-3 border-b border-slate-700/50">
                <div className="flex justify-between items-center">
                  <span className="font-mono text-[10px] text-slate-400 uppercase tracking-wider">2FA Auth</span>
                  {is2faSet === true ? (
                    <span className="font-mono text-[9px] text-cyber-green px-1.5 py-0.5 rounded bg-cyber-green/10 border border-cyber-green/20">ACTIVE</span>
                  ) : is2faSet === false ? (
                    <span className="font-mono text-[9px] text-cyber-red px-1.5 py-0.5 rounded bg-cyber-red/10 border border-cyber-red/20 uppercase tracking-widest animate-pulse">Please einrichten</span>
                  ) : (
                    <span className="font-mono text-[9px] text-slate-500">CHECKING...</span>
                  )}
                </div>
              </div>
              <button 
                className="w-full text-left px-4 py-3 font-mono text-[10px] text-slate-300 hover:text-cyber-cyan hover:bg-white/5 transition-colors uppercase tracking-wider flex items-center gap-2"
                onClick={() => { setShowPasswordModal(true); setShowSettings(false); }}
              >
                <Lock className="w-3 h-3" />
                Change Password
              </button>
            </div>
          )}
        </div>

        {/* Digital clock (hidden on small phones) */}
        <div
          className="hidden md:block font-orbitron font-bold text-sm sm:text-lg tracking-widest text-slate-200 tabular-nums"
          style={{ textShadow: '0 0 20px rgba(255,255,255,0.2)' }}
        >
          {time}
        </div>

        {/* Logout Button */}
        <button
          type="button"
          onClick={() => {
            if (typeof window !== 'undefined') {
              localStorage.removeItem('soc_auth');
            }
            router.push('/login');
          }}
          className="flex items-center gap-1 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 font-mono text-[10px] sm:text-xs tracking-wider transition-all cursor-pointer"
          title="Sign Out"
        >
          <LogOut className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          <span>LOGOUT</span>
        </button>
      </div>
    </header>

    {/* ── Password Change Modal ──────────────────────── */}
    {showPasswordModal && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div
          className="w-full max-w-md mx-4 rounded-2xl border overflow-hidden"
          style={{
            background: 'linear-gradient(145deg, rgba(2,8,23,0.98), rgba(15,23,42,0.95))',
            borderColor: 'rgba(6, 182, 212, 0.2)',
            boxShadow: '0 0 60px rgba(6, 182, 212, 0.1), 0 25px 50px rgba(0,0,0,0.5)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyber-cyan/10 border border-cyber-cyan/20">
                <Lock className="w-4 h-4 text-cyber-cyan" />
              </div>
              <div>
                <h3 className="font-orbitron text-sm tracking-widest text-slate-100 uppercase">Change Password</h3>
                <p className="font-mono text-[9px] text-slate-500 mt-0.5 tracking-wider">ADMIN CREDENTIALS</p>
              </div>
            </div>
            <button
              onClick={closePasswordModal}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-4">
            {/* Success Message */}
            {pwSuccess && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span className="font-mono text-xs text-emerald-300">{pwSuccess}</span>
              </div>
            )}

            {/* Error Message */}
            {pwError && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-rose-500/10 border border-rose-500/20">
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <span className="font-mono text-xs text-rose-300">{pwError}</span>
              </div>
            )}

            {/* Current Password */}
            <div>
              <label className="block font-mono text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">Current Password</label>
              <div className="relative">
                <input
                  type={showCurrentPw ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-800/50 border border-slate-600/50 text-slate-100 font-mono text-sm placeholder-slate-600 focus:outline-none focus:border-cyber-cyan/50 focus:ring-1 focus:ring-cyber-cyan/20 transition-all"
                  placeholder="Enter current password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPw(!showCurrentPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block font-mono text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">New Password</label>
              <div className="relative">
                <input
                  type={showNewPw ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-800/50 border border-slate-600/50 text-slate-100 font-mono text-sm placeholder-slate-600 focus:outline-none focus:border-cyber-cyan/50 focus:ring-1 focus:ring-cyber-cyan/20 transition-all"
                  placeholder="Min. 6 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw(!showNewPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block font-mono text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-slate-800/50 border border-slate-600/50 text-slate-100 font-mono text-sm placeholder-slate-600 focus:outline-none focus:border-cyber-cyan/50 focus:ring-1 focus:ring-cyber-cyan/20 transition-all"
                placeholder="Re-enter new password"
                onKeyDown={(e) => e.key === 'Enter' && handlePasswordChange()}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-700/50">
            <button
              onClick={closePasswordModal}
              className="px-4 py-2 rounded-lg font-mono text-xs text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-slate-700/50 transition-all tracking-wider uppercase"
            >
              Cancel
            </button>
            <button
              onClick={handlePasswordChange}
              disabled={pwLoading || !currentPassword || !newPassword || !confirmPassword}
              className="px-5 py-2 rounded-lg font-mono text-xs tracking-wider uppercase transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: 'linear-gradient(135deg, rgba(6,182,212,0.2), rgba(6,182,212,0.1))',
                border: '1px solid rgba(6,182,212,0.3)',
                color: '#06b6d4',
                boxShadow: '0 0 20px rgba(6,182,212,0.1)',
              }}
            >
              {pwLoading ? 'Saving...' : 'Save Password'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

