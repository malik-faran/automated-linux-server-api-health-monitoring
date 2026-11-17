const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

/**
 * Common fetch helper with error handling and JSON parsing
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  try {
    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });

    if (!res.ok) {
      let errorMsg = `HTTP ${res.status}: ${res.statusText}`;
      try {
        const errJson = await res.json();
        if (errJson.detail) {
          errorMsg = typeof errJson.detail === "string" ? errJson.detail : JSON.stringify(errJson.detail);
        }
      } catch (_) {}
      throw new Error(errorMsg);
    }

    return await res.json();
  } catch (err) {
    console.error(`API request failed for ${url}:`, err);
    throw err;
  }
}

export const api = {
  getHealth: () => request("/api/health"),
  getLatestMetrics: () => request("/api/metrics/latest"),
  getEndpoints: () => request("/api/endpoints"),
  createEndpoint: (data) =>
    request("/api/endpoints", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteEndpoint: (id) =>
    request(`/api/endpoints/${id}`, {
      method: "DELETE",
    }),
  getIncidents: () => request("/api/incidents"),
  triggerMonitoringCycle: () =>
    request("/api/monitor/trigger", {
      method: "POST",
    }),
};
