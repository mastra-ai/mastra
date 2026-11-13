import { LibSQLStore } from '@mastra/libsql';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { registerApiRoute } from '@mastra/core/server';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { createBilling } from '../../../src/billing/integration.js';

const options = JSON.parse(process.env.BILLING_TEST_CONFIGURATION!);
const billing = createBilling({
  environment: {
    BILLING_PROVIDER: 'local',
    BILLING_MODE: 'local',
    BILLING_DATABASE_URL: options.databaseUrl,
    BILLING_PROJECT_ROOT: options.directory,
  },
  storage: new LibSQLStore({
    id: 'application-owned',
    url: pathToFileURL(join(options.directory, 'custom-workflows.db')).href,
  }),
  billingKeys: { meters: [{ key: 'credits', unit: 'credits', funding: ['prepaid'] }] },
  localAccounts: [{ workspaceId: options.workspaceId, meters: [{ key: 'credits', funding: 'prepaid', balance: 10 }] }],
});
const agent = (id: string) =>
  new Agent({
    id,
    name: id,
    instructions: 'Return a short answer.',
    model: { id: 'billing-test/model', url: options.modelUrl, apiKey: 'controlled', api: 'chat' },
    maxRetries: 0,
  });
const schema = z.strictObject({ text: z.string() });
const workflow = (id: string) => {
  const step = createStep({
    id: 'echo',
    inputSchema: schema,
    outputSchema: schema,
    execute: async ({ inputData }) => inputData,
  });
  return createWorkflow({
    id,
    inputSchema: schema,
    outputSchema: schema,
    steps: [step],
    options: { autoRestartActiveRuns: false },
  })
    .then(step)
    .commit();
};
const integration = await billing.prepare({
  agents: {
    paid: billing.agent(agent('paid'), {
      policy: { version: 'v1', charge: { type: 'credits', meter: 'credits', units: 1 } },
    }),
  },
  workflows: {
    'paid-flow': billing.workflow(workflow('paid-flow'), {
      policy: { version: 'v1', charge: { type: 'credits', meter: 'credits', units: 3 } },
    }),
  },
});
export const mastra = new Mastra({
  agents: { ...integration.agents, public: agent('public'), 'paid-alias': integration.agents.paid },
  workflows: { ...integration.workflows, 'public-flow': workflow('public-flow') },
  storage: integration.storage,
  logger: false,
  server: integration.server({
    host: '127.0.0.1',
    port: Number(process.env.BILLING_PORT),
    middleware: [
      {
        path: '*',
        handler: async (context, next) => {
          context.header('X-Application', 'custom');
          const calls = Number(context.get('applicationMiddlewareCalls') ?? 0) + 1;
          context.set('applicationMiddlewareCalls', calls);
          context.header('X-Middleware-Calls', String(calls));
          await next();
        },
      },
    ],
    apiRoutes: [
      registerApiRoute('/status/:name', {
        method: 'GET',
        requiresAuth: true,
        handler: context => context.json({ name: context.req.param('name') }),
      }),
    ],
  }),
});
await integration.attach(mastra);
