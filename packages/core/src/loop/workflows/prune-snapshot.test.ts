/**
 * Unit coverage for the `stepResult.request` strip in the agent-loop snapshot
 * pruner. The engine echoes the raw provider request (full serialized prompt
 * plus the entire tool JSON schema) into `stepResult.request` on both sides of
 * every step result, and the snapshot is re-persisted at every step boundary,
 * so the echo dominates persisted bytes on long conversations. Nothing reads
 * it back; resume rebuilds requests from `messageListState`.
 */
import { describe, expect, it } from 'vitest';
import type { WorkflowRunState } from '../../workflows/types';
import { pruneAgentLoopSnapshot } from './prune-snapshot';

function requestEcho() {
  return {
    body: {
      messages: [{ role: 'user', content: [{ type: 'text', text: 'x'.repeat(2000) }] }],
      tools: [{ type: 'function', function: { name: 'big', parameters: { blob: 'y'.repeat(2000) } } }],
    },
  };
}

function stepResult() {
  return {
    reason: 'tool-calls',
    isContinued: true,
    messageId: 'msg-1',
    warnings: [],
    totalUsage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    request: requestEcho(),
  };
}

function snapshotWith(steps: Record<string, Record<string, unknown>>): WorkflowRunState {
  return { context: { input: { some: 'input' }, ...steps } } as unknown as WorkflowRunState;
}

/** Deep-scans a structure for surviving `stepResult.request` occurrences. */
function countRequestEchoes(value: unknown): number {
  if (Array.isArray(value)) return value.reduce<number>((n, v) => n + countRequestEchoes(v), 0);
  if (value === null || typeof value !== 'object') return 0;
  const record = value as Record<string, unknown>;
  let n = 0;
  const sr = record.stepResult;
  if (sr !== null && typeof sr === 'object' && 'request' in (sr as object)) n += 1;
  for (const v of Object.values(record)) n += countRequestEchoes(v);
  return n;
}

