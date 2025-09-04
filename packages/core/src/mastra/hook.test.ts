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
      getScorerByName: vi.fn(),
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
    };

    const mockScorer = {
      run: vi.fn().mockResolvedValue({ score: 0.8 }),
    };

    mockMastra.getAgentById.mockReturnValue({
      getScorers: vi.fn().mockReturnValue({ 'test-scorer': { scorer: mockScorer } }),
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
      getScorers: vi.fn().mockReturnValue({}), // Empty scorers
    });
    mockMastra.getScorerByName.mockReturnValue(null);

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
      run: vi.fn().mockRejectedValue(new Error('Scorer failed')),
    };

    mockMastra.getAgentById.mockReturnValue({
      getScorers: vi.fn().mockReturnValue({ 'test-scorer': { scorer: mockScorer } }),
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
      run: vi.fn().mockResolvedValue({
        // Missing required fields that will cause validation to fail
        invalidField: 'invalid',
      }),
    };

    mockMastra.getAgentById.mockReturnValue({
      getScorers: vi.fn().mockReturnValue({ 'test-scorer': { scorer: mockScorer } }),
    });

    // Confirm it doesn't throw even with validation errors
    await expect(hook(hookData)).resolves.not.toThrow();

    // Should not call saveScore due to validation failure
    expect(mockStorage.saveScore).not.toHaveBeenCalled();
  });
});
