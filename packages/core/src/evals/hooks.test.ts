import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runScorer } from './hooks';
import * as hooks from '../hooks';
import type { MastraScorerEntry } from './base';
import { createScorer } from './base';
import { RequestContext } from '../request-context';

// Mock the hooks module
vi.mock('../hooks', () => ({
  AvailableHooks: {
    ON_SCORER_RUN: 'ON_SCORER_RUN',
  },
  executeHook: vi.fn(),
}));

describe('runScorer', () => {
  const mockExecuteHook = vi.mocked(hooks.executeHook);

  const createMockScorer = (id: string = 'test-scorer') => {
    return createScorer({
      id,
      name: id,
      description: 'Test scorer',
    }).generateScore(() => 0.8);
  };

  const createBaseScorerParams = (scorerObject: MastraScorerEntry) => ({
    runId: 'test-run-id',
    scorerId: scorerObject.scorer?.id || 'test-scorer',
    scorerObject,
    input: { test: 'input' },
    output: { test: 'output' },
    requestContext: new RequestContext([['key', 'value']]),
    entity: { id: 'test-entity' },
    structuredOutput: false,
    source: 'LIVE' as const,
    entityType: 'AGENT' as const,
    threadId: 'test-thread',
    resourceId: 'test-resource',
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('temperature array functionality', () => {
    it('should call executeHook once when no temperatures specified', () => {
      const scorer = createMockScorer();
      const scorerObject: MastraScorerEntry = { scorer };

      runScorer(createBaseScorerParams(scorerObject));

      expect(mockExecuteHook).toHaveBeenCalledTimes(1);
      expect(mockExecuteHook).toHaveBeenCalledWith(
        hooks.AvailableHooks.ON_SCORER_RUN,
        expect.objectContaining({
          temperature: undefined,
          modelSettings: undefined,
        }),
      );
    });

    it('should call executeHook once when temperatures array is empty', () => {
      const scorer = createMockScorer();
      const scorerObject: MastraScorerEntry = {
        scorer,
        temperatures: [],
      };

      runScorer(createBaseScorerParams(scorerObject));

      expect(mockExecuteHook).toHaveBeenCalledTimes(1);
      expect(mockExecuteHook).toHaveBeenCalledWith(
        hooks.AvailableHooks.ON_SCORER_RUN,
        expect.objectContaining({
          temperature: undefined,
        }),
      );
    });

    it('should call executeHook multiple times when temperatures array is provided', () => {
      const scorer = createMockScorer();
      const scorerObject: MastraScorerEntry = {
        scorer,
        temperatures: [0.3, 0.5, 0.7],
      };

      runScorer(createBaseScorerParams(scorerObject));

      expect(mockExecuteHook).toHaveBeenCalledTimes(3);

      // Verify each call has the correct temperature
      expect(mockExecuteHook).toHaveBeenNthCalledWith(
        1,
        hooks.AvailableHooks.ON_SCORER_RUN,
        expect.objectContaining({ temperature: 0.3 }),
      );
      expect(mockExecuteHook).toHaveBeenNthCalledWith(
        2,
        hooks.AvailableHooks.ON_SCORER_RUN,
        expect.objectContaining({ temperature: 0.5 }),
      );
      expect(mockExecuteHook).toHaveBeenNthCalledWith(
        3,
        hooks.AvailableHooks.ON_SCORER_RUN,
        expect.objectContaining({ temperature: 0.7 }),
      );
    });

    it('should merge temperature with existing modelSettings', () => {
      const scorer = createMockScorer();
      const scorerObject: MastraScorerEntry = {
        scorer,
        modelSettings: { maxTokens: 100, topP: 0.9 },
        temperatures: [0.5],
      };

      runScorer(createBaseScorerParams(scorerObject));

      expect(mockExecuteHook).toHaveBeenCalledWith(
        hooks.AvailableHooks.ON_SCORER_RUN,
        expect.objectContaining({
          temperature: 0.5,
          modelSettings: { maxTokens: 100, topP: 0.9, temperature: 0.5 },
        }),
      );
    });

    it('should override modelSettings.temperature with temperatures array value', () => {
      const scorer = createMockScorer();
      const scorerObject: MastraScorerEntry = {
        scorer,
        modelSettings: { temperature: 0.1, maxTokens: 100 },
        temperatures: [0.9],
      };

      runScorer(createBaseScorerParams(scorerObject));

      expect(mockExecuteHook).toHaveBeenCalledWith(
        hooks.AvailableHooks.ON_SCORER_RUN,
        expect.objectContaining({
          temperature: 0.9,
          modelSettings: { temperature: 0.9, maxTokens: 100 },
        }),
      );
    });

    it('should pass modelSettings without temperature when no temperatures array provided', () => {
      const scorer = createMockScorer();
      const scorerObject: MastraScorerEntry = {
        scorer,
        modelSettings: { maxTokens: 100, topP: 0.9 },
      };

      runScorer(createBaseScorerParams(scorerObject));

      expect(mockExecuteHook).toHaveBeenCalledWith(
        hooks.AvailableHooks.ON_SCORER_RUN,
        expect.objectContaining({
          temperature: undefined,
          modelSettings: { maxTokens: 100, topP: 0.9 },
        }),
      );
    });

    it('should handle single temperature in array', () => {
      const scorer = createMockScorer();
      const scorerObject: MastraScorerEntry = {
        scorer,
        temperatures: [0.42],
      };

      runScorer(createBaseScorerParams(scorerObject));

      expect(mockExecuteHook).toHaveBeenCalledTimes(1);
      expect(mockExecuteHook).toHaveBeenCalledWith(
        hooks.AvailableHooks.ON_SCORER_RUN,
        expect.objectContaining({ temperature: 0.42 }),
      );
    });

    it('should handle temperature value of 0', () => {
      const scorer = createMockScorer();
      const scorerObject: MastraScorerEntry = {
        scorer,
        temperatures: [0],
      };

      runScorer(createBaseScorerParams(scorerObject));

      expect(mockExecuteHook).toHaveBeenCalledTimes(1);
      expect(mockExecuteHook).toHaveBeenCalledWith(
        hooks.AvailableHooks.ON_SCORER_RUN,
        expect.objectContaining({
          temperature: 0,
          modelSettings: { temperature: 0 },
        }),
      );
    });
  });

  describe('sampling integration', () => {
    it('should not call executeHook when sampling rate rejects', () => {
      // Mock Math.random to always return a high value (rejected by 0.1 rate)
      vi.spyOn(Math, 'random').mockReturnValue(0.5);

      const scorer = createMockScorer();
      const scorerObject: MastraScorerEntry = {
        scorer,
        sampling: { type: 'ratio', rate: 0.1 },
        temperatures: [0.3, 0.5, 0.7],
      };

      runScorer(createBaseScorerParams(scorerObject));

      expect(mockExecuteHook).not.toHaveBeenCalled();
    });

    it('should call executeHook for all temperatures when sampling rate accepts', () => {
      // Mock Math.random to always return a low value (accepted by 0.9 rate)
      vi.spyOn(Math, 'random').mockReturnValue(0.1);

      const scorer = createMockScorer();
      const scorerObject: MastraScorerEntry = {
        scorer,
        sampling: { type: 'ratio', rate: 0.9 },
        temperatures: [0.3, 0.5, 0.7],
      };

      runScorer(createBaseScorerParams(scorerObject));

      expect(mockExecuteHook).toHaveBeenCalledTimes(3);
    });
  });

  describe('payload structure', () => {
    it('should include all required fields in payload', () => {
      const scorer = createMockScorer('my-scorer');
      const scorerObject: MastraScorerEntry = {
        scorer,
        temperatures: [0.5],
        modelSettings: { maxTokens: 50 },
      };

      const params = createBaseScorerParams(scorerObject);
      runScorer(params);

      expect(mockExecuteHook).toHaveBeenCalledWith(
        hooks.AvailableHooks.ON_SCORER_RUN,
        expect.objectContaining({
          scorer: expect.objectContaining({
            id: 'my-scorer',
            name: 'my-scorer',
            description: 'Test scorer',
          }),
          input: { test: 'input' },
          output: { test: 'output' },
          runId: 'test-run-id',
          source: 'LIVE',
          entityType: 'AGENT',
          threadId: 'test-thread',
          resourceId: 'test-resource',
          temperature: 0.5,
          modelSettings: { maxTokens: 50, temperature: 0.5 },
        }),
      );
    });
  });
});
