import { describe, expect, it } from 'vitest';

import { createBaseIterationStateUpdate } from './iteration-state';

describe('createBaseIterationStateUpdate', () => {
  it('preserves request context entries for the next iteration', () => {
    const nextState = createBaseIterationStateUpdate({
      currentState: {
        runId: 'run-1',
        agentId: 'agent-1',
        messageListState: {},
        toolsMetadata: [],
        modelConfig: {},
        options: {},
        state: {},
        messageId: 'message-1',
        requestContextEntries: { tenantId: 'tenant-1' },
        iterationCount: 0,
        accumulatedSteps: [],
        accumulatedUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      } as any,
      executionOutput: {
        messageListState: {},
        messageId: 'message-2',
        state: {},
        output: { usage: {} },
        stepResult: { reason: 'tool-calls' },
      } as any,
    });

    expect(nextState.requestContextEntries).toEqual({ tenantId: 'tenant-1' });
  });
});
