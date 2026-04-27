import { z } from 'zod';
function createStep(args) {
  return async params => {
    const { mastra } = await import('../index');
    return args.execute({
      ...params,
      mastra,
    });
  };
}
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
