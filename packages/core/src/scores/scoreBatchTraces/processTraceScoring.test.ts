// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processTraceScoring } from './processTraceScoring';
import type { MastraScorer } from '../base';
import type { MastraStorage, AITraceRecord } from '../../storage';
import type { IMastraLogger } from '../../logger';

describe('processTraceScoring', () => {
  let mockScorer: MastraScorer;
  let mockStorage: MastraStorage;

  beforeEach(() => {
    vi.clearAllMocks();

    mockScorer = {
      name: 'test-scorer',
      run: vi.fn(),
    } as unknown as MastraScorer;

    mockStorage = {
      getAITrace: vi.fn(),
      saveScore: vi.fn(),
    } as unknown as MastraStorage;
  });

  it('should process workflow traces and score them successfully', async () => {
    // Arrange
    const targets = [
      { traceId: 'trace-123' }, // workflow trace-level scoring
      { traceId: 'trace-456', spanId: 'span-step-1' }, // workflow step span-level scoring
    ];

    const mockTrace: AITraceRecord = {
      traceId: 'trace-123',
      spans: [
        {
          spanId: 'workflow-span-123',
          spanType: 'workflow_run',
          traceId: 'trace-123',
          parentSpanId: null,
          input: { ingredient: 'tomato' },
          output: { recipe: 'tomato soup' },
          attributes: { workflowId: 'recipe-maker' },
        } as any,
        {
          spanId: 'span-step-1',
          spanType: 'workflow_step',
          traceId: 'trace-456',
          parentSpanId: 'workflow-span-123',
          input: { ingredient: 'tomato' },
          output: { processed: 'diced tomato' },
          attributes: { stepId: 'prep-step' },
        } as any,
      ],
    };

    const mockScorerResult = {
      score: 0.85,
      reason: 'Good workflow execution',
      runId: 'run-123',
    };

    (mockStorage.getAITrace as any).mockResolvedValue(mockTrace);
    (mockScorer.run as any).mockResolvedValue(mockScorerResult);

    // Act
    await processTraceScoring({
      scorer: mockScorer,
      targets,
      storage: mockStorage,
    });

    // Assert
    expect(mockStorage.getAITrace).toHaveBeenCalledTimes(2);
    expect(mockStorage.getAITrace).toHaveBeenCalledWith('trace-123');
    expect(mockStorage.getAITrace).toHaveBeenCalledWith('trace-456');

    expect(mockScorer.run).toHaveBeenCalledTimes(2);

    // First call: trace-level scoring (uses parent span)
    expect(mockScorer.run).toHaveBeenNthCalledWith(1, {
      input: { ingredient: 'tomato' },
      output: { recipe: 'tomato soup' },
    });

    // Second call: span-level scoring (uses specific span)
    expect(mockScorer.run).toHaveBeenNthCalledWith(2, {
      input: { ingredient: 'tomato' },
      output: { processed: 'diced tomato' },
    });

    expect(mockStorage.saveScore).toHaveBeenCalledTimes(2);
    expect(mockStorage.saveScore).toHaveBeenCalledWith({
      ...mockScorerResult,
      traceId: 'trace-123-workflow-span-123',
      entityId: 'recipe-maker',
      entityType: 'WORKFLOW',
      source: 'TEST',
      scorerId: 'test-scorer',
    });
  });

  it('should skip agent runs and log message', async () => {
    const targets = [{ traceId: 'agent-trace-123' }];

    const mockAgentTrace: AITraceRecord = {
      traceId: 'agent-trace-123',
      spans: [
        {
          spanId: 'agent-span-123',
          spanType: 'agent_run',
          parentSpanId: null,
          input: { messages: [{ role: 'user', content: 'hello' }] },
          output: { text: 'hi there' },
          attributes: { agentId: 'chat-agent' },
        } as any,
      ],
    };

    (mockStorage.getAITrace as any).mockResolvedValue(mockAgentTrace);
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Act
    await processTraceScoring({
      scorer: mockScorer,
      targets,
      storage: mockStorage,
    });

    // Assert
    expect(consoleSpy).toHaveBeenCalledWith('Skipping agent run agent-span-123');
    expect(mockScorer.run).not.toHaveBeenCalled();
    expect(mockStorage.saveScore).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('should handle missing trace gracefully', async () => {
    const targets = [{ traceId: 'missing-trace' }];
    const mockLogger = { warn: vi.fn() };

    (mockStorage.getAITrace as any).mockResolvedValue(null);

    // Act
    await processTraceScoring({
      scorer: mockScorer,
      targets,
      storage: mockStorage,
      logger: mockLogger as unknown as IMastraLogger,
    });

    // Assert
    expect(mockLogger.warn).toHaveBeenCalledWith('Trace missing-trace not found for scoring');
    expect(mockScorer.run).not.toHaveBeenCalled();
    expect(mockStorage.saveScore).not.toHaveBeenCalled();
  });
});
