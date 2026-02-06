import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Agent } from '../../../agent';
import type { Mastra } from '../../../mastra';
import type { MastraCompositeStore, StorageDomains } from '../../../storage/base';
import { DatasetsInMemory } from '../../../storage/domains/datasets/inmemory';
import { InMemoryDB } from '../../../storage/domains/inmemory-db';
import { RunsInMemory } from '../../../storage/domains/runs/inmemory';
import { runDataset } from '../index';

// Mock isSupportedLanguageModel at module level
vi.mock('../../../agent', async importOriginal => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    isSupportedLanguageModel: vi.fn().mockReturnValue(true),
  };
});

// Helper: mock agent with configurable behavior
const createMockAgent = (
  opts: { delayMs?: number; shouldFail?: boolean; response?: string; failMessage?: string } = {},
): Agent => {
  const { delayMs = 0, shouldFail = false, response = 'ok', failMessage = 'Agent error' } = opts;
  return {
    id: 'test-agent',
    name: 'Test Agent',
    getModel: vi.fn().mockResolvedValue({ specificationVersion: 'v2' }),
    generate: vi.fn().mockImplementation(async () => {
      if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
      if (shouldFail) throw new Error(failMessage);
      return { text: response };
    }),
  } as unknown as Agent;
};

// Shared test infrastructure
let db: InMemoryDB;
let datasetsStorage: DatasetsInMemory;
let runsStorage: RunsInMemory;
let mockStorage: MastraCompositeStore;
let mastra: Mastra;
let datasetId: string;

async function setupDataset(itemCount: number) {
  db = new InMemoryDB();
  datasetsStorage = new DatasetsInMemory({ db });
  runsStorage = new RunsInMemory({ db });

  const dataset = await datasetsStorage.createDataset({
    name: 'Streaming Test Dataset',
    description: 'Regression',
  });
  datasetId = dataset.id;

  for (let i = 0; i < itemCount; i++) {
    await datasetsStorage.addItem({
      datasetId: dataset.id,
      input: { prompt: `item-${i}` },
      expectedOutput: null,
    });
  }

  mockStorage = {
    id: 'test-storage',
    stores: {
      datasets: datasetsStorage,
      runs: runsStorage,
    } as unknown as StorageDomains,
    getStore: vi.fn().mockImplementation(async (name: keyof StorageDomains) => {
      if (name === 'datasets') return datasetsStorage;
      if (name === 'runs') return runsStorage;
      return undefined;
    }),
  } as unknown as MastraCompositeStore;
}

function setupMastra(agent: Agent) {
  mastra = {
    getStorage: vi.fn().mockReturnValue(mockStorage),
    getAgent: vi.fn().mockReturnValue(agent),
    getAgentById: vi.fn().mockReturnValue(agent),
    getScorerById: vi.fn(),
    getWorkflowById: vi.fn(),
    getWorkflow: vi.fn(),
  } as unknown as Mastra;
}

