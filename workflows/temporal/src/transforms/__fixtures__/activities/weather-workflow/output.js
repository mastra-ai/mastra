import { RequestContext } from '@mastra/core/di';
import { z } from 'zod';

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
    suspend: async (suspendPayload, options) => {
      const parsedSuspendPayload = await parseWithSchema(args.suspendSchema, suspendPayload, 'Suspend payload');
      suspended = {
        __temporalSuspension: true,
        suspendPayload: parsedSuspendPayload,
        ...(options?.resumeLabel !== undefined && {
          resumeLabel: options.resumeLabel
        })
      };
    },
    __getTemporalSuspension: () => suspended
  };
}
async function parseWithSchema(schema, value, label) {
  if (!schema) return value;
  if (schema['~standard']?.validate) {
    const result = await schema['~standard'].validate(value);
    if ('issues' in result && result.issues?.length) {
      throw new Error(label + ' validation failed: ' + result.issues.map(issue => issue.message).join(', '));
    }
    return result.value;
  }
  if (typeof schema.parseAsync === 'function') return schema.parseAsync(value);
  if (typeof schema.parse === 'function') return schema.parse(value);
  return value;
}
async function executeTemporalStep(args, context) {
  const result = await args.execute(context);
  return context.__getTemporalSuspension() ?? result;
}
function createStep(args) {
  return {
    inputSchema: args.inputSchema,
    requestContextSchema: args.requestContextSchema,
    suspendSchema: args.suspendSchema,
    resumeSchema: args.resumeSchema,
    execute: async params => {
      return executeTemporalStep(args, {
        ...withRequestContext(params, args),
        mastra
      });
    }
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