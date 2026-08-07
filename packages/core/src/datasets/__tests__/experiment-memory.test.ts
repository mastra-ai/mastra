/**
 * Regression tests for #20663 — startExperiment against a memory-enabled agent
 * with a requestContext carrying only MASTRA_RESOURCE_ID_KEY (as set by auth
 * middleware or the Studio "Run Experiment" field) used to throw
 * AGENT_MEMORY_MISSING_RESOURCE_ID for every item, because the experiment
 * executor forwarded the resourceId without any thread.
 *
 * The executor now injects a distinct per-item thread (mirroring the
 * multi-turn evals runner precedent) whenever a resourceId is present, no
 * threadId is supplied, and the agent has its own memory. These tests use a
 * real Agent + MockMemory + real Dataset.startExperiment — the pre-existing
 * experiment tests mock the agent, which is why the bug went unnoticed.
 */
import { MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, vi } from 'vitest';
import { Agent } from '../../agent/agent';
import type { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY } from '../../request-context';
import { InMemoryStore } from '../../storage';
import type { MastraCompositeStore, StorageDomains } from '../../storage/base';
import { DatasetsInMemory } from '../../storage/domains/datasets/inmemory';
import { ExperimentsInMemory } from '../../storage/domains/experiments/inmemory';
import { InMemoryDB } from '../../storage/domains/inmemory-db';
import { ScoresInMemory } from '../../storage/domains/scores/inmemory';
import { Dataset } from '../dataset';

const ITEM_INPUTS = ['Hello there', 'Second item', 'Third item'];

function createV2Model() {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop' as const,
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      content: [{ type: 'text' as const, text: 'Dummy response' }],
      warnings: [],
    }),
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      stream: convertArrayToReadableStream([
        { type: 'text-delta' as const, id: 'text-1', delta: 'Dummy response' },
        {
          type: 'finish' as const,
          id: '2',
          finishReason: 'stop' as const,
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        },
      ]),
      warnings: [],
    }),
  });
}

function createV1Model() {
  return new MockLanguageModelV1({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop' as const,
      usage: { promptTokens: 10, completionTokens: 20 },
      text: 'Dummy response',
    }),
  });
}

function createMemoryAgent(model: MockLanguageModelV1 | MockLanguageModelV2) {
  const memory = new MockMemory({ storage: new InMemoryStore() });
  const agent = new Agent({
    id: 'memory-agent',
    name: 'Memory Agent',
    instructions: 'test agent',
    model,
    memory,
  });
  return { agent, memory };
}

async function setupDataset(agent: Agent, inputs: string[] = ITEM_INPUTS) {
  const db = new InMemoryDB();
  const datasetsStorage = new DatasetsInMemory({ db });
  const experimentsStorage = new ExperimentsInMemory({ db });
  const scoresStorage = new ScoresInMemory({ db });

  const mockStorage = {
    id: 'test-storage',
    stores: {
      datasets: datasetsStorage,
      experiments: experimentsStorage,
      scores: scoresStorage,
    } as unknown as StorageDomains,
    getStore: vi.fn().mockImplementation(async (name: keyof StorageDomains) => {
      if (name === 'datasets') return datasetsStorage;
      if (name === 'experiments') return experimentsStorage;
      if (name === 'scores') return scoresStorage;
      return undefined;
    }),
  } as unknown as MastraCompositeStore;

  const mastra = {
    getStorage: vi.fn().mockReturnValue(mockStorage),
    getAgent: vi.fn().mockReturnValue(agent),
    getAgentById: vi.fn().mockReturnValue(agent),
    getScorerById: vi.fn(),
    getWorkflowById: vi.fn(),
    getWorkflow: vi.fn(),
    getLogger: vi.fn().mockReturnValue({ warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() }),
  } as unknown as Mastra;

  const record = await datasetsStorage.createDataset({ name: 'Experiment Memory DS' });
  const itemIds: string[] = [];
  for (const input of inputs) {
    const item = await datasetsStorage.addItem({ datasetId: record.id, input });
    itemIds.push(item.id);
  }

  return { ds: new Dataset(record.id, mastra), itemIds };
}

async function listThreadsForResource(memory: MockMemory, resourceId: string) {
  const { threads } = await memory.listThreads({ filter: { resourceId } });
  return threads;
}

