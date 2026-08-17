import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import type { MastraDBMessage, MastraMessageContentV2 } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore, InMemoryMemory, InMemoryDB } from '@mastra/core/storage';
import type { MastraEmbeddingModel, MastraVector } from '@mastra/core/vector';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Memory, Subconscious } from '../../../index';
import { ObservationStep } from '../observation-turn/step';
import { ObservationalMemory } from '../observational-memory';

const scope = ['org:acme', 'resource:user-42', 'thread:alpha'];
const semanticInfrastructure = {
  vector: {} as MastraVector,
  embedder: {} as MastraEmbeddingModel<string>,
};

function createMemory(options?: { omModel?: string | false }) {
  return new Memory({
    storage: new InMemoryStore(),
    ...semanticInfrastructure,
    options: {
      observationalMemory: {
        ...(options?.omModel === false ? {} : { model: options?.omModel ?? 'openai/om-model' }),
        experimental_subconscious: new Subconscious({ defaultScope: 'resource', maxScope: 'resource' }),
      },
    },
  });
}

function requestContext() {
  const context = new RequestContext();
  context.set('organizationId', 'acme');
  return context;
}

async function seedItem(memory: Memory, text = 'Atlas launches soon.') {
  const store = (await memory.storage.getStore('knowledge'))!;
  const node = await store.createNode({ name: 'Project Atlas', kind: 'project', scope });
  return store.appendItem({
    parentNodeId: node.id,
    text,
    scope,
    sourceThreadId: 'alpha',
    resolutionScope: scope,
    defaultScope: scope,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Memory.runCuration', () => {
  it('runs the curate agent over the pending worklist and advances the cursor without reflection', async () => {
    const memory = createMemory();
    const item = await seedItem(memory);
    const generate = vi
      .spyOn(Agent.prototype, 'generate')
      .mockResolvedValue({ text: `<curation-complete through="${item.id}" />` } as any);
    generate.mockClear();

    const result = await memory.runCuration({
      threadId: 'alpha',
      resourceId: 'user-42',
      requestContext: requestContext(),
    });

    expect(result.outcome).toBe('ran');
    expect(generate).toHaveBeenCalledOnce();
    const store = (await memory.storage.getStore('knowledge'))!;
    expect(await store.getCurationCursor({ sourceThreadId: 'alpha', agent: 'curate' })).toMatchObject({
      lastItemId: item.id,
    });
  });

  it('reports no-op when the worklist and prompt are both empty', async () => {
    const memory = createMemory();
    const generate = vi.spyOn(Agent.prototype, 'generate');
    generate.mockClear();

    const result = await memory.runCuration({
      threadId: 'alpha',
      resourceId: 'user-42',
      requestContext: requestContext(),
    });

    expect(result.outcome).toBe('no-op');
    expect(generate).not.toHaveBeenCalled();
  });

  it('threads the phase prompt into the curator run even with an empty worklist', async () => {
    const memory = createMemory();
    const generate = vi.spyOn(Agent.prototype, 'generate').mockResolvedValue({ text: 'Nothing to keep.' } as any);
    generate.mockClear();

    const result = await memory.runCuration({
      threadId: 'alpha',
      resourceId: 'user-42',
      requestContext: requestContext(),
      prompt: 'Now that the work item has left the build phase: anything worth remembering?',
    });

    expect(result.outcome).toBe('ran');
    expect(generate).toHaveBeenCalledWith(expect.stringContaining('left the build phase'), expect.objectContaining({}));
  });

  it('skips when a curation for the same thread is already in flight', async () => {
    const memory = createMemory();
    const item = await seedItem(memory);
    let release!: (value: any) => void;
    const pending = new Promise(resolve => {
      release = resolve;
    });
    const generate = vi.spyOn(Agent.prototype, 'generate').mockReturnValue(pending as any);
    generate.mockClear();

    const first = memory.runCuration({ threadId: 'alpha', resourceId: 'user-42', requestContext: requestContext() });
    // Give the first call a tick to enter the handler and register in flight.
    await new Promise(resolve => setTimeout(resolve, 10));
    const second = await memory.runCuration({
      threadId: 'alpha',
      resourceId: 'user-42',
      requestContext: requestContext(),
    });

    expect(second.outcome).toBe('skipped');
    // Resolve the dangling curation so the first call settles cleanly.
    release({ text: `<curation-complete through="${item.id}" />` });
    expect((await first).outcome).toBe('ran');
  });

  it('maps a missing model to the no-model outcome instead of throwing', async () => {
    const memory = createMemory({ omModel: false });
    await seedItem(memory);

    const result = await memory.runCuration({
      threadId: 'alpha',
      resourceId: 'user-42',
      requestContext: requestContext(),
    });

    expect(result.outcome).toBe('no-model');
  });
});

describe('curation trigger config resolution', () => {
  it('validates curationThreshold as a positive integer or false', () => {
    expect(() => new Subconscious({ curationThreshold: 0 })).toThrow('positive integer');
    expect(() => new Subconscious({ curationThreshold: 1.5 })).toThrow('positive integer');
    expect(new Subconscious({ curationThreshold: 3 }).resolved.curationThreshold).toBe(3);
    expect(new Subconscious({ curationThreshold: false }).resolved.curationThreshold).toBe(false);
  });

  it('validates curationInterval as a positive number of milliseconds or false', () => {
    expect(() => new Subconscious({ curationInterval: -1 })).toThrow('positive number');
    expect(new Subconscious({ curationInterval: 5_000 }).resolved.curationIntervalMs).toBe(5_000);
    expect(new Subconscious({ curationInterval: false }).resolved.curationIntervalMs).toBe(false);
  });

  it('turns both triggers on by default', () => {
    const resolved = new Subconscious({}).resolved;
    expect(resolved.curationThreshold).toBe(20);
    expect(resolved.curationIntervalMs).toBe(60 * 60 * 1000);
  });
});

// =============================================================================
// Curation triggers (engine level)
//
// Two harnesses live in this file on purpose. Tests below drive om.observe()
// directly with buffering off; the async-buffer tests at the bottom construct a
// real ObservationTurn because only a Turn carries a requestContext. Do not
// unify them.
// =============================================================================

function createTestMessage(content: string, role: 'user' | 'assistant', id: string): MastraDBMessage {
  return {
    id,
    role,
    content: { format: 2, parts: [{ type: 'text', text: content }] } as MastraMessageContentV2,
    type: 'text',
    createdAt: new Date(),
  };
}

function createBulkMessages(count: number, threadId: string, offset = 0): MastraDBMessage[] {
  return Array.from({ length: count }, (_, i) => ({
    ...createTestMessage(
      `Message ${offset + i}: `.padEnd(200, 'x'),
      i % 2 === 0 ? 'user' : 'assistant',
      `${threadId}-msg-${offset + i}`,
    ),
    threadId,
  }));
}

function createMockModel(text: string) {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      warnings: [],
      content: [{ type: 'text', text }],
    }),
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'obs-1', modelId: 'mock-observer', timestamp: new Date() },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 } },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  } as any);
}

