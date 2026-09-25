/**
 * Experiments with scorers that return `notScorable()`.
 *
 * A not-scorable item surfaces as a `ScorerResult` with `score: null`,
 * `error: null`, and `notScorable` set. No score row is persisted for it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createScorer, notScorable } from '../../../evals';
import type { Mastra } from '../../../mastra';
import type { MastraCompositeStore, StorageDomains } from '../../../storage/base';
import { DatasetsInMemory } from '../../../storage/domains/datasets/inmemory';
import { ExperimentsInMemory } from '../../../storage/domains/experiments/inmemory';
import { InMemoryDB } from '../../../storage/domains/inmemory-db';
import { runExperiment } from '../index';

const createMockAgent = () => ({
  id: 'test-agent',
  name: 'Test Agent',
  getModel: vi.fn().mockResolvedValue({ specificationVersion: 'v2' }),
  generate: vi.fn().mockImplementation(async (input: string) => ({
    text: `reply to: ${input}`,
    scoringData: {
      input,
      output: [{ role: 'assistant', content: { parts: [{ type: 'text', text: `reply to: ${input}` }] } }],
    },
  })),
});

/** Scores 1 for refund requests; declares every other item not scorable. */
const refundScorer = createScorer({
  id: 'refund-quality',
  description: 'Judges refund handling',
})
  .preprocess(({ run }) =>
    JSON.stringify(run.input).includes('refund') ? { refund: true } : notScorable('no refund requested'),
  )
  .generateScore(() => 1)
  .generateReason(() => 'refund handled');

function buildStorage() {
  const db = new InMemoryDB();
  const datasetsStorage = new DatasetsInMemory({ db });
  const experimentsStorage = new ExperimentsInMemory({ db });
  const scoresStorage = { saveScore: vi.fn().mockResolvedValue({ score: {} }) };

  const storage: MastraCompositeStore = {
    id: 'test',
    stores: { datasets: datasetsStorage, experiments: experimentsStorage } as unknown as StorageDomains,
    getStore: vi.fn().mockImplementation(async (name: keyof StorageDomains) => {
      if (name === 'datasets') return datasetsStorage;
      if (name === 'experiments') return experimentsStorage;
      if (name === 'scores') return scoresStorage;
      return undefined;
    }),
  } as unknown as MastraCompositeStore;

  return { storage, datasetsStorage, scoresStorage };
}

describe('runExperiment with notScorable()', () => {
  let storage: MastraCompositeStore;
  let datasetsStorage: DatasetsInMemory;
  let scoresStorage: { saveScore: ReturnType<typeof vi.fn> };
  let mastra: Mastra;
  let datasetId: string;

  beforeEach(async () => {
    ({ storage, datasetsStorage, scoresStorage } = buildStorage());
    const mockAgent = createMockAgent();
    mastra = {
      getStorage: vi.fn().mockReturnValue(storage),
      getAgent: vi.fn().mockReturnValue(mockAgent),
      getAgentById: vi.fn().mockReturnValue(mockAgent),
      getScorerById: vi.fn(),
      getWorkflowById: vi.fn(),
      getWorkflow: vi.fn(),
      getLogger: vi.fn().mockReturnValue({ debug: vi.fn(), warn: vi.fn(), error: vi.fn() }),
    } as unknown as Mastra;

    const dataset = await datasetsStorage.createDataset({ name: 'Refunds', description: '' });
    datasetId = dataset.id;
    await datasetsStorage.addItem({ datasetId, input: 'I want a refund' });
    await datasetsStorage.addItem({ datasetId, input: 'What is the weather?' });
  });

  it('reports not-scorable items without an error and persists only real scores', async () => {
    const result = await runExperiment(mastra, {
      datasetId,
      targetType: 'agent',
      targetId: 'test-agent',
      scorers: [refundScorer],
    });

    expect(result.status).toBe('completed');

    const byInput = new Map(result.results.map(item => [item.input, item.scores[0]]));

    expect(byInput.get('I want a refund')).toMatchObject({
      scorerId: 'refund-quality',
      score: 1,
      reason: 'refund handled',
      error: null,
    });
    expect(byInput.get('I want a refund')).not.toHaveProperty('notScorable');

    expect(byInput.get('What is the weather?')).toMatchObject({
      scorerId: 'refund-quality',
      score: null,
      reason: null,
      error: null,
      notScorable: { step: 'preprocess', reason: 'no refund requested' },
    });

    expect(scoresStorage.saveScore).toHaveBeenCalledTimes(1);
    expect(scoresStorage.saveScore).toHaveBeenCalledWith(expect.objectContaining({ score: 1 }));
  });
});
