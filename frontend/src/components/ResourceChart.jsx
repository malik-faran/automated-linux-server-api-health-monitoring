import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Cpu, Layers, TrendingUp } from 'lucide-react';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900/95 p-3 shadow-xl backdrop-blur-md">
        <p className="text-xs font-mono text-slate-400 mb-2 border-b border-slate-800 pb-1">
          {label}
        </p>
        <div className="space-y-1 font-mono text-xs">
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-cyan-400">
              <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
              CPU Load:
            </span>
            <span className="font-bold text-slate-200">
              {payload[0]?.value?.toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-indigo-400">
              <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
              Memory Usage:
            </span>
            <span className="font-bold text-slate-200">
              {payload[1]?.value?.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export default function ResourceChart({ history = [] }) {
  // Format timestamps for chart X-axis
  const formattedData = history.map((item) => {
    let timeLabel = '';
    try {
      const date = new Date(item.timestamp);
      timeLabel = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (_) {
      timeLabel = item.timestamp;
    }

    return {
      time: timeLabel,
      cpu: item.cpu_percent,
      memory: item.memory_percent,
      disk: item.disk_percent,
    };
  });

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-400" />
            <h2 className="text-base font-bold text-slate-100">
              Real-Time Host Telemetry
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            Continuous CPU & Memory consumption across recent sampling intervals
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-cyan-400"></span>
            <span className="text-slate-300">CPU %</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500"></span>
            <span className="text-slate-300">Memory %</span>
          </div>
        </div>
      </div>

      <div className="w-full h-64 sm:h-72">
        {formattedData.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm">
            Awaiting telemetry cycles...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={formattedData}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="memGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis
                dataKey="time"
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#334155' }}
              />
              <YAxis
                domain={[0, 100]}
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#334155' }}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="cpu"
                name="CPU Load"
                stroke="#06b6d4"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#cpuGradient)"
              />
              <Area
                type="monotone"
                dataKey="memory"
                name="Memory Usage"
                stroke="#6366f1"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#memGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
