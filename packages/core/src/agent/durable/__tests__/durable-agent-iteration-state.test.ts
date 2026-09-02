import { describe, expect, it } from 'vitest';
import { createBaseIterationStateUpdate } from '../workflows/shared/iteration-state';

const largeToolResult = { value: 'x'.repeat(512 * 1024) };

function createUpdate(includeToolResultsInStepRecord?: boolean) {
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
      messageListState: { messages: [{ content: largeToolResult }] },
      messageId: 'message-1',
      stepResult: { reason: 'tool-calls', isContinued: true },
      toolResults: [largeToolResult],
      output: {
        text: '',
        toolCalls: [{ toolCallId: 'call-1', toolName: 'large-tool', args: {} }],
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        steps: [],
      },
      state: {},
    } as any,
    includeToolResultsInStepRecord,
  });
}

describe('createBaseIterationStateUpdate', () => {
  it('includes tool results in step records by default', () => {
    const update = createUpdate();

    expect(update.accumulatedSteps[0]).toMatchObject({ toolResults: [largeToolResult] });
  });

  it('omits duplicate tool results from compact step records while preserving message history', () => {
    const update = createUpdate(false);

    expect(update.accumulatedSteps[0]).not.toHaveProperty('toolResults');
    expect(update.messageListState).toEqual({ messages: [{ content: largeToolResult }] });
    expect(JSON.stringify(update)).not.toContain('"toolResults"');
  });
});
