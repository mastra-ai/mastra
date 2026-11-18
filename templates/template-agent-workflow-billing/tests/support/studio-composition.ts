import { Hono } from 'hono';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { Memory } from '@mastra/memory';
import { realpath } from 'node:fs/promises';
import { RequestContext } from '@mastra/core/request-context';
import { registerApiRoute } from '@mastra/core/server';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import {
  GET_PROVIDERS_ROUTE,
  GENERATE_AGENT_ROUTE,
  STREAM_GENERATE_ROUTE,
  SEND_AGENT_MESSAGE_ROUTE,
  SEND_AGENT_SIGNAL_ROUTE,
  QUEUE_AGENT_MESSAGE_ROUTE,
  QUEUE_AGENT_SIGNAL_ROUTE,
  SEND_TOOL_APPROVAL_ROUTE,
  SUBSCRIBE_AGENT_THREAD_ROUTE,
  OBSERVE_AGENT_STREAM_ROUTE,
  LIST_SUSPENDED_RUNS_ROUTE,
  ABORT_AGENT_THREAD_ROUTE,
  ABORT_AGENT_RUN_ROUTE,
  RECOVER_ROUTE,
} from '@mastra/server/handlers/agents';
import {
  GET_THREAD_BY_ID_ROUTE,
  LIST_MESSAGES_ROUTE,
  LIST_THREADS_ROUTE,
  CREATE_THREAD_ROUTE,
} from '@mastra/server/handlers/memory';
import {
  GET_EDITOR_BUILDER_SETTINGS_ROUTE,
  GET_EDITOR_BUILDER_AVAILABLE_MODELS_ROUTE,
} from '@mastra/server/handlers/editor-builder';
import { EXECUTE_TOOL_ROUTE } from '@mastra/server/handlers/tools';
import { z } from 'zod';
import { createBilling } from '../../src/billing/integration.js';
import { localDemoAccounts } from '../../src/billing/providers/local/accounts.js';
import { createBillingApp } from '../../src/billing/server/routes.js';
import { createStudioBillingWrapper } from '../../src/studio-billing/index.js';
import { createImageAssistantAgent } from '../../src/mastra/agents/image-assistant.js';
import { billingSocket } from './http.js';

/** Real generic application using the native public handler, schema transforms and a custom API prefix. */
export async function studioComposition(
  root: string,
  modelUrl: string,
  options: { wrapper?: boolean; studio?: boolean } = {},
) {
  const environment = {
    BILLING_MODE: 'local',
    BILLING_PROVIDER: 'local',
    BILLING_STUDIO_ENABLED: options.studio === false ? 'false' : 'true',
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
  const publicAgent = new Agent({
    id: 'public',
    name: 'Public',
    instructions: 'Answer.',
    model,
    maxRetries: 0,
    memory: new Memory({
      options: { lastMessages: 40, semanticRecall: false, workingMemory: { enabled: false }, generateTitle: false },
    }),
  });
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
  const original = createImageAssistantAgent(
    { analyze: wrapper.agentTool('analysis'), ...wrapper.workflowTools('report', { approvalSteps: ['review'] }) },
    environment,
  );
  const conversation = wrapper.decorateAgent(original);
  wrapper.decorateAgent(
    new Agent({
      id: 'other-chat',
      name: 'Other Chat',
      instructions: 'Answer.',
      model,
      maxRetries: 0,
      memory: new Memory({
        options: { lastMessages: 40, semanticRecall: false, workingMemory: { enabled: false }, generateTitle: false },
      }),
    }),
  );
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
    options.wrapper === false ? {} : { studioWrapper: wrapper },
  );
  const mastra = new Mastra({
    agents: {
      ...integration.agents,
      ...(options.wrapper === false ? {} : wrapper.agents),
      public: publicAgent,
      'public-alias': publicAgent,
      'paid-alias': business,
      ...(options.wrapper === false ? {} : { 'chat-alias': conversation }),
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
  // Use installed native handlers with complete options; shared Memory must exercise the real boundary.
  for (const route of [
    GET_PROVIDERS_ROUTE,
    GET_EDITOR_BUILDER_SETTINGS_ROUTE,
    GET_EDITOR_BUILDER_AVAILABLE_MODELS_ROUTE,
    GENERATE_AGENT_ROUTE,
    STREAM_GENERATE_ROUTE,
    SEND_AGENT_MESSAGE_ROUTE,
    SEND_AGENT_SIGNAL_ROUTE,
    QUEUE_AGENT_MESSAGE_ROUTE,
    QUEUE_AGENT_SIGNAL_ROUTE,
    SEND_TOOL_APPROVAL_ROUTE,
    SUBSCRIBE_AGENT_THREAD_ROUTE,
    OBSERVE_AGENT_STREAM_ROUTE,
    LIST_SUSPENDED_RUNS_ROUTE,
    ABORT_AGENT_THREAD_ROUTE,
    ABORT_AGENT_RUN_ROUTE,
    RECOVER_ROUTE,
    GET_THREAD_BY_ID_ROUTE,
    LIST_MESSAGES_ROUTE,
    LIST_THREADS_ROUTE,
    CREATE_THREAD_ROUTE,
  ]) {
    app.on(route.method, '/private-api' + route.path, async context => {
      const query = Object.fromEntries(new URL(context.req.url).searchParams);
      const requestContext = Object.assign(new RequestContext(), {} as Record<string, unknown>);
      if (query.requestContext) {
        const encoded = query.requestContext;
        const values = JSON.parse(encoded.startsWith('{') ? encoded : Buffer.from(encoded, 'base64').toString('utf8'));
        for (const [key, value] of Object.entries(values)) requestContext.set(key, value);
      }
      for (const [header, key] of [
        ['x-resource-id', 'mastra__resourceId'],
        ['x-thread-id', 'mastra__threadId'],
      ]) {
        const value = context.req.header(header);
        if (value) requestContext.set(key, value);
      }
      const body = route.method === 'POST' ? await context.req.json() : {};
      const handler = route.handler as (parameters: Record<string, unknown>) => Promise<unknown>;
      const result = await handler({
        ...query,
        ...body,
        ...context.req.param(),
        mastra,
        abortSignal: context.req.raw.signal,
        requestContext,
      });
      return result instanceof ReadableStream ? new Response(result) : context.json(result);
    });
  }
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
