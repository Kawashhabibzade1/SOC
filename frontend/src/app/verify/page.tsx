'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Lock, Loader2 } from 'lucide-react';

export default function OtpVerificationV7() {
  const router = useRouter();
  const [otp, setOtp] = useState(['', '', '', '', '', '']); // 6 digits for TOTP
  const [isVerified, setIsVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showQr, setShowQr] = useState(false);
  const [qrData, setQrData] = useState<{ secret: string; qrDataUrl: string } | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3001';

  const fetchQr = async () => {
    setQrLoading(true);
    try {
      const res = await fetch(`${GATEWAY_URL}/api/auth/qr`);
      const data = await res.json();
      if (data.success) {
        setQrData({ secret: data.secret, qrDataUrl: data.qrDataUrl });
      }
    } catch {
      // ignore
    } finally {
      setQrLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const value = e.target.value;
    if (isNaN(Number(value))) return;

    const newOtp = [...otp];
    newOtp[index] = value.substring(value.length - 1);
    setOtp(newOtp);
    setError('');

    // Auto-focus next input
    if (value && index < 5 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1]?.focus();
    }

    // Trigger verification when all 6 fields are filled
    if (newOtp.every((digit) => digit !== '')) {
      verifyCode(newOtp.join(''));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0 && inputRefs.current[index - 1]) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const verifyCode = async (token: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${GATEWAY_URL}/api/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      const data = await res.json();
      
      if (data.success) {
        setIsVerified(true);
        localStorage.setItem('soc_auth', 'true');
        setTimeout(() => {
          router.push('/');
        }, 1500);
      } else {
        setError(data.error || 'Invalid 2FA code.');
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch (err) {
      setError('Network error. Is the Gateway running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black font-sans p-3 sm:p-4">
      <div className="w-full max-w-[400px] min-h-[460px] bg-[#121212] rounded-[2rem] sm:rounded-[2.5rem] p-5 sm:p-8 relative flex flex-col shadow-2xl border border-zinc-800/50">
        
        <div className="w-12 h-1 bg-zinc-800 rounded-full mx-auto mb-8 sm:mb-10" />

        {!isVerified ? (
          <div className="flex flex-col items-center flex-1 animate-in fade-in zoom-in duration-300">
            <h2 className="text-[1.25rem] sm:text-[1.35rem] font-semibold text-white mb-2 sm:mb-3 text-center tracking-wide">
              Microsoft Authenticator
            </h2>
            <p className="text-zinc-500 text-xs sm:text-sm text-center mb-8 sm:mb-10 px-2 leading-relaxed">
              Enter the 6-digit code from your Authenticator app.
            </p>

            <div className="flex gap-1.5 sm:gap-2 w-full justify-center mt-2">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { inputRefs.current[index] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  disabled={loading}
                  onChange={(e) => handleChange(e, index)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  className="w-10 sm:w-12 h-12 sm:h-14 bg-[#1a1a1a] rounded-xl text-center text-lg sm:text-xl font-medium text-white outline-none focus:bg-[#222] transition-colors
                             border-b border-l border-b-zinc-800/80 border-l-zinc-800/80
                             border-t border-r border-t-red-500/40 border-r-red-500/40 
                             shadow-[4px_-4px_15px_rgba(239,68,68,0.1)] disabled:opacity-50"
                />
              ))}
            </div>
            
            <div className="mt-8 h-6">
              {loading && <Loader2 className="w-5 h-5 text-zinc-400 animate-spin mx-auto" />}
              {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            </div>


          </div>
        ) : (
          <div className="flex flex-col items-center flex-1 animate-in fade-in zoom-in duration-500">
            <h2 className="text-[1.35rem] font-semibold text-green-500 mb-3 text-center tracking-wide">
              Verified Successfully
            </h2>
            <p className="text-zinc-500 text-sm text-center mb-16">
              Access granted to Command Center.
            </p>

            <div className="relative mb-auto mt-4">
              <div className="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none -z-10">
                <div className="absolute -top-12 left-[-3rem] w-3 h-3 bg-green-500/20 rounded-full" />
                <div className="absolute -top-6 right-[-2.5rem] w-4 h-4 bg-green-500/20 rotate-45" />
                <div className="absolute top-12 left-[-4rem] w-2 h-2 bg-green-500/30 rounded-full" />
                <div className="absolute top-4 right-[-4rem] w-3 h-3 bg-green-500/20 rotate-12" />
                <div className="absolute -bottom-8 left-[-1.5rem] w-4 h-4 bg-green-500/10 rounded-full" />
                <div className="absolute -bottom-4 right-[-2rem] w-2.5 h-2.5 bg-green-500/30 rotate-[60deg]" />
              </div>

              <div className="w-[3.75rem] h-[3.75rem] bg-[#1a1a1a] rounded-2xl flex items-center justify-center relative z-10
                              border-b border-l border-b-zinc-800/80 border-l-zinc-800/80
                              border-t border-r border-t-green-500/50 border-r-green-500/50 
                              shadow-[4px_-4px_20px_rgba(34,197,94,0.15)]">
                <Check className="w-6 h-6 text-white" strokeWidth={3} />
              </div>
            </div>

            <div className="flex items-center justify-center space-x-2 text-green-500/90 font-medium pb-2">
              <Lock className="w-4 h-4" />
              <span className="text-sm">Verified and Secure</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
