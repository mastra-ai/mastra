import { openai } from '@ai-sdk/openai';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { createScorer } from '@mastra/core/evals';
import { createTool } from '@mastra/core/tools';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { createToolCallAccuracyScorerCode, createCompletenessScorer } from '@mastra/evals/scorers/prebuilt';
import { getAssistantMessageFromRunOutput, getUserMessageFromRunInput } from '@mastra/evals/scorers/utils';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { Observability } from '@mastra/observability';
import cors from 'cors';
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { z } from 'zod';
import { MastraServer } from '../src/index';

const storage = new LibSQLStore({
  id: 'express-storage',
  url: 'file:./mastra.db',
});

export const weatherTool = createTool({
  id: 'get-weather',
  description: 'Get current weather for a location',
  inputSchema: z.object({
    location: z.string().describe('City name'),
  }),
  outputSchema: z.object({
    temperature: z.number(),
    feelsLike: z.number(),
    humidity: z.number(),
    windSpeed: z.number(),
    windGust: z.number(),
    conditions: z.string(),
    location: z.string(),
  }),
  execute: async inputData => {
    console.info('tool context', inputData);
    const location = inputData.location;
    const geocodingUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1`;
    const geocodingResponse = await fetch(geocodingUrl);
    const geocodingData = (await geocodingResponse.json()) as any;

    if (!geocodingData.results?.[0]) {
      throw new Error(`Location '${location}' not found`);
    }

    const { latitude, longitude, name } = geocodingData.results[0];

    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,weather_code`;

    const response = await fetch(weatherUrl);
    const data = (await response.json()) as any;

    return {
      temperature: data.current.temperature_2m,
      feelsLike: data.current.apparent_temperature,
      humidity: data.current.relative_humidity_2m,
      windSpeed: data.current.wind_speed_10m,
      windGust: data.current.wind_gusts_10m,
      conditions: getWeatherCondition(data.current.weather_code),
      location: name,
    };
  },
});

const newAgent = new Agent({
  id: 'new-agent',
  name: 'New Agent',
  instructions: 'This is a new agent',
  model: openai('gpt-4o'),
});

export const planningAgent = new Agent({
  id: 'planningAgent',
  name: 'planningAgent',
  model: openai('gpt-4o'),
  instructions: `
        You are a local activities and travel expert who excels at weather-based planning. Analyze the weather data and provide practical activity recommendations.

        📅 [Day, Month Date, Year]
        ═══════════════════════════

        🌡️ WEATHER SUMMARY
        • Conditions: [brief description]
        • Temperature: [X°C/Y°F to A°C/B°F]
        • Precipitation: [X% chance]

        🌅 MORNING ACTIVITIES
        Outdoor:
        • [Activity Name] - [Brief description including specific location/route]
          Best timing: [specific time range]
          Note: [relevant weather consideration]

        🌞 AFTERNOON ACTIVITIES
        Outdoor:
        • [Activity Name] - [Brief description including specific location/route]
          Best timing: [specific time range]
          Note: [relevant weather consideration]

        🏠 INDOOR ALTERNATIVES
        • [Activity Name] - [Brief description including specific venue]
          Ideal for: [weather condition that would trigger this alternative]

        ⚠️ SPECIAL CONSIDERATIONS
        • [Any relevant weather warnings, UV index, wind conditions, etc.]

        Guidelines:
        - Suggest 2-3 time-specific outdoor activities per day
        - Include 1-2 indoor backup options
        - For precipitation >50%, lead with indoor activities
        - All activities must be specific to the location
        - Include specific venues, trails, or locations
        - Consider activity intensity based on temperature
        - Keep descriptions concise but informative

        Maintain this exact formatting for consistency, using the emoji and section headers as shown.
      `,
});

function getWeatherCondition(code: number): string {
  const conditions: Record<number, string> = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Foggy',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    71: 'Slight snow fall',
    73: 'Moderate snow fall',
    75: 'Heavy snow fall',
    95: 'Thunderstorm',
  };
  return conditions[code] || 'Unknown';
}

const forecastSchema = z.object({
  date: z.string(),
  maxTemp: z.number(),
  minTemp: z.number(),
  precipitationChance: z.number(),
  condition: z.string(),
});

const fetchWeather = createStep({
  id: 'fetch-weather',
  description: 'Fetches weather forecast for a given city',
  inputSchema: z.object({
    city: z.string(),
  }),
  outputSchema: forecastSchema,
  execute: async ({ inputData }) => {
    const geocodingUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(inputData.city)}&count=1`;
    const geocodingResponse = await fetch(geocodingUrl);
    const geocodingData = (await geocodingResponse.json()) as {
      results: { latitude: number; longitude: number; name: string }[];
    };

    if (!geocodingData.results?.[0]) {
      throw new Error(`Location '${inputData.city}' not found`);
    }

    const { latitude, longitude } = geocodingData.results[0];

    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=precipitation,weathercode&timezone=auto,&hourly=precipitation_probability,temperature_2m`;
    const response = await fetch(weatherUrl);
    const data = (await response.json()) as {
      current: {
        time: string;
        precipitation: number;
        weathercode: number;
      };
      hourly: {
        precipitation_probability: number[];
        temperature_2m: number[];
      };
    };

    const forecast = {
      date: new Date().toISOString(),
      maxTemp: Math.max(...data.hourly.temperature_2m),
      minTemp: Math.min(...data.hourly.temperature_2m),
      condition: getWeatherCondition(data.current.weathercode),
      precipitationChance: data.hourly.precipitation_probability.reduce((acc, curr) => Math.max(acc, curr), 0),
    };

    return forecast;
  },
});

