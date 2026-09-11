import type {
  IntentAnalyzeRequest,
  AnalysisResult,
  ExternalContextItem,
} from '../../types/analysis.js';
import { weatherService } from './weatherService.js';
import { mapsService } from './mapsService.js';
import { webContextService } from './webContextService.js';

const WEATHER_KEYWORDS = /\b(weather|rain|flooding|flood|storm|temperature|wind|heat|freeze|cold|snow|inundat|stormwater|surge)\b/i;
const MAP_KEYWORDS = /\b(street|road|sidewalk|traffic|hospital|building|fire|accident|trapped|pipe|downed|pole|line|neighborhood|vicinity)\b/i;
const WEB_KEYWORDS = /\b(advisory|announcement|closure|evacuation|official|regulation|transit|curfew|alert|health notice)\b/i;

export class ContextRouter {
  /**
   * Deterministically routes requests to relevant external context providers.
   * Ensures irrelevant providers are NOT queried and failures degrade gracefully.
   */
  public async routeContext(
    request: IntentAnalyzeRequest,
    rawAnalysis: AnalysisResult
  ): Promise<ExternalContextItem[]> {
    const hasValidLocation =
      request.location !== null &&
      request.location !== undefined &&
      typeof request.location.latitude === 'number' &&
      typeof request.location.longitude === 'number' &&
      !isNaN(request.location.latitude) &&
      !isNaN(request.location.longitude) &&
      request.location.latitude >= -90 &&
      request.location.latitude <= 90 &&
      request.location.longitude >= -180 &&
      request.location.longitude <= 180;

    const situationCorpus = [
      request.text,
      rawAnalysis.situation,
      rawAnalysis.userIntent,
      ...(rawAnalysis.risks || []).map((r) => r.text),
      ...(rawAnalysis.facts || []).map((f) => f.text),
      ...(rawAnalysis.userReported || []).map((u) => u.text),
    ].join(' ');

    const needsWeather = hasValidLocation && WEATHER_KEYWORDS.test(situationCorpus);
    const needsMap = hasValidLocation && MAP_KEYWORDS.test(situationCorpus);
    const needsWeb = WEB_KEYWORDS.test(situationCorpus);

    const pendingRequests: Promise<ExternalContextItem | null>[] = [];

    if (needsWeather && request.location) {
      pendingRequests.push(
        weatherService.fetchCurrentWeather(request.location.latitude, request.location.longitude)
      );
    }

    if (needsMap && request.location) {
      pendingRequests.push(
        mapsService.fetchLocationContext(request.location.latitude, request.location.longitude)
      );
    }

    if (needsWeb) {
      pendingRequests.push(
        webContextService.fetchPublicAdvisories(rawAnalysis.situation, request.location?.label)
      );
    }

    if (pendingRequests.length === 0) {
      return [];
    }

    // Execute relevant providers in parallel with resilient settle
    const results = await Promise.allSettled(pendingRequests);
    const contextItems: ExternalContextItem[] = [];

    for (const res of results) {
      if (res.status === 'fulfilled' && res.value !== null) {
        contextItems.push(res.value);
      }
    }

    // Deduplicate any repeated sources
    const seenSources = new Set<string>();
    const deduplicated: ExternalContextItem[] = [];

    for (const item of contextItems) {
      const key = `${item.source}-${item.title}`;
      if (!seenSources.has(key)) {
        seenSources.add(key);
        deduplicated.push(item);
      }
    }

    return deduplicated;
  }
}

export const contextRouter = new ContextRouter();
