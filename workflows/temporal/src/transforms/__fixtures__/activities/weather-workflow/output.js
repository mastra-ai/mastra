import { z } from 'zod';

function createStep(args) {
  return async params => {
    return args.execute({
      ...params,
      mastra,
    });
  };
}
const mastra = {
  marker: 'ok',
};
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

export { fetchWeather, planActivities };
