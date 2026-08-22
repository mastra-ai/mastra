import { describe, expect, it, beforeEach, vi } from 'vitest';
import { SCORE_RUN_WORKFLOW_ID } from '../evals/scoreRun/executeScoreRun';
import { createOnScorerHook } from './hooks';

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

  it('skips start() when the run is already terminal', async () => {
    mockRun.workflowRunStatus = 'success';
    const hook = createOnScorerHook(mockMastra);
    await hook(createHookData({ tracingContext: createTracingContext() }) as any);

    expect(mockWorkflow.createRun).toHaveBeenCalledTimes(1);
    expect(mockRun.start).not.toHaveBeenCalled();
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
