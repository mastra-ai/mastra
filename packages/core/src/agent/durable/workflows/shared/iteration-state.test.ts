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

function executionOutput(usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number }) {
  return {
    output: { text: 'done', usage },
    toolResults: [],
    stepResult: { reason: 'stop' },
    messageListState: {},
    state: {},
    messageId: 'message-1',
  } as any;
}

function iterationState(overrides: Record<string, unknown> = {}) {
  return {
    runId: 'run-1',
    agentId: 'agent-1',
    messageListState: {},
    toolsMetadata: [],
    modelConfig: {},
    options: {},
    state: {},
    messageId: 'message-0',
    iterationCount: 0,
    accumulatedSteps: [],
    accumulatedUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    ...overrides,
  } as any;
}

describe('calculateAccumulatedUsage', () => {
  it('adds complete usage and preserves explicit zeroes', () => {
    expect(
      calculateAccumulatedUsage(
        { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        { inputTokens: 0, outputTokens: 5, totalTokens: 5 },
      ),
    ).toEqual({ inputTokens: 10, outputTokens: 25, totalTokens: 35 });
  });

  it('marks only omitted counters unknown and keeps them unknown', () => {
    const incomplete = calculateAccumulatedUsage(
      { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      { outputTokens: 5 },
    );

    expect(incomplete).toEqual({ inputTokens: undefined, outputTokens: 25, totalTokens: undefined });
    expect(calculateAccumulatedUsage(incomplete, { inputTokens: 7, outputTokens: 3, totalTokens: 10 })).toEqual({
      inputTokens: undefined,
      outputTokens: 28,
      totalTokens: undefined,
    });
  });
});

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

  it('uses the zero identity for a legacy pre-first-step state', () => {
    const result = createBaseIterationStateUpdate({
      currentState: iterationState(),
      executionOutput: executionOutput({ inputTokens: 10, outputTokens: 20, totalTokens: 30 }),
    });

    expect(result.accumulatedUsage).toEqual({ inputTokens: 10, outputTokens: 20, totalTokens: 30 });
    expect(result.usageAggregationVersion).toBe(1);
  });

  it('fails closed for a legacy state that already contains steps', () => {
    const result = createBaseIterationStateUpdate({
      currentState: iterationState({
        iterationCount: 1,
        accumulatedSteps: [{ text: 'earlier' }],
        accumulatedUsage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      }),
      executionOutput: executionOutput({ inputTokens: 5, outputTokens: 5, totalTokens: 10 }),
    });

    expect(result.accumulatedUsage).toEqual({
      inputTokens: undefined,
      outputTokens: undefined,
      totalTokens: undefined,
    });
    expect(result.usageAggregationVersion).toBe(1);
  });
});
