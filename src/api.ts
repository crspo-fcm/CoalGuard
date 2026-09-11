export const API_BASE_URL =
  "https://coalguard.onrender.com";

/* =========================================================
   GENERIC API HELPER
========================================================= */

async function apiRequest(
  endpoint: string,
  options: RequestInit = {}
) {
  const response = await fetch(
    `${API_BASE_URL}${endpoint}`,
    {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    }
  );

  const data =
    await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.message ||
        `Request failed (${response.status})`
    );
  }

  return data;
}

/* =========================================================
   BACKEND HEALTH
========================================================= */

export async function testBackend() {
  return apiRequest("/");
}

/* =========================================================
   AUTH
========================================================= */

export async function login(
  email: string,
  password: string
) {
  return apiRequest(
    "/api/auth/login",
    {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
      }),
    }
  );
}

/* =========================================================
   INSPECTIONS
========================================================= */

export async function submitInspection(
  payload: {
    inspector_id: number;
    location_id: number;
    latitude: number;
    longitude: number;
    observation?: string;
  }
) {
  return apiRequest(
    "/api/inspections",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export async function getInspections() {
  return apiRequest(
    "/api/inspections"
  );
}

export async function deleteInspection(
  inspectionId: number
) {
  return apiRequest(
    `/api/inspections/${inspectionId}`,
    {
      method: "DELETE",
    }
  );
}

/* =========================================================
   LOCATIONS
========================================================= */

export async function getLocations() {
  return apiRequest(
    "/api/locations"
  );
}

export async function getLocation(
  locationId: number
) {
  return apiRequest(
    `/api/locations/${locationId}`
  );
}

/* =========================================================
   FRAUD ALERTS
========================================================= */

export async function getFraudAlerts() {
  return apiRequest(
    "/api/inspections/fraud-alerts"
  );
}

export async function deleteFraudAlert(
  alertId: number
) {
  return apiRequest(
    `/api/inspections/fraud-alerts/${alertId}`,
    {
      method: "DELETE",
    }
  );
}

/* =========================================================
   VIOLATIONS
========================================================= */

export async function getViolations() {
  return apiRequest(
    "/api/violations"
  );
}

export async function updateViolation(
  violationId: number,
  payload: Record<string, unknown>
) {
  return apiRequest(
    `/api/violations/${violationId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    }
  );
}

export async function deleteViolation(
  violationId: number
) {
  return apiRequest(
    `/api/violations/${violationId}`,
    {
      method: "DELETE",
    }
  );
}

/* =========================================================
   AUDIT
========================================================= */

export async function getAuditLogs() {
  return apiRequest(
    "/api/audit"
  );
}

export async function getAuditStats() {
  return apiRequest(
    "/api/audit/stats"
  );
}

export async function verifyAuditChain() {
  return apiRequest(
    "/api/audit/verify"
  );
}

/* =========================================================
   MINES
========================================================= */

export async function getMines() {
  return apiRequest(
    "/api/mines"
  );
}