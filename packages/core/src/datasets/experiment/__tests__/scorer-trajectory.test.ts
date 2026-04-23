/**
 * Tests for trajectory scorer dispatch and categorised scorer config support
 * in runExperiment / dataset.startExperiment.
 *
 * Covers the two bugs fixed in #15614:
 *   Part A — categorised scorer config (AgentScorerConfig) was rejected by TS
 *   Part B — trajectory scorers received raw MastraDBMessage[] instead of Trajectory
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MastraScorer } from '../../../evals/base';
import type { Trajectory } from '../../../evals/types';
import type { Mastra } from '../../../mastra';
import type { MastraCompositeStore, StorageDomains } from '../../../storage/base';
import { DatasetsInMemory } from '../../../storage/domains/datasets/inmemory';
import { ExperimentsInMemory } from '../../../storage/domains/experiments/inmemory';
import { InMemoryDB } from '../../../storage/domains/inmemory-db';
import { runExperiment } from '../index';

// ── Helpers ────────────────────────────────────────────────────────────────

/** Agent that returns a stable scoringData payload with tool invocations. */
const createMockAgent = () => ({
  id: 'test-agent',
  name: 'Test Agent',
  getModel: vi.fn().mockResolvedValue({ specificationVersion: 'v2' }),
  generate: vi.fn().mockImplementation(async () => ({
    text: 'The weather is 66°F.',
    scoringData: {
      input: 'What is the weather in London in Fahrenheit?',
      output: [
        {
          role: 'assistant',
          content: {
            toolInvocations: [
              { toolName: 'getWeather', state: 'result', args: { city: 'London' }, result: { tempCelsius: 19 } },
              { toolName: 'convertUnits', state: 'result', args: { celsius: 19 }, result: { fahrenheit: 66.2 } },
            ],
          },
        },
      ],
    },
  })),
});

/** Scorer that captures what run.output it received. */
const createCapturingScorer = (id: string): MastraScorer<any, any, any, any> & { capturedOutput: unknown } => {
  const scorer = {
    id,
    name: id,
    description: '',
    type: 'trajectory' as const,
    capturedOutput: undefined as unknown,
    run: vi.fn().mockImplementation(async ({ output }: { output: unknown }) => {
      scorer.capturedOutput = output;
      return { score: 1, reason: 'captured' };
    }),
  };
  return scorer as any;
};

/** Plain agent scorer (no trajectory expectations). */
const createAgentScorer = (id: string): MastraScorer<any, any, any, any> =>
  ({
    id,
    name: id,
    description: '',
    type: 'agent' as const,
    run: vi.fn().mockResolvedValue({ score: 1, reason: 'ok' }),
  }) as any;

// ── Storage / Mastra setup ─────────────────────────────────────────────────

function buildStorage() {
  const db = new InMemoryDB();
  const datasetsStorage = new DatasetsInMemory({ db });
  const experimentsStorage = new ExperimentsInMemory({ db });

  const storage: MastraCompositeStore = {
    id: 'test',
    stores: { datasets: datasetsStorage, experiments: experimentsStorage } as unknown as StorageDomains,
    getStore: vi.fn().mockImplementation(async (name: keyof StorageDomains) => {
      if (name === 'datasets') return datasetsStorage;
      if (name === 'experiments') return experimentsStorage;
      return undefined;
    }),
  } as unknown as MastraCompositeStore;

  return { storage, datasetsStorage };
}

