import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SpanType } from '../../observability';
import type { SpanRecord, TraceRecord, MastraStorage } from '../../storage';
import type { MastraScorer } from '../base';

vi.mock('./utils', () => ({
  transformTraceToScorerInputAndOutput: vi.fn(() => ({ input: 'test', output: 'test' })),
}));

import type { ScoreTraceBatchTarget, ScoreTraceTarget } from './scoreTracesWorkflow';
import { scoreTrace, scoreTraceBatch } from './scoreTracesWorkflow';

type MockObservabilityStore = {
  getTrace: ReturnType<typeof vi.fn>;
  updateSpan: ReturnType<typeof vi.fn>;
};

type MockScoresStore = {
  saveScore: ReturnType<typeof vi.fn>;
};

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

function createMockTraceRecord({
  traceId = 'trace-1',
  spanId,
  rootSpanOverrides = {},
  childSpanOverrides = {},
}: {
  traceId?: string;
  spanId?: string;
  rootSpanOverrides?: Partial<SpanRecord>;
  childSpanOverrides?: Partial<SpanRecord>;
} = {}): TraceRecord {
  const rootSpan = createMockSpanRecord({
    spanId: 'span-1',
    traceId,
    parentSpanId: null,
    name: 'root-span',
    entityId: 'root-span',
    spanType: SpanType.AGENT_RUN,
    ...rootSpanOverrides,
  });

  if (!spanId) {
    return {
      traceId,
      spans: [rootSpan],
    };
  }

  return {
    traceId,
    spans: [
      rootSpan,
      createMockSpanRecord({
        spanId,
        traceId,
        parentSpanId: rootSpan.spanId,
        name: 'child-span',
        entityId: 'child-span',
        spanType: SpanType.MODEL_GENERATION,
        ...childSpanOverrides,
      }),
    ],
  };
}

function createMockScorerResult(overrides: Record<string, unknown> = {}) {
  return {
    runId: 'run-123',
    score: 0.85,
    result: { test: 'result' },
    prompt: 'Test prompt',
    ...overrides,
  };
}

function createMockSavedScore(overrides: Record<string, unknown> = {}) {
  return {
    id: 'score-123',
    score: 0.85,
    scorer: { name: 'test-scorer' },
    createdAt: new Date('2025-01-01T00:02:00Z'),
    ...overrides,
  };
}

class TestContext {
  public mockStorage!: MastraStorage;
  public mockObservabilityStore!: MockObservabilityStore;
  public mockScoresStore!: MockScoresStore;
  public mockScorer!: MastraScorer;
  public mockScorerRun!: ReturnType<typeof vi.fn>;

  constructor() {
    this.reset();
  }

  reset() {
    this.mockObservabilityStore = {
      getTrace: vi.fn(),
      updateSpan: vi.fn(),
    };
    this.mockScoresStore = {
      saveScore: vi.fn(),
    };
    this.mockStorage = {
      getStore: vi.fn().mockImplementation((domain: string) => {
        if (domain === 'observability') return Promise.resolve(this.mockObservabilityStore);
        if (domain === 'scores') return Promise.resolve(this.mockScoresStore);
        return Promise.resolve(undefined);
      }),
    } as unknown as MastraStorage;

    this.mockScorerRun = vi.fn();
    this.mockScorer = {
      id: 'test-scorer',
      name: 'test-scorer',
      description: 'Test scorer for unit tests',
      type: 'llm',
      run: this.mockScorerRun,
    } as unknown as MastraScorer;
  }

  setupSaveScorePassthrough() {
    this.mockScoresStore.saveScore.mockImplementation(async (payload: Record<string, unknown>) => ({
      score: createMockSavedScore({
        ...payload,
        id: `score-${String(payload.traceId ?? 'unknown')}-${String(payload.spanId ?? 'unknown')}`,
      }),
    }));
  }

  async setupSuccessfulScenario(target: { traceId: string; spanId?: string } = { traceId: 'trace-1' }) {
    const mockTrace = createMockTraceRecord({ traceId: target.traceId, spanId: target.spanId });

    this.mockObservabilityStore.getTrace.mockResolvedValue(mockTrace);
    this.mockScorerRun.mockResolvedValue(
      createMockScorerResult({
        runId: 'run-123',
        input: { test: 'input' },
        output: { test: 'output' },
      }),
    );
    this.setupSaveScorePassthrough();
    this.mockObservabilityStore.updateSpan.mockResolvedValue(undefined);

    return { mockTrace };
  }

