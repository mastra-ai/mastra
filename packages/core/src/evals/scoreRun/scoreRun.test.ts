import { describe, expect, it, beforeEach, vi } from 'vitest';
import { createOnScorerHook } from '../../mastra/hooks';
import { runScorer } from '../hooks';
import { executeScoreRun, extractScoreRunTarget, getScoreRunId, SCORE_RUN_WORKFLOW_ID } from './executeScoreRun';
import { pruneScoreRunSnapshot } from './scoreRunWorkflow';

function createHookData(overrides: Record<string, any> = {}) {
  return {
    runId: 'run-1',
    scorer: { id: 'scorer-1', name: 'Scorer One' },
    input: [{ message: 'hi' }],
    output: { result: 'ok' },
    source: 'LIVE' as const,
    entity: { id: 'entity-1' },
    entityType: 'AGENT' as const,
    ...overrides,
  };
}

function createTracingContext({ traceId = 'trace-1', spanId = 'span-1' } = {}) {
  return {
    currentSpan: {
      id: spanId,
      traceId,
      isValid: true,
      metadata: { sessionId: 's-1' },
      getCorrelationContext: vi.fn().mockReturnValue({ traceId, spanId }),
    },
  };
}

describe('getScoreRunId', () => {
  it('is deterministic for the same (scorer, span)', () => {
    const hookData = createHookData() as any;
    const a = getScoreRunId({ scorerId: 'scorer-1', hookData, traceId: 't1', spanId: 's1' });
    const b = getScoreRunId({ scorerId: 'scorer-1', hookData, traceId: 't1', spanId: 's1' });
    expect(a).toBe(b);
    expect(a).toBe('scoring-scorer-1-t1-s1');
  });

  it('falls back to hook runId and entity id without span identity', () => {
    const hookData = createHookData() as any;
    expect(getScoreRunId({ scorerId: 'scorer-1', hookData })).toBe('scoring-scorer-1-run-1-entity-1');
  });
});

describe('extractScoreRunTarget', () => {
  it('extracts serializable span identity from tracingContext', () => {
    const hookData = createHookData({ tracingContext: createTracingContext() }) as any;
    const target = extractScoreRunTarget(hookData);
    expect(target.traceId).toBe('trace-1');
    expect(target.spanId).toBe('span-1');
    expect(target.targetCorrelationContext).toEqual({ traceId: 'trace-1', spanId: 'span-1' });
    expect(target.targetMetadata).toEqual({ sessionId: 's-1' });
  });

  it('returns undefined identity when span is invalid or missing', () => {
    const hookData = createHookData() as any;
    expect(extractScoreRunTarget(hookData)).toEqual({
      traceId: undefined,
      spanId: undefined,
      targetCorrelationContext: undefined,
      targetMetadata: undefined,
    });
  });
});

