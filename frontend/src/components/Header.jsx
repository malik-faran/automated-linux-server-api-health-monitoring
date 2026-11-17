import React from 'react';
import { Activity, RefreshCw, Server, ShieldCheck, AlertTriangle } from 'lucide-react';

export default function Header({
  isChecking,
  onTriggerCheck,
  lastUpdated,
  healthStatus,
  countdown,
}) {
  const isHealthy = healthStatus?.status === 'healthy';

  return (
    <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-500/20 ring-1 ring-indigo-400/30">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-100 tracking-tight">
                HealthSentinel
              </h1>
              <span className="text-[10px] uppercase tracking-wider font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full">
                v1.0 Pro
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Automated Linux Server & API Health Monitoring
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          {/* Status Indicator */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60">
            <span className="relative flex h-2.5 w-2.5">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isHealthy ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              ></span>
              <span
                className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  isHealthy ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              ></span>
            </span>
            <span className="text-xs font-medium text-slate-300">
              {isHealthy ? 'System Operational' : 'Degraded State'}
            </span>
          </div>

          {/* Countdown timer pill */}
          <div className="text-xs text-slate-400 bg-slate-800/50 border border-slate-800 px-2.5 py-1.5 rounded-lg font-mono">
            Auto-sync: <span className="text-indigo-400 font-semibold">{countdown}s</span>
          </div>

          {/* Trigger Check button */}
          <button
            onClick={onTriggerCheck}
            disabled={isChecking}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white transition-all shadow-md ${
              isChecking
                ? 'bg-indigo-600/50 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-500 active:scale-95 shadow-indigo-600/25'
            }`}
            title="Manually trigger immediate monitoring probe"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
            <span>{isChecking ? 'Checking...' : 'Run Check Now'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
