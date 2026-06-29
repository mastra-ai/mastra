import { Agent } from '@mastra/core/agent';
import { createWorkflow, mapVariable } from '@mastra/core/workflows';
import { z } from 'zod';
import { weatherTool } from '../tools/weather-tool';

const weatherReportSchema = z.object({
  headline: z.string().describe('A short, friendly headline summarizing the weather.'),
  body: z.string().describe('A 2-3 sentence narrative description of current conditions.'),
  recommendation: z.string().describe('A practical recommendation (clothing, activities) for the conditions.'),
});

export const weatherReporterAgent = new Agent({
  id: 'weather-reporter',
  name: 'Weather Reporter',
  description: 'Turns raw weather data into a friendly structured report.',
  instructions:
    'You are a friendly local weather reporter. Given current weather data in the user prompt, ' +
    'produce a short headline, a 2-3 sentence narrative body describing the conditions, and a ' +
    'practical recommendation for the listener.',
  model: 'openai/gpt-5.4-mini',
});

export const weatherReportWorkflow = createWorkflow({
  id: 'weather-report-workflow',
  description: 'Fetches weather for a location, generates a structured report, and flattens it for output.',
  inputSchema: z.object({
    location: z.string().describe('City name to fetch weather for.'),
  }),
  outputSchema: z.object({
    report: z.string(),
  }),
})
  .tool(weatherTool)
  .map(async ({ inputData }) => ({
    prompt:
      `Current weather for ${inputData.location}: ` +
      `${inputData.conditions}, ${inputData.temperature}°C (feels like ${inputData.feelsLike}°C), ` +
      `humidity ${inputData.humidity}%, wind ${inputData.windSpeed} km/h (gusts ${inputData.windGust} km/h). ` +
      `Write a structured weather report.`,
  }))
  .agent(weatherReporterAgent, {
    structuredOutput: { schema: weatherReportSchema },
  })
  .map({
    report: mapVariable({
      step: weatherReporterAgent,
      path: 'headline',
    }),
  })
  .commit();
