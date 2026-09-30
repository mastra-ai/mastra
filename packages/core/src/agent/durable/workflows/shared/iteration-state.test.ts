import { describe, expect, it } from 'vitest';
import { calculateAccumulatedUsage, createBaseIterationStateUpdate } from './iteration-state';

const providerRequest = {
  body: {
    prompt: 'p'.repeat(10_000),
    tools: Array.from({ length: 20 }, (_, index) => ({
      name: `tool-${index}`,
      inputSchema: {
        description: 's'.repeat(1_000),
      },
    })),
  },
};

function createUpdate() {
  return createBaseIterationStateUpdate({
    currentState: {
      runId: 'run-1',
      agentId: 'agent-1',
      agentName: 'Agent',
      iterationCount: 0,
      accumulatedSteps: [],
      accumulatedUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    } as any,
    executionOutput: {
      messageListState: { messages: [] },
      messageId: 'message-1',
      stepResult: {
        reason: 'tool-calls',
        isContinued: true,
        warnings: ['warning'],
        totalUsage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
        request: providerRequest,
      },
      output: {
        text: '',
        toolCalls: [],
        toolResults: [],
        usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
        steps: [],
      },
      state: {},
    } as any,
  });
}

describe('createBaseIterationStateUpdate', () => {
  it('does not carry the provider request into the next iteration', () => {
    const update = createUpdate();

    expect(update.lastStepResult).toEqual({
      reason: 'tool-calls',
      isContinued: true,
      warnings: ['warning'],
      totalUsage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
    });
    expect(JSON.stringify(update)).not.toContain('tool-19');
  });
});

describe('calculateAccumulatedUsage', () => {
  const base = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

  it('sums cache and reasoning token details across steps', () => {
    const first = calculateAccumulatedUsage(base, {
      inputTokens: 100,
      outputTokens: 10,
      totalTokens: 110,
      cachedInputTokens: 80,
      cacheCreationInputTokens: 5,
      reasoningTokens: 4,
    });
    const second = calculateAccumulatedUsage(first, {
      inputTokens: 50,
      outputTokens: 20,
      totalTokens: 70,
      cachedInputTokens: 40,
      reasoningTokens: 6,
    });
    expect(second).toEqual({
      inputTokens: 150,
      outputTokens: 30,
      totalTokens: 180,
      cachedInputTokens: 120,
      cacheCreationInputTokens: 5,
      reasoningTokens: 10,
    });
  });

  it('leaves detail fields undefined when no step reports them', () => {
    const result = calculateAccumulatedUsage(base, { inputTokens: 1, outputTokens: 2, totalTokens: 3 });
    expect(result).toEqual({ inputTokens: 1, outputTokens: 2, totalTokens: 3 });
  });
});
