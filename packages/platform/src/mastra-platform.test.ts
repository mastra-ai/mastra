import type { AddressInfo } from 'node:net';
import { serve } from '@hono/node-server';
import type { ServerType } from '@hono/node-server';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { MastraClient } from '@mastra/client-js';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import type { ProcessInputStepArgs } from '@mastra/core/processors';
import { MASTRA_RESOURCE_ID_KEY, RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { MastraServer } from '@mastra/hono';
import { Memory } from '@mastra/memory';
import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { MastraPlatform, PlatformAgent, PlatformMemory } from './index';

const PROJECT_ID = 'proj_123';
// A project access token is a JWT naming its project; the Platform verifies the signature.
const ACCESS_TOKEN = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ teamId: 'org_1', projectId: PROJECT_ID })).toString('base64url')}.signature`;
const REPLY = 'Your invoice is in Billing > Invoices.';
const USAGE = { inputTokens: 10, outputTokens: 5, totalTokens: 15 };

type Part = Record<string, unknown> & { type: string };

function streamOf(parts: Part[]) {
  return {
    stream: convertArrayToReadableStream([{ type: 'stream-start', warnings: [] }, ...parts] as never[]),
  };
}

/**
 * The model behind every managed agent in the stand-in: it looks the invoice up with a tool, then
 * answers. Asked for structured output it answers in JSON; asked to fail it throws.
 */
function invoiceModel(prompts: unknown[] = []) {
  return new MockLanguageModelV2({
    doStream: async options => {
      prompts.push(options.prompt);
      const prompt = JSON.stringify(options.prompt);
      if (prompt.includes('Fail please')) throw new Error('The model is down');
      const answer = (text: string) =>
        streamOf([
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: text },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage: USAGE },
        ]);
      if (options.responseFormat?.type === 'json') return answer(JSON.stringify({ location: 'Billing > Invoices' }));
      if (options.prompt.at(-1)?.role === 'tool') return answer(REPLY);
      return streamOf([
        {
          type: 'tool-call',
          toolCallId: 'call-1',
          toolName: 'lookupInvoice',
          input: JSON.stringify({ month: 'May' }),
        },
        { type: 'finish', finishReason: 'tool-calls', usage: USAGE },
      ]);
    },
  });
}

const lookupInvoice = createTool({
  id: 'lookupInvoice',
  description: 'Finds an invoice',
  inputSchema: z.object({ month: z.string() }),
  execute: async ({ month }) => ({ month, location: 'Billing > Invoices' }),
});

function invoiceAgent(
  id: string,
  { name, description, instructions }: { name: string; description?: string; instructions: string },
  storage: InMemoryStore,
  prompts?: unknown[],
  observe?: 'turn' | 'mid-run',
) {
  return new Agent({
    id,
    name,
    description,
    instructions,
    model: invoiceModel(prompts),
    tools: { lookupInvoice },
    // Like hosted Platform Memory, Observational Memory saves each turn whatever the caller's
    // `lastMessages`.
    memory: new Memory({
      storage,
      ...(observe && { options: { observationalMemory: { model: invoiceModel() as never } } }),
    }),
    // Observing partway through a run seals the reply so far and starts a new message after it.
    ...(observe === 'mid-run' && {
      inputProcessors: [
        {
          id: 'observe-mid-run',
          processInputStep: ({ stepNumber, messageList, rotateResponseMessageId }: ProcessInputStepArgs) => {
            if (stepNumber === 1) rotateResponseMessageId?.();
            return messageList;
          },
        },
      ],
    }),
  });
}

/**
 * A stand-in for Mastra Platform's `/v1/server/projects/:projectId` API. Agent runs, agent details,
 * and thread reads are served by Mastra's own route handlers, as the Managed Agents runtime does;
 * agent create/update/delete and the Platform's auth and end-user rules are reproduced around them.
 */
async function startPlatform() {
  const storage = new InMemoryStore();
  const mastra = new Mastra({ logger: false, storage });
  const prompts: unknown[] = [];
  const created: Record<string, unknown>[] = [];
  const updated: Record<string, unknown>[] = [];
  const runs: Record<string, unknown>[] = [];
  const prefix = `/v1/server/projects/${PROJECT_ID}`;
  const app = new Hono();

  app.use('/v1/server/projects/:projectId/*', async (c, next) => {
    if (c.req.header('authorization') !== `Bearer ${ACCESS_TOKEN}`) return c.json({ error: 'Unauthorized' }, 401);
    if (c.req.param('projectId') !== PROJECT_ID) return c.json({ error: 'Project not found' }, 404);
    return next();
  });
  // A project access token carries no user, so a run must name the end user it acts for.
  const requireEndUser = async (c: Context, next: Next) => {
    const body = (await c.req.raw.clone().json()) as Record<string, unknown>;
    runs.push(body);
    if (typeof body.resourceId !== 'string') return c.json({ error: 'resourceId is required' }, 400);
    return next();
  };
  app.post(`${prefix}/agents/:agentId/:run{stream|generate}`, requireEndUser);
  app.post(`${prefix}/agents/:agentId/tools/:toolId/execute`, requireEndUser);
  const setup: { memoryInstanceId?: string; observe?: 'turn' | 'mid-run' } = {};
  app.get(`${prefix}/agents/setup`, c =>
    c.json({ status: 'ready', ...(setup.memoryInstanceId && { memoryInstanceId: setup.memoryInstanceId }) }),
  );
  app.post(`${prefix}/agents`, async c => {
    const body = await c.req.json();
    created.push(body);
    const id = `agent_${created.length}`;
    mastra.addAgent(invoiceAgent(id, body, storage, prompts, setup.observe), id);
    return c.json({ id, name: body.name, instructions: body.instructions }, 201);
  });
  app.patch(`${prefix}/agents/:agentId`, async c => {
    const body = await c.req.json();
    updated.push(body);
    return c.json({ id: c.req.param('agentId'), name: body.name ?? 'Support' });
  });
  app.delete(`${prefix}/agents/:agentId`, c => {
    if (!mastra.removeAgent(c.req.param('agentId'))) return c.json({ error: 'agent_not_found' }, 404);
    return c.body(null, 204);
  });
  await new MastraServer({ app, mastra, prefix }).init();

  const server = await new Promise<ServerType>(resolve => {
    const s = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' }, () => resolve(s));
  });
  const { port } = server.address() as AddressInfo;
  return {
    apiUrl: `http://127.0.0.1:${port}`,
    storage,
    setup,
    prompts,
    created,
    updated,
    runs,
    close: () => new Promise<void>(resolve => server.close(() => resolve())),
  };
}

