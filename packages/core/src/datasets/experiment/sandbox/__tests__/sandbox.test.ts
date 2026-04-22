import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Mastra } from '../../../../mastra';
import type { MastraCompositeStore, StorageDomains } from '../../../../storage/base';
import { ExperimentsInMemory } from '../../../../storage/domains/experiments/inmemory';
import { InMemoryDB } from '../../../../storage/domains/inmemory-db';
import { ScoresInMemory } from '../../../../storage/domains/scores/inmemory';
import { runSandboxExperiment } from '../index';
import type { SandboxExperimentItem, SandboxExperimentLifecycle } from '../types';

function createMockMastra(mockStorage: MastraCompositeStore): Mastra {
  return {
    getStorage: vi.fn().mockReturnValue(mockStorage),
    getAgent: vi.fn(),
    getAgentById: vi.fn(),
    getScorerById: vi.fn(),
    getWorkflowById: vi.fn(),
    getWorkflow: vi.fn(),
  } as unknown as Mastra;
}

function createMockStorage() {
  const db = new InMemoryDB();
  const experimentsStorage = new ExperimentsInMemory({ db });
  const scoresStorage = new ScoresInMemory({ db });

  const mockStorage = {
    id: 'test-storage',
    stores: { experiments: experimentsStorage, scores: scoresStorage } as unknown as StorageDomains,
    getStore: vi.fn().mockImplementation(async (name: keyof StorageDomains) => {
      if (name === 'experiments') return experimentsStorage;
      if (name === 'scores') return scoresStorage;
      return undefined;
    }),
  } as unknown as MastraCompositeStore;

  return { mockStorage, experimentsStorage };
}

interface TestItem extends SandboxExperimentItem<{ prompt: string }> {}

describe('runSandboxExperiment', () => {
  let mastra: Mastra;

  beforeEach(() => {
    const storage = createMockStorage();
    mastra = createMockMastra(storage.mockStorage);
  });

  it('runs lifecycle in order: setup → execute → teardown', async () => {
    const callOrder: string[] = [];

    const lifecycle: SandboxExperimentLifecycle<TestItem, string> = {
      setup: vi.fn().mockImplementation(async () => {
        callOrder.push('setup');
        return {};
      }),
      execute: vi.fn().mockImplementation(async () => {
        callOrder.push('execute');
        return 'result';
      }),
      teardown: vi.fn().mockImplementation(async () => {
        callOrder.push('teardown');
      }),
    };

    const summary = await runSandboxExperiment(mastra, {
      items: [{ input: { prompt: 'hello' } }],
      lifecycle,
    });

    expect(callOrder).toEqual(['setup', 'execute', 'teardown']);
    expect(summary.succeededCount).toBe(1);
  });

  it('always calls teardown when execute throws', async () => {
    const lifecycle: SandboxExperimentLifecycle<TestItem, string> = {
      setup: vi.fn().mockResolvedValue({ workspacePath: '/tmp/test' }),
      execute: vi.fn().mockRejectedValue(new Error('boom')),
      teardown: vi.fn().mockResolvedValue(undefined),
    };

    const summary = await runSandboxExperiment(mastra, {
      items: [{ input: { prompt: 'hello' } }],
      lifecycle,
    });

    expect(lifecycle.teardown).toHaveBeenCalledTimes(1);
    // Teardown receives the error for cleanup decisions
    expect((lifecycle.teardown as ReturnType<typeof vi.fn>).mock.calls[0][1]).toEqual(
      expect.objectContaining({ error: expect.objectContaining({ message: 'boom' }) }),
    );
    expect(summary.failedCount).toBe(1);
  });

  it('always calls teardown when setup throws, and skips execute', async () => {
    const lifecycle: SandboxExperimentLifecycle<TestItem, string> = {
      setup: vi.fn().mockRejectedValue(new Error('setup failed')),
      execute: vi.fn().mockResolvedValue('unreachable'),
      teardown: vi.fn().mockResolvedValue(undefined),
    };

    const summary = await runSandboxExperiment(mastra, {
      items: [{ input: { prompt: 'hello' } }],
      lifecycle,
    });

    expect(lifecycle.teardown).toHaveBeenCalledTimes(1);
    expect(lifecycle.execute).not.toHaveBeenCalled();
    expect(summary.failedCount).toBe(1);
  });
});
