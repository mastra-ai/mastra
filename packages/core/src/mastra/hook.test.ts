import { describe, expect, it, beforeEach, vi } from 'vitest';
import { validateAndSaveScore, createOnScorerHook } from './hooks';

describe('validateAndSaveScore', () => {
  let mockStorage: any;

  beforeEach(() => {
    mockStorage = {
      saveScore: vi.fn().mockResolvedValue({ score: 'mocked' }),
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
    expect(mockStorage.saveScore).toHaveBeenCalledTimes(1);
    expect(mockStorage.saveScore).toHaveBeenCalledWith(
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
    expect(mockStorage.saveScore).not.toHaveBeenCalled();
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

    expect(mockStorage.saveScore).toHaveBeenCalledTimes(1);
    expect(mockStorage.saveScore).toHaveBeenCalledWith(expectedScore);
  });
});

describe('createOnScorerHook', () => {
  let mockStorage: any;
  let mockMastra: any;
  let hook: (hookData: any) => Promise<void>;

  beforeEach(() => {
    mockStorage = {
      saveScore: vi.fn().mockResolvedValue({ score: 'mocked' }),
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
    expect(mockStorage.saveScore).not.toHaveBeenCalled();
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
    expect(mockStorage.saveScore).toHaveBeenCalledTimes(1);
    expect(mockStorage.saveScore).toHaveBeenCalledWith(
      expect.objectContaining({
        score: 0.8,
        entityId: 'test-entity',
        scorerId: 'test-scorer',
        source: 'LIVE',
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
    expect(mockStorage.saveScore).not.toHaveBeenCalled();
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
    expect(mockStorage.saveScore).not.toHaveBeenCalled();
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
    expect(mockStorage.saveScore).not.toHaveBeenCalled();
  });

  it('should call addScoreToTrace on exporters with expected arguments', async () => {
    const mockExporter = {
      addScoreToTrace: vi.fn().mockResolvedValue(undefined),
    };

    const hookData = {
      runId: 'run-1',
      scorer: { id: 'test-scorer' },
      input: [],
      output: {},
      source: 'LIVE' as const,
      entity: { id: 'agent-1' },
      entityType: 'AGENT' as const,
      tracingContext: {
        currentSpan: {
          id: 'span-123',
          traceId: 'trace-abc',
          isValid: true,
          metadata: { sessionId: 'session-789', extra: 'meta' },
          observabilityInstance: {
            getExporters: () => [mockExporter],
          },
        },
      },
    };

    const mockScorer = {
      id: 'test-scorer',
      name: 'test-scorer',
      run: vi.fn().mockResolvedValue({ score: 0.9, reason: 'great' }),
    };

    mockMastra.getAgentById.mockReturnValue({
      listScorers: vi.fn().mockReturnValue({ 'test-scorer': { scorer: mockScorer } }),
    });

    await hook(hookData);

    expect(mockExporter.addScoreToTrace).toHaveBeenCalledTimes(1);
    expect(mockExporter.addScoreToTrace).toHaveBeenCalledWith({
      traceId: 'trace-abc',
      spanId: 'span-123',
      score: 0.9,
      reason: 'great',
      scorerName: 'test-scorer',
      metadata: { sessionId: 'session-789', extra: 'meta' },
    });
  });

  it('should call addScoreToTrace for multiple exporters', async () => {
    const exporterA = { addScoreToTrace: vi.fn().mockResolvedValue(undefined) };
    const exporterB = { addScoreToTrace: vi.fn().mockResolvedValue(undefined) };

    const hookData = {
      runId: 'run-2',
      scorer: { id: 'perf-scorer' },
      input: [],
      output: {},
      source: 'LIVE' as const,
      entity: { id: 'agent-2' },
      entityType: 'AGENT' as const,
      tracingContext: {
        currentSpan: {
          id: 'span-999',
          traceId: 'trace-zzz',
          isValid: true,
          metadata: { key: 'value' },
          observabilityInstance: {
            getExporters: () => [exporterA, exporterB],
          },
        },
      },
    };

    const mockScorer = {
      id: 'perf-scorer',
      name: 'perf-scorer',
      run: vi.fn().mockResolvedValue({ score: 0.42, reason: 'ok' }),
    };

    mockMastra.getAgentById.mockReturnValue({
      listScorers: vi.fn().mockReturnValue({ 'perf-scorer': { scorer: mockScorer } }),
    });

    await hook(hookData);

    const expectedPayload = {
      traceId: 'trace-zzz',
      spanId: 'span-999',
      score: 0.42,
      reason: 'ok',
      scorerName: 'perf-scorer',
      metadata: { key: 'value' },
    };

    expect(exporterA.addScoreToTrace).toHaveBeenCalledTimes(1);
    expect(exporterA.addScoreToTrace).toHaveBeenCalledWith(expectedPayload);
    expect(exporterB.addScoreToTrace).toHaveBeenCalledTimes(1);
    expect(exporterB.addScoreToTrace).toHaveBeenCalledWith(expectedPayload);
  });

  it('should skip exporters without addScoreToTrace method', async () => {
    const exporterWithMethod = { addScoreToTrace: vi.fn().mockResolvedValue(undefined) };
    const exporterWithoutMethod = {};

    const hookData = {
      runId: 'run-3',
      scorer: { id: 'test-scorer' },
      input: [],
      output: {},
      source: 'LIVE' as const,
      entity: { id: 'agent-3' },
      entityType: 'AGENT' as const,
      tracingContext: {
        currentSpan: {
          id: 'span-456',
          traceId: 'trace-def',
          isValid: true,
          metadata: {},
          observabilityInstance: {
            getExporters: () => [exporterWithMethod, exporterWithoutMethod],
          },
        },
      },
    };

    const mockScorer = {
      id: 'test-scorer',
      name: 'test-scorer',
      run: vi.fn().mockResolvedValue({ score: 0.7 }),
    };

    mockMastra.getAgentById.mockReturnValue({
      listScorers: vi.fn().mockReturnValue({ 'test-scorer': { scorer: mockScorer } }),
    });

    await hook(hookData);

    // Only the exporter with addScoreToTrace should be called
    expect(exporterWithMethod.addScoreToTrace).toHaveBeenCalledTimes(1);
    expect(exporterWithMethod.addScoreToTrace).toHaveBeenCalledWith({
      traceId: 'trace-def',
      spanId: 'span-456',
      score: 0.7,
      reason: undefined,
      scorerName: 'test-scorer',
      metadata: {},
    });
  });

  it('should handle addScoreToTrace throwing without failing the hook', async () => {
    const mockExporter = {
      addScoreToTrace: vi.fn().mockRejectedValue(new Error('Exporter failed')),
    };

    const hookData = {
      runId: 'run-4',
      scorer: { id: 'test-scorer' },
      input: [],
      output: {},
      source: 'LIVE' as const,
      entity: { id: 'agent-4' },
      entityType: 'AGENT' as const,
      tracingContext: {
        currentSpan: {
          id: 'span-789',
          traceId: 'trace-ghi',
          isValid: true,
          metadata: { test: 'data' },
          observabilityInstance: {
            getExporters: () => [mockExporter],
          },
        },
      },
    };

    const mockScorer = {
      id: 'test-scorer',
      name: 'test-scorer',
      run: vi.fn().mockResolvedValue({ score: 0.8, reason: 'good' }),
    };

    mockMastra.getAgentById.mockReturnValue({
      listScorers: vi.fn().mockReturnValue({ 'test-scorer': { scorer: mockScorer } }),
    });

    // Should not throw even if addScoreToTrace fails
    await expect(hook(hookData)).resolves.not.toThrow();

    // Should still call addScoreToTrace (the error is handled internally)
    expect(mockExporter.addScoreToTrace).toHaveBeenCalledTimes(1);
    expect(mockExporter.addScoreToTrace).toHaveBeenCalledWith({
      traceId: 'trace-ghi',
      spanId: 'span-789',
      score: 0.8,
      reason: 'good',
      scorerName: 'test-scorer',
      metadata: { test: 'data' },
    });

    // Storage should still be called despite exporter failure
    expect(mockStorage.saveScore).toHaveBeenCalledTimes(1);
  });
});