const planActivities = createStep({
  id: 'plan-activities',
  description: 'Suggests activities based on weather conditions',
  inputSchema: forecastSchema,
  outputSchema: z.object({
    activities: z.string(),
  }),
  execute: async ({ getInitData, inputData, mastra }) => {
    const { city } = getInitData();
    const forecast = inputData;

    const prompt = `Based on the following weather forecast for ${city}, suggest appropriate activities:
      ${JSON.stringify(forecast, null, 2)}
      `;

    const agent = mastra.getAgent('planningAgent');
    const response = await agent.stream([
      {
        role: 'user',
        content: prompt,
      },
    ]);

    let activitiesText = '';

    for await (const chunk of response.textStream) {
      process.stdout.write(chunk);
      activitiesText += chunk;
    }

    return {
      activities: activitiesText,
    };
  },
});

export const summaryAgent = new Agent({
  id: 'summaryAgent',
  name: 'summaryAgent',
  model: openai('gpt-4o'),
  instructions: `
  You are a travel agent who is given a user prompt about what kind of holiday they want to go on.
  You then generate 3 different options for the holiday. Return the suggestions as a JSON array { "suggestions": [{"location": "string", "description": "string"}] }. Don't format as markdown.

  Make the options as different as possible from each other.
  Also make the plan very short and summarized.
  `,
});
export const travelAgent = new Agent({
  id: 'travelAgent',
  name: 'travelAgent',
  model: openai('gpt-4o'),
  instructions: `
  You are a travel agent who is given a user prompt about what kind of holiday they want to go on. A summary of the plan is provided as well as the location.
  You then generate a detailed travel plan for the holiday.
  `,
});

const generateSuggestionsStep = createStep({
  id: 'generate-suggestions',
  inputSchema: z.object({
    vacationDescription: z.string().describe('The description of the vacation'),
  }),
  outputSchema: z.object({
    suggestions: z.array(
      z.object({
        location: z.string(),
        description: z.string(),
      }),
    ),
  }),
  execute: async ({ inputData, mastra }) => {
    const { vacationDescription } = inputData;
    const result = await mastra.getAgent('summaryAgent').generate(
      [
        {
          role: 'user',
          content: `Generate 3 suggestions for: ${vacationDescription}`,
        },
      ],
      {
        structuredOutput: {
          schema: z.object({
            suggestions: z.array(
              z.object({
                location: z.string(),
                description: z.string(),
              }),
            ),
          }),
        },
      },
    );
    return { suggestions: result.object?.suggestions || [] };
  },
});

const humanInputStep = createStep({
  id: 'human-input',
  inputSchema: z.object({
    suggestions: z.array(
      z.object({
        location: z.string(),
        description: z.string(),
      }),
    ),
  }),
  outputSchema: z.object({
    selection: z.string().describe('The selection of the user'),
  }),
  resumeSchema: z.object({
    selection: z.string().describe('The selection of the user'),
  }),
  suspendSchema: z.object({
    suggestions: z.array(
      z.object({
        location: z.string(),
        description: z.string(),
      }),
    ),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!resumeData?.selection) {
      return await suspend({ suggestions: inputData?.suggestions });
    }

    return {
      selection: resumeData?.selection,
    };
  },
});

const travelPlannerStep = createStep({
  id: 'travel-planner',
  inputSchema: z.object({
    selection: z.string().describe('The selection of the user'),
  }),
  outputSchema: z.object({
    travelPlan: z.string(),
  }),
  execute: async ({ inputData, mastra, getInitData }) => {
    const { vacationDescription } = getInitData();

    const travelAgent = mastra.getAgent('travelAgent');

    const { selection } = inputData;
    const result = await travelAgent.generate([
      { role: 'assistant', content: vacationDescription },
      { role: 'user', content: selection || '' },
    ]);
    return { travelPlan: result.text };
  },
});

const travelAgentWorkflow = createWorkflow({
  id: 'travel-agent-workflow-step4-suspend-resume',
  inputSchema: z.object({
    vacationDescription: z.string().describe('The description of the vacation'),
  }),
  outputSchema: z.object({
    travelPlan: z.string(),
  }),
})
  .then(generateSuggestionsStep)
  .then(humanInputStep)
  .then(travelPlannerStep);

travelAgentWorkflow.commit();

export const toolCallAppropriatenessScorer = createToolCallAccuracyScorerCode({
  expectedTool: 'weatherTool',
  strictMode: false,
});

