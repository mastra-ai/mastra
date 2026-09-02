import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import type { MastraEmbeddingModel, MastraVector } from '@mastra/core/vector';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Memory, Subconscious } from '../../../index';
import { omError } from '../debug';
import {
  AsyncBufferObservationStrategy,
  ObservationStrategy,
  ResourceScopedObservationStrategy,
  SyncObservationStrategy,
} from '../observation-strategies';
import type { ProcessedObservation } from '../observation-strategies';
import type { ObservationalMemoryModel } from '../types';

vi.mock('../debug', async importOriginal => {
  const actual = await importOriginal<typeof import('../debug')>();
  return { ...actual, omError: vi.fn(actual.omError) };
});

const semanticInfrastructure = {
  vector: {} as MastraVector,
  embedder: {} as MastraEmbeddingModel<string>,
};

function createMockObserverModel(observations = 'User confirmed Project Atlas launches on 2026-09-15.') {
  const text = `<observations>\n${observations}\n</observations>\n<current-task>Continue the launch work.</current-task>`;
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop' as const,
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      warnings: [],
      content: [{ type: 'text' as const, text }],
    }),
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start' as const, warnings: [] },
        { type: 'response-metadata' as const, id: 'observer-1', modelId: 'mock-observer', timestamp: new Date() },
        { type: 'text-start' as const, id: 'text-1' },
        { type: 'text-delta' as const, id: 'text-1', delta: text },
        { type: 'text-end' as const, id: 'text-1' },
        {
          type: 'finish' as const,
          finishReason: 'stop' as const,
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  } as any);
}