/**
 * The seeded facts must carry exactly the scope resolveCurationScope builds from
 * the request context, and the same sourceThreadId as the observed thread. If they
 * diverge, listItemsBySource returns nothing and every trigger test fails as
 * "the trigger never fired" while the implementation is fine.
 */
async function seedPendingItems(store: any, options: { threadId: string; count: number; organizationId?: string }) {
  const orgId = options.organizationId ?? 'acme';
  const factScope = [`org:${orgId}`, `resource:${options.threadId}`, `thread:${options.threadId}`];
  const node = await store.createNode({
    name: `Entity for ${options.threadId}`,
    kind: 'entity',
    scope: factScope,
  });
  const ids: string[] = [];
  for (let i = 0; i < options.count; i++) {
    const item = await store.appendItem({
      parentNodeId: node.id,
      text: `Pending knowledge ${i} for ${options.threadId}.`,
      scope: factScope,
      sourceThreadId: options.threadId,
      resolutionScope: factScope,
      defaultScope: factScope,
    });
    ids.push(item.id);
  }
  return { node, ids };
}

async function createTriggerEngine(options: {
  threshold?: number | false;
  interval?: number | false;
  runCuration?: any;
}) {
  const knowledgeStorage = new InMemoryStore();
  const store = (await knowledgeStorage.getStore('knowledge'))!;
  const runCuration = options.runCuration ?? vi.fn(async () => ({ outcome: 'ran' }));
  const om = new ObservationalMemory({
    storage: new InMemoryMemory({ db: new InMemoryDB() }),
    scope: 'thread',
    memory: { runCuration, storage: knowledgeStorage } as any,
    curationThreshold: options.threshold ?? false,
    curationInterval: options.interval ?? false,
    observation: {
      model: createMockModel('<observations>\n* Something happened\n</observations>'),
      messageTokens: 100,
      bufferTokens: false,
    },
    reflection: {
      model: createMockModel('<observations>\n* Condensed\n</observations>'),
      observationTokens: 50_000,
    },
  } as any);
  return { om, store, runCuration };
}

