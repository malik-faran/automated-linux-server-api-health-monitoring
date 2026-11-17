import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, ShieldAlert, Clock } from 'lucide-react';

export default function IncidentFeed({ incidents = [] }) {
  const getSeverityBadge = (severity) => {
    const sev = severity ? severity.toUpperCase() : 'INFO';
    if (sev === 'CRITICAL') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono">
          <AlertCircle className="w-3 h-3" />
          CRITICAL
        </span>
      );
    }
    if (sev === 'WARNING') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
          <AlertTriangle className="w-3 h-3" />
          WARNING
        </span>
      );
    }
    if (sev === 'RESOLVED') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
          <CheckCircle2 className="w-3 h-3" />
          RESOLVED
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-500/10 text-slate-400 border border-slate-500/20 font-mono">
        {sev}
      </span>
    );
  };

  const formatTimestamp = (ts) => {
    try {
      const d = new Date(ts);
      return d.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch (_) {
      return ts;
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 shadow-sm space-y-4 flex flex-col h-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-indigo-400" />
          <h2 className="text-base font-bold text-slate-100">
            Incident & Alert Feed
          </h2>
        </div>
        <span className="text-[11px] font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60">
          Last {incidents.length} Events
        </span>
      </div>

      <div className="flex-1 overflow-y-auto max-h-[380px] space-y-2.5 pr-1">
        {incidents.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center text-slate-500">
            <CheckCircle2 className="w-8 h-8 text-emerald-500/40 mb-2" />
            <p className="text-xs font-semibold text-slate-400">All Systems Operational</p>
            <p className="text-[11px] text-slate-500 max-w-xs mt-1">
              No warnings or outages recorded. Telemetry within safe baseline limits.
            </p>
          </div>
        ) : (
          incidents.map((incident) => (
            <div
              key={incident.id}
              className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 hover:border-slate-700/80 transition-colors"
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  {getSeverityBadge(incident.severity)}
                  <span className="text-xs font-semibold text-slate-200">
                    {incident.source}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-slate-500 font-mono">
                  <Clock className="w-3 h-3" />
                  <span>{formatTimestamp(incident.created_at)}</span>
                </div>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed font-mono">
                {incident.message}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