describe('createOnScorerHook durable dispatch', () => {
  let mockScoresStore: any;
  let mockStorage: any;
  let mockRun: any;
  let mockWorkflow: any;
  let mockMastra: any;

  beforeEach(() => {
    mockScoresStore = { saveScore: vi.fn().mockResolvedValue({ score: 'ok' }) };
    mockStorage = {
      getStore: vi.fn((domain: string) => Promise.resolve(domain === 'scores' ? mockScoresStore : undefined)),
    };
    mockRun = { start: vi.fn().mockResolvedValue({ status: 'success' }) };
    mockWorkflow = { createRun: vi.fn().mockResolvedValue(mockRun) };
    mockMastra = {
      getStorage: vi.fn().mockReturnValue(mockStorage),
      getLogger: vi.fn().mockReturnValue({ warn: vi.fn(), debug: vi.fn(), trackException: vi.fn() }),
      __getInternalWorkflow: vi.fn().mockReturnValue(mockWorkflow),
      getAgentById: vi.fn(),
      getWorkflowById: vi.fn(),
      getScorerById: vi.fn(),
    };
  });

  it('dispatches through the __score-run workflow with a deterministic runId', async () => {
    const hook = createOnScorerHook(mockMastra);
    await hook(createHookData({ tracingContext: createTracingContext() }) as any);

    expect(mockMastra.__getInternalWorkflow).toHaveBeenCalledWith(SCORE_RUN_WORKFLOW_ID);
    expect(mockWorkflow.createRun).toHaveBeenCalledWith({ runId: 'scoring-scorer-1-trace-1-span-1' });
    expect(mockRun.start).toHaveBeenCalledTimes(1);
    // Direct execution must not happen when the workflow handles the run.
    expect(mockScoresStore.saveScore).not.toHaveBeenCalled();
  });

  it('passes a serializable input (tracingContext stripped, span identity extracted)', async () => {
    const hook = createOnScorerHook(mockMastra);
    await hook(createHookData({ tracingContext: createTracingContext() }) as any);

    const { inputData } = mockRun.start.mock.calls[0][0];
    expect(inputData.traceId).toBe('trace-1');
    expect(inputData.spanId).toBe('span-1');
    expect(inputData.hookData.tracingContext).toBeUndefined();
    expect(inputData.hookData.scorer.id).toBe('scorer-1');
  });

  it('duplicate dispatches compute the same runId (idempotent intent upsert)', async () => {
    const hook = createOnScorerHook(mockMastra);
    const hookData = () => createHookData({ tracingContext: createTracingContext() }) as any;
    await hook(hookData());
    await hook(hookData());

    const [first, second] = mockWorkflow.createRun.mock.calls;
    expect(first[0].runId).toBe(second[0].runId);
  });

  it('logs (not throws) when the workflow run start fails', async () => {
    mockRun.start.mockRejectedValue(new Error('engine down'));
    const hook = createOnScorerHook(mockMastra);
    await expect(hook(createHookData() as any)).resolves.toBeUndefined();
    // fire-and-forget rejection handled asynchronously
    await new Promise(resolve => setImmediate(resolve));
    expect(mockMastra.getLogger().trackException).toHaveBeenCalled();
  });

  it('falls back to direct execution when the workflow is not registered', async () => {
    mockMastra.__getInternalWorkflow = vi.fn(() => {
      throw new Error('not registered');
    });
    const mockScorer = { id: 'scorer-1', name: 'Scorer One', run: vi.fn().mockResolvedValue({ score: 0.7 }) };
    mockMastra.getAgentById.mockReturnValue({
      listScorers: vi.fn().mockResolvedValue({ 'scorer-1': { scorer: mockScorer } }),
    });

    const hook = createOnScorerHook(mockMastra);
    await hook(createHookData() as any);

    expect(mockScorer.run).toHaveBeenCalledTimes(1);
    expect(mockScoresStore.saveScore).toHaveBeenCalledWith(expect.objectContaining({ score: 0.7 }));
  });
});

describe('executeScoreRun', () => {
  let mockScoresStore: any;
  let mockMastra: any;

  beforeEach(() => {
    mockScoresStore = { saveScore: vi.fn().mockResolvedValue({ score: 'ok' }) };
    mockMastra = {
      getStorage: vi.fn().mockReturnValue({
        getStore: vi.fn((domain: string) => Promise.resolve(domain === 'scores' ? mockScoresStore : undefined)),
      }),
      getLogger: vi.fn().mockReturnValue({ warn: vi.fn(), debug: vi.fn(), trackException: vi.fn() }),
      getAgentById: vi.fn(),
      getWorkflowById: vi.fn(),
      getScorerById: vi.fn(),
    };
  });

  it('propagates scorer failures so a durable run ends failed', async () => {
    const mockScorer = { id: 'scorer-1', run: vi.fn().mockRejectedValue(new Error('judge rate limited')) };
    mockMastra.getAgentById.mockReturnValue({
      listScorers: vi.fn().mockResolvedValue({ 'scorer-1': { scorer: mockScorer } }),
    });

    await expect(
      executeScoreRun({ mastra: mockMastra, input: { hookData: createHookData() as any } }),
    ).rejects.toThrow('judge rate limited');
  });

  it('throws when the scorer cannot be resolved', async () => {
    mockMastra.getAgentById.mockReturnValue({ listScorers: vi.fn().mockResolvedValue({}) });
    mockMastra.getScorerById.mockReturnValue(undefined);

    await expect(
      executeScoreRun({ mastra: mockMastra, input: { hookData: createHookData() as any } }),
    ).rejects.toThrow(/not found/i);
  });

  it('throws when storage is missing', async () => {
    mockMastra.getStorage.mockReturnValue(undefined);
    await expect(
      executeScoreRun({ mastra: mockMastra, input: { hookData: createHookData() as any } }),
    ).rejects.toThrow(/storage not found/i);
  });
});

