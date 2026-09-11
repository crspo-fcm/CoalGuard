export type BackendInspection = {
  id: number;
  observation: string;
  risk_level: "GREEN" | "RED" | string;
  status: string;
  latitude: number;
  longitude: number;
  distance_meters: number;
  created_at: string;
  inspector_name: string;
  inspector_email?: string;
  location_name: string;
};

export type MineLocation = {
  id: number;
  name: string;
  description?: string;
  latitude: number;
  longitude: number;
  qr_code: string;
  created_at: string;
};

export type BackendFraudAlert = {
  id: number;
  latitude: number;
  longitude: number;
  distance_meters: number;
  reason: string;
  created_at: string;
  inspector_name?: string;
  location_name?: string;
};

const api = async (path: string, options?: RequestInit) => {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.message || `Request failed (${response.status})`
    );
  }

  return data;
};

export async function checkBackendHealth() {
  return api("/api/health");
}

export async function getBackendInspections(): Promise<BackendInspection[]> {
  const data = await api("/api/inspections");

  return Array.isArray(data.inspections)
    ? data.inspections
    : [];
}

export async function submitBackendInspection(payload: {
  inspector_id: number;
  location_id: number;
  latitude: number;
  longitude: number;
  observation?: string;
}) {
  return api("/api/inspections", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteBackendInspection(
  inspectionId: number
) {
  return api(`/api/inspections/${inspectionId}`, {
    method: "DELETE",
  });
}

export async function getMineLocations(): Promise<MineLocation[]> {
  const data = await api("/api/locations");

  return Array.isArray(data.locations)
    ? data.locations
    : [];
}

export async function getFraudAlerts(): Promise<BackendFraudAlert[]> {
  const data = await api("/api/inspections/fraud-alerts");

  return Array.isArray(data.alerts)
    ? data.alerts
    : [];
}
export async function deleteFraudAlert(alertId: number) {
  return api(`/api/inspections/fraud-alerts/${alertId}`, {
    method: "DELETE",
  });
}