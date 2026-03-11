import { existsSync, readFileSync } from 'node:fs';

import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';

import { Memory } from '../../../index';
import {
  createOmTestAgent,
  createOmTestMemory,
  formatCacheRatio,
  getCacheHitRatio,
  logUsage,
  runStreamAndCollectUsage,
  seedActiveObservations,
  seedConversationTurns,
} from './cache-test-utils';

import { PersistableInMemoryStore } from './persistable-memory-test-util';

type StreamPart =
  | { type: 'stream-start'; warnings: unknown[] }
  | { type: 'response-metadata'; id: string; modelId: string; timestamp: Date }
  | { type: 'text-start'; id: string }
  | { type: 'text-delta'; id: string; delta: string }
  | { type: 'text-end'; id: string }
  | {
      type: 'finish';
      finishReason: 'stop';
      usage: { inputTokens: number; outputTokens: number; totalTokens: number };
    };

function createChangingObserverModel(label: string) {
  let callCount = 0;

  const buildText = () => {
    callCount += 1;
    return `<observations>\n## Date\n- 🔴 Observation ${label} ${callCount}: user asked for deep mastra research\n</observations>`;
  };

  return {
    specificationVersion: 'v2' as const,
    provider: 'mock-observer',
    modelId: `mock-observer-${label}`,
    defaultObjectGenerationMode: undefined,
    supportsImageUrls: false,
    supportedUrls: {},
    async doGenerate() {
      const text = buildText();
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 20, outputTokens: 20, totalTokens: 40 },
        content: [{ type: 'text' as const, text }],
        warnings: [],
      };
    },
    async doStream() {
      const text = buildText();
      const stream = new ReadableStream<StreamPart>({
        start(controller) {
          controller.enqueue({ type: 'stream-start', warnings: [] });
          controller.enqueue({
            type: 'response-metadata',
            id: 'obs-id',
            modelId: 'mock-observer',
            timestamp: new Date(),
          });
          controller.enqueue({ type: 'text-start', id: 'obs-text' });
          controller.enqueue({ type: 'text-delta', id: 'obs-text', delta: text });
          controller.enqueue({ type: 'text-end', id: 'obs-text' });
          controller.enqueue({
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 20, outputTokens: 20, totalTokens: 40 },
          });
          controller.close();
        },
      });

      return {
        stream,
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  };
}

function createStableObserverModel() {
  const stableText = `<observations>\n## Date\n- 🔴 Stable observation: user is researching Mastra docs deeply\n</observations>`;
  return {
    specificationVersion: 'v2' as const,
    provider: 'mock-observer',
    modelId: 'mock-observer-stable',
    defaultObjectGenerationMode: undefined,
    supportsImageUrls: false,
    supportedUrls: {},
    async doGenerate() {
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 20, outputTokens: 20, totalTokens: 40 },
        content: [{ type: 'text' as const, text: stableText }],
        warnings: [],
      };
    },
    async doStream() {
      const stream = new ReadableStream<StreamPart>({
        start(controller) {
          controller.enqueue({ type: 'stream-start', warnings: [] });
          controller.enqueue({
            type: 'response-metadata',
            id: 'obs-id',
            modelId: 'mock-observer',
            timestamp: new Date(),
          });
          controller.enqueue({ type: 'text-start', id: 'obs-text' });
          controller.enqueue({ type: 'text-delta', id: 'obs-text', delta: stableText });
          controller.enqueue({ type: 'text-end', id: 'obs-text' });
          controller.enqueue({
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 20, outputTokens: 20, totalTokens: 40 },
          });
          controller.close();
        },
      });

      return {
        stream,
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  };
}

function createChangingReflectorModel() {
  let callCount = 0;
  const getText = () => {
    callCount += 1;
    return `<observations>\n## Reflected\n- 🔴 Reflected summary revision ${callCount} with updated terms\n</observations>`;
  };

  return {
    specificationVersion: 'v2' as const,
    provider: 'mock-reflector',
    modelId: 'mock-reflector-changing',
    defaultObjectGenerationMode: undefined,
    supportsImageUrls: false,
    supportedUrls: {},
    async doGenerate() {
      const text = getText();
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 20, outputTokens: 20, totalTokens: 40 },
        content: [{ type: 'text' as const, text }],
        warnings: [],
      };
    },
    async doStream() {
      const text = getText();
      const stream = new ReadableStream<StreamPart>({
        start(controller) {
          controller.enqueue({ type: 'stream-start', warnings: [] });
          controller.enqueue({
            type: 'response-metadata',
            id: 'ref-id',
            modelId: 'mock-reflector',
            timestamp: new Date(),
          });
          controller.enqueue({ type: 'text-start', id: 'ref-text' });
          controller.enqueue({ type: 'text-delta', id: 'ref-text', delta: text });
          controller.enqueue({ type: 'text-end', id: 'ref-text' });
          controller.enqueue({
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 20, outputTokens: 20, totalTokens: 40 },
          });
          controller.close();
        },
      });

      return {
        stream,
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  };
}

