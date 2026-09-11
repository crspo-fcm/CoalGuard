const API_BASE_URL = "https://coalguard.onrender.com"

export async function testBackend() {
  const response = await fetch(`${API_BASE_URL}/`);

  if (!response.ok) {
    throw new Error("Backend is not responding");
  }

  return response.json();
}

export async function getInspections() {
  const response = await fetch(
    `${API_BASE_URL}/api/inspections`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch inspections");
  }

  return response.json();
}

export async function getLocations() {
  const response = await fetch(
    `${API_BASE_URL}/api/locations`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch mine locations");
  }

  return response.json();
}

export async function getFraudAlerts() {
  const response = await fetch(
    `${API_BASE_URL}/api/inspections/fraud-alerts`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch fraud alerts");
  }

  return response.json();
}

export async function submitInspection(data: {
  inspector_id: number;
  location_id: number;
  latitude: number;
  longitude: number;
  observation: string;
}) {
  const response = await fetch(
    `${API_BASE_URL}/api/inspections`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.message || "Inspection submission failed"
    );
  }

  return result;
}

export async function calculateRisk(observation: string) {
  const response = await fetch(
    `${API_BASE_URL}/api/risk-test`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        observation,
      }),
    }
  );

  if (!response.ok) {
    throw new Error("Risk calculation failed");
  }

  return response.json();
}