async function observeOnce(om: ObservationalMemory, threadId: string, run = 0) {
  const result = await om.observe({
    threadId,
    resourceId: threadId,
    messages: createBulkMessages(10, threadId, run * 10),
    requestContext: requestContext(),
  });
  // The trigger is fire-and-forget; let it settle.
  await new Promise(resolve => setTimeout(resolve, 20));
  return result;
}

describe('curation triggers', () => {
  it('fires on accumulated knowledge volume', async () => {
    const { om, store, runCuration } = await createTriggerEngine({ threshold: 3 });
    const threadId = 'volume-thread';
    await seedPendingItems(store, { threadId, count: 3 });

    await observeOnce(om, threadId);

    expect(runCuration).toHaveBeenCalledOnce();
    expect(runCuration).toHaveBeenCalledWith(expect.objectContaining({ threadId, requestContext: expect.anything() }));
  });

  it('does not fire before the threshold is met', async () => {
    const { om, store, runCuration } = await createTriggerEngine({ threshold: 5 });
    const threadId = 'under-threshold-thread';
    await seedPendingItems(store, { threadId, count: 3 });

    await observeOnce(om, threadId);

    expect(runCuration).not.toHaveBeenCalled();
  });

  it('fires on elapsed time when the volume threshold is unmet', async () => {
    const { om, store, runCuration } = await createTriggerEngine({ threshold: 50, interval: 20 });
    const threadId = 'time-thread';
    const { ids } = await seedPendingItems(store, { threadId, count: 2 });
    // Curated through the first fact; one update stays pending behind the cursor.
    await store.advanceCurationCursor({ sourceThreadId: threadId, agent: 'curate', lastItemId: ids[0]! });
    await new Promise(resolve => setTimeout(resolve, 40));

    await observeOnce(om, threadId);

    expect(runCuration).toHaveBeenCalledOnce();
  });

  it('falls back to the oldest pending fact when the thread has never been curated', async () => {
    const { om, store, runCuration } = await createTriggerEngine({ threshold: 50, interval: 1 });
    const threadId = 'never-curated-thread';
    await seedPendingItems(store, { threadId, count: 1 });
    await new Promise(resolve => setTimeout(resolve, 5));

    await observeOnce(om, threadId);

    expect(runCuration).toHaveBeenCalledOnce();
  });

  it('costs nothing when nothing is pending', async () => {
    const { om, runCuration } = await createTriggerEngine({ threshold: 1, interval: 1 });
    const threadId = 'idle-thread';

    await observeOnce(om, threadId);
    await observeOnce(om, threadId, 1);

    expect(runCuration).not.toHaveBeenCalled();
  });

  it('fires nothing when both triggers are disabled', async () => {
    const { om, store, runCuration } = await createTriggerEngine({ threshold: false, interval: false });
    const threadId = 'disabled-thread';
    await seedPendingItems(store, { threadId, count: 40 });

    await observeOnce(om, threadId);

    expect(runCuration).not.toHaveBeenCalled();
  });

  it('reads pending knowledge with one bounded query', async () => {
    const { om, store } = await createTriggerEngine({ threshold: 4 });
    const threadId = 'bounded-thread';
    await seedPendingItems(store, { threadId, count: 4 });
    const spy = vi.spyOn(store, 'listItemsBySource');

    await observeOnce(om, threadId);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ sourceThreadId: threadId, limit: 4 }));
  });

  it('reads a single row when only the time trigger is enabled', async () => {
    const { om, store } = await createTriggerEngine({ threshold: false, interval: 60_000 });
    const threadId = 'time-only-thread';
    await seedPendingItems(store, { threadId, count: 4 });
    const spy = vi.spyOn(store, 'listItemsBySource');

    await observeOnce(om, threadId);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ limit: 1 }));
  });

  it('does not re-fire the time trigger while the cursor stays behind', async () => {
    const runCuration = vi.fn(async () => ({ outcome: 'no-op' }));
    const { om, store } = await createTriggerEngine({ threshold: 50, interval: 200, runCuration });
    const threadId = 'repeat-fire-thread';
    const { ids } = await seedPendingItems(store, { threadId, count: 2 });
    await store.advanceCurationCursor({ sourceThreadId: threadId, agent: 'curate', lastItemId: ids[0]! });
    await new Promise(resolve => setTimeout(resolve, 250));

    // A curation that returns no-op leaves the cursor behind, so the elapsed-time
    // condition stays true. The last-attempt guard is what stops it re-firing.
    await observeOnce(om, threadId);
    await observeOnce(om, threadId, 1);

    expect(runCuration).toHaveBeenCalledOnce();
  });

  it('counts the same scope the curation it triggers will read', async () => {
    const { om, store, runCuration } = await createTriggerEngine({ threshold: 2 });
    const threadId = 'no-resource-thread';
    // Seeded under the thread id as the resource rung, which is what runCuration
    // falls back to when no resourceId is supplied.
    await seedPendingItems(store, { threadId, count: 2 });

    await om.observe({
      threadId,
      messages: createBulkMessages(10, threadId),
      requestContext: requestContext(),
    });
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(runCuration).toHaveBeenCalledWith(expect.objectContaining({ threadId, resourceId: threadId }));
  });

  it('throttles the volume trigger after a curation that changed nothing', async () => {
    const runCuration = vi.fn(async () => ({ outcome: 'no-op' }));
    const { om, store } = await createTriggerEngine({ threshold: 2, interval: 60_000, runCuration });
    const threadId = 'volume-backoff-thread';
    await seedPendingItems(store, { threadId, count: 4 });

    // The cursor never advances, so the pending count stays above the threshold.
    // Without the backoff this fires a full curator run on every observation.
    await observeOnce(om, threadId);
    await observeOnce(om, threadId, 1);
    await observeOnce(om, threadId, 2);

    expect(runCuration).toHaveBeenCalledOnce();
  });

  it('lets the volume trigger fire again once curation advances the cursor', async () => {
    let store: any;
    const runCuration = vi.fn(async ({ threadId }: any) => {
      // A curator that actually processes its worklist advances the cursor.
      const { items } = await store.listItemsBySource({
        sourceThreadId: threadId,
        scope: [`org:acme`, `resource:${threadId}`, `thread:${threadId}`],
        limit: 1,
      });
      await store.advanceCurationCursor({ sourceThreadId: threadId, agent: 'curate', lastItemId: items[0]!.id });
      return { outcome: 'ran' };
    });
    const engine = await createTriggerEngine({ threshold: 2, interval: 60_000, runCuration });
    store = engine.store;
    const threadId = 'volume-progress-thread';
    await seedPendingItems(store, { threadId, count: 6 });

    await observeOnce(engine.om, threadId);
    await observeOnce(engine.om, threadId, 1);

    // Progress lifts the backoff, so a busy thread is never throttled by it.
    expect(runCuration).toHaveBeenCalledTimes(2);
  });

  it('never fails an observation when curation throws', async () => {
    const runCuration = vi.fn(async () => {
      throw new Error('curator exploded');
    });
    const { om, store } = await createTriggerEngine({ threshold: 1, runCuration });
    const threadId = 'throwing-curation-thread';
    await seedPendingItems(store, { threadId, count: 2 });

    const result = await observeOnce(om, threadId);

    expect(result.observed).toBe(true);
    expect(runCuration).toHaveBeenCalled();
  });

  it('never fails an observation when the knowledge domain is absent', async () => {
    const runCuration = vi.fn(async () => ({ outcome: 'ran' }));
    const om = new ObservationalMemory({
      storage: new InMemoryMemory({ db: new InMemoryDB() }),
      scope: 'thread',
      memory: { runCuration, storage: { getStore: async () => undefined } } as any,
      curationThreshold: 1,
      curationInterval: 1,
      observation: {
        model: createMockModel('<observations>\n* Something happened\n</observations>'),
        messageTokens: 100,
        bufferTokens: false,
      },
      reflection: {
        model: createMockModel('<observations>\n* Condensed\n</observations>'),
        observationTokens: 50_000,
      },
    } as any);

    const result = await observeOnce(om, 'no-knowledge-domain-thread');

    expect(result.observed).toBe(true);
    expect(runCuration).not.toHaveBeenCalled();
  });

  it('never fails an observation when the request context has no organizationId', async () => {
    const { om, store, runCuration } = await createTriggerEngine({ threshold: 1 });
    const threadId = 'no-org-thread';
    await seedPendingItems(store, { threadId, count: 2 });

    const result = await om.observe({
      threadId,
      resourceId: threadId,
      messages: createBulkMessages(10, threadId),
      requestContext: new RequestContext(),
    });
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(result.observed).toBe(true);
    expect(runCuration).not.toHaveBeenCalled();
  });

  it('no longer persists an observation-run counter', async () => {
    const { om, store } = await createTriggerEngine({ threshold: 50 });
    const threadId = 'counter-thread';
    await seedPendingItems(store, { threadId, count: 1 });

    await observeOnce(om, threadId);
    await observeOnce(om, threadId, 1);

    const record = await om.getRecord(threadId);
    expect((record?.config as any)?.subconscious?.observationRuns).toBeUndefined();
  });
});