export const completenessScorer = createCompletenessScorer();

// Custom LLM-judged scorer: evaluates if non-English locations are translated appropriately
export const translationScorer = createScorer({
  id: 'translation-quality-scorer',
  name: 'Translation Quality',
  description: 'Checks that non-English location names are translated and used correctly',
  type: 'agent',
  judge: {
    model: 'openai/gpt-4o-mini',
    instructions:
      'You are an expert evaluator of translation quality for geographic locations. ' +
      'Determine whether the user text mentions a non-English location and whether the assistant correctly uses an English translation of that location. ' +
      'Be lenient with transliteration differences and diacritics. ' +
      'Return only the structured JSON matching the provided schema.',
  },
})
  .preprocess(({ run }) => {
    const userText = getUserMessageFromRunInput(run.input) || '';
    const assistantText = getAssistantMessageFromRunOutput(run.output) || '';
    return { userText, assistantText };
  })
  .analyze({
    description: 'Extract location names and detect language/translation adequacy',
    outputSchema: z.object({
      nonEnglish: z.boolean(),
      translated: z.boolean(),
      confidence: z.number().min(0).max(1).default(1),
      explanation: z.string().default(''),
    }),
    createPrompt: ({ results }) => `
            You are evaluating if a weather assistant correctly handled translation of a non-English location.
            User text:
            """
            ${results.preprocessStepResult.userText}
            """
            Assistant response:
            """
            ${results.preprocessStepResult.assistantText}
            """
            Tasks:
            1) Identify if the user mentioned a location that appears non-English.
            2) If non-English, check whether the assistant used a correct English translation of that location in its response.
            3) Be lenient with transliteration differences (e.g., accents/diacritics).
            Return JSON with fields:
            {
            "nonEnglish": boolean,
            "translated": boolean,
            "confidence": number, // 0-1
            "explanation": string
            }
        `,
  })
  .generateScore(({ results }) => {
    const r = (results as any)?.analyzeStepResult || {};
    if (!r.nonEnglish) return 1; // If not applicable, full credit
    if (r.translated) return Math.max(0, Math.min(1, 0.7 + 0.3 * (r.confidence ?? 1)));
    return 0; // Non-English but not translated
  })
  .generateReason(({ results, score }) => {
    const r = (results as any)?.analyzeStepResult || {};
    return `Translation scoring: nonEnglish=${r.nonEnglish ?? false}, translated=${r.translated ?? false}, confidence=${r.confidence ?? 0}. Score=${score}. ${r.explanation ?? ''}`;
  });

const weatherWorkflow = createWorkflow({
  steps: [fetchWeather, planActivities],
  id: 'weather-workflow-step1-single-day',
  inputSchema: z.object({
    city: z.string().describe('The city to get the weather for'),
  }),
  outputSchema: z.object({
    activities: z.string(),
  }),
})
  .then(fetchWeather)
  .then(planActivities);

weatherWorkflow.commit();

export const weatherAgent = new Agent({
  id: 'weatherAgent',
  name: 'Weather Agent',
  instructions: `
      You are a helpful weather assistant that provides accurate weather information.

      Your primary function is to help users get weather details for specific locations. When responding:
      - Always ask for a location if none is provided
      - If the location name isn’t in English, please translate it
      - If giving a location with multiple parts (e.g. "New York, NY"), use the most relevant part (e.g. "New York")
      - Include relevant details like humidity, wind conditions, and precipitation
      - Keep responses concise but informative

      Use the weatherTool to fetch current weather data.
`,
  model: openai('gpt-4o'),
  tools: {
    weatherTool,
  },
  memory: new Memory({
    storage,
    options: {
      lastMessages: 10,
    },
  }),
  scorers: {
    toolCallAppropriateness: {
      scorer: toolCallAppropriatenessScorer,
      sampling: {
        type: 'ratio',
        rate: 1,
      },
    },
    completeness: {
      scorer: completenessScorer,
      sampling: {
        type: 'ratio',
        rate: 1,
      },
    },
    translation: {
      scorer: translationScorer,
      sampling: {
        type: 'ratio',
        rate: 1,
      },
    },
  },
});

const mastra = new Mastra({
  agents: {
    newAgent,
    weatherAgent,
    planningAgent,
    summaryAgent,
    travelAgent,
  },
  workflows: {
    weatherWorkflow,
    travelAgentWorkflow,
  },
  tools: {
    weatherTool,
  },
  storage,
  observability: new Observability({
    default: {
      enabled: true,
    },
  }),
});

const app = express();
app.use(express.json());
app.use(cors());

const expressServerAdapter = new MastraServer({ mastra, app, openapiPath: '/openapi.json' });
await expressServerAdapter.init();

// Add Swagger UI
app.use('/swagger-ui', swaggerUi.serve, swaggerUi.setup(undefined, { swaggerUrl: '/openapi.json' }));

app.listen(3001, () => {
  console.info('Server is running on port 3001');
  console.info('OpenAPI spec: http://localhost:3001/openapi.json');
  console.info('Swagger UI: http://localhost:3001/swagger-ui');
});
