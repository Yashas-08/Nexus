import type { ExternalContextItem } from '../../types/analysis.js';

export class MapsService {
  private timeoutMs = 3500;

  /**
   * Resolves geographic location context and nearby civic/emergency infrastructure.
   */
  public async fetchLocationContext(
    latitude: number,
    longitude: number
  ): Promise<ExternalContextItem | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude.toFixed(5)}&lon=${longitude.toFixed(5)}&zoom=16&addressdetails=1`;

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'NexusConsumerApp/1.0',
        },
      });

      clearTimeout(timer);

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as any;
      if (!data || !data.address) return null;

      const addr = data.address;
      const road = addr.road || addr.pedestrian || addr.suburb || 'Local road';
      const city = addr.city || addr.town || addr.village || addr.county || 'Municipality';
      const postcode = addr.postcode ? ` ${addr.postcode}` : '';
      const neighborhood = addr.neighbourhood || addr.suburb || '';

      const locationLabel = [road, neighborhood, city + postcode].filter(Boolean).join(', ');

      return {
        id: `ctx-map-${Date.now()}`,
        source: 'MAP',
        title: 'Geographic & Administrative Area Context',
        summary: `Identified incident vicinity: ${locationLabel}. Coordinates: ${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°.`,
        retrievedAt: new Date().toISOString(),
        relevance: 'MEDIUM',
        verificationStatus: 'CONTEXT_ONLY',
        sourceReference: 'OpenStreetMap Cartographic Data',
      };
    } catch (err) {
      clearTimeout(timer);
      return null;
    }
  }
}

export const mapsService = new MapsService();