describe('Streaming: onItemComplete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // T-1: onItemComplete fires for each item
  it('T-1: onItemComplete fires for each item', async () => {
    await setupDataset(5);
    const agent = createMockAgent();
    setupMastra(agent);

    const collected: Array<{ index: number }> = [];
    const onItemComplete = vi.fn().mockImplementation((_result, index) => {
      collected.push({ index });
    });

    await runDataset(mastra, {
      datasetId,
      targetType: 'agent',
      targetId: 'test-agent',
      onItemComplete,
    });

    expect(onItemComplete).toHaveBeenCalledTimes(5);
    // Each call should have (ItemWithScores, index)
    for (let i = 0; i < 5; i++) {
      const call = onItemComplete.mock.calls[i];
      expect(call[0]).toHaveProperty('scores');
      expect(typeof call[1]).toBe('number');
    }
  });

  // T-2: onItemComplete auto-defaults retainResults to false
  it('T-2: onItemComplete auto-defaults retainResults to false', async () => {
    await setupDataset(5);
    const agent = createMockAgent();
    setupMastra(agent);

    const collected: unknown[] = [];
    const onItemComplete = vi.fn().mockImplementation(result => {
      collected.push(result);
    });

    const result = await runDataset(mastra, {
      datasetId,
      targetType: 'agent',
      targetId: 'test-agent',
      onItemComplete,
    });

    // Smart default: results not retained
    expect(result.results).toHaveLength(0);
    // But callback collected all items
    expect(collected).toHaveLength(5);
    expect(result.succeededCount).toBe(5);
  });

  // T-3: onItemComplete + explicit retainResults true gives both
  it('T-3: onItemComplete + retainResults true gives both', async () => {
    await setupDataset(3);
    const agent = createMockAgent();
    setupMastra(agent);

    const onItemComplete = vi.fn();

    const result = await runDataset(mastra, {
      datasetId,
      targetType: 'agent',
      targetId: 'test-agent',
      onItemComplete,
      retainResults: true,
    });

    expect(result.results).toHaveLength(3);
    expect(onItemComplete).toHaveBeenCalledTimes(3);
  });

  // T-4: onItemComplete receives both success and failure items
  it('T-4: onItemComplete receives both success and failure items', async () => {
    await setupDataset(3);

    let callIdx = 0;
    const agent = {
      id: 'test-agent',
      name: 'Test Agent',
      getModel: vi.fn().mockResolvedValue({ specificationVersion: 'v2' }),
      generate: vi.fn().mockImplementation(async () => {
        callIdx++;
        // Fail on 2nd call
        if (callIdx === 2) throw new Error('deliberate failure');
        return { text: 'ok' };
      }),
    } as unknown as Agent;
    setupMastra(agent);

    const errors: (string | null)[] = [];
    const onItemComplete = vi.fn().mockImplementation(result => {
      errors.push(result.error);
    });

    const result = await runDataset(mastra, {
      datasetId,
      targetType: 'agent',
      targetId: 'test-agent',
      maxConcurrency: 1,
      onItemComplete,
    });

    expect(onItemComplete).toHaveBeenCalledTimes(3);
    expect(errors.filter(e => e !== null)).toHaveLength(1);
    expect(result.succeededCount).toBe(2);
    expect(result.failedCount).toBe(1);
  });

  // T-5: onItemComplete throw is non-fatal
  it('T-5: onItemComplete throw is non-fatal', async () => {
    await setupDataset(3);
    const agent = createMockAgent();
    setupMastra(agent);

    const onItemComplete = vi.fn().mockImplementation(() => {
      throw new Error('callback boom');
    });

    const result = await runDataset(mastra, {
      datasetId,
      targetType: 'agent',
      targetId: 'test-agent',
      onItemComplete,
    });

    expect(result.succeededCount).toBe(3);
    expect(result.status).toBe('completed');
  });

  // T-6: async onItemComplete is awaited
  it('T-6: async onItemComplete is awaited', async () => {
    await setupDataset(3);
    const agent = createMockAgent();
    setupMastra(agent);

    const timestamps: number[] = [];
    const onItemComplete = vi.fn().mockImplementation(async () => {
      timestamps.push(performance.now());
      await new Promise(r => setTimeout(r, 50));
      timestamps.push(performance.now());
    });

    await runDataset(mastra, {
      datasetId,
      targetType: 'agent',
      targetId: 'test-agent',
      maxConcurrency: 1,
      onItemComplete,
    });

    expect(onItemComplete).toHaveBeenCalledTimes(3);
    // Each callback's end (even index) should be before next callback's start (odd index)
    // timestamps: [start0, end0, start1, end1, start2, end2]
    for (let i = 1; i < timestamps.length - 1; i += 2) {
      // end of callback i should be <= start of callback i+1
      expect(timestamps[i]).toBeLessThanOrEqual(timestamps[i + 1]);
    }
  });

  // T-7: onItemComplete on abort — only completed items
  it('T-7: onItemComplete on abort — only completed items', { timeout: 5000 }, async () => {
    await setupDataset(10);
    const agent = createMockAgent({ delayMs: 200 });
    setupMastra(agent);

    const collected: unknown[] = [];
    const onItemComplete = vi.fn().mockImplementation(result => {
      collected.push(result);
    });

    const controller = new AbortController();
    setTimeout(() => controller.abort(), 300);

    const result = await runDataset(mastra, {
      datasetId,
      targetType: 'agent',
      targetId: 'test-agent',
      maxConcurrency: 2,
      signal: controller.signal,
      onItemComplete,
    });

    // Some items completed, but not all
    expect(collected.length).toBeGreaterThan(0);
    expect(collected.length).toBeLessThan(10);
    // Callback count should match collected
    expect(onItemComplete).toHaveBeenCalledTimes(collected.length);
    // Run should have partial results
    expect(result.status).toBe('failed');
  });
});
