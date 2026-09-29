import { describe, expect, it } from 'vitest';
import { createBaseIterationStateUpdate } from './iteration-state';

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
