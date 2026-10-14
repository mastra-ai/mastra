import { RequestContext } from '@mastra/core/di';
import { z } from 'zod';

function parseWithSchema(schema, value) {
  if (!schema) {
    return value;
  }
  if (typeof schema.parseAsync === 'function') {
    return schema.parseAsync(value);
  }
  if (typeof schema.parse === 'function') {
    return schema.parse(value);
  }
  return value;
}
function resumeLabelsFor(stepId, suspendOptions) {
  const labels = suspendOptions?.resumeLabel;
  if (!labels) {
    return undefined;
  }
  return Object.fromEntries((Array.isArray(labels) ? labels : [labels]).map(label => [label, {
    stepId
  }]));
}
function withRequestContext(params, args) {
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
    suspend: async (suspendPayload, suspendOptions) => {
      const parsedSuspendPayload = await parseWithSchema(args.suspendSchema, suspendPayload);
      suspended = {
        __temporalSuspension: true,
        suspendPayload: parsedSuspendPayload,
        resumeLabels: resumeLabelsFor(args.id, suspendOptions)
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
      ...withRequestContext(params, args),
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