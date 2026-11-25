import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { createOpenAI } from '@ai-sdk/openai-v5';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { z } from 'zod/v4';
import { Observability } from '../../../../../../../observability/mastra/src/default';
import { FGADeniedError } from '../../../../auth/ee';
import { MockMemory } from '../../../../memory/mock';
import { InternalSpans, SpanType, TracingEventType } from '../../../../observability';
import { RequestContext } from '../../../../request-context';
import { InMemoryStore } from '../../../../storage';
import { createTool } from '../../../../tools';
import { describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';
import { captureOutcomeEvents as capture } from '../outcome-test-utils';

describeForAllEngines('run and generation span fields', engine => {
  const getMock = useLoopScenarioAimock();

  it('records the prompt, settings, tools and object', async () => {
    const { observability, ended } = capture();
    await runLoopScenario({
      engine,
      llm: getMock(),
      observability,
      prompt: 'Pick a color.',
      tools: {
        lookup: createTool({
          id: 'lookup',
          description: 'Look up a color.',
          inputSchema: z.object({ n: z.number() }),
          execute: async () => ({ color: 'blue' }),
        }),
      },
      structuredOutput: { schema: z.object({ word: z.string() }) },
      modelSettings: { temperature: 0 },
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_1', name: 'lookup', arguments: { n: 1 } }] },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: '{"word":"Blue"}' });
      },
      afterStream: async () => {
        await expect.poll(() => ended().length).toBe(1);
      },
    });

    const [run] = ended();
    const [generation] = ended(SpanType.MODEL_GENERATION);
    expect(run!.attributes).toMatchObject({ availableTools: ['lookup'] });
    expect(run!.output).toMatchObject({ object: { word: 'Blue' } });
    expect(generation!.input).toMatchObject({
      messages: expect.arrayContaining([expect.objectContaining({ role: 'user' })]),
    });
    expect(generation!.attributes).toMatchObject({
      parameters: { temperature: 0 },
      tools: [expect.objectContaining({ name: 'lookup' })],
    });
    expect(generation!.output).toMatchObject({ object: { word: 'Blue' } });
  });

  it('records an input processor abort on the run', async () => {
    const { observability, ended } = capture();
    await runLoopScenario({
      engine,
      llm: getMock(),
      observability,
      prompt: 'Hello.',
      inputProcessors: [{ id: 'block', processInput: ({ abort }) => abort('blocked by test') }],
      fixtures: llm => llm.onMessage(/.*/, { content: 'The model should never run.' }),
      afterStream: async () => {
        await expect.poll(() => ended().length).toBe(1);
      },
    });

    const tripwire = { reason: 'blocked by test', processorId: 'block' };
    const [run] = ended();
    expect(run!.output).toMatchObject({ tripwire });
    expect(run!.attributes).toMatchObject({ tripwireAbort: tripwire });
  });

  it('hides model spans the agent tracingPolicy marks internal', async () => {
    const { observability, events, ended } = capture();
    await runLoopScenario({
      engine,
      llm: getMock(),
      observability,
      prompt: 'Hello.',
      tracingPolicy: { internal: InternalSpans.MODEL },
      fixtures: llm => llm.onMessage(/.*/, { content: 'Hi.' }),
      afterStream: async () => {
        await expect.poll(() => ended().length).toBe(1);
      },
    });

    const exported = events.filter(e => e.type === TracingEventType.SPAN_ENDED).map(e => e.exportedSpan.type);
    expect(exported.filter(type => type.startsWith('model_'))).toEqual([]);
  });

  it('keeps the answer when the observability config selector throws at the end of the run', async () => {
    const memory = new MockMemory();
    const exporter = {
      name: 'noop',
      exportTracingEvent: async () => {},
      flush: async () => {},
      shutdown: async () => {},
    };
    const observability = new Observability({
      configs: {
        acme: { serviceName: 'acme', exporters: [exporter] },
        other: { serviceName: 'other', exporters: [exporter] },
      },
      configSelector: ({ requestContext }) => (requestContext!.get('tenant') as string).toLowerCase(),
    });
    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      observability,
      memory,
      threadId: 'thread',
      resourceId: 'user',
      requestContext: new RequestContext([['tenant', 'Acme']]),
      outputProcessors: [
        {
          id: 'clear-tenant',
          processOutputStep: ({ messages, requestContext }: any) => {
            requestContext.delete('tenant');
            return messages;
          },
        },
      ],
      prompt: 'Hello.',
      fixtures: llm => llm.onMessage(/.*/, { content: 'Hi.' }),
    });

    expect(await output.text).toBe('Hi.');
    await expect
      .poll(async () =>
        (await memory.recall({ threadId: 'thread', resourceId: 'user' })).messages.map(message => message.role),
      )
      .toEqual(['user', 'assistant']);
  });
});

