import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Agent } from '../../../agent';
import type { Mastra } from '../../../mastra';
import type { MastraCompositeStore, StorageDomains } from '../../../storage/base';
import { DatasetsInMemory } from '../../../storage/domains/datasets/inmemory';
import { ExperimentsInMemory } from '../../../storage/domains/experiments/inmemory';
import { InMemoryDB } from '../../../storage/domains/inmemory-db';
import { executeTarget } from '../executor';
import { runExperiment } from '../index';

// Mock isSupportedLanguageModel at module level
vi.mock('../../../agent', async importOriginal => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    isSupportedLanguageModel: vi.fn().mockReturnValue(true),
  };
});

// Import after mock setup
// eslint-disable-next-line import/order
import { isSupportedLanguageModel } from '../../../agent';

// Helper: mock agent with configurable delay
const createMockAgent = (opts: { delayMs?: number; shouldFail?: boolean; response?: string } = {}): Agent => {
  const { delayMs = 0, shouldFail = false, response = 'ok' } = opts;
  return {
    id: 'test-agent',
    name: 'Test Agent',
    getModel: vi.fn().mockResolvedValue({ specificationVersion: 'v2' }),
    generate: vi.fn().mockImplementation(async () => {
      if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
      if (shouldFail) throw new Error('Agent error');
      return { text: response };
    }),
  } as unknown as Agent;
};

// Shared test infrastructure
let db: InMemoryDB;
let datasetsStorage: DatasetsInMemory;
let experimentsStorage: ExperimentsInMemory;
let mockStorage: MastraCompositeStore;
let mastra: Mastra;
let datasetId: string;

async function setupDataset(itemCount: number) {
  db = new InMemoryDB();
  datasetsStorage = new DatasetsInMemory({ db });
  experimentsStorage = new ExperimentsInMemory({ db });

  const dataset = await datasetsStorage.createDataset({
    name: 'P0 Test Dataset',
    description: 'Regression',
  });
  datasetId = dataset.id;

  for (let i = 0; i < itemCount; i++) {
    await datasetsStorage.addItem({
      datasetId: dataset.id,
      input: { prompt: `item-${i}` },
      groundTruth: null,
    });
  }

  mockStorage = {
    id: 'test-storage',
    stores: {
      datasets: datasetsStorage,
      experiments: experimentsStorage,
    } as unknown as StorageDomains,
    getStore: vi.fn().mockImplementation(async (name: keyof StorageDomains) => {
      if (name === 'datasets') return datasetsStorage;
      if (name === 'experiments') return experimentsStorage;
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

describe('P0 Regression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isSupportedLanguageModel).mockReturnValue(true);
  });

  // T-A: Abort returns partial summary (not throw)
  describe('Bug A: Abort returns partial summary', () => {
    it('resolves with partial ExperimentSummary when aborted mid-run', async () => {
      await setupDataset(10);
      const agent = createMockAgent({ delayMs: 200 });
      setupMastra(agent);

      const controller = new AbortController();

      // Abort after ~300ms — some items should have completed
      setTimeout(() => controller.abort(), 300);

      const result = await runExperiment(mastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'test-agent',
        maxConcurrency: 2,
        signal: controller.signal,
      });

      // Must resolve, not reject
      expect(result).toBeDefined();
      expect(result.status).toBe('failed');
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.results.length).toBeLessThan(10);
      expect(result.succeededCount + result.failedCount).toBe(result.results.length);
    });
  });

  // T-B: generateLegacy missing → explicit error
  describe('Bug B: generateLegacy silent false success', () => {
    it('returns error when generateLegacy is not available', async () => {
      vi.mocked(isSupportedLanguageModel).mockReturnValue(false);

      // Agent WITHOUT generateLegacy
      const agent = {
        id: 'no-legacy-agent',
        name: 'No Legacy Agent',
        getModel: vi.fn().mockResolvedValue({ specificationVersion: 'v1' }),
        generate: vi.fn(),
      } as unknown as Agent;

      const item = {
        id: 'item-1',
        datasetId: 'ds-1',
        input: 'test input',
        groundTruth: null,
        version: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await executeTarget(agent, 'agent', item);

      expect(result.output).toBeNull();
      expect(result.error).toBeTruthy();
      expect(result.error!.message).toContain('generateLegacy');
    });
  });

  // T-C: Per-item timeout
  describe('Bug C: Per-item timeout', () => {
    it('times out hanging items without blocking the run', { timeout: 5000 }, async () => {
      await setupDataset(2);

      // Agent that never resolves
      const hangingAgent = {
        id: 'hanging-agent',
        name: 'Hanging Agent',
        getModel: vi.fn().mockResolvedValue({ specificationVersion: 'v2' }),
        generate: vi.fn().mockImplementation(() => new Promise(() => {})),
      } as unknown as Agent;

      setupMastra(hangingAgent);

      const result = await runExperiment(mastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'hanging-agent',
        maxConcurrency: 2,
        itemTimeout: 100,
      });

      expect(result).toBeDefined();
      expect(result.failedCount).toBe(2);
      expect(result.succeededCount).toBe(0);
      // Each item should have a timeout-related error
      for (const item of result.results) {
        expect(item.error).toBeTruthy();
        expect(item.error!.message.toLowerCase()).toContain('timeout');
      }
    });
  });

  // T-D: AbortSignal forwarded to agent.generate()
  describe('Bug D: AbortSignal forwarded to agent', () => {
    it('passes abortSignal to agent.generate() options', async () => {
      await setupDataset(1);

      const generateSpy = vi.fn().mockResolvedValue({ text: 'ok' });
      const agent = {
        id: 'spy-agent',
        name: 'Spy Agent',
        getModel: vi.fn().mockResolvedValue({ specificationVersion: 'v2' }),
        generate: generateSpy,
      } as unknown as Agent;

      setupMastra(agent);

      const controller = new AbortController();

      await runExperiment(mastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'spy-agent',
        signal: controller.signal,
      });

      expect(generateSpy).toHaveBeenCalledTimes(1);
      const callArgs = generateSpy.mock.calls[0];
      // Second arg should contain abortSignal
      expect(callArgs[1]).toHaveProperty('abortSignal');
      expect(callArgs[1].abortSignal).toBeInstanceOf(AbortSignal);
    });
  });

  // T-E: addResult failure doesn't kill run
  describe('Bug E: addResult failure is non-fatal', () => {
    it('completes run even when storage addResult throws', async () => {
      await setupDataset(3);
      const agent = createMockAgent({ response: 'success' });
      setupMastra(agent);

      // Override experimentsStorage.addExperimentResult to throw
      experimentsStorage.addExperimentResult = vi.fn().mockRejectedValue(new Error('DB down'));

      const result = await runExperiment(mastra, {
        datasetId,
        targetType: 'agent',
        targetId: 'test-agent',
        maxConcurrency: 1,
      });

      expect(result).toBeDefined();
      expect(result.status).toBe('completed');
      expect(result.succeededCount).toBe(3);
      expect(result.results.length).toBe(3);

      // Verify addExperimentResult was attempted
      expect(experimentsStorage.addExperimentResult).toHaveBeenCalledTimes(3);
    });
  });
});