describe('pruneAgentLoopSnapshot stepResult.request strip', () => {
  it('strips the request echo from a terminal step on both payload and output', () => {
    const pruned = pruneAgentLoopSnapshot({
      snapshot: snapshotWith({
        'durable-llm-execution': {
          status: 'success',
          payload: { stepResult: stepResult() },
          output: { stepResult: stepResult() },
        },
      }),
    });

    const step = (pruned.context as Record<string, any>)['durable-llm-execution'];
    expect(step.payload.stepResult).not.toHaveProperty('request');
    expect(step.output.stepResult).not.toHaveProperty('request');
  });

  it('strips non-terminal steps too, since the snapshot persists at every step boundary', () => {
    const pruned = pruneAgentLoopSnapshot({
      snapshot: snapshotWith({
        'durable-tool-call': {
          status: 'running',
          payload: { stepResult: stepResult() },
          output: { stepResult: stepResult() },
        },
      }),
    });

    expect(countRequestEchoes((pruned.context as Record<string, any>)['durable-tool-call'])).toBe(0);
  });

  it('preserves every routing field of stepResult', () => {
    const pruned = pruneAgentLoopSnapshot({
      snapshot: snapshotWith({
        step: { status: 'success', output: { stepResult: stepResult() } },
      }),
    });

    const kept = (pruned.context as Record<string, any>).step.output.stepResult;
    expect(kept.reason).toBe('tool-calls');
    expect(kept.isContinued).toBe(true);
    expect(kept.messageId).toBe('msg-1');
    expect(kept.totalUsage).toEqual({ inputTokens: 10, outputTokens: 20, totalTokens: 30 });
    expect(kept.warnings).toEqual([]);
  });

  it('passes step results without a stepResult through unchanged', () => {
    const pruned = pruneAgentLoopSnapshot({
      snapshot: snapshotWith({
        'collect-tool-results': { status: 'success', output: { toolResults: [{ result: 'ok' }] } },
      }),
    });

    expect((pruned.context as Record<string, any>)['collect-tool-results']).toMatchObject({
      output: { toolResults: [{ result: 'ok' }] },
    });
  });

  it('leaves no echo anywhere in a mixed snapshot', () => {
    const build = () =>
      snapshotWith({
        a: { status: 'success', payload: { stepResult: stepResult() }, output: { stepResult: stepResult() } },
        b: { status: 'running', payload: { stepResult: stepResult() }, output: { stepResult: stepResult() } },
        c: { status: 'success', output: { stepResult: stepResult() } },
      });

    // Self-check: the unpruned snapshot really carries 5 echoes, so the zero
    // below cannot pass vacuously.
    expect(countRequestEchoes(build())).toBe(5);
    expect(countRequestEchoes(pruneAgentLoopSnapshot({ snapshot: build() }))).toBe(0);
  });

  it('prunes array-shaped foreach entries while preserving the array and live resume state', () => {
    const original = snapshotWith({
      'durable-tool-call': {
        status: 'suspended',
        suspendPayload: {
          __workflow_meta: {
            foreachOutput: [
              {
                status: 'success',
                payload: { stepResult: stepResult(), messages: { all: ['old conversation'] } },
                output: { stepResult: stepResult(), messages: { all: ['old conversation'] } },
                suspendPayload: { __streamState: { messageList: 'stale' } },
              },
              {
                status: 'suspended',
                payload: { stepResult: stepResult(), messages: { all: ['current conversation'] } },
                suspendPayload: {
                  __streamState: { messageList: 'live' },
                  approval: { toolCallId: 'tool-1' },
                },
              },
            ],
          },
        },
      },
    });

    const pruned = pruneAgentLoopSnapshot({ snapshot: original });
    const foreachOutput = (pruned.context as Record<string, any>)['durable-tool-call'].suspendPayload.__workflow_meta
      .foreachOutput;

    expect(Array.isArray(foreachOutput)).toBe(true);
    expect(foreachOutput).toHaveLength(2);
    expect(foreachOutput[0]).not.toHaveProperty('suspendPayload');
    expect(foreachOutput[0].payload).not.toHaveProperty('messages');
    expect(foreachOutput[0].output).not.toHaveProperty('messages');
    expect(countRequestEchoes(foreachOutput[0])).toBe(0);
    expect(foreachOutput[1].payload).not.toHaveProperty('messages');
    expect(foreachOutput[1].suspendPayload).toEqual({
      __streamState: { messageList: 'live' },
      approval: { toolCallId: 'tool-1' },
    });

    const originalForeachOutput = (original.context as Record<string, any>)['durable-tool-call'].suspendPayload
      .__workflow_meta.foreachOutput;
    expect(originalForeachOutput[0].suspendPayload.__streamState.messageList).toBe('stale');
    expect(countRequestEchoes(originalForeachOutput)).toBe(3);
  });

  it('strips stream-state mirrors from array-shaped foreach output in snapshot.result', () => {
    const snapshot = {
      context: { input: { some: 'input' } },
      result: {
        status: 'suspended',
        suspendPayload: {
          __streamState: { messageList: 'outer mirror' },
          __workflow_meta: {
            foreachOutput: [
              { status: 'success', suspendPayload: { __streamState: { messageList: 'stale' } } },
              {
                status: 'suspended',
                suspendPayload: {
                  __streamState: { messageList: 'live mirror' },
                  approval: { toolCallId: 'tool-1' },
                },
              },
            ],
          },
        },
      },
    } as unknown as WorkflowRunState;

    const pruned = pruneAgentLoopSnapshot({ snapshot });
    const resultPayload = (pruned.result as any).suspendPayload;
    const foreachOutput = resultPayload.__workflow_meta.foreachOutput;

    expect(resultPayload).not.toHaveProperty('__streamState');
    expect(Array.isArray(foreachOutput)).toBe(true);
    expect(foreachOutput[0]).not.toHaveProperty('suspendPayload');
    expect(foreachOutput[1].suspendPayload).toEqual({ approval: { toolCallId: 'tool-1' } });
  });

  it('is copy-on-write and does not mutate the caller snapshot', () => {
    const original = snapshotWith({
      step: { status: 'success', output: { stepResult: stepResult() } },
    });
    pruneAgentLoopSnapshot({ snapshot: original });

    expect(countRequestEchoes(original)).toBe(1);
  });
});

/**
 * Unit coverage for the `agentSpanData.attributes.instructions` strip. The
 * exported agent span the loop carries forward holds the agent's entire system
 * prompt, stored on both sides of every step result and rewritten at every
 * step boundary. Resume rebuilds the span from `context.input`, which the
 * pruner leaves whole, so the step-level copies are dead weight.
 */
