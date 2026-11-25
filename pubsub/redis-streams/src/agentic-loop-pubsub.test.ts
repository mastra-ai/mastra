import { randomUUID } from 'node:crypto';
import { createOpenAI } from '@ai-sdk/openai-v5';
import { LLMock } from '@copilotkit/aimock';
import { stepCountIs } from '@internal/ai-sdk-v5';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { PostgresStore } from '@mastra/pg';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createResumeContextRuntime } from '../test-fixtures/evented-resume-context';
import { killProcess, spawnFixture, waitFor, waitForLine } from '../test-fixtures/harness';
import { RedisStreamsPubSub } from './index';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6381';
const SCENARIO_MODEL_ID = 'gpt-4o-mini';

/**
 * Mirror of `packages/core/.../evented-unix-pubsub.scenario.test.ts` but
 * pointed at `RedisStreamsPubSub`. The agentic loop must complete cleanly
 * when the evented engine ships `workflow.events.v2` and step-result
 * snapshots through a real Redis Streams broker, including tool outputs
 * carrying non-JSON-safe payloads (Date, Map, Error).
 *
 * This guards against regressions where the codec at the pubsub frame
 * boundary, or the `RunScope` plumbing in `prepare-stream`, fails to
 * preserve enough fidelity for the loop to finish.
 */
