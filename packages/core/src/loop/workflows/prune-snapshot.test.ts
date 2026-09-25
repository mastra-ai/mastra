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

const executionGraph = [
  { type: 'step', step: { id: 'durable-llm-execution' } },
  { type: 'foreach', step: { type: 'step', step: { id: 'durable-tool-call' } } },
  { type: 'mapping', id: 'collect-tool-results' },
  { type: 'step', step: { id: 'durable-llm-mapping' } },
];

const stepResultReads = { 'collect-tool-results': ['durable-llm-execution'] };

function history(tag: string) {
  return { messageListState: { messages: [{ role: 'user', content: tag }] }, accumulatedSteps: [tag] };
}

function contextOf(snapshot: WorkflowRunState): Record<string, any> {
  return snapshot.context as Record<string, any>;
}

describe('pruneAgentLoopSnapshot running history', () => {
  it('keeps the active terminal step conversation for restart after an end-phase write', () => {
    const conversation = { messages: [{ role: 'user', content: 'earlier turn' }] };
    const snapshot = {
      status: 'running',
      activePaths: [1],
      activeStepsPath: { previous: [0], current: [1] },
      context: {
        input: { initial: true },
        previous: {
          status: 'success',
          payload: { messageListState: conversation, accumulatedSteps: ['old'] },
        },
        current: {
          status: 'success',
          payload: { messageListState: conversation, accumulatedSteps: ['old', 'current'] },
        },
      },
    } as unknown as WorkflowRunState;

    const pruned = pruneAgentLoopSnapshot({ snapshot });
    const context = pruned.context as Record<string, any>;

    expect(context.previous.payload).not.toHaveProperty('messageListState');
    expect(context.previous.payload).not.toHaveProperty('accumulatedSteps');
    expect(context.current.payload.messageListState).toEqual(conversation);
    expect(context.current.payload.accumulatedSteps).toEqual(['old', 'current']);
  });

  it('retainRunningHistory keeps terminal outputs that a restart would not read back', () => {
    // The evented engine replaces in-flight stepResults with the storage-merged
    // context at every step boundary, so it reads completed outputs back during
    // live execution, not only on restart.
    const snapshot = {
      status: 'running',
      serializedStepGraph: executionGraph,
      activePaths: [3],
      activeStepsPath: { 'durable-llm-mapping': [3] },
      context: {
        input: { initial: true },
        'durable-llm-execution': { status: 'success', output: history('s1') },
        'durable-llm-mapping': { status: 'running', payload: history('s2') },
      },
    } as unknown as WorkflowRunState;

    const stripped = pruneAgentLoopSnapshot({ snapshot, stepResultReads });
    const retained = pruneAgentLoopSnapshot({ snapshot, stepResultReads, retainRunningHistory: true });

    expect(contextOf(stripped)['durable-llm-execution'].output).not.toHaveProperty('messageListState');
    expect(contextOf(retained)['durable-llm-execution'].output).toEqual(history('s1'));
  });
});

/**
 * Recovery re-drives a running snapshot from `activePaths[0]`, or from the next
 * entry when that one already finished, and reads a few persisted copies back
 * to do it. Those copies must survive the running-history
 * strip; every other completed step's conversation is still removed.
 */
