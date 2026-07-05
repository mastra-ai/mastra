import { describe, it, expect } from 'vitest';
import {
  calculateAccumulatedUsage,
  buildStepRecord,
  createBaseIterationStateUpdate,
} from './iteration-state';
import type { BaseIterationState } from './schemas';
import type { DurableAgenticExecutionOutput } from '../../types';

describe('calculateAccumulatedUsage', () => {
  const base = { inputTokens: 10, outputTokens: 20, totalTokens: 30 };

  it('sums token counts when execution usage is provided', () => {
    const result = calculateAccumulatedUsage(base, { inputTokens: 5, outputTokens: 7, totalTokens: 12 });
    expect(result).toEqual({ inputTokens: 15, outputTokens: 27, totalTokens: 42 });
  });

  it('returns current usage unchanged when execution usage is undefined', () => {
    const result = calculateAccumulatedUsage(base);
    expect(result).toEqual(base);
  });

  it('treats missing token fields as zero', () => {
    const result = calculateAccumulatedUsage(base, { inputTokens: 3 });
    expect(result).toEqual({ inputTokens: 13, outputTokens: 20, totalTokens: 30 });
  });

  it('handles zero-value current usage', () => {
    const zero = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    const result = calculateAccumulatedUsage(zero, { inputTokens: 1, outputTokens: 2, totalTokens: 3 });
    expect(result).toEqual({ inputTokens: 1, outputTokens: 2, totalTokens: 3 });
  });
});

describe('buildStepRecord', () => {
  const makeOutput = (overrides: Partial<DurableAgenticExecutionOutput> = {}): DurableAgenticExecutionOutput => ({
    output: {
      text: 'hello',
      toolCalls: [{ type: 'tool-call', toolCallId: 'tc1', toolName: 't', input: {} }],
      toolResults: [{ type: 'tool-result', toolCallId: 'tc1', toolName: 't', output: {} }],
      usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
    },
    toolResults: [{ type: 'tool-result', toolCallId: 'tc1', toolName: 't', output: {} }],
    stepResult: { reason: 'stop' },
    messageListState: {},
    state: {},
    messageId: 'm1',
    backgroundTaskPending: false,
    delegationBailed: false,
    ...overrides,
  } as unknown as DurableAgenticExecutionOutput);

  it('maps execution output fields onto a StepRecord', () => {
    const record = buildStepRecord(makeOutput());
    expect(record.text).toBe('hello');
    expect(record.toolCalls).toHaveLength(1);
    expect(record.toolResults).toHaveLength(1);
    expect(record.usage).toEqual({ inputTokens: 1, outputTokens: 2, totalTokens: 3 });
    expect(record.finishReason).toBe('stop');
  });

  it('preserves undefined text when missing', () => {
    const out = makeOutput({ output: { text: undefined } } as any);
    expect(buildStepRecord(out).text).toBeUndefined();
  });
});

describe('createBaseIterationStateUpdate', () => {
  const baseState: BaseIterationState = {
    runId: 'run-1',
    agentId: 'agent-1',
    agentName: 'Agent',
    messageListState: {},
    toolsMetadata: [],
    modelConfig: {} as any,
    options: {} as any,
    state: {},
    messageId: 'm0',
    iterationCount: 0,
    accumulatedSteps: [],
    accumulatedUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    lastStepResult: {} as any,
    backgroundTaskPending: false,
    delegationBailed: false,
    pendingFeedbackStop: false,
    agentSpanData: {} as any,
    modelSpanData: {} as any,
  } as unknown as BaseIterationState;

  const execOutput = {
    output: { text: 'step-1', usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
    toolResults: [],
    stepResult: { reason: 'stop' },
    messageListState: { updated: true },
    state: { phase: 'running' },
    messageId: 'm1',
    backgroundTaskPending: true,
    delegationBailed: false,
  } as unknown as DurableAgenticExecutionOutput;

  it('increments iteration count and accumulates usage', () => {
    const next = createBaseIterationStateUpdate({ currentState: baseState, executionOutput: execOutput });
    expect(next.iterationCount).toBe(1);
    expect(next.accumulatedUsage).toEqual({ inputTokens: 10, outputTokens: 5, totalTokens: 15 });
    expect(next.accumulatedSteps).toHaveLength(1);
  });

  it('carries forward identity and config fields unchanged', () => {
    const next = createBaseIterationStateUpdate({ currentState: baseState, executionOutput: execOutput });
    expect(next.runId).toBe('run-1');
    expect(next.agentId).toBe('agent-1');
    expect(next.agentName).toBe('Agent');
    expect(next.toolsMetadata).toBe(baseState.toolsMetadata);
    expect(next.modelConfig).toBe(baseState.modelConfig);
    expect(next.options).toBe(baseState.options);
  });

  it('propagates execution output state fields', () => {
    const next = createBaseIterationStateUpdate({ currentState: baseState, executionOutput: execOutput });
    expect(next.messageListState).toEqual({ updated: true });
    expect(next.state).toEqual({ phase: 'running' });
    expect(next.messageId).toBe('m1');
    expect(next.backgroundTaskPending).toBe(true);
    expect(next.delegationBailed).toBe(false);
    expect(next.lastStepResult).toEqual({ reason: 'stop' });
  });

  it('preserves pendingFeedbackStop and span identity across iterations', () => {
    const stateWithFlags = { ...baseState, pendingFeedbackStop: true };
    const next = createBaseIterationStateUpdate({ currentState: stateWithFlags, executionOutput: execOutput });
    expect(next.pendingFeedbackStop).toBe(true);
    expect(next.agentSpanData).toBe(baseState.agentSpanData);
    expect(next.modelSpanData).toBe(baseState.modelSpanData);
  });

  it('accumulates steps across multiple iterations', () => {
    const first = createBaseIterationStateUpdate({ currentState: baseState, executionOutput: execOutput });
    const second = createBaseIterationStateUpdate({ currentState: first, executionOutput: execOutput });
    expect(second.iterationCount).toBe(2);
    expect(second.accumulatedSteps).toHaveLength(2);
    expect(second.accumulatedUsage).toEqual({ inputTokens: 20, outputTokens: 10, totalTokens: 30 });
  });
});
