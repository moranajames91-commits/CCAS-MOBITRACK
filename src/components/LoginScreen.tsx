/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { LogIn, Key, User, ShieldCheck, ShoppingBag, Eye, EyeOff, AlertTriangle, Database, Settings, RefreshCw, CheckCircle, Wifi, WifiOff } from 'lucide-react';
import { Cashier, AuthState } from '../types';

interface LoginScreenProps {
  cashiers: Cashier[];
  admins: { username: string; fullName: string; passwordHash: string }[];
  onLoginSuccess: (auth: AuthState) => void;
  useApi: boolean;
  onToggleUseApi: (val: boolean) => void;
  apiUrl: string;
  onSetApiUrl: (val: string) => void;
  onRefreshApi: () => void;
  loadingApi: boolean;
  apiError: string | null;
}

export default function LoginScreen({ 
  cashiers, 
  admins, 
  onLoginSuccess,
  useApi,
  onToggleUseApi,
  apiUrl,
  onSetApiUrl,
  onRefreshApi,
  loadingApi,
  apiError
}: LoginScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'cashier' | 'admin'>('cashier');
  const [showConfig, setShowConfig] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Please provide both username and password.');
      return;
    }

    if (activeTab === 'admin') {
      const foundAdmin = admins.find(
        a => a.username.toLowerCase() === username.toLowerCase() && a.passwordHash === password
      );
      if (foundAdmin) {
        onLoginSuccess({
          role: 'admin',
          username: foundAdmin.username,
          fullName: foundAdmin.fullName
        });
      } else {
        setError('Invalid administrative credentials.');
      }
    } else {
      // Cashier login Check
      const foundCashier = cashiers.find(
        c => c.username.toLowerCase() === username.toLowerCase() && c.passwordHash === password
      );

      if (foundCashier) {
        if (foundCashier.status === 'inactive') {
          setError('This cashier account is inactive. Please contact your system administrator.');
          return;
        }
        onLoginSuccess({
          role: 'cashier',
          username: foundCashier.username,
          fullName: foundCashier.fullName
        });
      } else {
        setError('Invalid cashier username or password.');
      }
    }
  };

  return (
    <div id="login-screen-view" className="min-h-screen bg-[#dfeee4] flex flex-col justify-between p-4 sm:p-8 md:p-12 font-sans">
      <a href="#login-username-input" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-[#e9dfbb] focus:px-4 focus:py-2 focus:text-[#0b2e24] focus:rounded">
        Skip to sign in
      </a>
      
      {/* Main Core Auth Card */}
      <main className="my-auto max-w-lg w-full mx-auto bg-[#0b2e24] border border-[#b18a36] rounded-2xl shadow-[0_20px_60px_rgba(11,46,36,0.32)] overflow-hidden flex flex-col justify-between" aria-labelledby="login-title">
        
        {/* Symmetrical Dual-tab view selectors */}
        <div className="flex border-b border-[#176044] bg-[#08271e]">
          <button
            type="button"
            id="tab-select-cashier"
            onClick={() => { setActiveTab('cashier'); setError(''); setUsername(''); setPassword(''); }}
            className={`flex-1 py-4 text-center font-display font-bold text-xs tracking-wider uppercase transition flex items-center justify-center gap-2 border-b-2 ${
              activeTab === 'cashier'
                ? 'border-[#b18a36] bg-[#176044] text-[#e9dfbb] shadow-inner'
                : 'border-transparent text-[#b8d8c2] hover:text-[#e9dfbb] hover:bg-[#176044]'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            Cashier Terminal
          </button>
          <button
            type="button"
            id="tab-select-admin"
            onClick={() => { setActiveTab('admin'); setError(''); setUsername(''); setPassword(''); }}
            className={`flex-1 py-4 text-center font-display font-bold text-xs tracking-wider uppercase transition flex items-center justify-center gap-2 border-b-2 ${
              activeTab === 'admin'
                ? 'border-[#b18a36] bg-[#176044] text-[#e9dfbb] shadow-inner'
                : 'border-transparent text-[#d8c98f] hover:text-[#e9dfbb] hover:bg-[#176044]'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Admin Portal
          </button>
        </div>

        <div className="p-7 sm:p-10 space-y-7 bg-[#0b2e24]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[#176044] text-[#e9dfbb] rounded-xl border border-[#b18a36] shadow-sm">
                <ShoppingBag className="w-5 h-5" id="cims-logo-icon" />
              </div>
              <div>
                <p className="text-sm font-display font-bold tracking-[0.14em] text-[#0b2e24] uppercase">CCAS Inventory</p>
                <p className="text-[10px] text-[#b8d8c2] tracking-widest uppercase font-bold mt-0.5">Point of Sale</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#dfeee4] text-[#176044] text-[10px] font-bold font-mono">
              <span className="h-1.5 w-1.5 rounded-full bg-[#b18a36]" /> Online
            </span>
          </div>

          <div className="space-y-1">
            <h1 id="login-title" className="text-2xl font-display font-bold text-[#e9dfbb]">
              {activeTab === 'cashier' ? 'Welcome back, cashier' : 'Welcome back, admin'}
            </h1>
            <p className="text-sm text-[#b8d8c2] leading-relaxed">
              {activeTab === 'cashier' 
                ? 'Process sales and manage the checkout register.' 
                : 'Manage inventory, staff, and system settings.'}
            </p>
          </div>

          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-150 text-rose-850 rounded-lg text-xs font-mono leading-relaxed flex items-start gap-2" id="login-error-alert" role="alert" aria-live="assertive">
              <AlertTriangle className="w-4 h-4 text-rose-650 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username Input Field */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-display font-extrabold text-[#b8d8c2] tracking-widest uppercase block">Account Username</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-450">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  id="login-username-input"
                  name="username"
                  autoComplete="username"
                  aria-describedby="login-title"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  className="w-full pl-10 pr-4 py-3 bg-white border border-[#bfd8c7] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#176044] focus:bg-white text-slate-800 placeholder-slate-400 text-sm font-medium transition"
                  required
                />
              </div>
            </div>

            {/* Password Input Field */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-display font-extrabold text-[#b8d8c2] tracking-widest uppercase block">Security Password</label>
                {activeTab === 'cashier' && (
                  <span className="text-[10px] text-[#6d8779] font-mono">Need help?</span>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-450">
                  <Key className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="login-password-input"
                  name="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-11 py-3 bg-white border border-[#bfd8c7] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#176044] focus:bg-white text-slate-800 placeholder-slate-400 text-sm font-medium transition"
                  required
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-650"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              id="login-submit-button"
              className="w-full mt-4 py-3.5 px-4 bg-[#176044] border border-[#0b2e24] hover:bg-[#0b2e24] text-[#e9dfbb] text-sm font-display font-bold uppercase tracking-wider rounded-xl transition-all duration-150 shadow-[0_8px_18px_rgba(23,96,68,0.25)] hover:shadow active:scale-98 flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              Access {activeTab === 'admin' ? 'Admin Workspace' : 'Cashier Terminal'}
            </button>
          </form>


        </div>

        <div className="px-6 py-4 border-t border-[#176044] bg-[#08271e] text-center text-[10px] text-[#d8c98f] font-mono tracking-wide uppercase">
          Secure sign-in
        </div>
      </main>

      {/* Footer Details */}
      <div className="text-center text-[10px] text-slate-400 font-mono border-t border-slate-200/50 pt-4 pb-2 mt-4">
        CCAS Inventory &copy; 2026
      </div>
    </div>
  );
}