describe('pruneAgentLoopSnapshot restart reads', () => {
  it('keeps the finished step output on a save made between steps', () => {
    // Between steps nothing is active and the entry at activePaths[0] has
    // finished, so restart skips it and reads its saved output.
    const snapshot = {
      status: 'running',
      serializedStepGraph: executionGraph,
      activePaths: [3],
      activeStepsPath: {},
      context: {
        input: { initial: true },
        'durable-llm-execution': { status: 'success', payload: history('p1'), output: history('o1') },
        'durable-tool-call': { status: 'success', payload: history('p2'), output: [{ result: 'ok' }] },
        'collect-tool-results': { status: 'success', payload: history('p3'), output: history('o3') },
        'durable-llm-mapping': { status: 'success', payload: history('p4'), output: history('o4') },
      },
    } as unknown as WorkflowRunState;

    const context = contextOf(pruneAgentLoopSnapshot({ snapshot, stepResultReads }));

    expect(context['durable-llm-mapping'].output).toEqual(history('o4'));
    // Older history is still trimmed, including the declared read whose
    // reader has already run.
    expect(context['durable-llm-execution'].output).toEqual({});
    expect(context['collect-tool-results'].output).toEqual({});
    for (const id of ['durable-llm-execution', 'collect-tool-results', 'durable-llm-mapping']) {
      expect(context[id].payload).toEqual({});
    }
  });

  it('keeps a declared direct read until its reader has run', () => {
    // Mid-tool: collect-tool-results reads the model call result directly,
    // not from its input, so the previous-output rule alone would not keep it.
    const snapshot = {
      status: 'running',
      serializedStepGraph: executionGraph,
      activePaths: [2],
      activeStepsPath: { 'collect-tool-results': [2] },
      context: {
        input: { initial: true },
        'durable-llm-execution': { status: 'success', output: history('o1') },
        'durable-tool-call': { status: 'success', output: [{ result: 'ok' }] },
        'collect-tool-results': { status: 'running', payload: history('p3') },
      },
    } as unknown as WorkflowRunState;

    const undeclared = contextOf(pruneAgentLoopSnapshot({ snapshot }));
    const declared = contextOf(pruneAgentLoopSnapshot({ snapshot, stepResultReads }));

    expect(undeclared['durable-llm-execution'].output).toEqual({});
    expect(declared['durable-llm-execution'].output).toEqual(history('o1'));
    expect(declared['collect-tool-results'].payload).toEqual(history('p3'));
  });

  it('keeps the model call result while its tools run', () => {
    const snapshot = {
      status: 'running',
      serializedStepGraph: executionGraph,
      activePaths: [1],
      activeStepsPath: { 'durable-tool-call': [1] },
      context: {
        input: { initial: true },
        'durable-llm-execution': { status: 'success', payload: history('p1'), output: history('o1') },
      },
    } as unknown as WorkflowRunState;

    const context = contextOf(pruneAgentLoopSnapshot({ snapshot, stepResultReads }));

    expect(context['durable-llm-execution'].output).toEqual(history('o1'));
    expect(context['durable-llm-execution'].payload).toEqual({});
  });

  it("keeps the loop body's last input when the restart point is a loop", () => {
    // Mid-loop the body is only saved when an iteration starts, so the
    // checkpoint shows it running. A saved success means the loop finished.
    const loopGraph = [
      { type: 'step', step: { id: 'prepare' } },
      { type: 'loop', loopType: 'dountil', step: { type: 'step', step: { id: 'durable-agentic-execution' } } },
      { type: 'step', step: { id: 'map-final-output' } },
    ];
    const bodyInput = { ...history('p2'), lastStepResult: { reason: 'tool-calls' } };
    const snapshot = {
      status: 'running',
      serializedStepGraph: loopGraph,
      activePaths: [1],
      activeStepsPath: { 'durable-agentic-execution': [1] },
      context: {
        input: { initial: true },
        prepare: { status: 'success', output: history('o1') },
        'durable-agentic-execution': { status: 'running', payload: bodyInput },
      },
    } as unknown as WorkflowRunState;

    const context = contextOf(pruneAgentLoopSnapshot({ snapshot }));

    expect(context['durable-agentic-execution'].payload).toEqual(bodyInput);
    // The loop re-enters from its body's payload, not the previous entry.
    expect(context.prepare.output).toEqual({});
  });

  it('keeps every branch output when the previous entry is parallel', () => {
    const graph = [
      {
        type: 'parallel',
        steps: [
          { type: 'step', step: { id: 'branch-a' } },
          { type: 'step', step: { id: 'branch-b' } },
        ],
      },
      { type: 'step', step: { id: 'after' } },
    ];
    const snapshot = {
      status: 'running',
      serializedStepGraph: graph,
      activePaths: [1],
      activeStepsPath: {},
      context: {
        input: { initial: true },
        'branch-a': { status: 'success', output: history('a') },
        'branch-b': { status: 'success', output: history('b') },
      },
    } as unknown as WorkflowRunState;

    const context = contextOf(pruneAgentLoopSnapshot({ snapshot }));

    expect(context['branch-a'].output).toEqual(history('a'));
    expect(context['branch-b'].output).toEqual(history('b'));
  });

  it('leaves non-running snapshots unchanged', () => {
    const build = (status: string) =>
      ({
        status,
        serializedStepGraph: executionGraph,
        activePaths: [2],
        activeStepsPath: {},
        context: {
          input: { initial: true },
          'durable-llm-execution': { status: 'success', payload: history('p1'), output: history('o1') },
          'durable-tool-call': { status: 'success', payload: history('p2'), output: history('o2') },
        },
      }) as unknown as WorkflowRunState;

    for (const status of ['suspended', 'paused', 'success', 'failed']) {
      const withReads = pruneAgentLoopSnapshot({ snapshot: build(status), stepResultReads });
      const withoutGraph = { ...build(status), serializedStepGraph: undefined } as unknown as WorkflowRunState;
      expect(withReads.context).toEqual(pruneAgentLoopSnapshot({ snapshot: withoutGraph }).context);
    }
  });

  describe('checkpoint written after an entry finished (issue #24615)', () => {
    // `restart()` skips the finished entry and hands its saved output to the
    // next entry, so that output has to keep the conversation.
    const conversation = { messages: [{ role: 'user', content: 'earlier turn' }] };
    const heavy = () => ({ messageListState: conversation, accumulatedSteps: ['s1'] });
    const stepEntry = (id: string) => ({ type: 'step', step: { id } });

    function finishedCheckpoint(
      serializedStepGraph: unknown[] | undefined,
      context: Record<string, unknown>,
      activePaths = [1],
    ): WorkflowRunState {
      return {
        status: 'running',
        activePaths,
        activeStepsPath: {},
        serializedStepGraph,
        context: { input: { initial: true }, ...context },
      } as unknown as WorkflowRunState;
    }

    it("keeps the finished step's output and still prunes older steps", () => {
      const snapshot = finishedCheckpoint([stepEntry('older'), { type: 'mapping', id: 'map-to-llm-input' }], {
        older: { status: 'success', payload: heavy(), output: heavy() },
        'map-to-llm-input': { status: 'success', payload: heavy(), output: { ...heavy(), llmOutput: heavy() } },
      });

      const context = pruneAgentLoopSnapshot({ snapshot }).context as Record<string, any>;

      expect(context['map-to-llm-input'].output.messageListState).toEqual(conversation);
      expect(context['map-to-llm-input'].output.accumulatedSteps).toEqual(['s1']);
      expect(context['map-to-llm-input'].output.llmOutput.messageListState).toEqual(conversation);
      // The payload is never read once the step is skipped.
      expect(context['map-to-llm-input'].payload).not.toHaveProperty('messageListState');
      expect(context.older.output).not.toHaveProperty('messageListState');
      expect(context.older.payload).not.toHaveProperty('messageListState');
    });

    it('keeps every branch output of a finished parallel block', () => {
      const snapshot = finishedCheckpoint(
        [stepEntry('older'), { type: 'parallel', steps: [stepEntry('left'), stepEntry('right')] }],
        {
          older: { status: 'success', output: heavy() },
          left: { status: 'success', output: heavy() },
          right: { status: 'success', output: heavy() },
        },
      );

      const context = pruneAgentLoopSnapshot({ snapshot }).context as Record<string, any>;

      expect(context.left.output.messageListState).toEqual(conversation);
      expect(context.right.output.messageListState).toEqual(conversation);
      expect(context.older.output).not.toHaveProperty('messageListState');
    });

    it('keeps the body output of a finished loop', () => {
      const snapshot = finishedCheckpoint(
        [
          stepEntry('older'),
          { type: 'loop', step: stepEntry('body'), serializedCondition: { id: 'c', fn: '' }, loopType: 'dountil' },
        ],
        { older: { status: 'success', output: heavy() }, body: { status: 'success', output: heavy() } },
      );

      const context = pruneAgentLoopSnapshot({ snapshot }).context as Record<string, any>;

      expect(context.body.output.messageListState).toEqual(conversation);
      expect(context.older.output).not.toHaveProperty('messageListState');
    });

    it('prunes as before when the checkpoint has no step graph', () => {
      const snapshot = finishedCheckpoint(undefined, {
        'map-to-llm-input': { status: 'success', output: heavy() },
      });

      const context = pruneAgentLoopSnapshot({ snapshot }).context as Record<string, any>;

      expect(context['map-to-llm-input'].output).not.toHaveProperty('messageListState');
    });

    it('prunes as before when the checkpoint points inside a composite entry', () => {
      const snapshot = finishedCheckpoint(
        [stepEntry('older'), { type: 'parallel', steps: [stepEntry('left'), stepEntry('right')] }],
        { left: { status: 'success', output: heavy() } },
        [1, 0],
      );

      const context = pruneAgentLoopSnapshot({ snapshot }).context as Record<string, any>;

      expect(context.left.output).not.toHaveProperty('messageListState');
    });
  });
});

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
 * The durable agent loop threads its iteration state through every step as
 * that step's input, so each completed step's `payload` pins another copy of
 * the whole conversation. A terminal step is never re-invoked, so nothing
 * reads that copy back — but the readers that do exist (the suspended step's
 * payload, a terminal `output`, and `context.input`) must survive untouched.
 */
