import { openai } from '@ai-sdk/openai';
import { serve } from '@hono/node-server';
import { swaggerUI } from '@hono/swagger-ui';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { MastraServer } from '../src/index';

const storage = new LibSQLStore({
  id: 'hono-storage',
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
    // eslint-disable-next-line no-console
    console.log('tool context', inputData);
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
  storage,
});

const app = new Hono();
app.use('*', cors());

const srv = new MastraServer({ mastra, openapiPath: '/openapi.json', app });
await srv.init();

// Add Swagger UI
app.use('/swagger-ui/*', swaggerUI({ url: '/openapi.json' }));

serve(
  {
    fetch: app.fetch,
    port: 3001,
  },
  () => {
    // eslint-disable-next-line no-console
    console.log('Server is running on port 3001');
    // eslint-disable-next-line no-console
    console.log('OpenAPI spec: http://localhost:3001/openapi.json');
    // eslint-disable-next-line no-console
    console.log('Swagger UI: http://localhost:3001/swagger-ui');
  },
);