const ACTOR_MODEL = 'openai/gpt-4.1-mini';

type PersistedSeedState = {
  threads?: Array<[string, { id?: string; resourceId?: string; updatedAt?: string }]>;
  messages?: Array<[string, { id?: string }]>;
};

function resolveSeedStateFilePath() {
  const candidates = [
    process.env.OM_SEED_STATE_FILE,
    'seed-om-session-state.json',
    'packages/memory/seed-om-session-state.json',
  ].filter((candidate): candidate is string => Boolean(candidate));

  return candidates.find(candidate => existsSync(candidate));
}

function loadSeedContext() {
  const stateFile = resolveSeedStateFilePath();
  if (!stateFile) {
    return null;
  }

  const state = JSON.parse(readFileSync(stateFile, 'utf-8')) as PersistedSeedState;
  const sortedThreads = [...(state.threads ?? [])].sort((a, b) => {
    const left = new Date(a[1]?.updatedAt ?? 0).getTime();
    const right = new Date(b[1]?.updatedAt ?? 0).getTime();
    return right - left;
  });

  const thread = sortedThreads[0]?.[1];
  const threadId = thread?.id;
  const resourceId = thread?.resourceId;
  const observedMessageIds = (state.messages ?? [])
    .map(([, message]) => message?.id)
    .filter((id): id is string => Boolean(id))
    .slice(0, 50);

  if (!threadId || !resourceId) {
    return null;
  }

  return { stateFile, threadId, resourceId, observedMessageIds };
}

async function createHydratedStore(stateFile: string) {
  const store = new PersistableInMemoryStore();
  await store.hydrate(stateFile);
  return store;
}

