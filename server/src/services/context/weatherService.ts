import type { ExternalContextItem } from '../../types/analysis.js';

export interface WeatherTelemetry {
  temperature: number;
  precipitation: number; // mm
  windSpeed: number; // km/h
  weatherCode: number;
  description: string;
}

/**
 * Maps WMO Weather interpretation codes to clear human descriptions.
 */
function mapWeatherCode(code: number): string {
  if (code === 0) return 'Clear sky';
  if (code >= 1 && code <= 3) return 'Mainly clear, partly cloudy, and overcast';
  if (code === 45 || code === 48) return 'Fog and depositing rime fog';
  if (code >= 51 && code <= 55) return 'Drizzle (light to dense)';
  if (code >= 61 && code <= 65) return 'Rain (slight, moderate, or heavy)';
  if (code >= 71 && code <= 77) return 'Snow fall or grains';
  if (code >= 80 && code <= 82) return 'Rain showers (violent)';
  if (code >= 95 && code <= 99) return 'Thunderstorm with possible hail';
  return 'Overcast / mixed conditions';
}

export class WeatherService {
  private timeoutMs = 3500;

  /**
   * Fetches real-time meteorological conditions for given geographic coordinates.
   */
  public async fetchCurrentWeather(
    latitude: number,
    longitude: number
  ): Promise<ExternalContextItem | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude.toFixed(4)}&longitude=${longitude.toFixed(4)}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m`;

      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });

      clearTimeout(timer);

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as any;
      const current = data.current;
      if (!current) return null;

      const temp = current.temperature_2m;
      const precip = current.precipitation;
      const wind = current.wind_speed_10m;
      const code = current.weather_code;
      const conditionDesc = mapWeatherCode(code);

      const hasPrecip = precip > 0.0;
      const isSevere = precip >= 5.0 || wind >= 50 || code >= 95;

      const summary = `Current conditions: ${conditionDesc}, ${temp}°C. Precipitation: ${precip} mm/h. Wind: ${wind} km/h.`;

      return {
        id: `ctx-weather-${Date.now()}`,
        source: 'WEATHER',
        title: isSevere
          ? 'Active Severe Weather Advisory (Meteorological Telemetry)'
          : 'Real-Time Meteorological Telemetry',
        summary,
        retrievedAt: new Date().toISOString(),
        relevance: isSevere ? 'HIGH' : hasPrecip ? 'MEDIUM' : 'LOW',
        verificationStatus: 'VERIFIED',
        sourceReference: 'Open-Meteo High-Resolution Meteorological Telemetry',
      };
    } catch (err) {
      clearTimeout(timer);
      // Fail gracefully without interrupting main pipeline
      return null;
    }
  }
}

export const weatherService = new WeatherService();