let platformApi: Awaited<ReturnType<typeof startPlatform>>;
const originalEnv = { ...process.env };

beforeAll(async () => {
  platformApi = await startPlatform();
});
afterAll(() => platformApi.close());
afterEach(() => {
  process.env = { ...originalEnv };
});

function platform() {
  return new MastraPlatform({ accessToken: ACCESS_TOKEN, apiUrl: platformApi.apiUrl });
}

/** What a run's output says, without the ids and timestamps that differ between runs. */
async function shape(output: Awaited<ReturnType<Agent['generate']>>) {
  return {
    text: output.text,
    finishReason: output.finishReason,
    usage: { inputTokens: output.usage.inputTokens, outputTokens: output.usage.outputTokens },
    steps: output.steps.map(step => ({ text: step.text, finishReason: step.finishReason })),
    toolCalls: output.toolCalls.map(call => ({ toolName: call.payload.toolName, args: call.payload.args })),
    toolResults: output.toolResults.map(result => result.payload.result),
    messages: output.response.messages?.map(message => ({
      role: message.role,
      content: Array.isArray(message.content) ? message.content.map(part => part.type) : message.content,
    })),
  };
}

describe('MastraPlatform managed agents', () => {
  it('creates an agent that answers with its instructions, using only the project access token', async () => {
    const agent = await platform().createAgent({
      name: 'Support',
      instructions: 'You answer billing questions for Acme.',
      model: 'openai/gpt-5-mini',
    });

    const output = await agent.stream('Where is my invoice?', { memory: { thread: 'thread-1', resource: 'user-1' } });

    expect(await output.text).toBe(REPLY);
    // Platform agents only run Gateway models, sent as `{ provider: 'mastra', name }`.
    expect(platformApi.created.at(-1)).toMatchObject({ model: { provider: 'mastra', name: 'openai/gpt-5-mini' } });
    expect(JSON.stringify(platformApi.prompts.at(-1))).toContain('You answer billing questions for Acme.');
    expect(JSON.stringify(platformApi.prompts.at(-1))).toContain('Where is my invoice?');
  });

  it('returns the same output a local run of the agent returns', async () => {
    const agent = await platform().createAgent({ name: 'Support', instructions: 'Answer billing questions.' });
    const local = invoiceAgent(
      'local',
      { name: 'Support', instructions: 'Answer billing questions.' },
      new InMemoryStore(),
    );
    const memory = { thread: 'thread-same', resource: 'user-same' };

    const remote = await agent.stream('Where is my invoice?', { memory });
    const chunkTypes: string[] = [];
    for await (const chunk of remote.fullStream) chunkTypes.push(chunk.type);

    expect(chunkTypes).toEqual(expect.arrayContaining(['tool-call', 'tool-result', 'text-delta', 'finish']));
    expect(await shape(await remote.getFullOutput())).toEqual(
      // The mock models only stream, as the Platform's runtime does.
      await shape(await (await local.stream('Where is my invoice?', { memory })).getFullOutput()),
    );
  });

  it("saves the conversation to the end user's thread so it can be read back", async () => {
    const agent = await platform().createAgent({ name: 'Support', instructions: 'Answer billing questions.' });
    await agent.generate('Where is my invoice?', { memory: { thread: 'thread-2', resource: 'user-2' } });

    const { threads } = await agent.listThreads({ resourceId: 'user-2' });
    expect(threads.map(thread => thread.id)).toEqual(['thread-2']);
    const { messages } = await agent.listMessages('thread-2', { resourceId: 'user-2' });
    expect(messages.map(message => message.role)).toEqual(['user', 'assistant']);
    expect(JSON.stringify(messages)).toContain(REPLY);
  });

  it('generates a reply for an end user named without memory', async () => {
    const agent = await platform().createAgent({ name: 'Support', instructions: 'Answer billing questions.' });

    const output = await agent.generate('Where is my invoice?', { resourceId: 'user-3' });

    expect(output.text).toBe(REPLY);
  });

  it('returns structured output as a typed object', async () => {
    const agent = await platform().createAgent({ name: 'Support', instructions: 'Answer billing questions.' });

    const output = await agent.generate('Where is my invoice?', {
      resourceId: 'user-4',
      structuredOutput: { schema: z.object({ location: z.string() }) },
    });

    expect(output.object).toEqual({ location: 'Billing > Invoices' });
  });

  it('reports the Platform error when a run names no end user', async () => {
    const agent = await platform().createAgent({ name: 'Support', instructions: 'Answer billing questions.' });

    await expect(agent.generate('Where is my invoice?')).rejects.toThrow(/400.*resourceId is required/);
  });

  it('rejects with the error of a run that fails on the Platform', async () => {
    const agent = await platform().createAgent({ name: 'Support', instructions: 'Answer billing questions.' });

    await expect(agent.generate('Fail please', { resourceId: 'user-5' })).rejects.toThrow('The model is down');
  });

  it('never sends local run state in the request context', async () => {
    const agent = await platform().createAgent({ name: 'Support', instructions: 'Answer billing questions.' });
    const requestContext = new RequestContext<Record<string, unknown>>();
    requestContext.set('plan', 'enterprise');
    requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-6');
    requestContext.set('mastra__versions', { agents: {} });
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    requestContext.set('liveObject', cyclic);

    await agent.generate('Where is my invoice?', { requestContext });

    expect(platformApi.runs.at(-1)).toMatchObject({ resourceId: 'user-6', requestContext: { plan: 'enterprise' } });
    expect(Object.keys(platformApi.runs.at(-1)!.requestContext as object)).toEqual(['plan']);
  });

  it('reads, lists, updates, and deletes agents', async () => {
    const client = platform();
    const agent = await client.createAgent({ name: 'Triage', instructions: 'Route incoming tickets.' });

    const fetched = await client.getAgent(agent.id);
    expect(fetched).toBeInstanceOf(Agent);
    expect(fetched.name).toBe('Triage');
    expect(await fetched.getInstructions()).toBe('Route incoming tickets.');
    expect((await fetched.details()).instructions).toBe('Route incoming tickets.');
    expect(Object.keys(await client.listAgents())).toContain(agent.id);

    expect(await agent.update({ name: 'Ticket triage', model: 'anthropic/claude-sonnet-4-5' })).toMatchObject({
      id: agent.id,
      name: 'Ticket triage',
    });
    expect(platformApi.updated.at(-1)).toEqual({
      name: 'Ticket triage',
      model: { provider: 'mastra', name: 'anthropic/claude-sonnet-4-5' },
    });
    expect(agent.name).toBe('Ticket triage');

    await agent.delete();
    expect(Object.keys(await client.listAgents())).not.toContain(agent.id);
    await expect(agent.delete()).rejects.toThrow(/404/);
    await expect(client.getAgent(agent.id)).rejects.toThrow(/404/);
  });
});

