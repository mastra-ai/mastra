import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IMastraLogger } from '../../logger';
import type { TracingContext } from '../../observability';
import { SpanType } from '../../observability';
import type { SpanRecord, TraceRecord, MastraStorage } from '../../storage';
import type { MastraScorer } from '../base';

vi.mock('./utils', () => ({
  transformTraceToScorerInputAndOutput: vi.fn(() => ({ input: 'test', output: 'test' })),
}));

import { runScorerOnTarget } from './scoreTracesWorkflow';

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
    isEvent: false,
    ...overrides,
  } as SpanRecord;
}

function createMockScorerResult(overrides: any = {}) {
  return {
    runId: 'run-123',
    score: 0.85,
    result: { test: 'result' },
    prompt: 'Test prompt',
    ...overrides,
  };
}

// Test context helper to reduce repetitive setup
class TestContext {
  public mockStorage!: MastraStorage;
  public mockLogger!: IMastraLogger;
  public mockScorer!: MastraScorer;
  public mockTracingContext!: TracingContext;

  constructor() {
    this.reset();
  }

  reset() {
    this.mockStorage = {
      getTrace: vi.fn(),
      saveScore: vi.fn(),
      updateSpan: vi.fn(),
    } as unknown as MastraStorage;

    this.mockLogger = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      trackException: vi.fn(),
    } as unknown as IMastraLogger;

    this.mockScorer = {
      id: 'test-scorer',
      name: 'test-scorer',
      description: 'Test scorer for unit tests',
      type: 'llm', // Changed from 'agent' to avoid utils functions
      run: vi.fn(),
    } as unknown as MastraScorer;

    this.mockTracingContext = {
      traceId: 'test-trace-123',
      spanId: 'test-span-123',
    } as TracingContext;
  }

  setupSuccessfulScenario(target: { traceId: string; spanId?: string } = { traceId: 'trace-1' }) {
    const mockTrace: TraceRecord = {
      traceId: target.traceId,
      spans: target.spanId
        ? [
            createMockSpanRecord({
              spanId: 'span-1',
              traceId: target.traceId,
              parentSpanId: null,
              name: 'root-span',
              spanType: SpanType.AGENT_RUN,
            }),
            createMockSpanRecord({
              spanId: target.spanId,
              traceId: target.traceId,
              parentSpanId: 'span-1',
              name: 'child-span',
              spanType: SpanType.MODEL_GENERATION,
            }),
          ]
        : [
            createMockSpanRecord({
              spanId: 'span-1',
              traceId: target.traceId,
              parentSpanId: null,
              name: 'root-span',
              spanType: SpanType.AGENT_RUN,
            }),
          ],
    };

    const mockScorerResult = createMockScorerResult({
      runId: 'run-123',
      input: { test: 'input' },
      output: { test: 'output' },
    });

    const mockSavedScore = {
      id: 'score-123',
      score: 0.85,
      scorer: { name: 'test-scorer' },
      createdAt: new Date(),
    };

    (this.mockStorage.getTrace as any).mockResolvedValue(mockTrace);
    (this.mockScorer.run as any).mockResolvedValue(mockScorerResult);
    (this.mockStorage.saveScore as any).mockResolvedValue({ score: mockSavedScore });
    (this.mockStorage.updateSpan as any).mockResolvedValue(undefined);

    return this;
  }

  setupErrorScenario(
    scenarioType: 'trace-not-found' | 'span-not-found' | 'no-root-span' | 'scorer-failure' | 'storage-failure',
    errorDetails?: any,
  ) {
    switch (scenarioType) {
      case 'trace-not-found':
        (this.mockStorage.getTrace as any).mockResolvedValue(null);
        break;

      case 'span-not-found':
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
        (this.mockStorage.getTrace as any).mockResolvedValue(mockTrace);
        break;

      case 'no-root-span':
        const mockTraceNoRoot: TraceRecord = {
          traceId: errorDetails?.traceId || 'trace-1',
          spans: [
            createMockSpanRecord({
              spanId: 'span-1',
              traceId: errorDetails?.traceId || 'trace-1',
              parentSpanId: 'parent-span', // Not a root span
              name: 'child-span',
              spanType: SpanType.MODEL_GENERATION,
            }),
          ],
        };
        (this.mockStorage.getTrace as any).mockResolvedValue(mockTraceNoRoot);
        break;

      case 'scorer-failure':
        this.setupSuccessfulScenario(errorDetails?.target || { traceId: 'trace-1' });
        (this.mockScorer.run as any).mockRejectedValue(errorDetails?.error || new Error('Scorer execution failed'));
        break;

      case 'storage-failure':
        (this.mockStorage.getTrace as any).mockRejectedValue(errorDetails?.error || new Error('Storage error'));
        break;
    }
    return this;
  }

  async runTarget(target: { traceId: string; spanId?: string }) {
    return runScorerOnTarget({
      storage: this.mockStorage,
      scorer: this.mockScorer,
      target,
      tracingContext: this.mockTracingContext,
    });
  }
}