describe.skipIf(!process.env.OPENAI_API_KEY)('OM Cache Hit Rates (e2e)', () => {
  it('baseline: stable prompt should increase cache hit ratio on second call', async () => {
    const store = new InMemoryStore();
    const memory = new Memory({ storage: store });
    const agent = createOmTestAgent({
      memory,
      model: ACTOR_MODEL,
      instructions: 'You are a helpful assistant focused on concise research updates.',
      cacheControlled: true,
    });

    const threadId = 'cache-baseline-thread';
    const resourceId = 'cache-baseline-resource';

    await seedConversationTurns({ store, threadId, resourceId, turns: 14 });

    const first = await runStreamAndCollectUsage({
      agent,
      threadId,
      resourceId,
      prompt: 'Continue the Mastra deep research summary with any new patterns you see.',
    });
    const second = await runStreamAndCollectUsage({
      agent,
      threadId,
      resourceId,
      prompt: 'Continue with one additional concise finding from the same research path.',
    });

    logUsage('baseline-first', first.usage);
    logUsage('baseline-second', second.usage);

    expect(getCacheHitRatio(second.usage)).toBeGreaterThan(getCacheHitRatio(first.usage));
  }, 180_000);

  it('OM enabled with no observation/reflection firing should keep cache ratio high', async () => {
    const store = new InMemoryStore();
    const threadId = 'cache-om-stable-thread';
    const resourceId = 'cache-om-stable-resource';

    const observedMessageIds = await seedConversationTurns({ store, threadId, resourceId, turns: 14 });
    await seedActiveObservations({
      store,
      threadId,
      resourceId,
      activeObservations: '- 🔴 Stable seeded observation: user is iterating on Mastra internals',
      observedMessageIds,
    });

    const memory = createOmTestMemory(store, {
      enabled: true,
      observation: {
        model: createStableObserverModel(),
        messageTokens: 999_999,
        bufferTokens: false,
      },
      reflection: {
        model: createChangingReflectorModel(),
        observationTokens: 999_999,
      },
    });

    const agent = createOmTestAgent({
      memory,
      model: ACTOR_MODEL,
      instructions: 'You are a helpful assistant focused on concise research updates.',
      cacheControlled: true,
    });

    const first = await runStreamAndCollectUsage({
      agent,
      threadId,
      resourceId,
      prompt: 'Add one more detail from your Mastra deep-research notes.',
    });
    const second = await runStreamAndCollectUsage({
      agent,
      threadId,
      resourceId,
      prompt: 'Add one final detail while preserving the same context framing.',
    });

    logUsage('om-stable-first', first.usage);
    logUsage('om-stable-second', second.usage);

    expect(getCacheHitRatio(second.usage)).toBeGreaterThan(0.15);
  }, 180_000);

  it('observation change should reduce cache ratio versus stable OM scenario', async () => {
    const store = new InMemoryStore();
    const threadId = 'cache-obs-change-thread';
    const resourceId = 'cache-obs-change-resource';

    const observedMessageIds = await seedConversationTurns({ store, threadId, resourceId, turns: 14 });
    await seedActiveObservations({
      store,
      threadId,
      resourceId,
      activeObservations: '- 🔴 Seeded observation before forced observation rewrite',
      observedMessageIds,
    });

    const memoryChanging = createOmTestMemory(store, {
      enabled: true,
      observation: {
        model: createChangingObserverModel('obs-change'),
        messageTokens: 1,
        bufferTokens: false,
      },
      reflection: {
        model: createChangingReflectorModel(),
        observationTokens: 999_999,
      },
    });

    const changingAgent = createOmTestAgent({
      memory: memoryChanging,
      model: ACTOR_MODEL,
      instructions: 'You are a helpful assistant focused on concise research updates.',
      cacheControlled: true,
    });

    const firstChanging = await runStreamAndCollectUsage({
      agent: changingAgent,
      threadId,
      resourceId,
      prompt: 'Continue research and include one detail not previously mentioned.',
    });
    const secondChanging = await runStreamAndCollectUsage({
      agent: changingAgent,
      threadId,
      resourceId,
      prompt: 'Continue research and include one additional detail.',
    });

    logUsage('obs-change-first', firstChanging.usage);
    logUsage('obs-change-second', secondChanging.usage);

    const stableStore = new InMemoryStore();
    const stableThreadId = 'cache-obs-stable-thread';
    const stableResourceId = 'cache-obs-stable-resource';
    const stableObserved = await seedConversationTurns({
      store: stableStore,
      threadId: stableThreadId,
      resourceId: stableResourceId,
      turns: 14,
    });
    await seedActiveObservations({
      store: stableStore,
      threadId: stableThreadId,
      resourceId: stableResourceId,
      activeObservations: '- 🔴 Stable seeded observation for comparison',
      observedMessageIds: stableObserved,
    });

    const stableMemory = createOmTestMemory(stableStore, {
      enabled: true,
      observation: {
        model: createStableObserverModel(),
        messageTokens: 1,
        bufferTokens: false,
      },
      reflection: {
        model: createChangingReflectorModel(),
        observationTokens: 999_999,
      },
    });

    const stableAgent = createOmTestAgent({
      memory: stableMemory,
      model: ACTOR_MODEL,
      cacheControlled: true,
    });

    await runStreamAndCollectUsage({
      agent: stableAgent,
      threadId: stableThreadId,
      resourceId: stableResourceId,
      prompt: 'Warm up stable observer scenario for comparison.',
    });

    const secondStable = await runStreamAndCollectUsage({
      agent: stableAgent,
      threadId: stableThreadId,
      resourceId: stableResourceId,
      prompt: 'Second stable observer scenario call for comparison.',
    });

    logUsage('obs-stable-second', secondStable.usage);

    expect(getCacheHitRatio(secondChanging.usage)).toBeLessThan(getCacheHitRatio(secondStable.usage));
  }, 240_000);

  it('hydrated seed baseline: second prompt should produce cache hits', async () => {
    const seedContext = loadSeedContext();

    if (!seedContext) {
      console.warn('Skipping hydrated seed test: missing seed-om-session-state.json (or OM_SEED_STATE_FILE).');
      return;
    }

    const store = await createHydratedStore(seedContext.stateFile);
    const memory = new Memory({ storage: store });
    const agent = createOmTestAgent({
      memory,
      model: ACTOR_MODEL,
      instructions: 'Continue concise deep-research updates from existing context.',
      cacheControlled: true,
    });

    const first = await runStreamAndCollectUsage({
      agent,
      threadId: seedContext.threadId,
      resourceId: seedContext.resourceId,
      prompt: 'Continue the same research thread with one additional insight.',
    });

    const second = await runStreamAndCollectUsage({
      agent,
      threadId: seedContext.threadId,
      resourceId: seedContext.resourceId,
      prompt: 'Add one more insight without changing scope.',
    });

    logUsage('hydrated-baseline-first', first.usage);
    logUsage('hydrated-baseline-second', second.usage);

    expect(second.usage.cachedInputTokens ?? 0).toBeGreaterThan(0);
    expect(getCacheHitRatio(second.usage)).toBeGreaterThan(getCacheHitRatio(first.usage));
  }, 240_000);

  it('hydrated seed + observation activation should re-stabilize cache hits after the activated prompt repeats', async () => {
    const seedContext = loadSeedContext();

    if (!seedContext) {
      console.warn('Skipping hydrated observation test: missing seed-om-session-state.json (or OM_SEED_STATE_FILE).');
      return;
    }

    const stableStore = await createHydratedStore(seedContext.stateFile);
    const stableMemory = new Memory({ storage: stableStore });
    const stableAgent = createOmTestAgent({
      memory: stableMemory,
      model: ACTOR_MODEL,
      instructions: 'Continue concise deep-research updates from existing context.',
      cacheControlled: true,
    });

    await runStreamAndCollectUsage({
      agent: stableAgent,
      threadId: seedContext.threadId,
      resourceId: seedContext.resourceId,
      prompt: 'Stable baseline pass one.',
    });

    const stableSecond = await runStreamAndCollectUsage({
      agent: stableAgent,
      threadId: seedContext.threadId,
      resourceId: seedContext.resourceId,
      prompt: 'Stable baseline pass two.',
    });

    const activatedStore = await createHydratedStore(seedContext.stateFile);
    if (seedContext.observedMessageIds.length > 0) {
      await seedActiveObservations({
        store: activatedStore as unknown as InMemoryStore,
        threadId: seedContext.threadId,
        resourceId: seedContext.resourceId,
        activeObservations: [
          '- 🔴 Forced activated observation for cache re-stabilization test',
          '- 🔴 Activation preserves the same research thread but expands the prompt prefix before it stabilizes again',
        ].join('\n'),
        observedMessageIds: seedContext.observedMessageIds,
      });
    }

    const activatedMemory = createOmTestMemory(activatedStore as unknown as InMemoryStore, {
      enabled: true,
      observation: {
        model: createStableObserverModel(),
        messageTokens: 999_999,
        bufferTokens: false,
      },
      reflection: {
        model: createChangingReflectorModel(),
        observationTokens: 999_999,
      },
    });

    const activatedAgent = createOmTestAgent({
      memory: activatedMemory,
      model: ACTOR_MODEL,
      instructions: 'Continue concise deep-research updates from existing context.',
      cacheControlled: true,
    });

    const activatedFirst = await runStreamAndCollectUsage({
      agent: activatedAgent,
      threadId: seedContext.threadId,
      resourceId: seedContext.resourceId,
      prompt: 'Observation activation pass one after the active observations changed.',
    });

    const activatedSecond = await runStreamAndCollectUsage({
      agent: activatedAgent,
      threadId: seedContext.threadId,
      resourceId: seedContext.resourceId,
      prompt: 'Observation activation pass two after the active observations stayed unchanged.',
    });

    logUsage('hydrated-observation-stable-second', stableSecond.usage);
    logUsage('hydrated-observation-activated-first', activatedFirst.usage);
    logUsage('hydrated-observation-activated-second', activatedSecond.usage);

    expect(stableSecond.usage.cachedInputTokens ?? 0).toBeGreaterThan(0);
    expect(activatedSecond.usage.cachedInputTokens ?? 0).toBeGreaterThan(0);
    expect(getCacheHitRatio(activatedSecond.usage)).toBeGreaterThan(getCacheHitRatio(activatedFirst.usage));
  }, 240_000);

  it('reflection change should reduce cache ratio', async () => {
    const store = new InMemoryStore();
    const threadId = 'cache-reflection-change-thread';
    const resourceId = 'cache-reflection-change-resource';

    const observedMessageIds = await seedConversationTurns({ store, threadId, resourceId, turns: 14 });
    await seedActiveObservations({
      store,
      threadId,
      resourceId,
      activeObservations:
        '- 🔴 Observation one with enough detail to trigger reflection budget quickly\n- 🔴 Observation two with more detail to ensure reflection threshold is crossed',
      observedMessageIds,
    });

    const memoryReflection = createOmTestMemory(store, {
      enabled: true,
      observation: {
        model: createStableObserverModel(),
        messageTokens: 1,
        bufferTokens: false,
      },
      reflection: {
        model: createChangingReflectorModel(),
        observationTokens: 10,
      },
      shareTokenBudget: false,
    });

    const reflectionAgent = createOmTestAgent({
      memory: memoryReflection,
      model: ACTOR_MODEL,
      cacheControlled: true,
    });

    await runStreamAndCollectUsage({
      agent: reflectionAgent,
      threadId,
      resourceId,
      prompt: 'Run reflection-sensitive pass one.',
    });

    const secondReflection = await runStreamAndCollectUsage({
      agent: reflectionAgent,
      threadId,
      resourceId,
      prompt: 'Run reflection-sensitive pass two with similar request.',
    });

    logUsage('reflection-second', secondReflection.usage);

    expect(getCacheHitRatio(secondReflection.usage)).toBeLessThan(0.5);
    expect(formatCacheRatio(secondReflection.usage)).toMatch(/%/);
  }, 240_000);
});