describe('PlatformAgent as a Mastra agent', () => {
  it('runs when registered in Mastra', async () => {
    const billing = await platform().createAgent({ name: 'Billing', instructions: 'Answer billing questions.' });
    const mastra = new Mastra({ logger: false, agents: { billing } });

    const output = await mastra.getAgent('billing').generate('Where is my invoice?', { resourceId: 'user-7' });

    expect(output.text).toBe(REPLY);
  });

  it('answers as a sub-agent of a local supervisor', async () => {
    const billing = await platform().createAgent({
      name: 'Billing',
      description: 'Answers billing questions',
      instructions: 'Answer billing questions.',
    });
    const supervisorPrompts: unknown[] = [];
    const supervisor = new Agent({
      id: 'supervisor',
      name: 'Supervisor',
      instructions: 'Delegate billing questions.',
      agents: { billing },
      memory: new Memory({ storage: new InMemoryStore() }),
      model: new MockLanguageModelV2({
        doStream: async options => {
          supervisorPrompts.push(options);
          if (options.prompt.at(-1)?.role === 'tool') {
            return streamOf([
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'Billing says the invoice is under Billing.' },
              { type: 'text-end', id: 'text-1' },
              { type: 'finish', finishReason: 'stop', usage: USAGE },
            ]);
          }
          return streamOf([
            {
              type: 'tool-call',
              toolCallId: 'delegate-1',
              toolName: 'agent-billing',
              input: JSON.stringify({ prompt: 'Where is my invoice?' }),
            },
            { type: 'finish', finishReason: 'tool-calls', usage: USAGE },
          ]);
        },
      }),
    });

    const stream = await supervisor.stream('Where is my invoice?', {
      memory: { thread: 'supervised', resource: 'user-8' },
    });
    const output = await stream.getFullOutput();

    expect(output.text).toBe('Billing says the invoice is under Billing.');
    expect(output.toolResults[0]?.payload.result).toMatchObject({ text: REPLY });
    // Like any Mastra sub-agent, it runs for its own resource under the supervisor's end user.
    expect(platformApi.runs.at(-1)).toMatchObject({ resourceId: 'user-8-billing' });
    // The supervisor's model saw the managed agent described by its Platform description.
    expect(JSON.stringify(supervisorPrompts[0])).toContain('Answers billing questions');
  });

  it("returns the project's agent memory once the Platform has it ready", async () => {
    const billing = await platform().createAgent({ name: 'Billing', instructions: 'Answer billing questions.' });

    expect(billing.hasOwnMemory()).toBe(true);
    await expect(billing.getMemory()).resolves.toBeUndefined();

    platformApi.setup.memoryInstanceId = 'mem_managed-agents_1';
    try {
      const memory = await billing.getMemory();
      expect(memory).toBeInstanceOf(PlatformMemory);
      expect((memory as PlatformMemory).client.instanceId).toBe('mem_managed-agents_1');
    } finally {
      delete platformApi.setup.memoryInstanceId;
    }
  });

  // The Platform saves the delegated run, then the supervisor saves the transcript again to the
  // sub-agent's memory, which for a managed agent is the same Platform Memory.
  it.each([
    ['turn', ['user', 'assistant']],
    // The lookup, then the reply in the message started after observing.
    ['mid-run', ['user', 'assistant', 'assistant']],
  ] as const)(
    "keeps one copy of a sub-agent's conversation in the memory the Platform saved it to (observed %s)",
    async (observe, roles) => {
      platformApi.setup.observe = observe;
      const { id } = await platform()
        .createAgent({ name: 'Billing', instructions: 'Answer billing questions.' })
        .finally(() => delete platformApi.setup.observe);
      const memory = new Memory({ storage: platformApi.storage });
      const client = new MastraClient({
        baseUrl: platformApi.apiUrl,
        apiPrefix: `/v1/server/projects/${PROJECT_ID}`,
        headers: { authorization: `Bearer ${ACCESS_TOKEN}` },
      });
      // The memory the Platform saves the agent's conversations to.
      const billing = new PlatformAgent(client, {
        id,
        name: 'Billing',
        description: 'Answers billing questions',
        memory: async () => memory,
      });
      const supervisor = new Agent({
        id: 'supervisor',
        name: 'Supervisor',
        instructions: 'Delegate billing questions.',
        agents: { billing },
        memory: new Memory({ storage: new InMemoryStore() }),
        model: new MockLanguageModelV2({
          doStream: async options =>
            options.prompt.at(-1)?.role === 'tool'
              ? streamOf([
                  { type: 'text-start', id: 'text-1' },
                  { type: 'text-delta', id: 'text-1', delta: 'It is under Billing.' },
                  { type: 'text-end', id: 'text-1' },
                  { type: 'finish', finishReason: 'stop', usage: USAGE },
                ])
              : streamOf([
                  {
                    type: 'tool-call',
                    toolCallId: 'delegate-1',
                    toolName: 'agent-billing',
                    input: JSON.stringify({ prompt: 'Where is my invoice?' }),
                  },
                  { type: 'finish', finishReason: 'tool-calls', usage: USAGE },
                ]),
        }),
      });

      const stream = await supervisor.stream('Where is my invoice?', {
        memory: { thread: 'supervised-2', resource: 'user-12' },
      });
      const output = await stream.getFullOutput();
      const { subAgentThreadId } = output.toolResults[0]!.payload.result as { subAgentThreadId: string };
      const { messages } = await memory.recall({ threadId: subAgentThreadId });

      // The prompt, then the reply with its invoice lookup, each saved once.
      const parts = messages.flatMap(message => message.content.parts);
      expect(messages.map(message => message.role)).toEqual(roles);
      expect(parts.filter(part => part.type === 'tool-invocation')).toEqual([
        expect.objectContaining({
          toolInvocation: expect.objectContaining({
            state: 'result',
            result: { month: 'May', location: 'Billing > Invoices' },
          }),
        }),
      ]);
      expect(parts.filter(part => part.type === 'text' && part.text === REPLY)).toHaveLength(1);
    },
  );

  it('runs as a workflow step for the end user in the request context', async () => {
    const billing = await platform().createAgent({ name: 'Billing', instructions: 'Answer billing questions.' });
    const workflow = createWorkflow({
      id: 'answer-billing',
      inputSchema: z.object({ prompt: z.string() }),
      outputSchema: z.object({ text: z.string() }),
    })
      .then(createStep(billing))
      .commit();
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-9');

    const run = await workflow.createRun();
    const result = await run.start({ inputData: { prompt: 'Where is my invoice?' }, requestContext });

    expect(result).toMatchObject({ status: 'success', result: { text: REPLY } });
    expect(platformApi.runs.at(-1)).toMatchObject({ resourceId: 'user-9' });
  });

  it("reports the Platform's model and refuses to call it without a Gateway key", async () => {
    delete process.env.MASTRA_GATEWAY_API_KEY;
    const client = new MastraClient({ baseUrl: platformApi.apiUrl });
    const model = await new PlatformAgent(client, { id: 'a', name: 'A', model: 'openai/gpt-5-mini' }).getModel();

    expect([model.provider, model.modelId]).toEqual(['openai', 'gpt-5-mini']);
    await expect(model.doStream({ prompt: [] } as never)).rejects.toThrow(/MASTRA_GATEWAY_API_KEY/);
  });

  it('runs its model locally through the Mastra Gateway when a Gateway key is set', async () => {
    process.env.MASTRA_GATEWAY_API_KEY = 'msk_test';
    const client = new MastraClient({ baseUrl: platformApi.apiUrl });
    const model = await new PlatformAgent(client, { id: 'a', name: 'A', model: 'openai/gpt-5-mini' }).getModel();

    expect([model.provider, model.modelId, (model as { gatewayId?: string }).gatewayId]).toEqual([
      'openai',
      'gpt-5-mini',
      'mastra',
    ]);
  });

  it("lists the Platform agent's tools and runs them on the Platform for the end user", async () => {
    const billing = await platform().createAgent({ name: 'Billing', instructions: 'Answer billing questions.' });
    const tools = await billing.listTools();
    const lookup = tools.lookupInvoice!;
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-11');

    expect(lookup.description).toBe('Finds an invoice');
    const result = await lookup.execute!({ month: 'June' }, { requestContext } as never);

    expect(result).toEqual({ month: 'June', location: 'Billing > Invoices' });
    expect(platformApi.runs.at(-1)).toMatchObject({ data: { month: 'June' }, resourceId: 'user-11' });
    // Validated against the schema the Platform reported, before any request.
    const runs = platformApi.runs.length;
    await expect(lookup.execute!({ month: 6 } as never, { requestContext } as never)).resolves.toMatchObject({
      error: true,
    });
    expect(platformApi.runs).toHaveLength(runs);
  });
});

