import { RequestContext } from '@mastra/core/di';
import { z } from 'zod';

function withRequestContext(params) {
  const {
    requestContext,
    initData,
    ...rest
  } = params;
  let suspended;
  return {
    ...rest,
    requestContext: new RequestContext(requestContext),
    getInitData: () => initData,
    suspend: async suspendPayload => {
      suspended = {
        __temporalSuspension: true,
        suspendPayload
      };
    },
    __getTemporalSuspension: () => suspended
  };
}
async function executeTemporalStep(args, context) {
  const result = await args.execute(context);
  return context.__getTemporalSuspension() ?? result;
}
function createStep(args) {
  return async params => {
    return executeTemporalStep(args, {
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