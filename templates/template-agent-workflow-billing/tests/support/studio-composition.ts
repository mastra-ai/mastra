import { Hono } from 'hono';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { realpath } from 'node:fs/promises';
import { RequestContext } from '@mastra/core/request-context';
import { registerApiRoute } from '@mastra/core/server';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { SEND_AGENT_MESSAGE_ROUTE, SEND_TOOL_APPROVAL_ROUTE } from '@mastra/server/handlers/agents';
import { EXECUTE_TOOL_ROUTE } from '@mastra/server/handlers/tools';
import { z } from 'zod';
import { createBilling } from '../../src/billing/integration.js';
import { localDemoAccounts } from '../../src/billing/local-accounts.js';
import { createBillingApp } from '../../src/billing/server/routes.js';
import { createStudioBillingWrapper } from '../../src/studio-with-billing/index.js';
import { createStudioAssistantAgent } from '../../src/mastra/agents/studio-assistant.js';
import { billingSocket } from './http.js';

/** Real generic application using the native public handler, schema transforms and a custom API prefix. */
export async function studioComposition(root: string, modelUrl: string) {
  const environment = {
    BILLING_MODE: 'local',
    BILLING_PROVIDER: 'local',
    BILLING_STUDIO_ENABLED: 'true',
    BILLING_PROJECT_ROOT: await realpath(root),
    OPENAI_BASE_URL: modelUrl,
    OPENAI_API_KEY: 'controlled',
  };
  const billing = createBilling({
    environment,
    billingKeys: { meters: [{ key: 'credits', unit: 'credits', funding: ['prepaid'] }] },
    localAccounts: () => localDemoAccounts(environment, 30),
  });
  const model = { id: 'billing-test/model' as const, api: 'chat' as const, apiKey: 'controlled', url: modelUrl };
  const publicAgent = new Agent({ id: 'public', name: 'Public', instructions: 'Answer.', model, maxRetries: 0 });
  const business = new Agent({
    id: 'analysis',
    name: 'Analysis',
    instructions: 'Answer concisely.',
    model,
    maxRetries: 0,
  });
  const input = z.strictObject({ value: z.string().transform(value => `[input]${value}`) });
  const data = z.strictObject({ value: z.string() });
  const review = createStep({
    id: 'review',
    inputSchema: data,
    outputSchema: data,
    suspendSchema: data,
    resumeSchema: z.strictObject({ suffix: z.string().transform(value => `[resume]${value}`) }),
    execute: async ({ inputData, resumeData, suspend }) =>
      resumeData ? { value: inputData.value + resumeData.suffix } : suspend(inputData),
  });
  const workflow = createWorkflow({
    id: 'report',
    inputSchema: input,
    outputSchema: data,
    steps: [review],
    options: { autoRestartActiveRuns: false },
  })
    .then(review)
    .commit();
  const echo = createStep({
    id: 'echo',
    inputSchema: data,
    outputSchema: data,
    execute: async ({ inputData }) => inputData,
  });
  const publicFlow = createWorkflow({
    id: 'public-flow',
    inputSchema: data,
    outputSchema: data,
    steps: [echo],
    options: { autoRestartActiveRuns: false },
  })
    .then(echo)
    .commit();
  const integration = await billing.prepare({
    agents: {
      analysis: billing.agent(business, {
        policy: { version: 'v1', charge: { type: 'credits', meter: 'credits', units: 1 } },
        adapter: { version: 'v1', promptSchema: z.string().transform(value => `[prompt]${value}`) },
      }),
      'prepared-paid-alias': business,
      public: publicAgent,
      'prepared-public-alias': publicAgent,
    },
    workflows: {
      report: billing.workflow(workflow, {
        policy: { version: 'v1', charge: { type: 'credits', meter: 'credits', units: 3 } },
      }),
      'prepared-report-alias': workflow,
      'public-flow': publicFlow,
      'public-flow-alias': publicFlow,
    },
  });
  const wrapper = createStudioBillingWrapper({ integration });
  const original = createStudioAssistantAgent(
    { analyze: wrapper.agentTool('analysis'), ...wrapper.workflowTools('report', { approvalSteps: ['review'] }) },
    environment,
  );
  const conversation = wrapper.decorateAgent(original);
  const settings = integration.server(
    {
      apiPrefix: '/private-api',
      middleware: [
        {
          path: '*',
          handler: async (context, next) => {
            const count = Number(context.get('calls') ?? 0) + 1;
            context.set('calls', count);
            context.header('X-Application-Calls', String(count));
            await next();
          },
        },
      ],
      apiRoutes: [
        registerApiRoute('/status', { method: 'GET', handler: context => context.json({ ready: true }) }),
        registerApiRoute('/sdk/:threadId', {
          method: 'GET',
          handler: context => context.json({ threadId: context.req.param('threadId') }),
        }),
      ],
    },
    { studioWrapper: wrapper },
  );
  const mastra = new Mastra({
    agents: {
      ...integration.agents,
      ...wrapper.agents,
      public: publicAgent,
      'public-alias': publicAgent,
      'paid-alias': business,
      'chat-alias': conversation,
    },
    workflows: integration.workflows,
    tools: integration.tools,
    storage: integration.storage,
    logger: false,
    server: settings,
  });
  await integration.attach(mastra);
  const app = new Hono();
  for (const middleware of Array.isArray(settings.middleware) ? settings.middleware : [settings.middleware!])
    app.use('*', typeof middleware === 'function' ? middleware : middleware.handler);
  app.get('/status', context => context.json({ ready: true }));
  app.post('/private-api/agents/:agentId/send-message', async context =>
    context.json(
      await SEND_AGENT_MESSAGE_ROUTE.handler({
        ...(await context.req.json()),
        mastra,
        agentId: context.req.param('agentId'),
        requestContext: Object.assign(new RequestContext(), {} as Record<string, unknown>),
      }),
    ),
  );
  app.post('/private-api/agents/:agentId/send-tool-approval', async context =>
    context.json(
      await SEND_TOOL_APPROVAL_ROUTE.handler({
        ...(await context.req.json()),
        mastra,
        agentId: context.req.param('agentId'),
        abortSignal: context.req.raw.signal,
        requestContext: Object.assign(new RequestContext(), {} as Record<string, unknown>),
      }),
    ),
  );
  app.get('/private-api/memory/threads/:threadId/messages', async context =>
    context.json(
      await (await conversation.getMemory())!.recall({ threadId: context.req.param('threadId'), perPage: 40 }),
    ),
  );
  app.post('/private-api/tools/:toolId/execute', async context =>
    context.json(
      await EXECUTE_TOOL_ROUTE.handler({
        mastra,
        toolId: context.req.param('toolId'),
        abortSignal: context.req.raw.signal,
        data: (await context.req.json()).data,
        requestContext: Object.assign(new RequestContext(), {} as Record<string, unknown>),
      }),
    ),
  );
  app.post('/private-api/agents/:agentId/generate', async context => {
    const agent = mastra.getAgent(context.req.param('agentId') as keyof ReturnType<typeof mastra.listAgents>);
    return context.json(await agent.generate((await context.req.json()).messages));
  });
  app.post('/private-api/workflows/:workflowId/start', async context => {
    const workflow = mastra.getWorkflow(context.req.param('workflowId') as keyof typeof integration.workflows);
    const run = await workflow.createRun();
    return context.json(await run.start({ inputData: (await context.req.json()).inputData }));
  });
  app.get('/sdk/:threadId', async context => {
    const threadId = context.req.param('threadId');
    const selected = await integration.organizations.context({
      credential: context.req.header('authorization')!.slice(7),
    });
    const owner = await integration.conversations.thread(selected, conversation.id, threadId);
    const output = await conversation.generate<z.ZodType<{ answer: string }>, { answer: string }>(
      'Return a JSON answer.',
      {
        memory: { thread: threadId, resource: owner.resourceId },
        structuredOutput: { schema: z.strictObject({ answer: z.string() }) },
      },
    );
    const stream = await conversation.stream('Return text.', {
      memory: { thread: threadId, resource: owner.resourceId },
    });
    const streamed = await stream.getFullOutput();
    return context.json({
      answer: output.object?.answer,
      text: streamed.text,
      finishReason: streamed.finishReason,
      hasUsage: typeof streamed.usage === 'object',
    });
  });
  app.route(
    '/',
    createBillingApp({
      organizations: integration.organizations,
      execution: integration.execution,
      commercial: integration.runtime.commercial,
    }),
  );
  const socket = await billingSocket(app);
  return {
    ...socket,
    integration,
    wrapper,
    original,
    conversation,
    mastra,
    close: async () => {
      await socket.close();
      await integration.close();
    },
  };
}