function buildMastra(storage: MastraCompositeStore) {
  const mockAgent = createMockAgent();
  return {
    mastra: {
      getStorage: vi.fn().mockReturnValue(storage),
      getAgent: vi.fn().mockReturnValue(mockAgent),
      getAgentById: vi.fn().mockReturnValue(mockAgent),
      getScorerById: vi.fn(),
      getWorkflowById: vi.fn(),
      getWorkflow: vi.fn(),
    } as unknown as Mastra,
    mockAgent,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('trajectory scorer dispatch', () => {
  let storage: MastraCompositeStore;
  let datasetsStorage: DatasetsInMemory;
  let mastra: Mastra;
  let datasetId: string;

  beforeEach(async () => {
    ({ storage, datasetsStorage } = buildStorage());
    ({ mastra } = buildMastra(storage));

    const dataset = await datasetsStorage.createDataset({ name: 'Test', description: '' });
    datasetId = dataset.id;
    await datasetsStorage.addItem({
      datasetId,
      input: 'What is the weather in London in Fahrenheit?',
    });
  });

  it('Part B — trajectory scorer receives a Trajectory object, not raw messages', async () => {
    const scorer = createCapturingScorer('traj-scorer');

    await runExperiment(mastra, {
      datasetId,
      targetType: 'agent',
      targetId: 'test-agent',
      scorers: [scorer],
    });

    const output = scorer.capturedOutput as Trajectory;
    // Must be a Trajectory shape, not a raw MastraDBMessage[]
    expect(output).toHaveProperty('steps');
    expect(Array.isArray(output.steps)).toBe(true);
  });

  it('Part B — trajectory steps contain the expected tool calls', async () => {
    const scorer = createCapturingScorer('traj-scorer');

    await runExperiment(mastra, {
      datasetId,
      targetType: 'agent',
      targetId: 'test-agent',
      scorers: [scorer],
    });

    const output = scorer.capturedOutput as Trajectory;
    const names = output.steps.map(s => s.name);
    expect(names).toContain('getWeather');
    expect(names).toContain('convertUnits');
  });

  it('non-trajectory scorers still receive the raw output', async () => {
    const agentScorer = createAgentScorer('agent-scorer');

    await runExperiment(mastra, {
      datasetId,
      targetType: 'agent',
      targetId: 'test-agent',
      scorers: [agentScorer],
    });

    // raw output is not a Trajectory — it would be the trimmed execution result
    const callArg = (agentScorer.run as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(callArg?.output).not.toHaveProperty('steps');
  });
});

describe('categorised scorer config (AgentScorerConfig)', () => {
  let storage: MastraCompositeStore;
  let datasetsStorage: DatasetsInMemory;
  let mastra: Mastra;
  let datasetId: string;

  beforeEach(async () => {
    ({ storage, datasetsStorage } = buildStorage());
    ({ mastra } = buildMastra(storage));

    const dataset = await datasetsStorage.createDataset({ name: 'Test', description: '' });
    datasetId = dataset.id;
    await datasetsStorage.addItem({ datasetId, input: 'Hello' });
  });

  it('Part A — accepts { agent, trajectory } shape without TypeScript error', async () => {
    const agentScorer = createAgentScorer('agent-scorer');
    const trajScorer = createCapturingScorer('traj-scorer');

    const result = await runExperiment(mastra, {
      datasetId,
      targetType: 'agent',
      targetId: 'test-agent',
      // This shape was a TS error before the fix
      scorers: { agent: [agentScorer], trajectory: [trajScorer] },
    });

    expect(result.status).toBe('completed');
    const scores = result.results[0]?.scores ?? [];
    expect(scores.find(s => s.scorerId === 'agent-scorer')?.score).toBe(1);
    expect(scores.find(s => s.scorerId === 'traj-scorer')?.score).toBe(1);
  });

  it('Part A+B — trajectory scorer in categorised config also receives a Trajectory', async () => {
    const trajScorer = createCapturingScorer('traj-scorer');

    await runExperiment(mastra, {
      datasetId,
      targetType: 'agent',
      targetId: 'test-agent',
      scorers: { trajectory: [trajScorer] },
    });

    const output = trajScorer.capturedOutput as Trajectory;
    expect(output).toHaveProperty('steps');
    expect(Array.isArray(output.steps)).toBe(true);
  });

  it('both scorers run when passed in categorised form', async () => {
    const agentScorer = createAgentScorer('agent-scorer');
    const trajScorer = createCapturingScorer('traj-scorer');

    const result = await runExperiment(mastra, {
      datasetId,
      targetType: 'agent',
      targetId: 'test-agent',
      scorers: { agent: [agentScorer], trajectory: [trajScorer] },
    });

    const scores = result.results[0]?.scores ?? [];
    expect(scores).toHaveLength(2);
    expect(agentScorer.run).toHaveBeenCalledOnce();
    expect(trajScorer.run).toHaveBeenCalledOnce();
  });
});
