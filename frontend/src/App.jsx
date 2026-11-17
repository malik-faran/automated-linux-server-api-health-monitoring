import React, { useState, useEffect, useCallback, useRef } from 'react';
import Header from './components/Header';
import KpiCards from './components/KpiCards';
import ResourceChart from './components/ResourceChart';
import EndpointsTable from './components/EndpointsTable';
import IncidentFeed from './components/IncidentFeed';
import { api } from './api';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function App() {
  const [metrics, setMetrics] = useState({ latest: null, history: [] });
  const [endpoints, setEndpoints] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [healthStatus, setHealthStatus] = useState(null);

  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isDeleting, setIsDeleting] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [countdown, setCountdown] = useState(10);

  const countdownRef = useRef(10);

  // Fetch all dashboard data from backend
  const fetchAllData = useCallback(async (isSilent = false) => {
    try {
      const [health, metricsData, endpointsData, incidentsData] = await Promise.all([
        api.getHealth().catch((e) => ({ status: 'error', detail: e.message })),
        api.getLatestMetrics().catch(() => ({ latest: null, history: [] })),
        api.getEndpoints().catch(() => []),
        api.getIncidents().catch(() => []),
      ]);

      setHealthStatus(health);
      if (metricsData) setMetrics(metricsData);
      if (Array.isArray(endpointsData)) setEndpoints(endpointsData);
      if (Array.isArray(incidentsData)) setIncidents(incidentsData);

      setErrorMsg('');
      setLastUpdated(new Date());
    } catch (err) {
      if (!isSilent) {
        setErrorMsg('Unable to connect to backend monitoring server. Ensure FastAPI is running on port 8000.');
      }
    } finally {
      setIsLoadingInitial(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // 10-second polling and 1-second countdown ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchAllData(true);
          return 10;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [fetchAllData]);

  // Manual Trigger Check handler
  const handleTriggerCheck = async () => {
    setIsChecking(true);
    try {
      await api.triggerMonitoringCycle();
      await fetchAllData();
      setCountdown(10);
    } catch (err) {
      setErrorMsg(`Manual monitoring probe failed: ${err.message}`);
    } finally {
      setIsChecking(false);
    }
  };

  // Add Endpoint handler
  const handleAddEndpoint = async (newEndpoint) => {
    setIsAdding(true);
    try {
      await api.createEndpoint(newEndpoint);
      // Run quick check so new endpoint immediately has status
      await api.triggerMonitoringCycle().catch(() => {});
      await fetchAllData();
    } finally {
      setIsAdding(false);
    }
  };

  // Delete Endpoint handler
  const handleDeleteEndpoint = async (id) => {
    setIsDeleting(id);
    try {
      await api.deleteEndpoint(id);
      await fetchAllData();
    } catch (err) {
      setErrorMsg(`Failed to delete endpoint: ${err.message}`);
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header
        isChecking={isChecking}
        onTriggerCheck={handleTriggerCheck}
        lastUpdated={lastUpdated}
        healthStatus={healthStatus}
        countdown={countdown}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Error notification banner */}
        {errorMsg && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 flex items-start gap-3 text-rose-300 text-xs">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold text-rose-200">Connection Error:</span> {errorMsg}
            </div>
            <button
              onClick={() => fetchAllData()}
              className="text-xs underline hover:text-rose-100 font-semibold flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" /> Retry
            </button>
          </div>
        )}

        {/* Section 1: KPI Cards */}
        <KpiCards metrics={metrics} endpoints={endpoints} />

        {/* Section 2: Real-time Resource Chart */}
        <ResourceChart history={metrics.history} />

        {/* Section 3 & 4: Two-column grid for APIs and Incident feed */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7">
            <EndpointsTable
              endpoints={endpoints}
              onAddEndpoint={handleAddEndpoint}
              onDeleteEndpoint={handleDeleteEndpoint}
              isAdding={isAdding}
              isDeleting={isDeleting}
            />
          </div>
          <div className="lg:col-span-5">
            <IncidentFeed incidents={incidents} />
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Automated Linux Server & API Health Monitoring System &bull; Production Observability</span>
          <span className="font-mono text-[11px] text-slate-400">
            Last sync: {lastUpdated.toLocaleTimeString()}
          </span>
        </div>
      </footer>
    </div>
  );
}
