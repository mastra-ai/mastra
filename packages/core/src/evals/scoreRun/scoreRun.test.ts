import { describe, expect, it, beforeEach, vi } from 'vitest';
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

    await expect(executeScoreRun({ mastra: mockMastra, input: { hookData: createHookData() as any } })).rejects.toThrow(
      'judge rate limited',
    );
  });

  it('throws when the scorer cannot be resolved', async () => {
    mockMastra.getAgentById.mockReturnValue({ listScorers: vi.fn().mockResolvedValue({}) });
    mockMastra.getScorerById.mockReturnValue(undefined);

    await expect(executeScoreRun({ mastra: mockMastra, input: { hookData: createHookData() as any } })).rejects.toThrow(
      /not found/i,
    );
  });

  it('throws when storage is missing', async () => {
    mockMastra.getStorage.mockReturnValue(undefined);
    await expect(executeScoreRun({ mastra: mockMastra, input: { hookData: createHookData() as any } })).rejects.toThrow(
      /storage not found/i,
    );
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
