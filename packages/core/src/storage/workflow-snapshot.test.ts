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
        __mastra_foreach__: true,
        status: 'success',
        output: [null, 'resumed', null],
        payload: ['a', 'b', 'c'],
        startedAt: 2,
        endedAt: 3,
      } as any,
      requestContext: { incoming: true },
    });

    expect(context.foreach).toEqual({
      status: 'success',
      output: ['done', 'resumed', 'tail'],
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
    const output = Array(3);
    output[1] = 3;

    mergeWorkflowStepResult({
      snapshot,
      stepId: 'foreach',
      result: {
        __mastra_foreach__: true,
        status: 'success',
        output,
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

  it('replaces normal array outputs even when the step input payload is an array', () => {
    const snapshot = createEmptyWorkflowSnapshot('run-1');
    snapshot.context['array-input-step'] = {
      status: 'success',
      output: [1, 2, 3],
      payload: ['input-a', 'input-b'],
    } as any;

    mergeWorkflowStepResult({
      snapshot,
      stepId: 'array-input-step',
      result: {
        status: 'success',
        output: [null],
        payload: ['input-a', 'input-b'],
      } as any,
      requestContext: {},
    });

    expect(snapshot.context['array-input-step']?.output).toEqual([null]);
  });

  it('applies pending marker resets without trusting stale sibling values or status', () => {
    const snapshot = createEmptyWorkflowSnapshot('run-1');
    snapshot.context.foreach = {
      status: 'success',
      startedAt: 1,
      endedAt: 2,
      output: [
        { status: 'suspended', startedAt: 1, suspendedAt: 2, suspendPayload: { __workflow_meta: {} } },
        {
          status: 'suspended',
          payload: 'payload',
          suspendedAt: 3,
          suspendPayload: { token: 'tok', __workflow_meta: {} },
        },
        { status: 'suspended', suspendPayload: { token: 'tok' }, suspendedAt: 4 },
        { status: 'suspended', startedAt: 5, suspendedAt: 6 },
        { status: 'success', output: 'done-4' },
        { status: 'failed', error: 'failed-5' },
        { status: 'waiting' },
        { status: 'suspended', output: 'user-data' },
        { __mastra_pending__: true },
        { status: 'success', output: 'newer-tail' },
        { status: 'suspended', payload: { type: 'user-status' } },
        { status: 'suspended', startedAt: 10 },
      ],
    } as any;
    snapshot.requestContext = { existing: true, shared: 'old' };

    mergeWorkflowStepResult({
      snapshot,
      stepId: 'foreach',
      result: {
        __mastra_foreach__: true,
        status: 'running',
        startedAt: 3,
        output: [
          { __mastra_pending__: true },
          { __mastra_pending__: true },
          { __mastra_pending__: true },
          { __mastra_pending__: true },
          { __mastra_pending__: true },
          { status: 'suspended', startedAt: 8, suspendedAt: 9 },
          { __mastra_pending__: true },
          { __mastra_pending__: true },
          { __mastra_pending__: true },
          { __mastra_pending__: true },
          { __mastra_pending__: true },
        ],
      } as any,
      requestContext: { incoming: true, shared: 'new' },
    });

    expect(snapshot.context.foreach).toEqual({
      status: 'success',
      startedAt: 1,
      endedAt: 2,
      output: [
        null,
        null,
        { status: 'suspended', suspendPayload: { token: 'tok' }, suspendedAt: 4 },
        { status: 'suspended', startedAt: 5, suspendedAt: 6 },
        { status: 'success', output: 'done-4' },
        { status: 'failed', error: 'failed-5' },
        { status: 'waiting' },
        { status: 'suspended', output: 'user-data' },
        null,
        { status: 'success', output: 'newer-tail' },
        { status: 'suspended', payload: { type: 'user-status' } },
        { status: 'suspended', startedAt: 10 },
      ],
    });
    expect(snapshot.requestContext).toEqual({ existing: true, incoming: true, shared: 'new' });
  });

  it('ignores fresh-looking sibling values in pending marker reset writes', () => {
    const snapshot = createEmptyWorkflowSnapshot('run-1');
    snapshot.context.foreach = {
      status: 'success',
      startedAt: 1,
      endedAt: 2,
      output: [{ status: 'suspended', startedAt: 1, suspendedAt: 2, suspendPayload: { __workflow_meta: {} } }],
    } as any;

    const context = mergeWorkflowStepResult({
      snapshot,
      stepId: 'foreach',
      result: {
        __mastra_foreach__: true,
        status: 'running',
        startedAt: 3,
        output: [{ __mastra_pending__: true }, { status: 'success', output: 'stale-new-value' }],
      } as any,
      requestContext: {},
    });

    expect(context.foreach).toEqual({
      status: 'success',
      startedAt: 1,
      endedAt: 2,
      output: [null, null],
    });
  });

  it('does not treat user values with pending-like fields as internal markers', () => {
    const snapshot = createEmptyWorkflowSnapshot('run-1');
    snapshot.context.foreach = {
      status: 'success',
      output: [null],
    } as any;

    const context = mergeWorkflowStepResult({
      snapshot,
      stepId: 'foreach',
      result: {
        status: 'success',
        output: [{ __mastra_pending__: true, value: 'user-data' }],
      } as any,
      requestContext: {},
    });

    expect(context.foreach.output).toEqual([{ __mastra_pending__: true, value: 'user-data' }]);
  });

  it('does not treat user outputs shaped like suspended results as partial forEach markers', () => {
    const snapshot = createEmptyWorkflowSnapshot('run-1');
    snapshot.context.foreach = {
      status: 'success',
      output: [{ status: 'suspended', suspendedAt: 1, suspendPayload: { reason: 'user-domain-status' } }, 2],
      payload: ['a', 'b'],
    } as any;

    mergeWorkflowStepResult({
      snapshot,
      stepId: 'foreach',
      result: {
        __mastra_foreach__: true,
        status: 'success',
        output: [{ status: 'suspended', suspendedAt: 2, suspendPayload: { reason: 'new-user-domain-status' } }],
        payload: ['a', 'b'],
      } as any,
      requestContext: {},
    });

    expect(snapshot.context.foreach?.output).toEqual([
      { status: 'suspended', suspendedAt: 2, suspendPayload: { reason: 'new-user-domain-status' } },
    ]);
  });

  it('allows a completed forEach iteration to overwrite an older value with null output', () => {
    const snapshot = createEmptyWorkflowSnapshot('run-1');
    snapshot.context.foreach = {
      status: 'success',
      output: ['old-value', null],
      payload: ['a', 'b'],
    } as any;

    mergeWorkflowStepResult({
      snapshot,
      stepId: 'foreach',
      result: {
        __mastra_foreach__: true,
        __mastra_foreach_completed_indexes__: [0],
        status: 'success',
        output: [null, null],
        payload: ['a', 'b'],
      } as any,
      requestContext: {},
    });

    expect(snapshot.context.foreach?.output).toEqual([null, null]);
    expect(snapshot.context.foreach).not.toHaveProperty('__mastra_foreach__');
    expect(snapshot.context.foreach?.__mastra_foreach_completed_indexes__).toEqual([0]);

    mergeWorkflowStepResult({
      snapshot,
      stepId: 'foreach',
      result: {
        __mastra_foreach__: true,
        __mastra_foreach_completed_indexes__: [1],
        status: 'success',
        output: ['stale-old-value', 'done'],
        payload: ['a', 'b'],
      } as any,
      requestContext: {},
    });

    expect(snapshot.context.foreach?.output).toEqual([null, 'done']);
    expect(snapshot.context.foreach?.__mastra_foreach_completed_indexes__).toEqual([0, 1]);
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
