/**
 * Tests for trajectory scorer dispatch and categorised scorer config support
 * in runExperiment / dataset.startExperiment.
 *
 * Covers the two bugs fixed in #15614:
 *   Part A — categorised scorer config (AgentScorerConfig) was rejected by TS
 *   Part B — trajectory scorers received raw MastraDBMessage[] instead of Trajectory
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { ScorerRunError } from '../../../evals/base';
import type { MastraScorer } from '../../../evals/base';
import type { Trajectory } from '../../../evals/types';
import type { Mastra } from '../../../mastra';
import type { MastraCompositeStore, StorageDomains } from '../../../storage/base';
import { DatasetsInMemory } from '../../../storage/domains/datasets/inmemory';
import { ExperimentsInMemory } from '../../../storage/domains/experiments/inmemory';
import { InMemoryDB } from '../../../storage/domains/inmemory-db';
import { createStep, createWorkflow } from '../../../workflows';
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

describe('steps scorer config — per-step dispatch', () => {
  let storage: MastraCompositeStore;
  let datasetsStorage: DatasetsInMemory;
  let mastra: Mastra;
  let datasetId: string;

  beforeEach(async () => {
    ({ storage, datasetsStorage } = buildStorage());
    ({ mastra } = buildMastra(storage));

    const dataset = await datasetsStorage.createDataset({ name: 'Test', description: '' });
    datasetId = dataset.id;
    await datasetsStorage.addItem({ datasetId, input: { prompt: 'Hello' } });
  });

  /** Build a real workflow with two steps so step results actually populate. */
  function buildTwoStepWorkflow() {
    const inputSchema = z.object({ prompt: z.string() });
    const midSchema = z.object({ upper: z.string() });
    const outputSchema = z.object({ text: z.string() });

    const upperStep = createStep({
      id: 'upper',
      inputSchema,
      outputSchema: midSchema,
      execute: async ({ inputData }) => ({ upper: inputData.prompt.toUpperCase() }),
    });

    const echoStep = createStep({
      id: 'echo',
      inputSchema: midSchema,
      outputSchema,
      execute: async ({ inputData }) => ({ text: `echo:${inputData.upper}` }),
    });

    return createWorkflow({ id: 'two-step-wf', inputSchema, outputSchema }).then(upperStep).then(echoStep).commit();
  }

  it('runs per-step scorers against each step output', async () => {
    const workflow = buildTwoStepWorkflow();
    (mastra.getWorkflowById as ReturnType<typeof vi.fn>).mockReturnValue(workflow);
    (mastra.getWorkflow as ReturnType<typeof vi.fn>).mockReturnValue(workflow);

    const upperScorer: MastraScorer<any, any, any, any> = {
      id: 'upper-scorer',
      name: 'upper-scorer',
      description: '',
      type: 'agent' as const,
      run: vi.fn().mockResolvedValue({ score: 1, reason: 'ok' }),
    } as any;

    const echoScorer: MastraScorer<any, any, any, any> = {
      id: 'echo-scorer',
      name: 'echo-scorer',
      description: '',
      type: 'agent' as const,
      run: vi.fn().mockResolvedValue({ score: 0.5, reason: 'echoed' }),
    } as any;

    const result = await runExperiment(mastra, {
      datasetId,
      targetType: 'workflow',
      targetId: 'two-step-wf',
      scorers: { steps: { upper: [upperScorer], echo: [echoScorer] } } as any,
    });

    expect(result.status).toBe('completed');

    // Each step scorer should have been invoked once, with the step's output as run.output.
    expect(upperScorer.run).toHaveBeenCalledOnce();
    expect(echoScorer.run).toHaveBeenCalledOnce();

    const upperCall = (upperScorer.run as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(upperCall?.output).toEqual({ upper: 'HELLO' });

    const echoCall = (echoScorer.run as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(echoCall?.output).toEqual({ text: 'echo:HELLO' });

    // Scores show up on the item, tagged with their step. Per-step scores
    // keep targetScope='span' (matching runEvals + the canonical
    // ScorerTargetScope taxonomy) and identify their step via stepId.
    const scores = result.results[0]?.scores ?? [];
    const upperResult = scores.find(s => s.scorerId === 'upper-scorer');
    const echoResult = scores.find(s => s.scorerId === 'echo-scorer');
    expect(upperResult?.score).toBe(1);
    expect(upperResult?.targetScope).toBe('span');
    expect(upperResult?.stepId).toBe('upper');
    expect(echoResult?.score).toBe(0.5);
    expect(echoResult?.targetScope).toBe('span');
    expect(echoResult?.stepId).toBe('echo');
  });

  it('retains completed output from a failed step scorer without persisting its recovered score', async () => {
    const workflow = buildTwoStepWorkflow();
    (mastra.getWorkflowById as ReturnType<typeof vi.fn>).mockReturnValue(workflow);
    (mastra.getWorkflow as ReturnType<typeof vi.fn>).mockReturnValue(workflow);

    const recoveredFailure = new ScorerRunError({
      scorerId: 'partial-step-scorer',
      steps: ['generateScore', 'generateReason'],
      failedStep: 'generateReason',
      completedSteps: ['generateScore'],
      result: {
        output: { upper: 'HELLO' },
        runId: 'partial-step-run',
        score: 0,
        generateScorePrompt: 'score the upper-case output',
      },
      cause: new Error('step reason failed'),
    });
    const partialScorer = {
      id: 'partial-step-scorer',
      name: 'partial-step-scorer',
      description: '',
      type: 'agent' as const,
      run: vi.fn().mockRejectedValue(recoveredFailure),
    } as unknown as MastraScorer<any, any, any, any>;
    const workingScorer = createAgentScorer('working-step-scorer');

    const result = await runExperiment(mastra, {
      datasetId,
      targetType: 'workflow',
      targetId: 'two-step-wf',
      scorers: { steps: { upper: [partialScorer, workingScorer] } } as any,
    });

    const scores = result.results[0]?.scores ?? [];
    expect(scores.find(score => score.scorerId === 'partial-step-scorer')).toMatchObject({
      score: 0,
      reason: null,
      error: 'Scorer Run Failed: step reason failed',
      failedStep: 'generateReason',
      completedSteps: ['generateScore'],
      targetScope: 'span',
      stepId: 'upper',
    });
    expect(scores.find(score => score.scorerId === 'working-step-scorer')).toMatchObject({
      score: 1,
      error: null,
      stepId: 'upper',
    });
    const scoreStoreLookups = (storage.getStore as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([domain]) => domain === 'scores',
    );
    expect(scoreStoreLookups).toHaveLength(1);
  });

  it('skips step scorers for steps that did not run successfully', async () => {
    const workflow = buildTwoStepWorkflow();
    (mastra.getWorkflowById as ReturnType<typeof vi.fn>).mockReturnValue(workflow);
    (mastra.getWorkflow as ReturnType<typeof vi.fn>).mockReturnValue(workflow);

    const missingScorer: MastraScorer<any, any, any, any> = {
      id: 'missing-scorer',
      name: 'missing-scorer',
      description: '',
      type: 'agent' as const,
      run: vi.fn(),
    } as any;

    const result = await runExperiment(mastra, {
      datasetId,
      targetType: 'workflow',
      targetId: 'two-step-wf',
      scorers: { steps: { 'no-such-step': [missingScorer] } } as any,
    });

    expect(result.status).toBe('completed');
    // Scorer should never have been called for a step that doesn't exist.
    expect(missingScorer.run).not.toHaveBeenCalled();

    // Surface as an error result so callers can see the skip.
    const scores = result.results[0]?.scores ?? [];
    const missing = scores.find(s => s.scorerId === 'missing-scorer');
    expect(missing?.score).toBeNull();
    expect(missing?.error).toMatch(/no-such-step/);
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

describe('expectedTrajectory pass-through (#21743)', () => {
  const expectedTrajectory = { steps: [{ stepType: 'tool_call' as const, name: 'getWeather' }] };

  let storage: MastraCompositeStore;
  let datasetsStorage: DatasetsInMemory;
  let mastra: Mastra;

  beforeEach(() => {
    ({ storage, datasetsStorage } = buildStorage());
    ({ mastra } = buildMastra(storage));
  });

  it('forwards a dataset item expectedTrajectory to the scorer run', async () => {
    const dataset = await datasetsStorage.createDataset({ name: 'Test', description: '' });
    await datasetsStorage.addItem({
      datasetId: dataset.id,
      input: 'What is the weather in London in Fahrenheit?',
      expectedTrajectory,
    });

    const scorer = createCapturingScorer('traj-scorer');

    await runExperiment(mastra, {
      datasetId: dataset.id,
      targetType: 'agent',
      targetId: 'test-agent',
      scorers: [scorer],
    });

    const callArg = (scorer.run as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(callArg?.expectedTrajectory).toEqual(expectedTrajectory);
  });

  it('forwards an inline data item expectedTrajectory to the scorer run', async () => {
    const scorer = createCapturingScorer('traj-scorer');

    await runExperiment(mastra, {
      data: [{ input: 'What is the weather in London in Fahrenheit?', expectedTrajectory }],
      targetType: 'agent',
      targetId: 'test-agent',
      scorers: [scorer],
    });

    const callArg = (scorer.run as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(callArg?.expectedTrajectory).toEqual(expectedTrajectory);
  });

  it('passes undefined when the item has no expectedTrajectory', async () => {
    const dataset = await datasetsStorage.createDataset({ name: 'Test', description: '' });
    await datasetsStorage.addItem({
      datasetId: dataset.id,
      input: 'What is the weather in London in Fahrenheit?',
    });

    const scorer = createCapturingScorer('traj-scorer');

    const result = await runExperiment(mastra, {
      datasetId: dataset.id,
      targetType: 'agent',
      targetId: 'test-agent',
      scorers: [scorer],
    });

    expect(result.status).toBe('completed');
    const callArg = (scorer.run as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(callArg?.expectedTrajectory).toBeUndefined();
  });

  it('forwards expectedTrajectory to step-scoped scorers', async () => {
    const inputSchema = z.object({ prompt: z.string() });
    const outputSchema = z.object({ upper: z.string() });
    const upperStep = createStep({
      id: 'upper',
      inputSchema,
      outputSchema,
      execute: async ({ inputData }) => ({ upper: inputData.prompt.toUpperCase() }),
    });
    const workflow = createWorkflow({ id: 'one-step-wf', inputSchema, outputSchema }).then(upperStep).commit();
    (mastra.getWorkflowById as ReturnType<typeof vi.fn>).mockReturnValue(workflow);
    (mastra.getWorkflow as ReturnType<typeof vi.fn>).mockReturnValue(workflow);

    const stepScorer = createAgentScorer('upper-scorer');

    await runExperiment(mastra, {
      data: [{ input: { prompt: 'Hello' }, expectedTrajectory }],
      targetType: 'workflow',
      targetId: 'one-step-wf',
      scorers: { steps: { upper: [stepScorer] } } as any,
    });

    const callArg = (stepScorer.run as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(callArg?.expectedTrajectory).toEqual(expectedTrajectory);
  });
});