describe('pruneAgentLoopSnapshot terminal payload iteration state', () => {
  function iterationState() {
    return {
      messageListState: { messages: [{ role: 'user', content: 'x'.repeat(2000) }] },
      accumulatedSteps: [{ text: 'step one' }, { text: 'step two' }],
      lastStepResult: { reason: 'tool-calls', isContinued: true },
    };
  }

  it('drops the threaded iteration state from a terminal payload while keeping routing fields', () => {
    const pruned = pruneAgentLoopSnapshot({
      snapshot: snapshotWith({
        'durable-llm-execution': {
          status: 'success',
          payload: { ...iterationState(), stepResult: stepResult(), runId: 'run-1', iteration: 3 },
        },
      }),
    });

    const payload = (pruned.context as Record<string, any>)['durable-llm-execution'].payload;
    expect(payload).not.toHaveProperty('messageListState');
    expect(payload).not.toHaveProperty('accumulatedSteps');
    expect(payload).not.toHaveProperty('lastStepResult');
    expect(payload.runId).toBe('run-1');
    expect(payload.iteration).toBe(3);
    expect(payload.stepResult.reason).toBe('tool-calls');
  });

  it('applies to every terminal status', () => {
    const pruned = pruneAgentLoopSnapshot({
      snapshot: snapshotWith({
        a: { status: 'failed', payload: iterationState() },
        b: { status: 'skipped', payload: iterationState() },
        c: { status: 'bailed', payload: iterationState() },
        d: { status: 'canceled', payload: iterationState() },
      }),
    });

    for (const id of ['a', 'b', 'c', 'd']) {
      expect((pruned.context as Record<string, any>)[id].payload).toEqual({});
    }
  });

  it('keeps a suspended step payload and its resume state intact', () => {
    const pruned = pruneAgentLoopSnapshot({
      snapshot: snapshotWith({
        'durable-tool-call': {
          status: 'suspended',
          payload: iterationState(),
          suspendPayload: { __streamState: { messageList: 'live' }, approval: { toolCallId: 'tool-1' } },
        },
      }),
    });

    const step = (pruned.context as Record<string, any>)['durable-tool-call'];
    expect(step.payload).toEqual(iterationState());
    expect(step.suspendPayload).toEqual({
      __streamState: { messageList: 'live' },
      approval: { toolCallId: 'tool-1' },
    });
  });

  it('leaves a terminal output untouched, since a same-run continuation reads it', () => {
    const pruned = pruneAgentLoopSnapshot({
      snapshot: snapshotWith({
        'durable-llm-execution': { status: 'success', output: iterationState() },
      }),
    });

    expect((pruned.context as Record<string, any>)['durable-llm-execution'].output).toEqual(iterationState());
  });

  it('leaves context.input untouched, since recovery rebuilds the conversation from it', () => {
    const snapshot = {
      context: {
        input: { ...iterationState(), __workflowKind: 'durable-agent' },
        step: { status: 'success', payload: iterationState() },
      },
    } as unknown as WorkflowRunState;

    const prunedInput = (pruneAgentLoopSnapshot({ snapshot }).context as Record<string, any>).input;
    expect(prunedInput.messageListState).toEqual(iterationState().messageListState);
    expect(prunedInput.accumulatedSteps).toEqual(iterationState().accumulatedSteps);
    expect(prunedInput.__workflowKind).toBe('durable-agent');
  });

  it('strips completed foreach entries while preserving still-suspended ones', () => {
    const pruned = pruneAgentLoopSnapshot({
      snapshot: snapshotWith({
        'durable-tool-call': {
          status: 'suspended',
          suspendPayload: {
            __workflow_meta: {
              foreachOutput: [
                { status: 'success', payload: iterationState() },
                { status: 'suspended', payload: iterationState() },
              ],
            },
          },
        },
      }),
    });

    const foreachOutput = (pruned.context as Record<string, any>)['durable-tool-call'].suspendPayload.__workflow_meta
      .foreachOutput;
    expect(foreachOutput[0].payload).toEqual({});
    expect(foreachOutput[1].payload).toEqual(iterationState());
  });

  it('is copy-on-write and does not mutate the caller snapshot', () => {
    const original = snapshotWith({
      step: { status: 'success', payload: iterationState() },
    });
    pruneAgentLoopSnapshot({ snapshot: original });

    expect((original.context as Record<string, any>).step.payload).toEqual(iterationState());
  });

  it('passes terminal payloads without iteration state through untouched', () => {
    const pruned = pruneAgentLoopSnapshot({
      snapshot: snapshotWith({
        'collect-tool-results': { status: 'success', payload: { toolResults: [{ result: 'ok' }] } },
      }),
    });

    expect((pruned.context as Record<string, any>)['collect-tool-results'].payload).toEqual({
      toolResults: [{ result: 'ok' }],
    });
  });
});