describe('run and generation span fields on a worker in another process', () => {
  const getMock = useLoopScenarioAimock();

  const lookup = (options: { id?: string; toModelOutput?: () => never; requireApproval?: boolean } = {}) =>
    createTool({
      id: 'lookup',
      description: 'Look up an order.',
      inputSchema: z.object({}),
      execute: async () => ({ status: 'shipped' }),
      ...options,
    });
  const toModelOutput = () => {
    throw new Error('tool output mapping failed');
  };

  const pauseAfter = (ms: number, options?: { requireToolApproval: boolean }) =>
    createTool({
      id: 'pause',
      description: 'Ask a person.',
      inputSchema: z.object({}),
      execute: async (_, context) => {
        await setTimeout(ms);
        return context.agent!.suspend({ why: 'ask' }, options);
      },
    });

  /** The process that streams, and the worker process that executes the run. */
  async function split(
    agentOptions: Record<string, unknown>,
    { fga, fenced = true, leases = true }: { fga?: unknown; fenced?: boolean; leases?: boolean } = {},
  ) {
    const directory = await mkdtemp(join(tmpdir(), 'run-span-fields-'));
    const storage = new InMemoryStore();
    vi.spyOn((await storage.getStore('workflows'))!, 'supportsRunFencing').mockReturnValue(fenced);
    const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${getMock().url}/v1` });
    const start = async (index: number) => {
      // A process has its own run registry.
      if (index === 1) vi.resetModules();
      const { Agent } = await import('../../../../agent');
      const { Mastra } = await import('../../../../mastra');
      const { UnixSocketPubSub } = await import('../../../../events/unix-socket-pubsub');
      const pubsub = new UnixSocketPubSub(join(directory, 'pubsub.sock'));
      if (!leases) Object.assign(pubsub, { getLeaseProvider: () => undefined });
      const captured = capture();
      const agent = new Agent({
        id: 'support',
        name: 'Support',
        instructions: 'Help.',
        model: openai('gpt-4o'),
        durable: { executionEngine: 'evented' },
        ...agentOptions,
      });
      const { observability } = captured;
      const workers = index === 0 ? { workers: false as const } : {};
      return {
        ...captured,
        agent,
        pubsub,
        mastra: new Mastra({
          agents: { agent },
          storage,
          pubsub,
          observability,
          logger: false,
          ...(fga ? { server: { fga: fga as any } } : {}),
          ...workers,
        }),
      };
    };
    const api: any = await start(0);
    const worker: any = await start(1);
    onTestFinished(async () => {
      await api.mastra.shutdown();
      await worker.mastra.shutdown();
      for (const { pubsub } of [api, worker]) await pubsub.close();
      await rm(directory, { recursive: true, force: true });
    });
    await worker.mastra.startWorkers();
    const spanIds = (type: TracingEventType) =>
      [api, worker].flatMap(({ events }) =>
        events.filter((event: any) => event.type === type).map((event: any) => event.exportedSpan.id),
      );
    /** Ids of the spans no process ended, and of those ended more than once. */
    const unbalanced = () => {
      const endedIds = spanIds(TracingEventType.SPAN_ENDED);
      return {
        open: spanIds(TracingEventType.SPAN_STARTED).filter(id => !endedIds.includes(id)),
        endedTwice: endedIds.filter((id, index) => endedIds.indexOf(id) !== index),
      };
    };
    return { api, worker, storage, unbalanced };
  }

  it('reports the usage of hidden model spans on the run', async () => {
    getMock().on({ endpoint: 'chat' }, { content: 'Hi.' });
    const { api, worker } = await split({ options: { tracingPolicy: { internal: InternalSpans.MODEL } } });

    expect(await (await api.agent.stream('Hello.')).text).toBe('Hi.');
    await expect.poll(() => worker.ended().length).toBe(1);

    expect(worker.ended()[0].attributes.internalUsage).toMatchObject({ inputTokens: expect.any(Number) });
    expect(worker.ended(SpanType.MODEL_GENERATION)).toEqual([]);
  }, 15_000);

  it.each([true, false])(
    'ends every span once when the run fails, with storage fencing %s',
    async fenced => {
      getMock().on({ endpoint: 'chat' }, { toolCalls: [{ id: 'lookup-1', name: 'lookup', arguments: {} }] });
      const { api, worker, unbalanced } = await split({ tools: { lookup: lookup({ toModelOutput }) } }, { fenced });

      const { fullStream } = await api.agent.stream('Where is my order?');
      for await (const _ of fullStream);

      for (const type of [SpanType.AGENT_RUN, SpanType.MODEL_GENERATION, SpanType.MODEL_STEP]) {
        await expect.poll(() => [...worker.ended(type), ...api.ended(type)]).toMatchObject([{ outcome: 'error' }]);
      }
      expect(unbalanced()).toEqual({ open: [], endedTwice: [] });
    },
    15_000,
  );

  it('ends every span once when the cleanup of a failed run is retried', async () => {
    getMock().on({ endpoint: 'chat' }, { toolCalls: [{ id: 'lookup-1', name: 'lookup', arguments: {} }] });
    const { api, worker, storage, unbalanced } = await split({ tools: { lookup: lookup({ toModelOutput }) } });
    const store = (await storage.getStore('workflows'))!;
    const deleteRun = store.deleteWorkflowRunById.bind(store);
    let rejected = 0;
    vi.spyOn(store, 'deleteWorkflowRunById').mockImplementation(async args => {
      if (args.fence && rejected++ === 0) throw new Error('database unavailable');
      return deleteRun(args);
    });

    const { fullStream } = await api.agent.stream('Where is my order?');
    for await (const _ of fullStream);

    await expect.poll(() => worker.ended()).toMatchObject([{ outcome: 'error' }]);
    await expect.poll(() => rejected).toBeGreaterThan(1);
    await expect.poll(unbalanced).toEqual({ open: [], endedTwice: [] });
  }, 15_000);

  const deny = (ms = 0) => ({
    require: async (user: any, { resource, permission }: any) => {
      if (!resource.id.includes('lookup')) return;
      await setTimeout(ms);
      throw new FGADeniedError(user, resource, permission);
    },
  });
  const withoutLeases = { leases: false };
  const withoutFencing = { fenced: false };

  it.each([
    { pause: 'before', deniedAfter: 150, pausedAfter: 0 },
    { pause: 'with', deniedAfter: 0, pausedAfter: 0 },
    { pause: 'after', deniedAfter: 0, pausedAfter: 400 },
    { pause: 'for an approval after', deniedAfter: 0, pausedAfter: 400, options: { requireToolApproval: true } },
    { pause: 'before', deniedAfter: 150, pausedAfter: 0, setup: withoutLeases },
    { pause: 'after', deniedAfter: 0, pausedAfter: 400, setup: withoutLeases },
    { pause: 'after', deniedAfter: 0, pausedAfter: 400, setup: withoutFencing },
  ])(
    'ends spans once when a tool call pauses $pause a denied one ($setup)',
    async ({ setup, ...times }) => {
      const call = (name: string) => ({ id: `${name}-1`, name, arguments: {} });
      getMock().on({ endpoint: 'chat' }, { toolCalls: [call('pause'), call('lookup')] });
      const { api, worker } = await split(
        { tools: { pause: pauseAfter(times.pausedAfter, times.options), lookup: lookup() } },
        { fga: deny(times.deniedAfter), ...setup },
      );

      const requestContext = new RequestContext([['user', { id: 'user-1' }]]);
      const { fullStream } = await api.agent.stream('Where is my order?', { requestContext });
      for await (const _ of fullStream);

      await setTimeout(1_000);
      for (const type of [SpanType.AGENT_RUN, SpanType.MODEL_GENERATION, SpanType.MODEL_STEP]) {
        expect([...worker.ended(type), ...api.ended(type)]).toHaveLength(1);
      }
    },
    15_000,
  );

  it.each([{}, withoutLeases, withoutFencing])(
    'ends every span once when a tool call is denied beside one that succeeds (%j)',
    async setup => {
      const call = (name: string) => ({ id: `${name}-1`, name, arguments: {} });
      getMock().on({ endpoint: 'chat' }, { toolCalls: [call('other'), call('lookup')] });
      const { api, worker, unbalanced } = await split(
        { tools: { other: lookup({ id: 'other' }), lookup: lookup() } },
        { fga: deny(), ...setup },
      );

      const requestContext = new RequestContext([['user', { id: 'user-1' }]]);
      const { fullStream } = await api.agent.stream('Where is my order?', { requestContext });
      for await (const _ of fullStream);

      for (const type of [SpanType.AGENT_RUN, SpanType.MODEL_GENERATION, SpanType.MODEL_STEP]) {
        await expect.poll(() => [...worker.ended(type), ...api.ended(type)]).toHaveLength(1);
      }
      expect(unbalanced()).toMatchObject({ endedTwice: [] });
    },
    15_000,
  );

  it('ends every span once when the run fails after an approval', async () => {
    getMock().on({ endpoint: 'chat' }, { toolCalls: [{ id: 'lookup-1', name: 'lookup', arguments: {} }] });
    const { api, worker, unbalanced } = await split({
      tools: { lookup: lookup({ toModelOutput, requireApproval: true }) },
    });

    const { runId, fullStream } = await api.agent.stream('Where is my order?');
    for await (const chunk of fullStream) if (chunk.type === 'tool-call-approval') break;
    await expect.poll(() => worker.ended().length).toBe(1);
    const resumed = await api.agent.approveToolCall({ runId, toolCallId: 'lookup-1' });
    for await (const _ of resumed.fullStream);

    for (const type of [SpanType.AGENT_RUN, SpanType.MODEL_GENERATION]) {
      await expect
        .poll(() => [...worker.ended(type), ...api.ended(type)].map(span => span.outcome).sort())
        .toEqual(['error', 'suspend']);
    }
    await expect.poll(unbalanced).toMatchObject({ endedTwice: [] });
  }, 15_000);

  it('ends the spans of an output stream processor when the run succeeds', async () => {
    const llm = getMock();
    llm.on(
      { endpoint: 'chat', hasToolResult: false },
      { toolCalls: [{ id: 'lookup-1', name: 'lookup', arguments: {} }] },
    );
    llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Shipped.' });
    const { api, worker, unbalanced } = await split({
      tools: { lookup: lookup() },
      outputProcessors: [{ id: 'pass-through', processOutputStream: async ({ part }: any) => part }],
    });

    expect(await (await api.agent.stream('Where is my order?')).text).toBe('Shipped.');
    await expect.poll(() => worker.ended().length).toBe(1);

    await expect.poll(unbalanced).toEqual({ open: [], endedTwice: [] });
  }, 15_000);
});