describe('experiment executor memory-thread injection (#20663)', () => {
  it('SC1: memory-enabled agent + lone resourceId succeeds with a distinct thread per item', async () => {
    const { agent, memory } = createMemoryAgent(createV2Model());
    const generateSpy = vi.spyOn(agent, 'generate');
    const { ds, itemIds } = await setupDataset(agent);

    const summary = await ds.startExperiment({
      targetType: 'agent',
      targetId: 'memory-agent',
      requestContext: { [MASTRA_RESOURCE_ID_KEY]: 'user-1' },
    });

    expect(summary.failedCount).toBe(0);
    expect(summary.succeededCount).toBe(ITEM_INPUTS.length);

    const threads = await listThreadsForResource(memory, 'user-1');
    expect(threads).toHaveLength(ITEM_INPUTS.length);
    expect(new Set(threads.map(t => t.id)).size).toBe(ITEM_INPUTS.length);
    for (const thread of threads) {
      expect(thread.resourceId).toBe('user-1');
      // Injected threads are tagged with the experiment id and item id so a large
      // run's threads map back to their items without matching transcripts.
      expect(thread.metadata).toMatchObject({
        experimentId: expect.any(String),
        experimentItemId: expect.any(String),
      });
      // The transcript must actually be persisted — an injected memory option that
      // disables lastMessages would suppress the MessageHistory output processor
      // and leave every one of these threads empty.
      const recalled = await memory.recall({ threadId: thread.id, resourceId: 'user-1' });
      expect(recalled.messages.length).toBeGreaterThan(0);
    }

    // The tagged item ids must be exactly the dataset's item ids — one thread per item.
    const taggedItemIds = threads.map(t => (t.metadata as Record<string, unknown>).experimentItemId);
    expect(new Set(taggedItemIds)).toEqual(new Set(itemIds));

    // Contract check the mock cannot surface: title generation must be suppressed
    // (MockMemory never titles threads, so only the passed option proves this),
    // while lastMessages must stay enabled — it gates the MessageHistory output
    // processor, and disabling it would persist every injected thread empty.
    for (const call of generateSpy.mock.calls) {
      const options = (call as unknown[])[1] as { memory?: { options?: Record<string, unknown> } };
      expect(options?.memory?.options).toMatchObject({ generateTitle: false });
      expect(options?.memory?.options).not.toHaveProperty('lastMessages');
    }
  });

  it('SC1 (legacy): memory-enabled v1-model agent + lone resourceId succeeds with a distinct thread per item', async () => {
    const { agent, memory } = createMemoryAgent(createV1Model());
    const { ds } = await setupDataset(agent);

    const summary = await ds.startExperiment({
      targetType: 'agent',
      targetId: 'memory-agent',
      requestContext: { [MASTRA_RESOURCE_ID_KEY]: 'user-legacy' },
    });

    expect(summary.failedCount).toBe(0);
    expect(summary.succeededCount).toBe(ITEM_INPUTS.length);

    const threads = await listThreadsForResource(memory, 'user-legacy');
    expect(threads).toHaveLength(ITEM_INPUTS.length);
    expect(new Set(threads.map(t => t.id)).size).toBe(ITEM_INPUTS.length);
    for (const thread of threads) {
      expect(thread.resourceId).toBe('user-legacy');
      expect(thread.metadata).toMatchObject({
        experimentId: expect.any(String),
        experimentItemId: expect.any(String),
      });
    }
  });

  it('SC2a: no resourceId in context — run succeeds memory-less, no threads created', async () => {
    const { agent, memory } = createMemoryAgent(createV2Model());
    const { ds } = await setupDataset(agent);

    const summary = await ds.startExperiment({
      targetType: 'agent',
      targetId: 'memory-agent',
    });

    expect(summary.failedCount).toBe(0);
    expect(summary.succeededCount).toBe(ITEM_INPUTS.length);

    const { threads } = await memory.listThreads({ filter: {} });
    expect(threads).toHaveLength(0);
  });

  it('SC2b: memory-less agent + resourceId — no memory option is injected, run succeeds unchanged', async () => {
    const agent = new Agent({
      id: 'memory-agent',
      name: 'No Memory Agent',
      instructions: 'test agent',
      model: createV2Model(),
    });
    const generateSpy = vi.spyOn(agent, 'generate');
    const { ds } = await setupDataset(agent);

    const summary = await ds.startExperiment({
      targetType: 'agent',
      targetId: 'memory-agent',
      requestContext: { [MASTRA_RESOURCE_ID_KEY]: 'user-2' },
    });

    expect(summary.failedCount).toBe(0);
    expect(summary.succeededCount).toBe(ITEM_INPUTS.length);

    // The contract, not just the outcome: the executor must not pass a memory
    // option for a memory-less agent (deleting the hasOwnMemory() gate would
    // still produce failedCount === 0 with MockMemory-less agents otherwise).
    expect(generateSpy).toHaveBeenCalledTimes(ITEM_INPUTS.length);
    for (const call of generateSpy.mock.calls) {
      const options = (call as unknown[])[1];
      expect(options).not.toHaveProperty('memory');
    }
  });

  it('SC2c: empty-string resourceId — no injection, run stays memory-less as before the fix', async () => {
    const { agent, memory } = createMemoryAgent(createV2Model());
    const generateSpy = vi.spyOn(agent, 'generate');
    const { ds } = await setupDataset(agent);

    const summary = await ds.startExperiment({
      targetType: 'agent',
      targetId: 'memory-agent',
      requestContext: { [MASTRA_RESOURCE_ID_KEY]: '' },
    });

    // An empty-string resourceId is falsy downstream (prepare-memory-step skips
    // memory entirely), so injecting a thread here would turn a previously
    // succeeding memory-less run into a per-item failure.
    expect(summary.failedCount).toBe(0);
    expect(summary.succeededCount).toBe(ITEM_INPUTS.length);

    for (const call of generateSpy.mock.calls) {
      const options = (call as unknown[])[1];
      expect(options).not.toHaveProperty('memory');
    }

    const { threads } = await memory.listThreads({ filter: {} });
    expect(threads).toHaveLength(0);
  });

  it('SC3: explicit threadId in context wins — no per-item injection, all items share the supplied thread', async () => {
    const { agent, memory } = createMemoryAgent(createV2Model());
    const { ds } = await setupDataset(agent);

    const summary = await ds.startExperiment({
      targetType: 'agent',
      targetId: 'memory-agent',
      requestContext: {
        [MASTRA_RESOURCE_ID_KEY]: 'user-3',
        [MASTRA_THREAD_ID_KEY]: 'caller-supplied-thread',
      },
    });

    expect(summary.failedCount).toBe(0);
    expect(summary.succeededCount).toBe(ITEM_INPUTS.length);

    const threads = await listThreadsForResource(memory, 'user-3');
    expect(threads).toHaveLength(1);
    expect(threads[0]?.id).toBe('caller-supplied-thread');
  });

  it('SC4: each retry attempt gets a fresh injected thread (same item id, distinct thread ids)', async () => {
    // Fail the first generate call, succeed on the retry — retries re-enter
    // executeAgent, so each attempt must mint its own thread rather than
    // appending the retry transcript to the failed attempt's thread.
    let calls = 0;
    const model = new MockLanguageModelV2({
      doGenerate: async () => {
        calls += 1;
        if (calls === 1) throw new Error('transient model failure');
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop' as const,
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          content: [{ type: 'text' as const, text: 'Dummy response' }],
          warnings: [],
        };
      },
    });
    const { agent } = createMemoryAgent(model);
    const generateSpy = vi.spyOn(agent, 'generate');
    const { ds, itemIds } = await setupDataset(agent, ['Only item']);

    const summary = await ds.startExperiment({
      targetType: 'agent',
      targetId: 'memory-agent',
      requestContext: { [MASTRA_RESOURCE_ID_KEY]: 'user-retry' },
      maxRetries: 1,
    });

    expect(summary.failedCount).toBe(0);
    expect(summary.succeededCount).toBe(1);
    expect(generateSpy).toHaveBeenCalledTimes(2);

    // Contract check on the passed options (thread persistence timing for the
    // failed attempt is an implementation detail of the memory pipeline).
    const passedThreads = generateSpy.mock.calls.map(call => {
      const options = (call as unknown[])[1] as {
        memory?: { thread?: { id?: string; metadata?: Record<string, unknown> } };
      };
      return options?.memory?.thread;
    });
    expect(passedThreads[0]?.id).toBeDefined();
    expect(passedThreads[1]?.id).toBeDefined();
    expect(passedThreads[0]?.id).not.toBe(passedThreads[1]?.id);
    // Both attempts stay traceable to the same item.
    expect(passedThreads[0]?.metadata?.experimentItemId).toBe(itemIds[0]);
    expect(passedThreads[1]?.metadata?.experimentItemId).toBe(itemIds[0]);
  });
});
