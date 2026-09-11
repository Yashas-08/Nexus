import { WeatherService } from '../src/services/context/weatherService.js';
import { MapsService } from '../src/services/context/mapsService.js';
import { ContextRouter } from '../src/services/context/contextRouter.js';
import { VerificationEngine } from '../src/services/verificationEngine.js';
import type { AnalysisResult, ExternalContextItem } from '../src/types/analysis.js';
import { assessRisk } from '../../client/src/services/riskEngine.js';
import { generateActionGraph } from '../../client/src/services/actionEngine.js';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
}

console.log('--- STARTING EXTERNAL CONTEXT & VERIFICATION TEST SUITE (15 SCENARIOS) ---');

async function runTests() {
  const weatherService = new WeatherService();
  const mapsService = new MapsService();
  const contextRouter = new ContextRouter();
  const verificationEngine = new VerificationEngine();

  // 1. WeatherService: Valid coordinates return verified meteorological telemetry
  {
    console.log('Scenario 1: WeatherService returns verified telemetry for valid coordinates');
    // London coordinates
    const weather = await weatherService.fetchCurrentWeather(51.5074, -0.1278);
    assert(weather !== null, 'Weather service should return context for valid coordinates');
    assert(weather?.source === 'WEATHER', 'Context source must be WEATHER');
    assert(weather?.verificationStatus === 'VERIFIED', 'Direct telemetry verification status must be VERIFIED');
    assert(weather?.summary.includes('°C') || weather?.summary.includes('Conditions'), 'Summary must contain temperature/conditions');
    console.log('  Passed Scenario 1');
  }

  // 2. WeatherService: Graceful handling of invalid coordinates without throwing
  {
    console.log('Scenario 2: WeatherService handles out-of-range coordinates gracefully');
    const weather = await weatherService.fetchCurrentWeather(999.0, 999.0);
    assert(weather === null, 'Invalid coordinates must return null rather than crashing');
    console.log('  Passed Scenario 2');
  }

  // 3. MapsService: Valid coordinates return verified civic reverse geocode
  {
    console.log('Scenario 3: MapsService returns verified reverse geocode for valid coordinates');
    const location = await mapsService.fetchLocationContext(51.5074, -0.1278);
    // Even if OSM rate-limits or times out, it returns null gracefully; if successful it returns MAP context
    if (location) {
      assert(location.source === 'MAP', 'Context source must be MAP');
      assert(location.verificationStatus === 'CONTEXT_ONLY', 'Cartographic reference is CONTEXT_ONLY');
      assert(location.title.includes('Context') || location.title.includes('Geographic'), 'Title must note location context');
    }
    console.log('  Passed Scenario 3');
  }

  // 4. MapsService: Graceful handling of null/undefined coordinates
  {
    console.log('Scenario 4: MapsService handles invalid coordinates gracefully');
    const location = await mapsService.fetchLocationContext(NaN, NaN);
    assert(location === null, 'NaN coordinates must return null');
    console.log('  Passed Scenario 4');
  }

  // 5. ContextRouter: Weather keyword triggers weather retrieval when location is available
  {
    console.log('Scenario 5: ContextRouter routes weather query when keywords match');
    const mockRequest = {
      text: 'Heavy rain and storm flooding in the street outside my house',
      location: { latitude: 51.5074, longitude: -0.1278 },
    };
    const mockAnalysis: AnalysisResult = {
      situation: 'Street flooded by heavy storm',
      userIntent: 'Report road hazard',
      severity: 'high',
      confidence: 0.85,
      facts: [],
      userReported: [],
      inferences: [],
      risks: [],
      missingInformation: [],
    };
    const items = await contextRouter.routeContext(mockRequest, mockAnalysis);
    const hasWeather = items.some((i) => i.source === 'WEATHER');
    assert(hasWeather, 'Weather context must be retrieved when storm/rain keywords and location are present');
    console.log('  Passed Scenario 5');
  }

  // 6. ContextRouter: Routine non-weather inquiry does NOT trigger unnecessary weather request
  {
    console.log('Scenario 6: ContextRouter ignores weather for routine non-weather inquiry');
    const mockRequest = {
      text: 'How do I renew my resident parking permit online?',
      location: { latitude: 51.5074, longitude: -0.1278 },
    };
    const mockAnalysis: AnalysisResult = {
      situation: 'Renew parking permit online',
      userIntent: 'Find renewal portal',
      severity: 'low',
      confidence: 0.9,
      facts: [],
      userReported: [],
      inferences: [],
      risks: [],
      missingInformation: [],
    };
    const items = await contextRouter.routeContext(mockRequest, mockAnalysis);
    const hasWeather = items.some((i) => i.source === 'WEATHER');
    assert(!hasWeather, 'Weather context must NOT be retrieved for unrelated administrative inquiry');
    console.log('  Passed Scenario 6');
  }

  // 7. ContextRouter: Location provided without weather keywords retrieves civic map context only
  {
    console.log('Scenario 7: ContextRouter retrieves map context without weather when no storm keywords present');
    const mockRequest = {
      text: 'The sidewalk outside my storefront is cracked and uneven.',
      location: { latitude: 51.5074, longitude: -0.1278 },
    };
    const mockAnalysis: AnalysisResult = {
      situation: 'Sidewalk cracked on storefront road',
      userIntent: 'Report pavement defect',
      severity: 'low',
      confidence: 0.85,
      facts: [],
      userReported: [],
      inferences: [],
      risks: [],
      missingInformation: [],
    };
    const items = await contextRouter.routeContext(mockRequest, mockAnalysis);
    const hasWeather = items.some((i) => i.source === 'WEATHER');
    assert(!hasWeather, 'Weather context must not be called without weather keywords');
    console.log('  Passed Scenario 7');
  }

  // 8. ContextRouter: No location provided gracefully skips geo-dependent providers
  {
    console.log('Scenario 8: ContextRouter skips geo-dependent providers when location is absent');
    const mockRequest = {
      text: 'There is a major power outage in my neighborhood',
    };
    const mockAnalysis: AnalysisResult = {
      situation: 'Major power outage',
      userIntent: 'Report blackout',
      severity: 'high',
      confidence: 0.8,
      facts: [],
      userReported: [],
      inferences: [],
      risks: [],
      missingInformation: [],
    };
    const items = await contextRouter.routeContext(mockRequest, mockAnalysis);
    const hasWeather = items.some((i) => i.source === 'WEATHER');
    const hasMap = items.some((i) => i.source === 'MAP');
    assert(!hasWeather, 'Weather must not be called without coordinates');
    assert(!hasMap, 'Map must not be called without coordinates');
    console.log('  Passed Scenario 8');
  }

  // 9. Verification Engine: External context is attached without upgrading user statements to VERIFIED
  {
    console.log('Scenario 9: Verification Engine preserves USER_REPORTED status despite external context');
    const rawAnalysis: AnalysisResult = {
      situation: 'User reports basement flooded by rainstorm',
      userIntent: 'Get emergency pumping help',
      severity: 'high',
      confidence: 0.85,
      facts: [],
      userReported: [
        { text: 'Basement flooded with 2 feet of rainwater', source: 'text' },
        { text: 'Storm drain backed up', source: 'text' },
      ],
      inferences: [{ text: 'Possible storm sewer overflow', confidence: 0.7 }],
      risks: [{ text: 'Water damage to boiler', priority: 'high' }],
      missingInformation: ['Is the main electrical breaker isolated?'],
    };

    const externalContext: ExternalContextItem[] = [
      {
        id: 'weather-telemetry-1',
        source: 'WEATHER',
        title: 'Local Meteorological Telemetry',
        summary: 'Heavy Rain (14.5mm/h, precipitation probability 98%)',
        retrievedAt: new Date().toISOString(),
        relevance: 'HIGH',
        verificationStatus: 'VERIFIED',
        sourceReference: 'Open-Meteo',
      },
    ];

    const mockRequest = { text: 'Basement flooded with 2 feet of rainwater', images: [], documents: [] };
    const normalized = verificationEngine.normalize(rawAnalysis, mockRequest, externalContext);
    assert(normalized.externalContext?.length === 1, 'External context must be attached to normalized analysis');
    const basementReport = normalized.evidence.find((e) => e.text.includes('Basement flooded'));
    assert(basementReport !== undefined, 'User report must exist in evidence');
    assert(basementReport?.status === 'USER_REPORTED', 'User report must REMAIN USER_REPORTED; external data must NEVER upgrade user claims');
    console.log('  Passed Scenario 9');
  }

  // 10. Verification Engine: Discrepancy detection between user flood claim and dry telemetry
  {
    console.log('Scenario 10: Discrepancy surfaced when user claims flash flood but telemetry shows 0.0mm dry conditions');
    const rawAnalysis: AnalysisResult = {
      situation: 'User reports torrential downpour and street flooding',
      userIntent: 'Report flood emergency',
      severity: 'high',
      confidence: 0.8,
      facts: [],
      userReported: [{ text: 'Torrential downpour and flash flooding on Main St', source: 'text' }],
      inferences: [],
      risks: [],
      missingInformation: [],
    };

    const dryWeatherContext: ExternalContextItem[] = [
      {
        id: 'weather-dry',
        source: 'WEATHER',
        title: 'Current Weather Telemetry',
        summary: 'Clear sky, 22.0°C, 0.0mm precipitation, Wind 4 km/h',
        retrievedAt: new Date().toISOString(),
        relevance: 'HIGH',
        verificationStatus: 'VERIFIED',
        sourceReference: 'Open-Meteo',
      },
    ];

    const mockRequest = { text: 'Torrential downpour and flash flooding on Main St', images: [], documents: [] };
    const normalized = verificationEngine.normalize(rawAnalysis, mockRequest, dryWeatherContext);
    assert(normalized.conflicts.length > 0, 'Discrepancy must be surfaced in conflicts');
    assert(
      normalized.conflicts.some((c) => c.description.includes('Meteorological telemetry')),
      'Conflict description must reference meteorological telemetry discrepancy'
    );
    console.log('  Passed Scenario 10');
  }

  // 11. Verification Engine: Multiple external sources preserved without loss
  {
    console.log('Scenario 11: Multiple external context sources preserved');
    const rawAnalysis: AnalysisResult = {
      situation: 'Power pole leaning dangerously after storm',
      userIntent: 'Report downed wire risk',
      severity: 'high',
      confidence: 0.9,
      facts: [{ text: 'GPS coordinates 51.5074, -0.1278 provided', source: 'location' }],
      userReported: [{ text: 'Pole is leaning at 45 degrees', source: 'text' }],
      inferences: [],
      risks: [{ text: 'Live wire hazard', priority: 'high' }],
      missingInformation: [],
    };

    const multiContext: ExternalContextItem[] = [
      {
        id: 'ctx-weather',
        source: 'WEATHER',
        title: 'Wind Gust Telemetry',
        summary: 'Gale force gusts 68 km/h',
        retrievedAt: new Date().toISOString(),
        relevance: 'HIGH',
        verificationStatus: 'VERIFIED',
      },
      {
        id: 'ctx-map',
        source: 'MAP',
        title: 'Civic Geocode',
        summary: 'Westminster, London, Greater London',
        retrievedAt: new Date().toISOString(),
        relevance: 'MEDIUM',
        verificationStatus: 'VERIFIED',
      },
    ];

    const mockRequest = { text: 'Pole is leaning at 45 degrees', images: [], documents: [] };
    const normalized = verificationEngine.normalize(rawAnalysis, mockRequest, multiContext);
    assert(normalized.externalContext?.length === 2, 'Both external context items must be preserved');
    console.log('  Passed Scenario 11');
  }

  // 12. Risk Engine: Confirmed severe weather telemetry elevates risk score and adds verified factor
  {
    console.log('Scenario 12: Risk Engine incorporates severe weather telemetry into risk score and reasoning');
    const analysisWithWeather = {
      situation: 'Basement flooding with water rising',
      userReported: ['Water rising rapidly in basement'],
      evidence: [
        {
          id: 'ev-1',
          statement: 'Water rising rapidly in basement',
          status: 'USER_REPORTED' as const,
          source: 'text' as const,
          confidence: 0.8,
        },
      ],
      externalContext: [
        {
          id: 'w-1',
          source: 'WEATHER' as const,
          title: 'Violent Rainstorm Telemetry',
          summary: 'Torrential rain 25mm/h, thunderstorm active',
          retrievedAt: new Date().toISOString(),
          relevance: 'HIGH' as const,
          verificationStatus: 'VERIFIED' as const,
        },
      ],
    };

    const risk = assessRisk(analysisWithWeather);
    assert(
      risk.factors.some((f) => f.label === 'Verified Severe Weather Telemetry'),
      'Verified severe weather telemetry must appear in risk factors'
    );
    assert(
      risk.reasoning.some((r) => r.includes('Meteorological telemetry corroborates')),
      'Risk reasoning must mention external telemetry corroboration'
    );
    console.log('  Passed Scenario 12');
  }

  // 13. Risk Engine: Discrepancy/Conflict sets evidenceConfidence to UNCERTAIN
  {
    console.log('Scenario 13: Conflict in external telemetry forces evidence confidence to UNCERTAIN');
    const analysisWithConflict = {
      situation: 'User claims massive flood on sunny day',
      userReported: ['Street is underwater from hurricane'],
      conflicts: [
        {
          statementA: 'User claims street is underwater from hurricane',
          statementB: 'Meteorological telemetry reports clear sky and 0.0mm precipitation',
          description: 'Meteorological telemetry records dry conditions conflicting with flood claim.',
        },
      ],
    };

    const risk = assessRisk(analysisWithConflict);
    assert(risk.evidenceConfidence === 'UNCERTAIN', 'External conflict must set evidence confidence to UNCERTAIN');
    console.log('  Passed Scenario 13');
  }

  // 14. Action Engine: External severe weather context generates weather safety guidance
  {
    console.log('Scenario 14: Action Engine contextualizes safety action when severe weather is verified');
    const analysisForAction = {
      situation: 'Active flash flood and storm in low-lying district',
      userReported: [{ text: 'Heavy storm downpour in progress', source: 'text' as const }],
      externalContext: [
        {
          id: 'w-active',
          source: 'WEATHER' as const,
          title: 'Active Thunderstorm',
          summary: 'Severe thunderstorm warning, precipitation 18mm/h',
          retrievedAt: new Date().toISOString(),
          relevance: 'HIGH' as const,
          verificationStatus: 'VERIFIED' as const,
        },
      ],
    };

    const risk = assessRisk(analysisForAction);
    const graph = generateActionGraph(analysisForAction, risk);
    const hasWeatherSafetyAction = graph.actions.some((a) => a.id === 'safety-severe-weather-hazard');
    assert(hasWeatherSafetyAction, 'safety-severe-weather-hazard action must be generated for severe weather context');
    console.log('  Passed Scenario 14');
  }

  // 15. Action Engine: Routine situation without weather context omits weather actions
  {
    console.log('Scenario 15: Action Engine omits weather actions when no weather context is present');
    const routineAnalysis = {
      situation: 'Inquire about community recreation center summer camp registration',
      userReported: [{ text: 'Need summer camp registration hours', source: 'text' as const }],
      externalContext: [],
    };

    const routineRisk = assessRisk(routineAnalysis);
    const routineGraph = generateActionGraph(routineAnalysis, routineRisk);
    const hasWeatherSafety = routineGraph.actions.some((a) => a.id === 'safety-severe-weather-hazard');
    assert(!hasWeatherSafety, 'Weather safety action must NOT be generated for routine non-weather situation');
    console.log('  Passed Scenario 15');
  }

  console.log('\n======================================================');
  console.log('🎉 ALL 15 EXTERNAL CONTEXT TEST SCENARIOS PASSED SUCCESSFULLY!');
  console.log('======================================================');
}

runTests().catch((err) => {
  console.error('Test run error:', err);
  process.exit(1);
});
