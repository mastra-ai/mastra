import { RequestContext } from '@mastra/core/di';
import { z } from 'zod';

function withRequestContext(params) {
  return {
    ...params,
    requestContext: new RequestContext(params.requestContext)
  };
}
function createStep(args) {
  return async params => {
    return args.execute({
      ...withRequestContext(params),
      mastra
    });
  };
}
const mastra = {
  marker: 'ok'
};
const fetchWeather = createStep({
  id: 'fetch-weather',
  inputSchema: z.object({
    city: z.string()
  }),
  outputSchema: z.object({
    city: z.string()
  }),
  execute: async ({
    inputData
  }) => inputData
});
function createPlanActivities() {
  return createStep({
    id: 'plan-activities',
    inputSchema: z.object({
      city: z.string()
    }),
    outputSchema: z.object({
      city: z.string()
    }),
    execute: async ({
      inputData
    }) => inputData
  });
}
const planActivities = createPlanActivities();

export { fetchWeather, planActivities };