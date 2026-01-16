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
        error: vi.fn(),
        trackException: vi.fn(),
      }),
    };
    const hookWithoutStorage = createOnScorerHook(mastraWithoutStorage as any);

    await hookWithoutStorage({
      runId: 'test-run',
      scorer: { id: 'test-scorer' },
      input: [],
      output: {},
      source: 'TEST',
      entity: { id: 'test-entity' },
      entityType: 'AGENT',
    });

    // Should not call any storage methods
    expect(mockScoresStore.saveScore).not.toHaveBeenCalled();
  });

  it('should handle scorer not found without throwing', async () => {
    const hookData = {
      runId: 'test-run',
      scorer: { id: 'test-scorer' },
      input: [],
      output: {},
      source: 'TEST' as const,
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
      source: 'TEST' as const,
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
      source: 'TEST',
      entity: { id: 'test-entity' },
      entityType: 'AGENT',
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

  it('should call currentSpan.addScore with correct arguments', async () => {
    const mockAddScore = vi.fn();
    const mockUpdate = vi.fn();

    const hookData = {
      runId: 'test-run',
      scorer: { id: 'test-scorer' },
      input: [{ message: 'test' }],
      output: { result: 'test' },
      source: 'TEST',
      entity: { id: 'test-entity' },
      entityType: 'AGENT',
      tracingContext: {
        currentSpan: {
          isValid: true,
          addScore: mockAddScore,
          update: mockUpdate,
        },
      },
    };

    const mockScorer = {
      id: 'test-scorer',
      name: 'test-scorer',
      description: 'Test scorer',
      run: vi.fn().mockResolvedValue({ score: 0.9, reason: 'great' }),
    };

    mockMastra.getAgentById.mockReturnValue({
      listScorers: vi.fn().mockResolvedValue({ 'test-scorer': { scorer: mockScorer } }),
    });

    await hook(hookData);

    expect(mockAddScore).toHaveBeenCalledTimes(1);
    expect(mockAddScore).toHaveBeenCalledWith(
      expect.objectContaining({
        scorerId: 'test-scorer',
        scorerName: 'test-scorer',
        score: 0.9,
        reason: 'great',
        source: 'TEST',
      }),
    );
    expect(mockUpdate).toHaveBeenCalledWith({});
  });

  it('should not call addScore when currentSpan is not valid', async () => {
    const mockAddScore = vi.fn();
    const mockUpdate = vi.fn();

    const hookData = {
      runId: 'test-run',
      scorer: { id: 'test-scorer' },
      input: [{ message: 'test' }],
      output: { result: 'test' },
      source: 'TEST',
      entity: { id: 'test-entity' },
      entityType: 'AGENT',
      tracingContext: {
        currentSpan: {
          isValid: false,
          addScore: mockAddScore,
          update: mockUpdate,
        },
      },
    };

    const mockScorer = {
      id: 'test-scorer',
      name: 'test-scorer',
      description: 'Test scorer',
      run: vi.fn().mockResolvedValue({ score: 0.9 }),
    };

    mockMastra.getAgentById.mockReturnValue({
      listScorers: vi.fn().mockResolvedValue({ 'test-scorer': { scorer: mockScorer } }),
    });

    await hook(hookData);

    expect(mockAddScore).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('should handle addScore errors gracefully', async () => {
    const mockAddScore = vi.fn().mockImplementation(() => {
      throw new Error('addScore failed');
    });
    const mockUpdate = vi.fn();

    const hookData = {
      runId: 'test-run',
      scorer: { id: 'test-scorer' },
      input: [{ message: 'test' }],
      output: { result: 'test' },
      source: 'TEST',
      entity: { id: 'test-entity' },
      entityType: 'AGENT',
      tracingContext: {
        currentSpan: {
          isValid: true,
          addScore: mockAddScore,
          update: mockUpdate,
        },
      },
    };

    const mockScorer = {
      id: 'test-scorer',
      name: 'test-scorer',
      description: 'Test scorer',
      run: vi.fn().mockResolvedValue({ score: 0.9 }),
    };

    mockMastra.getAgentById.mockReturnValue({
      listScorers: vi.fn().mockResolvedValue({ 'test-scorer': { scorer: mockScorer } }),
    });

    // Should not throw, just log warning
    await expect(hook(hookData)).resolves.not.toThrow();
    expect(mockAddScore).toHaveBeenCalled();
  });

  it('should not call addScore when tracingContext is missing', async () => {
    const hookData = {
      runId: 'test-run',
      scorer: { id: 'test-scorer' },
      input: [{ message: 'test' }],
      output: { result: 'test' },
      source: 'TEST',
      entity: { id: 'test-entity' },
      entityType: 'AGENT',
      // No tracingContext
    };

    const mockScorer = {
      id: 'test-scorer',
      name: 'test-scorer',
      description: 'Test scorer',
      run: vi.fn().mockResolvedValue({ score: 0.9 }),
    };

    mockMastra.getAgentById.mockReturnValue({
      listScorers: vi.fn().mockResolvedValue({ 'test-scorer': { scorer: mockScorer } }),
    });

    // Should not throw
    await expect(hook(hookData)).resolves.not.toThrow();
  });
});
