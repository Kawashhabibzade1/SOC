'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, User, Lock, Loader2 } from 'lucide-react';

export default function LoginV5() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Simulate API login request
    setTimeout(() => {
      setLoading(false);
      // Navigate to the OTP authenticator page after successful login
      router.push('/verify');
    }, 1500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black relative overflow-hidden font-sans p-4">
      {/* Decorative background grid/glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-950/30 via-black to-black" />
      
      <div className="relative z-10 w-full max-w-4xl flex flex-col md:flex-row rounded-3xl border border-zinc-800 bg-zinc-950/50 backdrop-blur-xl shadow-[0_0_60px_-15px_rgba(37,99,235,0.2)] overflow-hidden">
        
        {/* Left Panel */}
        <div className="md:w-5/12 p-10 flex flex-col items-center justify-center text-center relative">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-transparent" />
          <div className="relative z-10">
            <h1 className="text-3xl font-bold text-white mb-4 tracking-wider">HELLO, FRIEND!</h1>
            <p className="text-zinc-400 text-sm leading-relaxed max-w-[250px] mx-auto">
              Enter your credentials to access the SOC Command Center.
            </p>
          </div>
        </div>

        {/* Right Panel (Form) */}
        <div className="md:w-7/12 p-8 md:p-12 border-t md:border-t-0 md:border-l border-zinc-800/50 relative bg-zinc-900/30">
          <h2 className="text-3xl font-bold text-white mb-8 text-center">Login</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username Field */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-zinc-500" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username or Email"
                className="w-full pl-12 pr-4 py-3.5 bg-zinc-950/50 border border-zinc-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl text-white placeholder-zinc-500 outline-none transition-all"
                required
              />
            </div>

            {/* Password Field */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-zinc-500" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full pl-12 pr-12 py-3.5 bg-zinc-950/50 border border-zinc-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl text-white placeholder-zinc-500 outline-none transition-all"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-zinc-500 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-all shadow-[0_0_20px_-5px_rgba(37,99,235,0.4)] mt-4 flex justify-center items-center disabled:opacity-70"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Login'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