  async setupSuccessfulBatchScenario(targets: ScoreTraceBatchTarget[]) {
    const tracesById = new Map(
      targets.map(target => [
        target.traceId,
        createMockTraceRecord({ traceId: target.traceId, spanId: target.spanId }),
      ]),
    );

    this.mockObservabilityStore.getTrace.mockImplementation(async ({ traceId }: { traceId: string }) => {
      return tracesById.get(traceId) ?? null;
    });
    this.mockScorerRun.mockResolvedValue(
      createMockScorerResult({
        runId: 'run-123',
        input: { test: 'input' },
        output: { test: 'output' },
      }),
    );
    this.setupSaveScorePassthrough();
    this.mockObservabilityStore.updateSpan.mockResolvedValue(undefined);

    return { tracesById };
  }

  async setupErrorScenario(
    scenarioType: 'trace-not-found' | 'span-not-found' | 'no-root-span' | 'scorer-failure' | 'storage-failure',
    errorDetails?: { traceId?: string; target?: { traceId: string; spanId?: string }; error?: Error },
  ) {
    switch (scenarioType) {
      case 'trace-not-found':
        this.mockObservabilityStore.getTrace.mockResolvedValue(null);
        break;

      case 'span-not-found': {
        const mockTrace = createMockTraceRecord({ traceId: errorDetails?.traceId || 'trace-1' });
        this.mockObservabilityStore.getTrace.mockResolvedValue(mockTrace);
        break;
      }

      case 'no-root-span': {
        const mockTraceNoRoot: TraceRecord = {
          traceId: errorDetails?.traceId || 'trace-1',
          spans: [
            createMockSpanRecord({
              spanId: 'span-1',
              traceId: errorDetails?.traceId || 'trace-1',
              parentSpanId: 'parent-span',
              name: 'child-span',
              spanType: SpanType.MODEL_GENERATION,
            }),
          ],
        };
        this.mockObservabilityStore.getTrace.mockResolvedValue(mockTraceNoRoot);
        break;
      }

      case 'scorer-failure':
        await this.setupSuccessfulScenario(errorDetails?.target || { traceId: 'trace-1' });
        this.mockScorerRun.mockRejectedValue(errorDetails?.error || new Error('Scorer execution failed'));
        break;

      case 'storage-failure':
        this.mockObservabilityStore.getTrace.mockRejectedValue(errorDetails?.error || new Error('Storage error'));
        break;
    }

    return this;
  }

  async scoreTraceTarget(
    target: ScoreTraceTarget,
    overrides: { batchId?: string; datasetId?: string; datasetItemId?: string } = {},
  ) {
    return scoreTrace({
      storage: this.mockStorage,
      scorer: this.mockScorer,
      target,
      ...overrides,
    });
  }

  async scoreTraceBatchTargets(
    targets: ScoreTraceBatchTarget[],
    overrides: { batchId?: string; datasetId?: string; concurrency?: number } = {},
  ) {
    return scoreTraceBatch({
      storage: this.mockStorage,
      scorer: this.mockScorer,
      targets,
      ...overrides,
    });
  }
}

