'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Check, Lock } from 'lucide-react';

export default function OtpVerificationV7() {
  const [otp, setOtp] = useState(['', '', '', '']);
  const [isVerified, setIsVerified] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const value = e.target.value;
    // Allow only numbers
    if (isNaN(Number(value))) return;

    const newOtp = [...otp];
    // Take the last character in case of pasting multiple
    newOtp[index] = value.substring(value.length - 1);
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 3 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1]?.focus();
    }

    // Trigger auto-verification when all fields are filled
    if (newOtp.every((digit) => digit !== '')) {
      setTimeout(() => setIsVerified(true), 800); // Slight delay to simulate API verification
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    // Handle backspace focus jumping
    if (e.key === 'Backspace' && !otp[index] && index > 0 && inputRefs.current[index - 1]) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Reset function if you want to test it again
  const resetVerification = () => {
    setOtp(['', '', '', '']);
    setIsVerified(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black font-sans p-4">
      <div className="w-full max-w-[340px] min-h-[480px] bg-[#121212] rounded-[2.5rem] p-8 relative flex flex-col shadow-2xl border border-zinc-800/50">
        
        {/* Top Notch / Drag Handle */}
        <div className="w-12 h-1 bg-zinc-800 rounded-full mx-auto mb-10" />

        {!isVerified ? (
          // --- OTP INPUT STATE ---
          <div className="flex flex-col items-center flex-1 animate-in fade-in zoom-in duration-300">
            <h2 className="text-[1.35rem] font-semibold text-white mb-3 text-center tracking-wide">
              Let's verify your number
            </h2>
            <p className="text-zinc-500 text-sm text-center mb-12 px-2 leading-relaxed">
              We've sent a 4-digit code to your phone. It'll auto-verify once entered.
            </p>

            {/* 2x2 Grid Layout */}
            <div className="relative w-40 h-40 mt-2">
              {/* Connecting Square Line Behind Inputs */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[5.5rem] h-[5.5rem] border-[1.5px] border-zinc-800 -z-10 rounded-sm" />

              <div className="grid grid-cols-2 gap-x-8 gap-y-8 h-full w-full place-items-center">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => { inputRefs.current[index] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(e, index)}
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    className="w-[3.75rem] h-[3.75rem] bg-[#1a1a1a] rounded-2xl text-center text-2xl font-medium text-white outline-none focus:bg-[#222] transition-colors
                               border-b border-l border-b-zinc-800/80 border-l-zinc-800/80
                               border-t border-r border-t-red-500/40 border-r-red-500/40 
                               shadow-[4px_-4px_15px_rgba(239,68,68,0.1)]"
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          // --- SUCCESS STATE ---
          <div className="flex flex-col items-center flex-1 animate-in fade-in zoom-in duration-500" onClick={resetVerification}>
            <h2 className="text-[1.35rem] font-semibold text-green-500 mb-3 text-center tracking-wide">
              Verified Successfully
            </h2>
            <p className="text-zinc-500 text-sm text-center mb-16">
              Your number has been verified.
            </p>

            <div className="relative mb-auto mt-4">
              {/* Confetti / Particle Background */}
              <div className="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none -z-10">
                <div className="absolute -top-12 left-[-3rem] w-3 h-3 bg-green-500/20 rounded-full" />
                <div className="absolute -top-6 right-[-2.5rem] w-4 h-4 bg-green-500/20 rotate-45" />
                <div className="absolute top-12 left-[-4rem] w-2 h-2 bg-green-500/30 rounded-full" />
                <div className="absolute top-4 right-[-4rem] w-3 h-3 bg-green-500/20 rotate-12" />
                <div className="absolute -bottom-8 left-[-1.5rem] w-4 h-4 bg-green-500/10 rounded-full" />
                <div className="absolute -bottom-4 right-[-2rem] w-2.5 h-2.5 bg-green-500/30 rotate-[60deg]" />
              </div>

              {/* Success Checkmark Box */}
              <div className="w-[3.75rem] h-[3.75rem] bg-[#1a1a1a] rounded-2xl flex items-center justify-center relative z-10
                              border-b border-l border-b-zinc-800/80 border-l-zinc-800/80
                              border-t border-r border-t-green-500/50 border-r-green-500/50 
                              shadow-[4px_-4px_20px_rgba(34,197,94,0.15)]">
                <Check className="w-6 h-6 text-white" strokeWidth={3} />
              </div>
            </div>

            {/* Bottom Secure Badge */}
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