function createMemory(options?: { omModel?: ObservationalMemoryModel | false }) {
  return new Memory({
    storage: new InMemoryStore(),
    ...semanticInfrastructure,
    options: {
      observationalMemory: {
        ...(options?.omModel === false ? {} : { model: options?.omModel ?? 'openai/om-model' }),
        observation: { messageTokens: 1, bufferTokens: false },
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

async function seedMessages(memory: Memory, threadId = 'alpha', resourceId = 'user-42') {
  const now = new Date();
  const messageStore = (await memory.storage.getStore('memory'))!;
  await messageStore.saveMessages({
    messages: [
      {
        id: `${threadId}-user`,
        threadId,
        resourceId,
        role: 'user',
        content: { format: 2, parts: [{ type: 'text', text: 'Project Atlas launch details. '.repeat(20) }] },
        createdAt: now,
      },
      {
        id: `${threadId}-assistant`,
        threadId,
        resourceId,
        role: 'assistant',
        content: { format: 2, parts: [{ type: 'text', text: 'Understood. '.repeat(20) }] },
        createdAt: new Date(now.getTime() + 1),
      },
    ] as MastraDBMessage[],
  });
}

function createStrategyHarness(options: {
  mode: 'sync' | 'async-buffer' | 'resource';
  cycleObservations: ProcessedObservation['cycleObservations'];
  stale?: boolean;
  observeError?: Error;
  /** Turn-scoped resources handed to the strategy, to prove they never reach post-commit work. */
  turn?: {
    writer?: { custom: ReturnType<typeof vi.fn> };
    sendStateSignal?: ReturnType<typeof vi.fn>;
    abortSignal?: AbortSignal;
  };
  committedImpl?: (context: { parentThreadId: string }) => Promise<void>;
}) {
  const events: string[] = [];
  const backgroundWork: Promise<unknown>[] = [];
  const record = {
    id: 'record-1',
    threadId: options.mode === 'resource' ? null : 'alpha',
    resourceId: 'user-42',
    activeObservations: null,
    observationTokenCount: 0,
    lastObservedAt: options.stale ? new Date(0) : null,
    generationCount: 0,
    bufferedObservationChunks: null,
    isBufferingObservation: false,
    lastBufferedAt: null,
    config: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;
  const committed = vi.fn(async (context: { parentThreadId: string }) => {
    await options.committedImpl?.(context);
    events.push(`curate:${context.parentThreadId}`);
  });
  const reflector = {
    maybeReflect: vi.fn(async () => {
      events.push('reflect');
    }),
  };
  const storage = {
    getObservationalMemory: vi.fn(async () => (options.stale ? { ...record, lastObservedAt: new Date(1) } : record)),
  };
  const om = {
    getStorage: () => storage,
    getMemory: () => undefined,
    getMessageHistory: () => ({ persistMessages: vi.fn() }),
    getTokenCounter: () => ({}),
    getObservationConfig: () => ({ messageTokens: 1, bufferTokens: false }),
    getReflectionConfig: () => ({ observationTokens: 50_000 }),
    scope: options.mode === 'resource' ? 'resource' : 'thread',
    retrieval: false,
    observer: {},
    reflector,
    observedMessageIds: new Set<string>(),
    getObscureThreadIds: () => false,
    onIndexObservations: undefined,
    getOnObservationCommitted: () => committed,
    trackBackgroundWork: (work: Promise<unknown>) => {
      backgroundWork.push(work);
      return work;
    },
    emitDebugEvent: vi.fn(),
  } as any;
  const strategy = ObservationStrategy.create(om, {
    record,
    threadId: 'alpha',
    resourceId: 'user-42',
    messages: [],
    ...(options.mode === 'async-buffer' ? { cycleId: 'idle-cycle' } : {}),
    ...(options.turn?.writer ? { writer: options.turn.writer as any } : {}),
    ...(options.turn?.sendStateSignal ? { sendStateSignal: options.turn.sendStateSignal as any } : {}),
    ...(options.turn?.abortSignal ? { abortSignal: options.turn.abortSignal } : {}),
  });
  const processed: ProcessedObservation = {
    observations: 'persisted observations',
    cycleObservations: options.cycleObservations,
    observationTokens: 4,
    cycleObservationTokens: 2,
    observedMessageIds: [],
    lastObservedAt: new Date(),
  };
  vi.spyOn(strategy, 'prepare').mockResolvedValue({ messages: [], existingObservations: '' });
  vi.spyOn(strategy, 'observe').mockImplementation(async () => {
    if (options.observeError) throw options.observeError;
    return { observations: 'raw observation' };
  });
  vi.spyOn(strategy, 'process').mockResolvedValue(processed);
  vi.spyOn(strategy, 'persist').mockImplementation(async () => {
    events.push('persist');
  });
  vi.spyOn(strategy, 'emitStartMarkers').mockResolvedValue(undefined);
  vi.spyOn(strategy, 'emitEndMarkers').mockImplementation(async () => {
    events.push('end');
  });
  vi.spyOn(strategy, 'emitFailedMarkers').mockImplementation(async () => {
    events.push('failed');
  });

  return { strategy, committed, reflector, storage, events, settleBackgroundWork: () => Promise.all(backgroundWork) };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(omError).mockClear();
});

describe('direct observation curation', () => {
  it('directly curates the persisted observation delta without worklist calls', async () => {
    const observation = 'User confirmed Project Atlas launches on 2026-09-15.';
    const memory = createMemory({ omModel: createMockObserverModel(observation) });
    const store = (await memory.storage.getStore('knowledge'))!;
    const worklist = vi.spyOn(store, 'knowledgeBySource');
    const getCursor = vi.spyOn(store, 'getCurationCursor');
    const advanceCursor = vi.spyOn(store, 'advanceCurationCursor');
    const generate = vi.spyOn(Agent.prototype, 'generate').mockResolvedValue({ text: 'Done.' } as any);
    await seedMessages(memory);

    const om = await memory.omEngine;
    expect(om).not.toBeNull();
    const result = await om!.observe({
      threadId: 'alpha',
      resourceId: 'user-42',
      requestContext: requestContext(),
    });

    expect(result.observed).toBe(true);
    await memory.settled();
    expect(generate).toHaveBeenCalledWith(expect.stringContaining(observation), expect.objectContaining({}));
    expect(worklist).not.toHaveBeenCalled();
    expect(getCursor).not.toHaveBeenCalled();
    expect(advanceCursor).not.toHaveBeenCalled();
  });

  it('resolves the observation cycle before curator completion while settlement waits', async () => {
    const memory = createMemory({ omModel: createMockObserverModel() });
    await seedMessages(memory);

    let releaseCurator!: () => void;
    const curatorFinished = new Promise<void>(resolve => {
      releaseCurator = resolve;
    });
    vi.spyOn(Agent.prototype, 'generate').mockImplementation(async () => {
      await curatorFinished;
      return { text: 'Done.' } as any;
    });

    const om = (await memory.omEngine)!;
    let observationResolved = false;
    const observation = om
      .observe({ threadId: 'alpha', resourceId: 'user-42', requestContext: requestContext() })
      .then(result => {
        observationResolved = true;
        return result;
      });

    // The curator is started but still blocked, and the observation cycle must not wait on it.
    await vi.waitFor(() => expect(Agent.prototype.generate).toHaveBeenCalled());
    await vi.waitFor(() => expect(observationResolved).toBe(true));
    await expect(observation).resolves.toMatchObject({ observed: true });

    // Settlement, not the agent turn, owns the pending curator promise.
    let settled = false;
    const settlement = memory.settled().finally(() => {
      settled = true;
    });
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(settled).toBe(false);

    releaseCurator();
    await settlement;
    expect(settled).toBe(true);
  });

  it('isolates curator failure from a successfully persisted observation', async () => {
    const memory = createMemory({ omModel: createMockObserverModel() });
    await seedMessages(memory);
    const generate = vi.spyOn(Agent.prototype, 'generate').mockRejectedValue(new Error('curator unavailable'));

    const om = (await memory.omEngine)!;
    const result = await om.observe({
      threadId: 'alpha',
      resourceId: 'user-42',
      requestContext: requestContext(),
    });

    expect(result.observed).toBe(true);
    expect(result.record.activeObservations).toContain('Project Atlas launches on 2026-09-15');
    await memory.settled();
    expect(generate).toHaveBeenCalledTimes(1);
    expect(omError).toHaveBeenCalledWith(expect.stringContaining('curator unavailable'));
  });

  it.each([
    ['sync', SyncObservationStrategy],
    ['async-buffer idle activation', AsyncBufferObservationStrategy],
  ] as const)('delivers one committed delta after persistence for the %s path', async (mode, StrategyClass) => {
    const harness = createStrategyHarness({
      mode: mode === 'sync' ? 'sync' : 'async-buffer',
      cycleObservations: [{ sourceThreadId: 'alpha', observations: 'cycle delta' }],
    });

    expect(harness.strategy).toBeInstanceOf(StrategyClass);
    await expect(harness.strategy.run()).resolves.toMatchObject({ observed: true });
    expect(harness.events.slice(0, 2)).toEqual(['persist', 'end']);

    await harness.settleBackgroundWork();
    expect(harness.committed).toHaveBeenCalledTimes(1);
    expect(harness.events.at(-1)).toBe('curate:alpha');
  });

  it('delivers separate thread-attributed deltas for a two-thread resource cycle before reflection', async () => {
    const harness = createStrategyHarness({
      mode: 'resource',
      cycleObservations: [
        { sourceThreadId: 'alpha', observations: 'Alpha observation' },
        { sourceThreadId: 'beta', observations: 'Beta observation' },
      ],
    });

    expect(harness.strategy).toBeInstanceOf(ResourceScopedObservationStrategy);
    await expect(harness.strategy.run()).resolves.toMatchObject({ observed: true });
    expect(harness.events.slice(0, 2)).toEqual(['persist', 'end']);

    await harness.settleBackgroundWork();
    expect(harness.committed.mock.calls.map(([context]) => context.parentThreadId)).toEqual(['alpha', 'beta']);
    expect(harness.events).toEqual(['persist', 'end', 'reflect', 'curate:alpha', 'curate:beta']);
  });

  it('does not curate stale, failed, or aborted observation cycles', async () => {
    const stale = createStrategyHarness({
      mode: 'sync',
      stale: true,
      cycleObservations: [{ sourceThreadId: 'alpha', observations: 'stale' }],
    });
    await expect(stale.strategy.run()).resolves.toEqual({ observed: false });
    expect(stale.committed).not.toHaveBeenCalled();

    const failed = createStrategyHarness({
      mode: 'sync',
      observeError: new Error('observer failed'),
      cycleObservations: [{ sourceThreadId: 'alpha', observations: 'failed' }],
    });
    await expect(failed.strategy.run()).rejects.toThrow('observer failed');
    expect(failed.committed).not.toHaveBeenCalled();
    expect(failed.events).toEqual(['failed']);

    // The abort branch must see an actually-aborted signal, not just an AbortError-shaped failure.
    const abortController = new AbortController();
    abortController.abort(new DOMException('aborted', 'AbortError'));
    const aborted = createStrategyHarness({
      mode: 'async-buffer',
      observeError: new DOMException('aborted', 'AbortError'),
      cycleObservations: [{ sourceThreadId: 'alpha', observations: 'aborted' }],
      turn: { abortSignal: abortController.signal },
    });
    expect(abortController.signal.aborted).toBe(true);
    // Real abort contract (base.ts `if (abortSignal?.aborted) throw error`): the failed marker is
    // persisted, then the abort propagates. Without the signal this would have hit the generic
    // swallow branch and resolved `{ observed: false }`, which is not the abort path at all.
    await expect(aborted.strategy.run()).rejects.toThrow('aborted');
    expect(aborted.committed).not.toHaveBeenCalled();
    expect(aborted.events).toEqual(['failed']);
  });

  it('skips blank deltas and never retries a rejected curator callback', async () => {
    const harness = createStrategyHarness({
      mode: 'resource',
      cycleObservations: [
        { sourceThreadId: 'alpha', observations: '   ' },
        { sourceThreadId: 'beta', observations: 'durable fact' },
      ],
    });
    harness.committed.mockRejectedValueOnce(new Error('curator unavailable'));

    await expect(harness.strategy.run()).resolves.toMatchObject({ observed: true });
    expect(harness.events).toEqual(['persist', 'end', 'reflect']);

    await harness.settleBackgroundWork();
    expect(harness.committed).toHaveBeenCalledTimes(1);
    expect(harness.committed).toHaveBeenCalledWith(expect.objectContaining({ parentThreadId: 'beta' }));
    expect(harness.events).toEqual(['persist', 'end', 'reflect']);
    expect(omError).toHaveBeenCalledTimes(1);
    expect(omError).toHaveBeenCalledWith(expect.stringContaining('curator unavailable'));
  });

  it('hands post-commit work memory-owned data only and survives turn abort after persistence', async () => {
    const turnAbort = new AbortController();
    const writer = { custom: vi.fn() };
    const sendStateSignal = vi.fn();
    let releaseCurator!: () => void;
    const curatorGate = new Promise<void>(resolve => {
      releaseCurator = resolve;
    });
    const harness = createStrategyHarness({
      mode: 'sync',
      cycleObservations: [{ sourceThreadId: 'alpha', observations: 'durable fact' }],
      turn: { writer, sendStateSignal, abortSignal: turnAbort.signal },
      committedImpl: () => curatorGate,
    });

    await expect(harness.strategy.run()).resolves.toMatchObject({ observed: true });
    expect(harness.events).toEqual(['persist', 'end', 'reflect']);
    expect(harness.committed).toHaveBeenCalledTimes(1);

    // The turn is over: its stream and abort signal are torn down while curation is still pending.
    turnAbort.abort(new DOMException('turn closed', 'AbortError'));
    const [context] = harness.committed.mock.calls[0]!;
    expect(Object.keys(context).sort()).toEqual(
      ['mainAgent', 'observations', 'parentThreadId', 'requestContext', 'resourceId'].sort(),
    );
    expect(context).not.toHaveProperty('writer');
    expect(context).not.toHaveProperty('abortSignal');
    expect(context).not.toHaveProperty('sendStateSignal');
    expect(context).not.toHaveProperty('sendSignal');
    expect(context).not.toHaveProperty('observabilityContext');

    releaseCurator();
    await harness.settleBackgroundWork();
    expect(harness.events).toEqual(['persist', 'end', 'reflect', 'curate:alpha']);
    expect(writer.custom).not.toHaveBeenCalled();
    expect(sendStateSignal).not.toHaveBeenCalled();
    expect(omError).not.toHaveBeenCalled();
  });

  it('suppresses scheduling when the turn aborts before persistence', async () => {
    const turnAbort = new AbortController();
    turnAbort.abort(new DOMException('turn closed', 'AbortError'));
    const harness = createStrategyHarness({
      mode: 'sync',
      observeError: new DOMException('aborted', 'AbortError'),
      cycleObservations: [{ sourceThreadId: 'alpha', observations: 'never persisted' }],
      turn: { abortSignal: turnAbort.signal },
    });

    await expect(harness.strategy.run()).rejects.toThrow('aborted');
    await harness.settleBackgroundWork();
    expect(harness.committed).not.toHaveBeenCalled();
    expect(harness.events).toEqual(['failed']);
  });
});