describe('scoreTrace', () => {
  let testContext: TestContext;

  beforeEach(() => {
    vi.clearAllMocks();
    testContext = new TestContext();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('successful execution', () => {
    it('runs the scorer and persists the score for a root span target', async () => {
      const target = { traceId: 'trace-1' };
      await testContext.setupSuccessfulScenario(target);

      await testContext.scoreTraceTarget(target);

      expect(testContext.mockObservabilityStore.getTrace).toHaveBeenCalledWith({ traceId: 'trace-1' });
      expect(testContext.mockScorerRun).toHaveBeenCalled();
      expect(testContext.mockScoresStore.saveScore).toHaveBeenCalledWith(
        expect.objectContaining({
          runId: 'run-123',
          scorerId: 'test-scorer',
          entityId: 'root-span',
          entityType: SpanType.AGENT_RUN,
          source: 'TEST',
          traceId: 'trace-1',
        }),
      );
      expect(testContext.mockObservabilityStore.updateSpan).toHaveBeenCalled();
    });

    it('returns the persisted score row from scoresStore.saveScore', async () => {
      const target = { traceId: 'trace-1' };
      await testContext.setupSuccessfulScenario(target);

      const savedScore = await testContext.scoreTraceTarget(target);

      expect(savedScore).toEqual(
        expect.objectContaining({
          id: 'score-trace-1-span-1',
          traceId: 'trace-1',
          spanId: 'span-1',
          scorerId: 'test-scorer',
        }),
      );
    });

    it('uses a preloaded trace target without rereading the trace from storage', async () => {
      const preloadedTrace = createMockTraceRecord({ traceId: 'trace-1', spanId: 'span-2' });
      testContext.mockScorerRun.mockResolvedValue(
        createMockScorerResult({
          runId: 'run-123',
          input: { test: 'input' },
          output: { test: 'output' },
        }),
      );
      testContext.setupSaveScorePassthrough();
      testContext.mockObservabilityStore.updateSpan.mockResolvedValue(undefined);

      const savedScore = await testContext.scoreTraceTarget({ trace: preloadedTrace, spanId: 'span-2' });

      expect(testContext.mockObservabilityStore.getTrace).not.toHaveBeenCalled();
      expect(savedScore).toEqual(
        expect.objectContaining({
          traceId: 'trace-1',
          spanId: 'span-2',
        }),
      );
      expect(testContext.mockObservabilityStore.updateSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          traceId: 'trace-1',
          spanId: 'span-2',
        }),
      );
    });
  });

  describe('error handling', () => {
    it('throws when the trace cannot be found', async () => {
      const target = { traceId: 'nonexistent-trace' };
      await testContext.setupErrorScenario('trace-not-found');

      await expect(testContext.scoreTraceTarget(target)).rejects.toThrow();
    });

    it('throws when the requested span cannot be found', async () => {
      const target = { traceId: 'trace-1', spanId: 'nonexistent-span' };
      await testContext.setupErrorScenario('span-not-found', { traceId: 'trace-1' });

      await expect(testContext.scoreTraceTarget(target)).rejects.toThrow();
    });

    it('throws when no root span exists and no spanId is provided', async () => {
      const target = { traceId: 'trace-1' };
      await testContext.setupErrorScenario('no-root-span', { traceId: 'trace-1' });

      await expect(testContext.scoreTraceTarget(target)).rejects.toThrow();
    });

    it('does not retry or persist a failed scorer execution', async () => {
      const target = { traceId: 'trace-1' };
      await testContext.setupErrorScenario('scorer-failure', {
        target,
        error: new Error('Scorer execution failed'),
      });

      await expect(testContext.scoreTraceTarget(target)).rejects.toThrow('Scorer execution failed');
      expect(testContext.mockScorerRun).toHaveBeenCalledTimes(1);
      expect(testContext.mockScoresStore.saveScore).not.toHaveBeenCalled();
      expect(testContext.mockObservabilityStore.updateSpan).not.toHaveBeenCalled();
    });

    it('throws when loading the trace fails', async () => {
      const target = { traceId: 'trace-1' };
      await testContext.setupErrorScenario('storage-failure', { error: new Error('Storage error') });

      await expect(testContext.scoreTraceTarget(target)).rejects.toThrow('Storage error');
    });
  });

  describe('span selection logic', () => {
    it('selects the root span when no spanId is provided', async () => {
      const target = { traceId: 'trace-1' };
      await testContext.setupSuccessfulScenario(target);

      await testContext.scoreTraceTarget(target);

      expect(testContext.mockScoresStore.saveScore).toHaveBeenCalled();
      expect(testContext.mockObservabilityStore.updateSpan).toHaveBeenCalled();
    });

    it('selects the specific span when spanId is provided', async () => {
      const target = { traceId: 'trace-1', spanId: 'span-2' };
      await testContext.setupSuccessfulScenario(target);

      await testContext.scoreTraceTarget(target);

      expect(testContext.mockScoresStore.saveScore).toHaveBeenCalled();
      expect(testContext.mockObservabilityStore.updateSpan).toHaveBeenCalled();
    });
  });

  describe('score result formatting', () => {
    it('formats the saved score payload for a root span target', async () => {
      const target = { traceId: 'trace-1' };
      await testContext.setupSuccessfulScenario(target);
      testContext.mockScorerRun.mockResolvedValue(
        createMockScorerResult({
          runId: 'run-123',
          input: { test: 'input' },
          output: { test: 'output' },
        }),
      );

      await testContext.scoreTraceTarget(target);

      expect(testContext.mockScoresStore.saveScore).toHaveBeenCalledWith(
        expect.objectContaining({
          runId: 'run-123',
          input: { test: 'input' },
          output: { test: 'output' },
          scorer: {
            id: 'test-scorer',
            name: 'test-scorer',
            description: 'Test scorer for unit tests',
            hasJudge: false,
          },
          traceId: 'trace-1',
          entityId: 'root-span',
          entityType: SpanType.AGENT_RUN,
          entity: { traceId: 'trace-1', spanId: 'span-1' },
          source: 'TEST',
          scorerId: 'test-scorer',
        }),
      );
    });

    it('formats the saved score payload for a span target', async () => {
      const target = { traceId: 'trace-1', spanId: 'span-2' };
      await testContext.setupSuccessfulScenario(target);
      testContext.mockScorerRun.mockResolvedValue(
        createMockScorerResult({
          runId: 'run-456',
          input: { test: 'input2' },
          output: { test: 'output2' },
        }),
      );

      await testContext.scoreTraceTarget(target);

      expect(testContext.mockScoresStore.saveScore).toHaveBeenCalledWith(
        expect.objectContaining({
          runId: 'run-456',
          input: { test: 'input2' },
          output: { test: 'output2' },
          scorer: {
            id: 'test-scorer',
            name: 'test-scorer',
            description: 'Test scorer for unit tests',
            hasJudge: false,
          },
          traceId: 'trace-1',
          spanId: 'span-2',
          entityId: 'child-span',
          entityType: SpanType.MODEL_GENERATION,
          entity: { traceId: 'trace-1', spanId: 'span-2' },
          source: 'TEST',
          scorerId: 'test-scorer',
        }),
      );
    });
  });

  describe('provenance persistence', () => {
    it('persists batch and dataset provenance fields when provided', async () => {
      const target = { traceId: 'trace-1' };
      await testContext.setupSuccessfulScenario(target);

      await testContext.scoreTraceTarget(target, {
        batchId: 'batch-1',
        datasetId: 'dataset-1',
        datasetItemId: 'dataset-item-1',
      });

      expect(testContext.mockScoresStore.saveScore).toHaveBeenCalledWith(
        expect.objectContaining({
          batchId: 'batch-1',
          datasetId: 'dataset-1',
          datasetItemId: 'dataset-item-1',
        }),
      );
    });
  });

  describe('tenancy threading', () => {
    it('passes span organizationId/resourceId into scorer.run and the saved score', async () => {
      const target = { traceId: 'trace-1' };
      await testContext.setupSuccessfulScenario(target);

      const taggedTrace = createMockTraceRecord({
        traceId: 'trace-1',
        rootSpanOverrides: {
          organizationId: 'org-1',
          resourceId: 'project-1',
        },
      });
      testContext.mockObservabilityStore.getTrace.mockResolvedValue(taggedTrace);

      await testContext.scoreTraceTarget(target);

      expect(testContext.mockScorerRun).toHaveBeenCalledWith(
        expect.objectContaining({
          targetCorrelationContext: expect.objectContaining({
            organizationId: 'org-1',
            resourceId: 'project-1',
          }),
          targetMetadata: expect.objectContaining({
            organizationId: 'org-1',
            projectId: 'project-1',
          }),
        }),
      );

      expect(testContext.mockScoresStore.saveScore).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org-1',
          projectId: 'project-1',
        }),
      );
    });
  });
});

