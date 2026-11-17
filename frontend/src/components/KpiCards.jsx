import React from 'react';
import { Cpu, Layers, HardDrive, Globe, ArrowUpRight, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function KpiCards({ metrics, endpoints = [] }) {
  const latest = metrics?.latest || { cpu_percent: 0, memory_percent: 0, disk_percent: 0 };

  // Calculate aggregate uptime
  const totalEndpoints = endpoints.length;
  const activeEndpoints = endpoints.filter((e) => e.latest_status === true).length;
  const avgUptime = totalEndpoints > 0
    ? (endpoints.reduce((acc, ep) => acc + (ep.uptime_percentage || 100), 0) / totalEndpoints).toFixed(1)
    : '100.0';

  const getMetricStatus = (val, warnThreshold = 70, critThreshold = 85) => {
    if (val >= critThreshold) return { label: 'CRITICAL', color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20', bar: 'bg-rose-500' };
    if (val >= warnThreshold) return { label: 'WARNING', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', bar: 'bg-amber-500' };
    return { label: 'OPTIMAL', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', bar: 'bg-emerald-500' };
  };

  const getUptimeStatus = (val) => {
    const num = parseFloat(val);
    if (num >= 99) return { label: 'EXCELLENT', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', bar: 'bg-emerald-500' };
    if (num >= 95) return { label: 'DEGRADED', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', bar: 'bg-amber-500' };
    return { label: 'OUTAGE', color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20', bar: 'bg-rose-500' };
  };

  const cpuStatus = getMetricStatus(latest.cpu_percent);
  const memStatus = getMetricStatus(latest.memory_percent);
  const diskStatus = getMetricStatus(latest.disk_percent, 80, 90);
  const uptimeStatus = getUptimeStatus(avgUptime);

  const cards = [
    {
      title: 'Host CPU Load',
      value: `${latest.cpu_percent.toFixed(1)}%`,
      icon: Cpu,
      status: cpuStatus,
      percent: Math.min(Math.max(latest.cpu_percent, 0), 100),
      subtitle: latest.cpu_percent > 85 ? 'Threshold exceeded (>85%)' : 'Operating within safe limits',
    },
    {
      title: 'Memory Utilization',
      value: `${latest.memory_percent.toFixed(1)}%`,
      icon: Layers,
      status: memStatus,
      percent: Math.min(Math.max(latest.memory_percent, 0), 100),
      subtitle: latest.memory_percent > 85 ? 'Threshold exceeded (>85%)' : 'System RAM healthy',
    },
    {
      title: 'Root Disk Usage',
      value: `${latest.disk_percent.toFixed(1)}%`,
      icon: HardDrive,
      status: diskStatus,
      percent: Math.min(Math.max(latest.disk_percent, 0), 100),
      subtitle: 'Host storage partition (/)',
    },
    {
      title: 'Overall API Uptime',
      value: `${avgUptime}%`,
      icon: Globe,
      status: uptimeStatus,
      percent: parseFloat(avgUptime),
      subtitle: `${activeEndpoints}/${totalEndpoints} endpoints responding UP`,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, idx) => {
        const IconComponent = card.icon;
        return (
          <div
            key={idx}
            className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/70 p-5 shadow-sm transition hover:border-slate-700 hover:bg-slate-900/90"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {card.title}
              </span>
              <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/50 text-indigo-400">
                <IconComponent className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-100 font-mono tracking-tight">
                {card.value}
              </span>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${card.status.bg} ${card.status.color}`}
              >
                {card.status.label}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="mt-3 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${card.status.bar}`}
                style={{ width: `${card.percent}%` }}
              ></div>
            </div>

            <p className="mt-2 text-xs text-slate-400 truncate">
              {card.subtitle}
            </p>
          </div>
        );
      })}
    </div>
  );
}
