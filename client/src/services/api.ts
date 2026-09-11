export interface HealthStatus {
  status: string;
  message: string;
  timestamp: string;
  uptime: number;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export async function checkHealth(): Promise<HealthStatus> {
  const response = await fetch(`${API_BASE_URL}/api/health`, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`API health check failed with status ${response.status}`);
  }

  return response.json();
}
