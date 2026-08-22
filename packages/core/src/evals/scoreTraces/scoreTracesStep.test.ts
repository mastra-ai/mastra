import { describe, expect, it, beforeEach, vi } from 'vitest';
import { SpanType } from '../../observability';
import type { SpanRecord, TraceRecord } from '../../storage';

vi.mock('./utils', () => ({
  transformTraceToScorerInputAndOutput: vi.fn(() => ({ input: 'test', output: 'test' })),
}));

import { getTraceStep } from './scoreTracesWorkflow';

function createMockSpanRecord(overrides: Partial<SpanRecord> = {}): SpanRecord {
  return {
    spanId: 'span-1',
    traceId: 'trace-1',
    parentSpanId: null,
    name: 'test-span',
    spanType: SpanType.AGENT_RUN,
    input: { test: 'input' },
    output: { test: 'output' },
    startedAt: '2025-01-01T00:00:00Z',
    endedAt: '2025-01-01T00:01:00Z',
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:01:00Z'),
    scope: null,
    attributes: {},
    metadata: {},
    links: null,
    error: null,
    requestContext: null,
    isEvent: false,
    ...overrides,
  } as SpanRecord;
}

function createMockTraceRecord(traceId: string): TraceRecord {
  const rootSpan = createMockSpanRecord({ traceId, spanId: 'span-1', parentSpanId: null, entityId: 'root-span' });
  return { traceId, spans: [rootSpan] } as unknown as TraceRecord;
}

describe('getTraceStep failure surfacing', () => {
  let mockObservabilityStore: any;
  let mockScoresStore: any;
  let mockStorage: any;
  let mockScorer: any;
  let mockMastra: any;

  beforeEach(() => {
    mockObservabilityStore = {
      getTrace: vi.fn(),
      updateSpan: vi.fn().mockResolvedValue(undefined),
    };
    mockScoresStore = {
      saveScore: vi.fn().mockImplementation(async (score: any) => ({ score: { id: 'score-1', ...score } })),
    };
    mockStorage = {
      getStore: vi.fn((domain: string) => {
        if (domain === 'observability') return Promise.resolve(mockObservabilityStore);
        if (domain === 'scores') return Promise.resolve(mockScoresStore);
        return Promise.resolve(undefined);
      }),
    };
    mockScorer = {
      id: 'scorer-1',
      name: 'Scorer One',
      description: 'Test scorer',
      type: 'llm',
      run: vi.fn().mockResolvedValue({
        runId: 'run-1',
        score: 0.9,
        input: { test: 'input' },
        output: { test: 'output' },
      }),
    };
    mockMastra = {
      getLogger: vi.fn().mockReturnValue({ trackException: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
      getStorage: vi.fn().mockReturnValue(mockStorage),
      getScorerById: vi.fn().mockReturnValue(mockScorer),
    };
  });

  function executeStep(targets: { traceId: string; spanId?: string }[]) {
    return (getTraceStep as any).execute({
      inputData: { targets, scorerId: 'scorer-1' },
      mastra: mockMastra,
    });
  }

  it('fails the step when every target fails', async () => {
    mockObservabilityStore.getTrace.mockResolvedValue(null);

    await expect(executeStep([{ traceId: 'trace-1' }, { traceId: 'trace-2' }])).rejects.toThrow(
      /All 2 trace scoring target\(s\) failed/,
    );
  });

  it('reports partial failures in the step output without failing the run', async () => {
    mockObservabilityStore.getTrace.mockImplementation(async ({ traceId }: { traceId: string }) =>
      traceId === 'trace-ok' ? createMockTraceRecord(traceId) : null,
    );

    const result = await executeStep([{ traceId: 'trace-ok' }, { traceId: 'trace-missing' }]);

    expect(result).toEqual(
      expect.objectContaining({
        total: 2,
        succeeded: 1,
        failed: 1,
        failures: [expect.objectContaining({ traceId: 'trace-missing', error: expect.stringContaining('Trace not found') })],
      }),
    );
  });

  it('returns a clean summary when all targets succeed', async () => {
    mockObservabilityStore.getTrace.mockImplementation(async ({ traceId }: { traceId: string }) =>
      createMockTraceRecord(traceId),
    );

    const result = await executeStep([{ traceId: 'trace-1' }]);

    expect(result).toEqual(expect.objectContaining({ total: 1, succeeded: 1, failed: 0, failures: [] }));
  });
});