describe('scoreTraceBatch', () => {
  let testContext: TestContext;

  beforeEach(() => {
    vi.clearAllMocks();
    testContext = new TestContext();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('scores all targets and returns ordered results with shared and per-target provenance', async () => {
    const targets: ScoreTraceBatchTarget[] = [
      { traceId: 'trace-1', datasetItemId: 'dataset-item-1' },
      { traceId: 'trace-2', spanId: 'span-2', datasetItemId: 'dataset-item-2' },
    ];
    await testContext.setupSuccessfulBatchScenario(targets);

    const result = await testContext.scoreTraceBatchTargets(targets, {
      batchId: 'batch-1',
      datasetId: 'dataset-1',
    });

    expect(result).toEqual(
      expect.objectContaining({
        batchId: 'batch-1',
        datasetId: 'dataset-1',
        scoredCount: 2,
        failedCount: 0,
      }),
    );
    expect(result.results).toEqual([
      expect.objectContaining({
        ok: true,
        index: 0,
        traceId: 'trace-1',
        spanId: 'span-1',
        datasetItemId: 'dataset-item-1',
        score: expect.objectContaining({
          batchId: 'batch-1',
          datasetId: 'dataset-1',
          datasetItemId: 'dataset-item-1',
          traceId: 'trace-1',
          spanId: 'span-1',
        }),
      }),
      expect.objectContaining({
        ok: true,
        index: 1,
        traceId: 'trace-2',
        spanId: 'span-2',
        datasetItemId: 'dataset-item-2',
        score: expect.objectContaining({
          batchId: 'batch-1',
          datasetId: 'dataset-1',
          datasetItemId: 'dataset-item-2',
          traceId: 'trace-2',
          spanId: 'span-2',
        }),
      }),
    ]);
  });

  it('returns mixed success and failure results without aborting sibling targets', async () => {
    const targets: ScoreTraceBatchTarget[] = [
      { traceId: 'trace-1', datasetItemId: 'dataset-item-1' },
      { traceId: 'trace-2', spanId: 'missing-span', datasetItemId: 'dataset-item-2' },
      { traceId: 'trace-3', spanId: 'span-3', datasetItemId: 'dataset-item-3' },
    ];

    testContext.mockObservabilityStore.getTrace.mockImplementation(async ({ traceId }: { traceId: string }) => {
      if (traceId === 'trace-2') {
        return createMockTraceRecord({ traceId });
      }

      if (traceId === 'trace-3') {
        return createMockTraceRecord({ traceId, spanId: 'span-3' });
      }

      return createMockTraceRecord({ traceId });
    });
    testContext.mockScorerRun.mockResolvedValue(
      createMockScorerResult({
        runId: 'run-123',
        input: { test: 'input' },
        output: { test: 'output' },
      }),
    );
    testContext.setupSaveScorePassthrough();
    testContext.mockObservabilityStore.updateSpan.mockResolvedValue(undefined);

    const result = await testContext.scoreTraceBatchTargets(targets, {
      batchId: 'batch-1',
      datasetId: 'dataset-1',
    });

    expect(result.scoredCount).toBe(2);
    expect(result.failedCount).toBe(1);
    expect(result.results).toEqual([
      expect.objectContaining({
        ok: true,
        index: 0,
        traceId: 'trace-1',
        spanId: 'span-1',
        datasetItemId: 'dataset-item-1',
      }),
      expect.objectContaining({
        ok: false,
        index: 1,
        traceId: 'trace-2',
        spanId: 'missing-span',
        datasetItemId: 'dataset-item-2',
        error: expect.any(Error),
      }),
      expect.objectContaining({
        ok: true,
        index: 2,
        traceId: 'trace-3',
        spanId: 'span-3',
        datasetItemId: 'dataset-item-3',
      }),
    ]);
    expect(result.results[1]?.ok).toBe(false);
    if (result.results[1]?.ok === false) {
      expect(result.results[1].error.message).toContain('Span not found for scoring');
    }
    expect(testContext.mockScoresStore.saveScore).toHaveBeenCalledTimes(2);
  });

  it('isolates a failed scorer target without retrying or duplicating sibling targets', async () => {
    const targets: ScoreTraceBatchTarget[] = [{ traceId: 'trace-1' }, { traceId: 'trace-2' }, { traceId: 'trace-3' }];
    await testContext.setupSuccessfulBatchScenario(targets);
    testContext.mockScorerRun.mockImplementation(async ({ targetTraceId }: { targetTraceId: string }) => {
      if (targetTraceId === 'trace-2') throw new Error('Scorer execution failed for trace-2');
      return createMockScorerResult({
        runId: `run-${targetTraceId}`,
        input: { test: 'input' },
        output: { test: 'output' },
      });
    });

    const result = await testContext.scoreTraceBatchTargets(targets, { concurrency: 1 });

    expect(testContext.mockScorerRun).toHaveBeenCalledTimes(3);
    expect(testContext.mockScorerRun.mock.calls.map(([run]) => run.targetTraceId)).toEqual([
      'trace-1',
      'trace-2',
      'trace-3',
    ]);
    expect(testContext.mockScoresStore.saveScore).toHaveBeenCalledTimes(2);
    expect(testContext.mockObservabilityStore.updateSpan).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ scoredCount: 2, failedCount: 1 });
    expect(result.results[1]).toMatchObject({
      ok: false,
      traceId: 'trace-2',
      error: expect.objectContaining({ message: 'Scorer execution failed for trace-2' }),
    });
  });
});