// =============================================================================
// Async-buffer activation path (turn/step level)
//
// Second harness, deliberately separate from the engine harness above: these
// drive the real ObservationStep branch that commits buffered knowledge and
// returns WITHOUT calling observe(), which is the only place the async-buffer
// lane can trigger a curation. The OM dependency is a spy set (the model-bearing
// collaborators), so what these prove is the hook's call site and the context it
// passes — the trigger's own arithmetic is covered against a real store above.
// =============================================================================

function createStepMessageList(count: number) {
  const messages = createBulkMessages(count, 'activation-thread');
  return {
    get: { all: { db: () => messages } },
    makeMessageSourceChecker: () => ({ context: new Set<string>() }),
  } as any;
}

function createStepHarness(options: { activated: boolean }) {
  const record = { id: 'rec-activation', observationTokenCount: 0 } as any;
  const maybeTriggerCuration = vi.fn(async () => {});
  const observe = vi.fn(async () => ({ observed: true, reflected: false, record }));
  const om = {
    waitForBuffering: vi.fn(async () => {}),
    getStatus: vi.fn(async () => ({ shouldObserve: true, canActivate: true, record })),
    activate: vi.fn(async () => ({ activated: options.activated, record, activatedMessageIds: ['msg-1'] })),
    observe,
    maybeTriggerCuration,
    composeHooks: vi.fn(() => undefined),
    sealMessagesForBuffering: vi.fn(() => {}),
    reflector: { maybeReflect: vi.fn(async () => {}) },
    observer: { lastExchange: undefined },
  } as any;
  const turnRequestContext = requestContext();
  const turn = {
    om,
    threadId: 'activation-thread',
    resourceId: 'activation-resource',
    messageList: createStepMessageList(4),
    requestContext: turnRequestContext,
    writer: undefined,
    actorModelContext: undefined,
    observabilityContext: undefined,
    responseMessageId: undefined,
    refreshRecord: vi.fn(async () => {}),
    setRecord: vi.fn(() => {}),
  } as any;
  const step = new ObservationStep(turn, 1);
  return { step, om, turn, turnRequestContext, maybeTriggerCuration, observe };
}

