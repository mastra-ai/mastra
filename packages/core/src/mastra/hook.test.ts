import { describe, expect, it, beforeEach, vi } from 'vitest';
import { validateAndSaveScore, createOnScorerHook } from './hooks';

describe('validateAndSaveScore', () => {
  let mockScoresStore: any;
  let mockStorage: any;

  beforeEach(() => {
    mockScoresStore = {
      saveScore: vi.fn().mockResolvedValue({ score: 'mocked' }),
    };
    mockStorage = {
      getStore: vi.fn((domain: string) => {
        if (domain === 'scores') return Promise.resolve(mockScoresStore);
        return Promise.resolve(undefined);
      }),
    };
  });

  it('should validate and save score with correct payload', async () => {
    const sampleScore = {
      runId: 'test-run-id',
      scorerId: 'test-scorer-id',
      entityId: 'test-entity-id',
      score: 0.5,
      source: 'TEST',
      entityType: 'AGENT',
      output: { result: 'test' },
      scorer: { name: 'test-scorer' },
      entity: { id: 'test-entity-id' },
    };

    await validateAndSaveScore(mockStorage, sampleScore);

    // Verify saveScore was called
    expect(mockScoresStore.saveScore).toHaveBeenCalledTimes(1);
    expect(mockScoresStore.saveScore).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'test-run-id',
        scorerId: 'test-scorer-id',
        entityId: 'test-entity-id',
        score: 0.5,
        source: 'TEST',
      }),
    );
  });

  it('should throw an error if missing required fields', async () => {
    const invalidScore = {
      runId: 'test-run-id',
    };

    await expect(validateAndSaveScore(mockStorage, invalidScore)).rejects.toThrow();

    // Verify saveScore was not called
    expect(mockScoresStore.saveScore).not.toHaveBeenCalled();
  });

  it('should filter out invalid fields', async () => {
    const sampleScore = {
      runId: 'test-run-id',
      scorerId: 'test-scorer-id',
      entityId: 'test-entity-id',
      score: 0.5,
      source: 'TEST',
      entityType: 'AGENT',
      output: { result: 'test' },
      scorer: { name: 'test-scorer' },
      entity: { id: 'test-entity-id' },
      invalidField: 'invalid',
    };

    await validateAndSaveScore(mockStorage, sampleScore);

    const expectedScore = {
      runId: 'test-run-id',
      scorerId: 'test-scorer-id',
      entityId: 'test-entity-id',
      score: 0.5,
      source: 'TEST',
      entityType: 'AGENT',
      output: { result: 'test' },
      scorer: { name: 'test-scorer' },
      entity: { id: 'test-entity-id' },
      // invalidField should be removed
    };

    expect(mockScoresStore.saveScore).toHaveBeenCalledTimes(1);
    expect(mockScoresStore.saveScore).toHaveBeenCalledWith(expectedScore);
  });
});

