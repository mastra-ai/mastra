import { init } from '@mastra/inngest';
import { z } from 'zod';
import { inngest } from './inngest-workflow';

const { createWorkflow, createStep } = init(inngest);

function getWeatherCondition(code: number): string {
  const conditions: Record<number, string> = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Foggy',
    51: 'Light drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
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
  location: z.string(),
});

const fetchWeatherA = createStep({
  id: 'fetch-weather-a',
  inputSchema: z.object({ cityA: z.string(), cityB: z.string() }),
  outputSchema: forecastSchema,
  execute: async ({ inputData }) => {
    const city = inputData.cityA;
    const geocodingUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`;
    const geocodingResponse = await fetch(geocodingUrl);

    if (!geocodingResponse.ok) {
      const errorBody = await geocodingResponse.text();
      throw new Error(`Geocoding API error (${geocodingResponse.status}): ${errorBody} - URL: ${geocodingUrl}`);
    }

    const geocodingData = (await geocodingResponse.json()) as {
      results: { latitude: number; longitude: number; name: string }[];
    };

    if (!geocodingData.results?.[0]) {
      throw new Error(`Location '${city}' not found`);
    }

    const { latitude, longitude, name } = geocodingData.results[0];

    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=precipitation,weathercode&timezone=auto,&hourly=precipitation_probability,temperature_2m`;
    const response = await fetch(weatherUrl);

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Weather API error (${response.status}): ${errorBody} - URL: ${weatherUrl}`);
    }

    const data = (await response.json()) as {
      current: { weathercode: number };
      hourly: { precipitation_probability: number[]; temperature_2m: number[] };
    };

    return {
      date: new Date().toISOString(),
      maxTemp: Math.max(...data.hourly.temperature_2m),
      minTemp: Math.min(...data.hourly.temperature_2m),
      condition: getWeatherCondition(data.current.weathercode),
      location: name,
      precipitationChance: Math.max(...data.hourly.precipitation_probability),
    };
  },
});

const fetchWeatherB = createStep({
  id: 'fetch-weather-b',
  inputSchema: z.object({ cityA: z.string(), cityB: z.string() }),
  outputSchema: forecastSchema,
  execute: async ({ inputData }) => {
    const city = inputData.cityB;
    const geocodingUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`;
    const geocodingResponse = await fetch(geocodingUrl);

    if (!geocodingResponse.ok) {
      const errorBody = await geocodingResponse.text();
      throw new Error(`Geocoding API error (${geocodingResponse.status}): ${errorBody} - URL: ${geocodingUrl}`);
    }

    const geocodingData = (await geocodingResponse.json()) as {
      results: { latitude: number; longitude: number; name: string }[];
    };

    if (!geocodingData.results?.[0]) {
      throw new Error(`Location '${city}' not found`);
    }

    const { latitude, longitude, name } = geocodingData.results[0];

    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=precipitation,weathercode&timezone=auto,&hourly=precipitation_probability,temperature_2m`;
    const response = await fetch(weatherUrl);

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Weather API error (${response.status}): ${errorBody} - URL: ${weatherUrl}`);
    }

    const data = (await response.json()) as {
      current: { weathercode: number };
      hourly: { precipitation_probability: number[]; temperature_2m: number[] };
    };

    return {
      date: new Date().toISOString(),
      maxTemp: Math.max(...data.hourly.temperature_2m),
      minTemp: Math.min(...data.hourly.temperature_2m),
      condition: getWeatherCondition(data.current.weathercode),
      location: name,
      precipitationChance: Math.max(...data.hourly.precipitation_probability),
    };
  },
});

const planActivitiesA = createStep({
  id: 'plan-activities-a',
  inputSchema: forecastSchema,
  outputSchema: z.object({ activities: z.string(), location: z.string() }),
  execute: async ({ inputData, mastra }) => {
    const agent = mastra?.getAgent('planningAgent');
    if (!agent) throw new Error('Planning agent not found');

    const response = await agent.stream([
      {
        role: 'user',
        content: `Based on the following weather forecast for ${inputData.location}, suggest appropriate activities:\n${JSON.stringify(inputData, null, 2)}`,
      },
    ]);

    let activitiesText = '';
    for await (const chunk of response.textStream) {
      process.stdout.write(chunk);
      activitiesText += chunk;
    }

    return { activities: activitiesText, location: inputData.location };
  },
});

const planActivitiesB = createStep({
  id: 'plan-activities-b',
  inputSchema: forecastSchema,
  outputSchema: z.object({ activities: z.string(), location: z.string() }),
  execute: async ({ inputData, mastra }) => {
    const agent = mastra?.getAgent('planningAgent');
    if (!agent) throw new Error('Planning agent not found');

    const response = await agent.stream([
      {
        role: 'user',
        content: `Based on the following weather forecast for ${inputData.location}, suggest appropriate activities:\n${JSON.stringify(inputData, null, 2)}`,
      },
    ]);

    let activitiesText = '';
    for await (const chunk of response.textStream) {
      process.stdout.write(chunk);
      activitiesText += chunk;
    }

    return { activities: activitiesText, location: inputData.location };
  },
});

const inputSchema = z.object({ cityA: z.string(), cityB: z.string() });

// Nested workflow A: fetches weather and plans activities for cityA
const cityPlanWorkflowA = createWorkflow({
  id: 'city-plan-workflow-a',
  inputSchema,
  outputSchema: z.object({ activities: z.string(), location: z.string() }),
})
  .then(fetchWeatherA)
  .then(planActivitiesA);

cityPlanWorkflowA.commit();

// Nested workflow B: fetches weather and plans activities for cityB
const cityPlanWorkflowB = createWorkflow({
  id: 'city-plan-workflow-b',
  inputSchema,
  outputSchema: z.object({ activities: z.string(), location: z.string() }),
})
  .then(fetchWeatherB)
  .then(planActivitiesB);

cityPlanWorkflowB.commit();

const compareTrips = createStep({
  id: 'compare-trips',
  inputSchema: z.object({
    'city-plan-workflow-a': z.object({ activities: z.string(), location: z.string() }),
    'city-plan-workflow-b': z.object({ activities: z.string(), location: z.string() }),
  }),
  outputSchema: z.object({ comparison: z.string() }),
  execute: async ({ inputData, mastra }) => {
    const agent = mastra?.getAgent('tripComparisonAgent');
    if (!agent) throw new Error('Trip comparison agent not found');

    const planA = inputData['city-plan-workflow-a'];
    const planB = inputData['city-plan-workflow-b'];

    const response = await agent.stream([
      {
        role: 'user',
        content: `Compare these two city trip plans and recommend which is better:

## ${planA.location}
${planA.activities}

## ${planB.location}
${planB.activities}`,
      },
    ]);

    let comparisonText = '';
    for await (const chunk of response.textStream) {
      process.stdout.write(chunk);
      comparisonText += chunk;
    }

    return { comparison: comparisonText };
  },
});

// Main workflow: runs both city plans in parallel, then compares them
const parallelCityComparisonWorkflow = createWorkflow({
  id: 'parallel-city-comparison-workflow',
  inputSchema,
  outputSchema: z.object({ comparison: z.string() }),
})
  .parallel([cityPlanWorkflowA, cityPlanWorkflowB])
  .then(compareTrips)
  .commit();

export { parallelCityComparisonWorkflow };