describe('curation triggers on the async-buffer activation path', () => {
  it('triggers curation when a buffered activation commits without observing', async () => {
    const { step, om, turnRequestContext, maybeTriggerCuration, observe } = createStepHarness({ activated: true });

    const result = await (step as any).runThresholdObservation();

    expect(result.succeeded).toBe(true);
    expect(om.activate).toHaveBeenCalledOnce();
    // The activation branch returns without observing, so observe()'s own
    // trigger cannot cover this turn.
    expect(observe).not.toHaveBeenCalled();
    expect(maybeTriggerCuration).toHaveBeenCalledOnce();
    expect(maybeTriggerCuration).toHaveBeenCalledWith('activation-thread', 'activation-resource', turnRequestContext);
  });

  it('hooks the activation branch only, leaving the sync path to observe()', async () => {
    const { step, om, maybeTriggerCuration, observe } = createStepHarness({ activated: false });

    await (step as any).runThresholdObservation();

    // Activation failed, so the step falls through to the sync observation block
    // and observe()'s own trigger owns this turn. The two hooks are structurally
    // exclusive within a step rather than merely untriggered.
    expect(om.activate).toHaveBeenCalledOnce();
    expect(observe).toHaveBeenCalledOnce();
    expect(maybeTriggerCuration).not.toHaveBeenCalled();
  });
});
