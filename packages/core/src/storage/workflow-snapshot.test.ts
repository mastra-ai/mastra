import { describe, expect, it } from 'vitest';

import { DefaultStepResult } from '../stream/aisdk/v5/output-helpers';
import { createEmptyWorkflowSnapshot, mergeWorkflowState, mergeWorkflowStepResult } from './workflow-snapshot';

describe('mergeWorkflowStepResult', () => {
  it('merges forEach array outputs without clobbering completed iterations', () => {
    const snapshot = createEmptyWorkflowSnapshot('run-1');
    snapshot.context.foreach = {
      status: 'success',
      output: [
        'done',
        { status: 'suspended', suspendedAt: 1, suspendPayload: { __workflow_meta: { path: ['foreach'] } } },
        'tail',
      ],
      payload: ['a', 'b', 'c'],
      startedAt: 1,
    } as any;
    snapshot.requestContext = { existing: true };

    const context = mergeWorkflowStepResult({
      snapshot,
      stepId: 'foreach',
      result: {
        status: 'success',
        output: [null, 'resumed', { __mastra_pending__: true }],
        payload: ['a', 'b', 'c'],
        startedAt: 2,
        endedAt: 3,
      } as any,
      requestContext: { incoming: true },
    });

    expect(context.foreach).toEqual({
      status: 'success',
      output: ['done', 'resumed', null],
      payload: ['a', 'b', 'c'],
      startedAt: 2,
      endedAt: 3,
    });
    expect(snapshot.requestContext).toEqual({ existing: true, incoming: true });
  });

  it('keeps existing values for null updates and fills trailing nulls without sparse arrays', () => {
    const snapshot = createEmptyWorkflowSnapshot('run-1');
    snapshot.context.foreach = {
      status: 'success',
      output: [1, 2],
      payload: ['a', 'b', 'c'],
    } as any;

    mergeWorkflowStepResult({
      snapshot,
      stepId: 'foreach',
      result: {
        status: 'success',
        output: [null, 3, null],
        payload: ['a', 'b', 'c'],
      } as any,
      requestContext: {},
    });

    expect(snapshot.context.foreach?.output).toEqual([1, 3, null]);
    expect(2 in (snapshot.context.foreach?.output as unknown[])).toBe(true);
  });

  it('replaces plain array outputs instead of treating them as partial forEach updates', () => {
    const snapshot = createEmptyWorkflowSnapshot('run-1');

    mergeWorkflowStepResult({
      snapshot,
      stepId: 'array-step',
      result: { status: 'success', output: [1, 2, 3] } as any,
      requestContext: {},
    });

    mergeWorkflowStepResult({
      snapshot,
      stepId: 'array-step',
      result: { status: 'success', output: [4] } as any,
      requestContext: {},
    });

    expect(snapshot.context['array-step']?.output).toEqual([4]);
  });

  it('replaces plain array outputs that contain null values', () => {
    const snapshot = createEmptyWorkflowSnapshot('run-1');

    mergeWorkflowStepResult({
      snapshot,
      stepId: 'array-step',
      result: { status: 'success', output: [1, 2, 3] } as any,
      requestContext: {},
    });

    mergeWorkflowStepResult({
      snapshot,
      stepId: 'array-step',
      result: { status: 'success', output: [null] } as any,
      requestContext: {},
    });

    expect(snapshot.context['array-step']?.output).toEqual([null]);
  });

  it('does not treat user outputs shaped like suspended results as partial forEach markers', () => {
    const snapshot = createEmptyWorkflowSnapshot('run-1');
    snapshot.context.foreach = {
      status: 'success',
      output: [{ status: 'suspended', reason: 'user-domain-status' }, 2],
      payload: ['a', 'b'],
    } as any;

    mergeWorkflowStepResult({
      snapshot,
      stepId: 'foreach',
      result: {
        status: 'success',
        output: [{ status: 'suspended', reason: 'new-user-domain-status' }],
        payload: ['a', 'b'],
      } as any,
      requestContext: {},
    });

    expect(snapshot.context.foreach?.output).toEqual([{ status: 'suspended', reason: 'new-user-domain-status' }]);
  });
});

describe('mergeWorkflowState', () => {
  it('serializes snapshot result fields through workflow snapshot serialization', () => {
    const snapshot = createEmptyWorkflowSnapshot('run-1');
    const messages = [
      { role: 'assistant', content: [{ type: 'text', text: 'first' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'second' }] },
    ];
    const result = {
      status: 'success',
      output: {
        steps: [
          new DefaultStepResult({
            content: [{ type: 'text', text: 'second' }] as any,
            finishReason: 'stop' as any,
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } as any,
            warnings: [],
            request: {},
            response: {
              id: 'response-1',
              timestamp: new Date(0),
              modelId: 'model',
              messages,
            } as any,
            providerMetadata: undefined,
            serializedResponseMessages: [messages[1]] as any,
          }),
        ],
      },
    };

    expect(JSON.parse(JSON.stringify(result)).output.steps[0].response.messages).toHaveLength(2);

    const merged = mergeWorkflowState({ snapshot, opts: { status: 'success', result: result as any } });

    expect((merged.result as any).output.steps[0].response.messages).toEqual([messages[1]]);
  });
});
