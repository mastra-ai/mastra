import { createServer } from 'node:http';
import type { ServerResponse } from 'node:http';
import { once } from 'node:events';
import { appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { createTool } from '@mastra/core/tools';
import { LibSQLStore } from '@mastra/libsql';
import { z } from 'zod';
import { MastraBilling } from '../../src/billing/mastra.js';
import { agentResource, workflowResource } from '../../src/billing/mastra-resources.js';
import { billingConfigurationSchema } from '../../src/billing/configuration.js';
import type { BillingConfiguration } from '../../src/billing/configuration.js';
import { OrganizationService } from '../../src/billing/organizations.js';
import { OrganizationStorage } from '../../src/billing/storage/organizations.js';
import { AccountingStorage } from '../../src/billing/storage/accounting.js';
import { WorkflowStorage } from '../../src/billing/storage/workflows.js';
import { LocalBillingStorage } from '../../src/billing/storage/libsql.js';
import { LocalBillingProvider } from '../../src/billing/providers/local.js';

export async function modelBoundary() {
  const waiting: ServerResponse[] = [];
  const requests: { body: Record<string, any>; scenario: string }[] = [];
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString());
    const prompt = JSON.stringify(body.messages);
    const scenario =
      /\[(success|zero|missing|multi|mixed|partial-error|model-error|abort|overflow|structured|tool-error|processor-retry)\]/.exec(
        prompt,
      )?.[1] ?? 'success';
    requests.push({ body, scenario });
    const hasToolResult = body.messages.some((message: { role: string }) => message.role === 'tool');
    if (scenario === 'abort') {
      waiting.push(response);
      return;
    }
    if (
      scenario === 'model-error' ||
      (scenario === 'partial-error' && hasToolResult) ||
      (scenario === 'processor-retry' && requests.filter(request => request.scenario === scenario).length === 1)
    ) {
      response.writeHead(400, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: { message: 'Controlled model error', type: 'invalid_request_error' } }));
      return;
    }
    const tool = ['multi', 'mixed', 'partial-error', 'tool-error'].includes(scenario) && !hasToolResult;
    const message = tool
      ? {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'call-echo',
              type: 'function',
              function: { name: 'echo', arguments: JSON.stringify({ fail: scenario === 'tool-error' }) },
            },
          ],
        }
      : { role: 'assistant', content: scenario === 'structured' ? '{"answer":"ok"}' : 'ok' };
    const missing = scenario === 'missing' || (scenario === 'mixed' && hasToolResult);
    const input = scenario === 'zero' ? 0 : scenario === 'overflow' ? 100 : 3;
    const output = scenario === 'zero' ? 0 : 2;
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(
      JSON.stringify({
        id: 'chatcmpl-billing',
        object: 'chat.completion',
        created: 1,
        model: 'billing-test',
        choices: [{ index: 0, message, finish_reason: tool ? 'tool_calls' : 'stop' }],
        ...(missing
          ? {}
          : { usage: { prompt_tokens: input, completion_tokens: output, total_tokens: input + output } }),
      }),
    );
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No model HTTP address');
  return {
    url: `http://127.0.0.1:${address.port}/v1`,
    requests,
    release: () => {
      for (const response of waiting.splice(0)) {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(
          JSON.stringify({
            id: 'released',
            object: 'chat.completion',
            created: 1,
            model: 'billing-test',
            choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
            usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
          }),
        );
      }
    },
    close: async () => {
      const pending = new Promise<void>(resolve => server.close(() => resolve()));
      server.closeAllConnections();
      await pending;
    },
  };
}
export function mastraConfiguration(
  workspaceId: string,
  options: { workflowUsage?: boolean; policyVersion?: string; taskUnits?: number; ttl?: number } = {},
) {
  const measurement = [
    { key: 'tokens', unit: 'tokens', enforceableBound: false },
    { key: 'input-tokens', unit: 'tokens', enforceableBound: false },
    { key: 'output-tokens', unit: 'tokens', enforceableBound: false },
    { key: 'model-calls', unit: 'custom', enforceableBound: true },
  ];
  return billingConfigurationSchema.parse({
    provider: 'local',
    resources: [
      {
        id: 'assistant',
        kind: 'agent',
        operations: ['generate'],
        measurements: measurement,
        policy: {
          version: 'agent-v1',
          charge: { type: 'usage', meter: 'tokens', measure: 'tokens', maxUnits: 20, funding: 'metered' },
        },
      },
      {
        id: 'report',
        kind: 'workflow',
        operations: ['start', 'resume', 'cancel'],
        measurements: measurement,
        policy: {
          version: options.policyVersion ?? 'workflow-v1',
          charge: options.workflowUsage
            ? { type: 'usage', meter: 'tokens', measure: 'tokens', maxUnits: 40, funding: 'metered' }
            : { type: 'per-task', meter: 'tasks', units: options.taskUnits ?? 2, funding: 'prepaid' },
          suspendedReservationTtlMs: options.ttl ?? 86400000,
        },
      },
    ],
    mappings: {
      meters: [
        { key: 'tokens', unit: 'tokens', funding: ['metered', 'prepaid'] },
        { key: 'tasks', unit: 'tasks', funding: ['prepaid'] },
        { key: 'calls', unit: 'custom', funding: ['prepaid'] },
      ],
    },
    localAccounts: [
      {
        workspaceId,
        meters: [
          { key: 'tokens', funding: 'metered', balance: null },
          { key: 'tasks', funding: 'prepaid', balance: 100 },
          { key: 'calls', funding: 'prepaid', balance: 100 },
        ],
      },
    ],
  });
}
export async function runtimeFixture(options: {
  databaseUrl: string;
  directory: string;
  modelUrl: string;
  credential?: string;
  workspaceId?: string;
  configuration?: BillingConfiguration;
  configure?: (configuration: ReturnType<typeof mastraConfiguration>) => BillingConfiguration;
  workflowPrompt?: string;
  workflowAfterPrompt?: string;
  workflowExpectedCalls?: readonly number[];
  workflowTransforms?: boolean;
  processorRetry?: boolean;
  agentMaxSteps?: number;
  structured?: boolean;
}) {
  const directory = await OrganizationStorage.open({ url: options.databaseUrl });
  const organizations = new OrganizationService(directory, { mode: 'local', provider: 'local' });
  const owner = options.credential
    ? null
    : await organizations.provisionLocal({ profileId: 'owner', displayName: 'Owner' });
  const credential = options.credential ?? owner!.credential!;
  const billingContext = await organizations.context({ credential, workspaceId: options.workspaceId });
  const configuration =
    options.configuration ??
    options.configure?.(mastraConfiguration(billingContext.workspaceId)) ??
    mastraConfiguration(billingContext.workspaceId);
  const providerStorage = await LocalBillingStorage.open({ url: options.databaseUrl });
  const provider = new LocalBillingProvider(providerStorage, configuration);
  const accounting = await AccountingStorage.open({ url: options.databaseUrl }, directory);
  const workflowStorage = await WorkflowStorage.open({ url: options.databaseUrl }, directory);
  const agent = new Agent({
    id: 'assistant',
    name: 'Billing assistant',
    ...(options.processorRetry
      ? { errorProcessors: [{ id: 'controlled-recovery', processAPIError: () => ({ retry: true }) }] }
      : {}),
    instructions: 'Return an answer or use the echo tool.',
    model: { id: 'billing-test/model', url: options.modelUrl, apiKey: 'controlled', api: 'chat' },
    tools: {
      echo: createTool({
        id: 'echo',
        description: 'Echo the controlled request.',
        inputSchema: z.object({ fail: z.boolean() }),
        outputSchema: z.object({ echoed: z.boolean() }),
        execute: async input => {
          if (input.fail) throw new Error('Controlled tool failure');
          return { echoed: true };
        },
      }),
    },
  });
  const schema = z.object({ count: z.number().int().min(0).max(100) });
  let billing: MastraBilling<any, any>;
  const before = createStep({
    id: 'before',
    inputSchema: schema,
    outputSchema: schema,
    execute: async ({ inputData }) => {
      await appendFile(join(options.directory, 'workflow-events.jsonl'), JSON.stringify({ step: 'before' }) + '\n');
      await billing.nestedAgent('assistant').generate(options.workflowPrompt ?? '[success] before');
      return { count: inputData.count + 1 };
    },
  });
  const approval = createStep({
    id: 'approval',
    inputSchema: schema,
    outputSchema: schema,
    resumeSchema: z.object({ approved: z.boolean() }),
    suspendSchema: z.object({ reason: z.string() }),
    execute: async ({ inputData, resumeData, suspend }) => {
      if (!resumeData?.approved) return suspend({ reason: 'Approval required' });
      return inputData;
    },
  });
  const after = createStep({
    id: 'after',
    inputSchema: schema,
    outputSchema: schema,
    execute: async ({ inputData }) => {
      await appendFile(join(options.directory, 'workflow-events.jsonl'), JSON.stringify({ step: 'after' }) + '\n');
      await billing.nestedAgent('assistant').generate(options.workflowAfterPrompt ?? '[success] after');
      return { count: inputData.count + 1 };
    },
  });
  const workflow = createWorkflow({
    id: 'report',
    inputSchema: options.workflowTransforms ? schema.transform(value => ({ count: value.count + 1 })) : schema,
    outputSchema: options.workflowTransforms ? schema.transform(value => ({ count: value.count + 10 })) : schema,
    options: { autoRestartActiveRuns: false },
  })
    .then(before)
    .then(approval)
    .then(after)
    .commit();
  const limits = { version: 'agent-adapter-v1', maxSteps: options.agentMaxSteps ?? 2, maxOutputTokens: 20 };
  const agents = {
    assistant: options.structured
      ? agentResource(agent, { ...limits, outputSchema: z.object({ answer: z.string() }) })
      : agentResource(agent, limits),
  };
  const workflows = {
    report: workflowResource(workflow, {
      version: 'workflow-adapter-v1',
      measurement: 'facade-calls',
      expectedCalls: options.workflowExpectedCalls ?? [1, 1],
    }),
  };
  const typedBilling = new MastraBilling({
    organizations,
    accounting,
    workflowStorage,
    provider,
    configuration,
    agents,
    workflows,
  });
  billing = typedBilling;
  const storage = new LibSQLStore({
    id: 'billing-workflow-snapshots',
    url: pathToFileURL(join(options.directory, 'workflow.db')).href,
  });
  await storage.init();
  const mastra = new Mastra({ agents: { assistant: agent }, workflows: { report: workflow }, storage });
  let closed = false;
  return {
    billing: typedBilling,
    billingContext,
    organizations,
    directory,
    accounting,
    workflowStorage,
    provider,
    providerStorage,
    configuration,
    credential,
    mastra,
    agents,
    workflows,
    close: async () => {
      if (closed) return;
      closed = true;
      accounting.close();
      workflowStorage.close();
      providerStorage.close();
      organizations.close();
      await storage.close();
    },
  };
}