function spanData() {
  return {
    id: 'span-1',
    traceId: 'trace-1',
    name: 'agent run',
    attributes: {
      agentId: 'weather',
      instructions: 's'.repeat(4000),
      maxSteps: 5,
    },
  };
}

/** Deep-scans a structure for surviving span instruction copies. */
function countInstructionEchoes(value: unknown): number {
  if (Array.isArray(value)) return value.reduce<number>((n, v) => n + countInstructionEchoes(v), 0);
  if (value === null || typeof value !== 'object') return 0;
  const record = value as Record<string, unknown>;
  let n = 0;
  const span = record.agentSpanData as Record<string, any> | undefined;
  if (span && typeof span === 'object' && span.attributes && 'instructions' in span.attributes) n += 1;
  for (const v of Object.values(record)) n += countInstructionEchoes(v);
  return n;
}

describe('pruneAgentLoopSnapshot span instructions strip', () => {
  it('strips the instructions echo from both sides of a terminal step', () => {
    const pruned = pruneAgentLoopSnapshot({
      snapshot: snapshotWith({
        'durable-llm-execution': {
          status: 'success',
          payload: { agentSpanData: spanData() },
          output: { agentSpanData: spanData() },
        },
      }),
    });

    const step = (pruned.context as Record<string, any>)['durable-llm-execution'];
    expect(step.payload.agentSpanData.attributes).not.toHaveProperty('instructions');
    expect(step.output.agentSpanData.attributes).not.toHaveProperty('instructions');
  });

  it('strips non-terminal steps too, since the snapshot persists at every step boundary', () => {
    const pruned = pruneAgentLoopSnapshot({
      snapshot: snapshotWith({
        'durable-tool-call': {
          status: 'running',
          payload: { agentSpanData: spanData() },
          output: { agentSpanData: spanData() },
        },
      }),
    });

    expect(countInstructionEchoes((pruned.context as Record<string, any>)['durable-tool-call'])).toBe(0);
  });

  it('keeps the span itself and every other attribute', () => {
    const pruned = pruneAgentLoopSnapshot({
      snapshot: snapshotWith({
        step: { status: 'success', output: { agentSpanData: spanData() } },
      }),
    });

    const span = (pruned.context as Record<string, any>).step.output.agentSpanData;
    expect(span.id).toBe('span-1');
    expect(span.traceId).toBe('trace-1');
    expect(span.name).toBe('agent run');
    expect(span.attributes).toEqual({ agentId: 'weather', maxSteps: 5 });
  });

  it('leaves the `context.input` copy intact, since resume rebuilds the span from it', () => {
    const pruned = pruneAgentLoopSnapshot({
      snapshot: {
        context: {
          input: { agentSpanData: spanData() },
          step: { status: 'success', output: { agentSpanData: spanData() } },
        },
      } as unknown as WorkflowRunState,
    });

    const input = (pruned.context as Record<string, any>).input;
    expect(input.agentSpanData.attributes.instructions).toBe('s'.repeat(4000));
    expect(countInstructionEchoes((pruned.context as Record<string, any>).step)).toBe(0);
  });

  it('passes step results without span data through unchanged', () => {
    const pruned = pruneAgentLoopSnapshot({
      snapshot: snapshotWith({
        'collect-tool-results': { status: 'success', output: { toolResults: [{ result: 'ok' }] } },
      }),
    });

    expect((pruned.context as Record<string, any>)['collect-tool-results']).toMatchObject({
      output: { toolResults: [{ result: 'ok' }] },
    });
  });

  it('passes a span without an instructions attribute through unchanged', () => {
    const span = { id: 'span-1', attributes: { agentId: 'weather' } };
    const pruned = pruneAgentLoopSnapshot({
      snapshot: snapshotWith({
        step: { status: 'success', output: { agentSpanData: span } },
      }),
    });

    expect((pruned.context as Record<string, any>).step.output.agentSpanData).toEqual(span);
  });

  it('is copy-on-write and does not mutate the caller snapshot', () => {
    const snapshot = snapshotWith({
      step: { status: 'success', payload: { agentSpanData: spanData() }, output: { agentSpanData: spanData() } },
    });

    pruneAgentLoopSnapshot({ snapshot });

    expect(countInstructionEchoes(snapshot.context)).toBe(2);
  });
});
