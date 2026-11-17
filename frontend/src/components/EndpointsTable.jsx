import React, { useState } from 'react';
import {
  Globe,
  Plus,
  Trash2,
  ExternalLink,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  AlertCircle,
} from 'lucide-react';

export default function EndpointsTable({
  endpoints = [],
  onAddEndpoint,
  onDeleteEndpoint,
  isAdding,
  isDeleting,
}) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [formError, setFormError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!name.trim()) {
      setFormError('Endpoint name is required.');
      return;
    }

    const trimmedUrl = url.trim();
    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      setFormError('URL must start with http:// or https://');
      return;
    }

    try {
      await onAddEndpoint({ name: name.trim(), url: trimmedUrl });
      setName('');
      setUrl('');
    } catch (err) {
      setFormError(err.message || 'Failed to add endpoint');
    }
  };

  const getLatencyBadge = (ms) => {
    if (ms === null || ms === undefined) return <span className="text-slate-500">-</span>;
    let color = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if (ms > 800) {
      color = 'text-rose-400 bg-rose-500/10 border-rose-500/20';
    } else if (ms > 350) {
      color = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    }
    return (
      <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${color}`}>
        {ms.toFixed(1)} ms
      </span>
    );
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 shadow-sm space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-indigo-400" />
            <h2 className="text-base font-bold text-slate-100">
              Monitored API Endpoints
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            Automated synthetic health probes executed every 30 seconds
          </p>
        </div>
      </div>

      {/* Inline Add Endpoint Form */}
      <form onSubmit={handleSubmit} className="bg-slate-950/60 p-3.5 rounded-lg border border-slate-800">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          <div className="sm:col-span-4">
            <input
              type="text"
              placeholder="Endpoint Name (e.g., Stripe Webhook)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div className="sm:col-span-6">
            <input
              type="text"
              placeholder="URL (https://...)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={isAdding}
              className="w-full flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white font-semibold text-xs py-2 px-3 rounded-lg transition"
            >
              {isAdding ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              <span>Add URL</span>
            </button>
          </div>
        </div>
        {formError && (
          <div className="mt-2 text-xs text-rose-400 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{formError}</span>
          </div>
        )}
      </form>

      {/* Endpoints Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">Service & URL</th>
              <th className="py-2.5 px-3">HTTP Code</th>
              <th className="py-2.5 px-3">Latency</th>
              <th className="py-2.5 px-3">Uptime</th>
              <th className="py-2.5 px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-xs">
            {endpoints.length === 0 ? (
              <tr>
                <td colSpan="6" className="py-8 text-center text-slate-500">
                  No monitored endpoints configured yet. Add your first service URL above.
                </td>
              </tr>
            ) : (
              endpoints.map((ep) => {
                const isUp = ep.latest_status === true;
                const isDown = ep.latest_status === false;
                const isPending = ep.latest_status === null;

                return (
                  <tr key={ep.id} className="hover:bg-slate-800/30 transition-colors">
                    {/* Status Pill */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      {isUp && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          UP
                        </span>
                      )}
                      {isDown && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                          DOWN
                        </span>
                      )}
                      {isPending && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-500/10 text-slate-400 border border-slate-500/20">
                          <Clock className="w-3 h-3 text-slate-400" />
                          PENDING
                        </span>
                      )}
                    </td>

                    {/* Service & URL */}
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-200">
                        {ep.name}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                        <span className="truncate max-w-xs">{ep.url}</span>
                        <a
                          href={ep.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-500 hover:text-indigo-400 inline-block transition"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </td>

                    {/* HTTP Code */}
                    <td className="py-3 px-3 whitespace-nowrap font-mono text-xs">
                      {ep.latest_status_code ? (
                        <span
                          className={`font-bold ${
                            ep.latest_status_code < 400 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {ep.latest_status_code}
                        </span>
                      ) : (
                        <span className="text-slate-500">N/A</span>
                      )}
                    </td>

                    {/* Latency */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      {getLatencyBadge(ep.latest_response_time_ms)}
                    </td>

                    {/* Uptime % */}
                    <td className="py-3 px-3 whitespace-nowrap font-mono">
                      <div className="flex items-center gap-2">
                        <div className="w-12 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              ep.uptime_percentage >= 99
                                ? 'bg-emerald-500'
                                : ep.uptime_percentage >= 95
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                            }`}
                            style={{ width: `${ep.uptime_percentage}%` }}
                          ></div>
                        </div>
                        <span className="text-xs font-semibold text-slate-300">
                          {ep.uptime_percentage.toFixed(1)}%
                        </span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => onDeleteEndpoint(ep.id)}
                        disabled={isDeleting === ep.id}
                        className="text-slate-500 hover:text-rose-400 p-1 rounded-md hover:bg-slate-800 transition"
                        title="Delete endpoint"
                      >
                        {isDeleting === ep.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