describe('runScorerOnTarget Function', () => {
  let testContext: TestContext;

  beforeEach(() => {
    vi.clearAllMocks();
    testContext = new TestContext();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Successful execution', () => {
    it('should run scorer successfully with valid trace and span (no spanId)', async () => {
      const target = { traceId: 'trace-1' };
      testContext.setupSuccessfulScenario(target);

      await testContext.runTarget(target);

      expect(testContext.mockStorage.getTrace).toHaveBeenCalledWith('trace-1');
      expect(testContext.mockScorer.run).toHaveBeenCalled();
      expect(testContext.mockStorage.saveScore).toHaveBeenCalledWith(
        expect.objectContaining({
          runId: 'run-123',
          scorerId: 'test-scorer',
          entityId: 'root-span',
          entityType: SpanType.AGENT_RUN,
          source: 'TEST',
          traceId: 'trace-1',
        }),
      );
      expect(testContext.mockStorage.updateSpan).toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    describe('Data not found scenarios', () => {
      it('should handle trace not found scenario', async () => {
        const target = { traceId: 'nonexistent-trace' };
        testContext.setupErrorScenario('trace-not-found');
        await expect(testContext.runTarget(target)).rejects.toThrow();
      });

      it('should handle span not found scenario (with spanId)', async () => {
        const target = { traceId: 'trace-1', spanId: 'nonexistent-span' };
        testContext.setupErrorScenario('span-not-found', { traceId: 'trace-1' });
        await expect(testContext.runTarget(target)).rejects.toThrow();
      });

      it('should handle span not found scenario (no spanId, no root span)', async () => {
        const target = { traceId: 'trace-1' };
        testContext.setupErrorScenario('no-root-span', { traceId: 'trace-1' });
        await expect(testContext.runTarget(target)).rejects.toThrow();
      });
    });

    describe('Execution failures', () => {
      it('should handle scorer execution failures', async () => {
        const target = { traceId: 'trace-1' };
        const scorerError = new Error('Scorer execution failed');
        testContext.setupErrorScenario('scorer-failure', { target, error: scorerError });
        await expect(testContext.runTarget(target)).rejects.toThrow();
      });

      it('should throw if fetching the trace fails', async () => {
        const target = { traceId: 'trace-1' };
        const storageError = new Error('Storage error');
        testContext.setupErrorScenario('storage-failure', { error: storageError });
        await expect(testContext.runTarget(target)).rejects.toThrow('Storage error');
      });
    });
  });

  describe('Span selection logic', () => {
    it('should select root span when no spanId provided', async () => {
      const target = { traceId: 'trace-1' };
      testContext.setupSuccessfulScenario(target);
      await testContext.runTarget(target);
      expect(testContext.mockStorage.saveScore).toHaveBeenCalled();
      expect(testContext.mockStorage.updateSpan).toHaveBeenCalled();
    });

    it('should select specific span when spanId provided', async () => {
      const target = { traceId: 'trace-1', spanId: 'span-2' };
      testContext.setupSuccessfulScenario(target);
      await testContext.runTarget(target);
      expect(testContext.mockStorage.saveScore).toHaveBeenCalled();
      expect(testContext.mockStorage.updateSpan).toHaveBeenCalled();
    });
  });

  describe('Score result formatting', () => {
    it('should format scorer result correctly for trace without spanId', async () => {
      const target = { traceId: 'trace-1' };
      testContext.setupSuccessfulScenario(target);

      const mockScorerResult = createMockScorerResult({
        runId: 'run-123',
        input: { test: 'input' },
        output: { test: 'output' },
      });
      (testContext.mockScorer.run as any).mockResolvedValue(mockScorerResult);

      await testContext.runTarget(target);

      expect(testContext.mockStorage.saveScore).toHaveBeenCalledWith(
        expect.objectContaining({
          runId: 'run-123',
          input: { test: 'input' },
          output: { test: 'output' },
          scorer: {
            id: 'test-scorer',
            name: 'test-scorer',
            description: 'Test scorer for unit tests',
          },
          traceId: 'trace-1', // No spanId suffix
          entityId: 'root-span',
          entityType: SpanType.AGENT_RUN,
          entity: { traceId: 'trace-1', spanId: 'span-1' },
          source: 'TEST',
          scorerId: 'test-scorer',
        }),
      );
    });

    it('should format scorer result correctly for trace with spanId', async () => {
      const target = { traceId: 'trace-1', spanId: 'span-2' };
      testContext.setupSuccessfulScenario(target);

      const mockScorerResult = createMockScorerResult({
        runId: 'run-456',
        input: { test: 'input2' },
        output: { test: 'output2' },
      });
      (testContext.mockScorer.run as any).mockResolvedValue(mockScorerResult);

      await testContext.runTarget(target);

      expect(testContext.mockStorage.saveScore).toHaveBeenCalledWith(
        expect.objectContaining({
          runId: 'run-456',
          input: { test: 'input2' },
          output: { test: 'output2' },
          scorer: {
            id: 'test-scorer',
            name: 'test-scorer',
            description: 'Test scorer for unit tests',
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
});