describe('createOnScorerHook', () => {
  let mockScoresStore: any;
  let mockStorage: any;
  let mockMastra: any;
  let hook: (hookData: any) => Promise<void>;

  beforeEach(() => {
    mockScoresStore = {
      saveScore: vi.fn().mockResolvedValue({ score: 'mocked' }),
    };
    mockStorage = {
      getStore: vi.fn((domain: string) => {
        if (domain === 'scores') return Promise.resolve(mockScoresStore);
        return Promise.resolve(undefined);
      }),
    };

    mockMastra = {
      getStorage: vi.fn().mockReturnValue(mockStorage),
      getLogger: vi.fn().mockReturnValue({
        error: vi.fn(),
        warn: vi.fn(),
        trackException: vi.fn(),
      }),
      getAgentById: vi.fn(),
      getWorkflowById: vi.fn(),
      getScorerById: vi.fn(),
    };

    hook = createOnScorerHook(mockMastra);
  });

  it('should return early if no storage', async () => {
    const mastraWithoutStorage = {
      getStorage: vi.fn().mockReturnValue(null),
      getLogger: vi.fn().mockReturnValue({
        warn: vi.fn(),
        trackException: vi.fn(),
      }),
    };
    const hookWithoutStorage = createOnScorerHook(mastraWithoutStorage as any);

    await hookWithoutStorage({
      runId: 'test-run',
      scorer: { id: 'test-scorer' },
      input: [],
      output: {},
      source: 'LIVE',
      entity: { id: 'test-entity' },
      entityType: 'AGENT',
    });

    // Should not call any storage methods
    expect(mockScoresStore.saveScore).not.toHaveBeenCalled();
  });

  it('should save score', async () => {
    const hookData = {
      runId: 'test-run',
      scorer: { id: 'test-scorer' },
      input: [{ message: 'test' }],
      output: { result: 'test' },
      source: 'LIVE' as const,
      entity: { id: 'test-entity' },
      entityType: 'AGENT' as const,
      entityId: 'test-entity',
      scorerId: 'test-scorer',
      score: 0.8,
    };

    const mockScorer = {
      id: 'test-scorer',
      name: 'test-scorer',
      run: vi.fn().mockResolvedValue({ score: 0.8 }),
    };

    mockMastra.getAgentById.mockReturnValue({
      listScorers: vi.fn().mockReturnValue({ 'test-scorer': { scorer: mockScorer } }),
    });

    await hook(hookData);

    // Verify saveScore was called
    expect(mockScoresStore.saveScore).toHaveBeenCalledTimes(1);
    expect(mockScoresStore.saveScore).toHaveBeenCalledWith(
      expect.objectContaining({
        score: 0.8,
        entityId: 'test-entity',
        scorerId: 'test-scorer',
        source: 'LIVE',
      }),
    );
  });

  it('should pass live span correlation context and metadata into scorer.run', async () => {
    const correlationContext = {
      traceId: 'trace-live',
      spanId: 'span-live',
      entityName: 'agent-run',
      rootEntityName: 'workflow-root',
      source: 'cloud',
      serviceName: 'test-service',
    };

    const hookData = {
      runId: 'test-run',
      scorer: { id: 'test-scorer' },
      input: [{ message: 'test' }],
      output: { result: 'test' },
      source: 'LIVE' as const,
      entity: { id: 'test-entity' },
      entityType: 'AGENT' as const,
      tracingContext: {
        currentSpan: {
          id: 'span-live',
          traceId: 'trace-live',
          isValid: true,
          metadata: { sessionId: 'session-1', inherited: true },
          getCorrelationContext: vi.fn().mockReturnValue(correlationContext),
          observabilityInstance: {
            getExporters: () => [],
          },
        },
      },
    };

    const mockScorer = {
      id: 'test-scorer',
      name: 'test-scorer',
      run: vi.fn().mockResolvedValue({ score: 0.8 }),
    };

    mockMastra.getAgentById.mockReturnValue({
      listScorers: vi.fn().mockReturnValue({ 'test-scorer': { scorer: mockScorer } }),
    });

    await hook(hookData);

    expect(mockScorer.run).toHaveBeenCalledWith(
      expect.objectContaining({
        scoreSource: 'live',
        targetScope: 'span',
        targetTraceId: 'trace-live',
        targetSpanId: 'span-live',
        targetCorrelationContext: correlationContext,
        targetMetadata: { sessionId: 'session-1', inherited: true },
      }),
    );
  });

  it('should handle scorer not found without throwing', async () => {
    const hookData = {
      runId: 'test-run',
      scorer: { id: 'test-scorer' },
      input: [],
      output: {},
      source: 'LIVE' as const,
      entity: { id: 'test-entity' },
      entityType: 'AGENT' as const,
    };

    mockMastra.getAgentById.mockReturnValue({
      listScorers: vi.fn().mockReturnValue({}), // Empty scorers
    });
    mockMastra.getScorerById.mockReturnValue(null);

    // Confirm it doesn't throw
    await expect(hook(hookData)).resolves.not.toThrow();

    // Should not call saveScore
    expect(mockScoresStore.saveScore).not.toHaveBeenCalled();
  });

  it('should handle scorer run failure without throwing', async () => {
    const hookData = {
      runId: 'test-run',
      scorer: { id: 'test-scorer' },
      input: [],
      output: {},
      source: 'LIVE' as const,
      entity: { id: 'test-entity' },
      entityType: 'AGENT' as const,
    };

    const mockScorer = {
      id: 'test-scorer',
      run: vi.fn().mockRejectedValue(new Error('Scorer failed')),
    };

    mockMastra.getAgentById.mockReturnValue({
      listScorers: vi.fn().mockReturnValue({ 'test-scorer': { scorer: mockScorer } }),
    });

    // Confirm it doesn't throw
    await expect(hook(hookData)).resolves.not.toThrow();

    // Should not call saveScore
    expect(mockScoresStore.saveScore).not.toHaveBeenCalled();
  });

  it('should handle validation errors without throwing', async () => {
    const hookData = {
      runId: 'test-run',
      scorer: { id: 'test-scorer' },
      input: [],
      output: {},
      source: 'LIVE' as const,
      entity: { id: 'test-entity' },
      entityType: 'AGENT' as const,
    };

    const mockScorer = {
      id: 'test-scorer',
      run: vi.fn().mockResolvedValue({
        // Missing required fields that will cause validation to fail
        invalidField: 'invalid',
      }),
    };

    mockMastra.getAgentById.mockReturnValue({
      listScorers: vi.fn().mockReturnValue({ 'test-scorer': { scorer: mockScorer } }),
    });

    // Confirm it doesn't throw even with validation errors
    await expect(hook(hookData)).resolves.not.toThrow();

    // Should not call saveScore due to validation failure
    expect(mockScoresStore.saveScore).not.toHaveBeenCalled();
  });

  it('does not publish a ScoreEvent itself — that is MastraScorer.run()`s job', async () => {
    const addScoreSpy = vi.fn().mockResolvedValue(undefined);
    mockMastra.observability = { addScore: addScoreSpy };

    const hookData = {
      runId: 'run-1',
      scorer: { id: 'test-scorer' },
      input: [{ message: 'hi' }],
      output: { result: 'ok' },
      source: 'LIVE' as const,
      entity: { id: 'agent-1' },
      entityType: 'AGENT' as const,
      tracingContext: {
        currentSpan: {
          id: 'span-123',
          traceId: 'trace-abc',
          isValid: true,
          metadata: { sessionId: 'session-789' },
          getCorrelationContext: vi.fn().mockReturnValue({ traceId: 'trace-abc', spanId: 'span-123' }),
        },
      },
    };

    const mockScorer = {
      id: 'test-scorer',
      name: 'Test Scorer',
      run: vi.fn().mockResolvedValue({ score: 0.9, reason: 'great' }),
    };

    mockMastra.getAgentById.mockReturnValue({
      listScorers: vi.fn().mockReturnValue({ 'test-scorer': { scorer: mockScorer } }),
    });

    await hook(hookData);

    // Hook only writes to the legacy scores store. ScoreEvent emission is owned by
    // MastraScorer.run() — emitting again here would double-publish to every exporter.
    expect(addScoreSpy).not.toHaveBeenCalled();
    expect(mockScoresStore.saveScore).toHaveBeenCalledTimes(1);
  });
});