describe('MastraPlatform credentials', () => {
  it('reads the access token and API URL from the environment', async () => {
    delete process.env.MASTRA_PROJECT_ID;
    process.env.MASTRA_PLATFORM_ACCESS_TOKEN = ACCESS_TOKEN;
    process.env.MASTRA_PLATFORM_API_URL = platformApi.apiUrl;

    const client = new MastraPlatform();

    expect(client.projectId).toBe(PROJECT_ID);
    await expect(client.listAgents()).resolves.toBeTypeOf('object');
  });

  it('works in another project through getProject', async () => {
    const client = new MastraPlatform({
      accessToken: ACCESS_TOKEN,
      projectId: 'proj_other',
      apiUrl: platformApi.apiUrl,
    });
    await expect(client.listAgents()).rejects.toMatchObject({ status: 404 });

    const project = client.getProject(PROJECT_ID);
    expect(project.projectId).toBe(PROJECT_ID);
    const agent = await project.createAgent({ name: 'Elsewhere', instructions: 'Help with billing.' });
    expect(Object.keys(await project.listAgents())).toContain(agent.id);
    // The client it came from still works in its own project.
    expect(client.projectId).toBe('proj_other');
    await agent.delete();
  });

  it('rejects a request made with a token the Platform does not accept', async () => {
    const client = new MastraPlatform({ accessToken: 'sk_wrong', projectId: PROJECT_ID, apiUrl: platformApi.apiUrl });

    await expect(client.listAgents()).rejects.toMatchObject({ status: 401 });
  });

  it('asks for a project only when a project method is used and the token does not name one', async () => {
    delete process.env.MASTRA_PROJECT_ID;
    const client = new MastraPlatform({ accessToken: 'sk_org_key' });
    expect(client.projects).toBeDefined();
    await expect(client.getAgent('agent-1')).rejects.toThrow('MastraPlatform: projectId is required');
    expect(client.getProject(PROJECT_ID).projectId).toBe(PROJECT_ID);
  });

  it('requires an access token', () => {
    delete process.env.MASTRA_PLATFORM_ACCESS_TOKEN;
    delete process.env.MASTRA_PLATFORM_SECRET_KEY;
    expect(() => new MastraPlatform()).toThrow('MastraPlatform: accessToken is required');
  });
});