describe('pruneScoreRunSnapshot', () => {
  it('keeps run/target identity but drops payload bodies', () => {
    const snapshot: any = {
      runId: 'scoring-scorer-1-trace-1-span-1',
      status: 'success',
      value: {},
      context: {
        input: {
          traceId: 'trace-1',
          spanId: 'span-1',
          hookData: {
            runId: 'run-1',
            scorer: { id: 'scorer-1', name: 'Scorer One' },
            entity: { id: 'entity-1' },
            entityType: 'AGENT',
            input: [{ message: 'a'.repeat(10_000) }],
            output: { result: 'b'.repeat(10_000) },
          },
        },
        '__execute-scorer': {
          status: 'success',
          output: { huge: 'c'.repeat(10_000) },
          payload: { huge: 'd'.repeat(10_000) },
          startedAt: 1,
          endedAt: 2,
        },
      },
      activePaths: [],
      suspendedPaths: {},
      serializedStepGraph: [],
      timestamp: Date.now(),
    };

    const pruned = pruneScoreRunSnapshot({ snapshot });

    const input = (pruned.context as any).input;
    expect(input).toEqual({
      traceId: 'trace-1',
      spanId: 'span-1',
      scorerId: 'scorer-1',
      entityId: 'entity-1',
      entityType: 'AGENT',
      runId: 'run-1',
    });

    const stepResult = (pruned.context as any)['__execute-scorer'];
    expect(stepResult.status).toBe('success');
    expect(stepResult.output).toBeUndefined();
    expect(stepResult.payload).toBeUndefined();
    expect(pruned.result).toBeUndefined();

    // The pruned snapshot must stay small — this is the cost-control contract.
    expect(JSON.stringify(pruned).length).toBeLessThan(1024);
  });
});

describe('runScorer sampling decision records', () => {
  let mockScoresStore: any;
  let mockMastra: any;

  beforeEach(() => {
    mockScoresStore = { saveScoringDecision: vi.fn().mockResolvedValue(undefined) };
    mockMastra = {
      getStorage: vi.fn().mockReturnValue({
        getStore: vi.fn((domain: string) => Promise.resolve(domain === 'scores' ? mockScoresStore : undefined)),
      }),
      getLogger: vi.fn().mockReturnValue({ debug: vi.fn() }),
    };
  });

  function baseArgs(scorerObject: any) {
    return {
      runId: 'run-1',
      scorerId: 'scorer-1',
      scorerObject,
      input: [],
      output: {},
      requestContext: {},
      entity: { id: 'entity-1' },
      structuredOutput: false,
      source: 'LIVE' as const,
      entityType: 'AGENT' as const,
      mastra: mockMastra,
    };
  }

  it('records a declined decision when ratio sampling rejects', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    runScorer(baseArgs({ scorer: { id: 'scorer-1' }, sampling: { type: 'ratio', rate: 0.5 } }) as any);
    vi.restoreAllMocks();

    await new Promise(resolve => setImmediate(resolve));
    expect(mockScoresStore.saveScoringDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        scorerId: 'scorer-1',
        decision: 'declined',
        samplingType: 'ratio',
        samplingRate: 0.5,
        entityId: 'entity-1',
      }),
    );
  });

  it('records a sampled decision when scoring proceeds', async () => {
    runScorer(baseArgs({ scorer: { id: 'scorer-1' } }) as any);

    await new Promise(resolve => setImmediate(resolve));
    expect(mockScoresStore.saveScoringDecision).toHaveBeenCalledWith(
      expect.objectContaining({ scorerId: 'scorer-1', decision: 'sampled' }),
    );
  });

  it('degrades to a no-op without storage', async () => {
    mockMastra.getStorage.mockReturnValue(undefined);
    expect(() => runScorer(baseArgs({ scorer: { id: 'scorer-1' } }) as any)).not.toThrow();
    await new Promise(resolve => setImmediate(resolve));
    expect(mockScoresStore.saveScoringDecision).not.toHaveBeenCalled();
  });
});
