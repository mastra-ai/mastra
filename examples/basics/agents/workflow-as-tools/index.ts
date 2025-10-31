import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { openai } from '@ai-sdk/openai';

const forecastSchema = z.object({
  date: z.string(),
  maxTemp: z.number(),
  minTemp: z.number(),
  precipitationChance: z.number(),
  condition: z.string(),
  location: z.string(),
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

const fetchWeatherWithSuspend = createStep({
  id: 'fetch-weather',
  description: 'Fetches weather forecast for a given city',
  inputSchema: z.object({}),
  resumeSchema: z.object({
    city: z.string().describe('The city to get the weather for'),
  }),
  outputSchema: forecastSchema,
  execute: async ({ resumeData, suspend }) => {
    if (!resumeData) {
      suspend({
        message: 'Please enter the city to get the weather for',
      });

      return {};
    }

    const geocodingUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(resumeData.city)}&count=1`;
    const geocodingResponse = await fetch(geocodingUrl);
    const geocodingData = (await geocodingResponse.json()) as {
      results: { latitude: number; longitude: number; name: string }[];
    };

    if (!geocodingData.results?.[0]) {
      throw new Error(`Location '${resumeData.city}' not found`);
    }

    const { latitude, longitude, name } = geocodingData.results[0];

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
      location: resumeData.city,
    };

    return forecast;
  },
});

const weatherWorkflowWithSuspend = createWorkflow({
  id: 'weather-workflow-with-suspend',
  inputSchema: z.object({}),
  outputSchema: forecastSchema,
})
  .then(fetchWeatherWithSuspend)
  .commit();

export const startWeatherTool = createTool({
  id: 'start-weather-tool',
  description: 'Start the weather tool',
  inputSchema: z.object({}),
  outputSchema: z.object({
    runId: z.string(),
  }),
  execute: async ({ context }) => {
    const workflow = mastra.getWorkflow('weatherWorkflowWithSuspend');
    const run = await workflow.createRunAsync();
    await run.start({
      inputData: {},
    });

    return {
      runId: run.runId,
    };
  },
});

export const resumeWeatherTool = createTool({
  id: 'resume-weather-tool',
  description: 'Resume the weather tool',
  inputSchema: z.object({
    runId: z.string(),
    city: z.string().describe('City name'),
  }),
  outputSchema: forecastSchema,
  execute: async ({ context }) => {
    const workflow = mastra.getWorkflow('weatherWorkflowWithSuspend');
    const run = await workflow.createRunAsync({
      runId: context.runId,
    });
    const result = await run.resume({
      step: 'fetch-weather',
      resumeData: {
        city: context.city,
      },
    });
    return result.result;
  },
});

export const weatherAgentWithWorkflow = new Agent({
  name: 'Weather Agent with Workflow',
  instructions: `You are a helpful weather assistant that provides accurate weather information.

Your primary function is to help users get weather details for specific locations. When responding:
- Always ask for a location if none is provided
- If the location name isn’t in English, please translate it
- If giving a location with multiple parts (e.g. "New York, NY"), use the most relevant part (e.g. "New York")
- Include relevant details like humidity, wind conditions, and precipitation
- Keep responses concise but informative

Use the startWeatherTool to start the weather workflow. This will start and then suspend the workflow and return a runId.
Use the resumeWeatherTool to resume the weather workflow. This takes the runId returned from the startWeatherTool and the city entered by the user. It will resume the workflow and return the result.
The result will be the weather forecast for the city.`,
  model: openai('gpt-4o'),
  tools: { startWeatherTool, resumeWeatherTool },
});

const mastra = new Mastra({
  agents: { weatherAgentWithWorkflow },
  workflows: { weatherWorkflowWithSuspend },
});

async function main() {
  const agent = mastra.getAgent('weatherAgentWithWorkflow');
  const result = await agent.generate([
    {
      role: 'user',
      content: 'London',
    },
  ]);

  console.log('\n \n');
  console.log(result);
}

main();
