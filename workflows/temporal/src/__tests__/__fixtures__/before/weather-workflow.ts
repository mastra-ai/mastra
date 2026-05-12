import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

const fetchWeather = createStep({
  id: 'fetch-weather',
  inputSchema: z.object({
    city: z.string(),
  }),
  outputSchema: z.object({
    city: z.string(),
  }),
  execute: async ({ inputData }) => inputData,
});

const planActivities = createStep({
  id: 'plan-activities',
  inputSchema: z.object({
    city: z.string(),
  }),
  outputSchema: z.object({
    city: z.string(),
  }),
  execute: async ({ inputData }) => inputData,
});

export const weatherWorkflow = createWorkflow({
  id: 'weather-workflow',
  inputSchema: z.object({
    city: z.string(),
  }),
  outputSchema: z.object({
    city: z.string(),
  }),
})
  .then(fetchWeather)
  .then(planActivities)
  .sleep(3000)
  .then(planActivities);