describe('AIMock loop scenario: evented + RedisStreamsPubSub', () => {
  let mock: LLMock | undefined;
  const pubsubs: RedisStreamsPubSub[] = [];

  beforeAll(async () => {
    mock = new LLMock({ port: 0 });
    await mock.start();
    process.env.MASTRA_EVENTED_EXECUTION = 'true';
  });

  afterEach(async () => {
    mock?.clearFixtures();
    mock?.clearRequests();
    mock?.resetMatchCounts();
    await Promise.allSettled(pubsubs.splice(0).map(p => p.close()));
  });

  afterAll(async () => {
    await mock?.stop();
    mock = undefined;
    delete process.env.MASTRA_EVENTED_EXECUTION;
  });

  it('uses resumed request context in both LLM processors after a worker restart', async () => {
    if (!mock) throw new Error('AIMock server is not running');
    mock.on(
      { endpoint: 'chat', hasToolResult: false },
      { toolCalls: [{ id: 'lookup-one', name: 'lookup', arguments: {} }] },
    );
    mock.on(
      {
        endpoint: 'chat',
        hasToolResult: true,
        predicate: req => !JSON.stringify(req.messages).includes('approval-one'),
      },
      { toolCalls: [{ id: 'approval-one', name: 'approve', arguments: {} }] },
    );
    mock.on(
      {
        endpoint: 'chat',
        hasToolResult: true,
        predicate: req => JSON.stringify(req.messages).includes('approval-one'),
      },
      { content: 'Approved.' },
    );
    const schemaName = `resume_${randomUUID().slice(0, 8)}`;
    const connectionString =
      process.env.POSTGRES_CONNECTION_STRING ?? 'postgres://postgres:postgres@localhost:5436/postgres';
    const { agent, mastra, storage } = createResumeContextRuntime({
      schemaName,
      connectionString,
      redisUrl: REDIS_URL,
      modelUrl: mock.url,
      worker: false,
    });
    const start = () =>
      spawnFixture({
        entry: 'test-fixtures/evented-resume-context.entry.ts',
        env: {
          MASTRA_WORKERS: 'orchestration',
          RESUME_CONTEXT_SCHEMA: schemaName,
          RESUME_CONTEXT_MODEL_URL: mock!.url,
          POSTGRES_CONNECTION_STRING: connectionString,
          REDIS_URL,
        },
      });
    let worker: ReturnType<typeof start> | undefined;
    const context = (marker: string) => {
      const requestContext = new RequestContext();
      requestContext.set('resume-marker', marker);
      return requestContext;
    };
    const runId = randomUUID();
    try {
      await storage.init();
      worker = start();
      await waitForLine(worker, 'resume-context-worker-ready');
      const output = await agent.stream('Ask for approval.', {
        runId,
        memory: { thread: runId, resource: 'resume-context' },
        requestContext: context('initial'),
      });
      void output.consumeStream().catch(() => {});
      const workflows = (await storage.getStore('workflows'))!;
      await waitFor(async () => {
        const snapshot = await workflows.loadWorkflowSnapshot({ workflowName: 'durable-agentic-loop', runId });
        return snapshot?.status === 'suspended';
      });
      expect(worker.stdout).toContain('input-step:initial');
      expect(worker.stdout).toContain('llm-request:initial');
      await killProcess(worker);
      worker = start();
      await waitForLine(worker, 'resume-context-worker-ready');

      const resumed = await agent.approveToolCall({
        runId,
        toolCallId: 'approval-one',
        requestContext: context('resumed'),
      });
      await waitForLine(worker, /llm-request:(initial|resumed)/);
      expect(worker.stdout.match(/(?:input-step|llm-request):\w+/g)).toEqual([
        'input-step:resumed',
        'llm-request:resumed',
      ]);
      expect(await resumed.text).toBe('Approved.');
    } finally {
      await killProcess(worker);
      await mastra.shutdown();
      const cleanup = new PostgresStore({ id: `${schemaName}_cleanup`, connectionString });
      try {
        await cleanup.db.none(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
      } finally {
        await cleanup.close();
      }
    }
  });

  it('retains live request context in a native evented input-step processor', async () => {
    if (!mock) throw new Error('AIMock server is not running');
    const pubsub = new RedisStreamsPubSub({ url: REDIS_URL, keyPrefix: `aimock-${randomUUID()}`, blockMs: 200 });
    pubsubs.push(pubsub);
    mock.on({ endpoint: 'chat' }, { content: 'Processed on the owning worker.' });
    const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${mock.url.replace(/\/+$/, '')}/v1` });
    const getState = () => 'live-controller-state';
    const requestContext = new RequestContext([['controller', { getState }]]);
    const observed: string[] = [];
    const agent = new Agent({
      id: 'live-context',
      name: 'Live context',
      instructions: 'Reply to the user.',
      model: openai(SCENARIO_MODEL_ID),
      durable: { executionEngine: 'evented' },
      inputProcessors: [
        {
          id: 'read-live-context',
          processInputStep: async ({ requestContext }) => {
            const controller = requestContext?.get('controller') as { getState(): string };
            observed.push(controller.getState());
          },
        },
      ],
    });
    const schemaName = `live_context_${randomUUID().replaceAll('-', '')}`;
    const connectionString =
      process.env.POSTGRES_CONNECTION_STRING ?? 'postgres://postgres:postgres@localhost:5436/postgres';
    const storage = new PostgresStore({ id: schemaName, schemaName, connectionString });
    let mastra: Mastra | undefined;
    try {
      mastra = new Mastra({ agents: { agent }, logger: false, storage, pubsub });
      const output = await mastra.getAgent('agent').stream('Read the live state.', { requestContext });
      await output.consumeStream();
      expect(observed).toEqual(['live-controller-state']);
      expect(await output.text).toBe('Processed on the owning worker.');
    } finally {
      try {
        await mastra?.shutdown();
      } finally {
        // Mastra shuts down its own Postgres pool before the schema can be dropped.
        const cleanup = mastra ? new PostgresStore({ id: `${schemaName}_cleanup`, connectionString }) : storage;
        try {
          await cleanup.db.none(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
        } finally {
          await cleanup.close();
        }
      }
    }
  });

  // COR-1659: the producer registers its loop when it starts the run, but the pull worker never calls the agent.
  it.each(['before', 'during', 'during lazy', 'after'] as const)(
    'runs a native evented agent registered %s pull worker startup',
    async timing => {
      if (!mock) throw new Error('AIMock server is not running');
      mock.on({ endpoint: 'chat' }, { content: 'Your order has shipped.' });
      const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${mock.url}/v1` });
      const makeAgent = () =>
        new Agent({
          id: 'order-support',
          name: 'Order support',
          instructions: 'Help with orders.',
          model: openai(SCENARIO_MODEL_ID),
          durable: { executionEngine: 'evented' },
        });
      const keyPrefix = `aimock-${randomUUID()}`;
      const apiPubsub = new RedisStreamsPubSub({ url: REDIS_URL, keyPrefix, blockMs: 200 });
      const workerPubsub = new RedisStreamsPubSub({ url: REDIS_URL, keyPrefix, blockMs: 200 });
      pubsubs.push(apiPubsub, workerPubsub);
      const storage = new InMemoryStore();
      const apiAgent = makeAgent();
      const api = new Mastra({
        agents: { support: apiAgent },
        storage,
        pubsub: apiPubsub,
        workers: false,
        logger: false,
      });
      const worker = new Mastra({ storage, pubsub: workerPubsub });
      try {
        if (timing === 'before') worker.addAgent(makeAgent(), 'support');
        if (timing === 'during' || timing === 'during lazy') {
          // Pull subscription starts after the initial registration pass, but before startup completes.
          const subscribe = workerPubsub.subscribe.bind(workerPubsub);
          const subscription = vi.spyOn(workerPubsub, 'subscribe').mockImplementation((topic, cb, options) => {
            if (topic === 'workflows') {
              subscription.mockRestore();
              worker.addAgent(makeAgent(), 'support');
            }
            return subscribe(topic, cb, options);
          });
        }
        if (timing === 'during lazy') {
          await worker.__ensureExecutionWorkersStarted();
        } else {
          await worker.startWorkers();
        }
        if (timing === 'after') worker.addAgent(makeAgent(), 'support');

        const output = await apiAgent.stream('Where is my order?');
        await expect(output.text).resolves.toBe('Your order has shipped.');
        expect(JSON.stringify(mock.getRequests()[0]?.body)).toContain('Where is my order?');
      } finally {
        await api.shutdown();
        await worker.shutdown();
      }
    },
    15_000,
  );

  it('round-trips a tool result containing Date/Map/Error across the evented pubsub', async () => {
    if (!mock) throw new Error('AIMock server is not running');

    // Per-test keyPrefix so concurrent or repeated runs don't cross talk.
    const pubsub = new RedisStreamsPubSub({
      url: REDIS_URL,
      keyPrefix: `aimock-${randomUUID()}`,
      blockMs: 200,
    });
    pubsubs.push(pubsub);

    const reportedAt = new Date('2024-06-15T12:34:56.789Z');

    const lookupTool = createTool({
      id: 'lookup_status',
      description: 'Look up a status payload with non-JSON-safe fields.',
      inputSchema: z.object({ query: z.string() }),
      outputSchema: z.any(),
      execute: async ({ query }) => ({
        status: `STATUS_OK:${query}`,
        reportedAt,
        tags: new Map([
          ['priority', 'high'],
          ['source', query],
        ]),
        warning: new Error(`slow_response:${query}`),
      }),
    });

    mock.on(
      { endpoint: 'chat', hasToolResult: false },
      {
        toolCalls: [
          {
            id: 'call_lookup_alpha',
            name: 'lookup_status',
            arguments: { query: 'alpha' },
          },
        ],
      },
    );
    mock.on(
      { endpoint: 'chat', toolCallId: 'call_lookup_alpha', hasToolResult: true },
      { content: 'The status for alpha is STATUS_OK:alpha.' },
    );

    const openai = createOpenAI({
      apiKey: 'aimock-test-key',
      baseURL: `${mock.url.replace(/\/+$/, '')}/v1`,
    });

    const agentId = `aimock-redis-scenario-${randomUUID()}`;
    const agent = new Agent({
      id: agentId,
      name: 'AIMock Redis Scenario Agent',
      instructions: 'You are a test agent driven by scripted AIMock responses.',
      model: openai(SCENARIO_MODEL_ID),
      tools: { lookup_status: lookupTool },
    });

    const mastra = new Mastra({
      agents: { [agentId]: agent },
      logger: false,
      storage: new InMemoryStore(),
      pubsub,
    });

    const registered = mastra.getAgent(agentId);
    const output = await registered.stream('Look up the status for query alpha.', {
      stopWhen: stepCountIs(5),
    });
    await output.consumeStream();

    const requests = mock.getRequests();
    expect(requests).toHaveLength(2);

    const text = await output.text;
    expect(text).toContain('STATUS_OK:alpha');

    const toolResults = await output.toolResults;
    expect(toolResults).toHaveLength(1);
    expect(toolResults[0]?.payload.toolName).toBe('lookup_status');
    const toolResult = toolResults[0]?.payload.result as { status: string };
    expect(toolResult.status).toBe('STATUS_OK:alpha');

    const turn2Messages = requests[1]?.body?.messages ?? [];
    const toolMessage = turn2Messages.find(message => (message as { role?: string }).role === 'tool') as
      | { tool_call_id?: string; content?: string }
      | undefined;
    expect(toolMessage?.tool_call_id).toBe('call_lookup_alpha');
    expect(toolMessage?.content).toContain('STATUS_OK:alpha');
  });
});
