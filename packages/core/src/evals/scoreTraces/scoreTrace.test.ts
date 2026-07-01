import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SpanType } from '../../observability';
import type { SpanRecord, TraceRecord, MastraStorage } from '../../storage';
import type { MastraScorer } from '../base';

vi.mock('./utils', () => ({
  transformTraceToScorerInputAndOutput: vi.fn(() => ({ input: 'test', output: 'test' })),
}));

import { scoreTrace } from './scoreTracesWorkflow';

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

function createMockScorerResult(overrides: Record<string, unknown> = {}) {
  return {
    runId: 'run-123',
    score: 0.85,
    result: { test: 'result' },
    prompt: 'Test prompt',
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

  async setupSuccessfulScenario(target: { traceId: string; spanId?: string } = { traceId: 'trace-1' }) {
    const mockTrace: TraceRecord = {
      traceId: target.traceId,
      spans: target.spanId
        ? [
            createMockSpanRecord({
              spanId: 'span-1',
              traceId: target.traceId,
              parentSpanId: null,
              name: 'root-span',
              entityId: 'root-span',
              spanType: SpanType.AGENT_RUN,
            }),
            createMockSpanRecord({
              spanId: target.spanId,
              traceId: target.traceId,
              parentSpanId: 'span-1',
              name: 'child-span',
              entityId: 'child-span',
              spanType: SpanType.MODEL_GENERATION,
            }),
          ]
        : [
            createMockSpanRecord({
              spanId: 'span-1',
              traceId: target.traceId,
              parentSpanId: null,
              name: 'root-span',
              entityId: 'root-span',
              spanType: SpanType.AGENT_RUN,
            }),
          ],
    };

    this.mockObservabilityStore.getTrace.mockResolvedValue(mockTrace);
    this.mockScorerRun.mockResolvedValue(
      createMockScorerResult({
        runId: 'run-123',
        input: { test: 'input' },
        output: { test: 'output' },
      }),
    );
    this.mockScoresStore.saveScore.mockResolvedValue({
      score: {
        id: 'score-123',
        score: 0.85,
        scorer: { name: 'test-scorer' },
        createdAt: new Date(),
      },
    });
    this.mockObservabilityStore.updateSpan.mockResolvedValue(undefined);

    return this;
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
        const mockTrace: TraceRecord = {
          traceId: errorDetails?.traceId || 'trace-1',
          spans: [
            createMockSpanRecord({
              spanId: 'span-1',
              traceId: errorDetails?.traceId || 'trace-1',
              parentSpanId: null,
              name: 'root-span',
              spanType: SpanType.AGENT_RUN,
            }),
          ],
        };
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
    target: { traceId: string; spanId?: string },
    overrides: { batchId?: string; datasetId?: string; datasetItemId?: string } = {},
  ) {
    return scoreTrace({
      storage: this.mockStorage,
      scorer: this.mockScorer,
      target,
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

    it('throws when scorer execution fails', async () => {
      const target = { traceId: 'trace-1' };
      await testContext.setupErrorScenario('scorer-failure', {
        target,
        error: new Error('Scorer execution failed'),
      });

      await expect(testContext.scoreTraceTarget(target)).rejects.toThrow();
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

      const taggedTrace: TraceRecord = {
        traceId: 'trace-1',
        spans: [
          createMockSpanRecord({
            spanId: 'span-1',
            traceId: 'trace-1',
            parentSpanId: null,
            name: 'root-span',
            entityId: 'root-span',
            spanType: SpanType.AGENT_RUN,
            organizationId: 'org-1',
            resourceId: 'project-1',
          }),
        ],
      };
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
