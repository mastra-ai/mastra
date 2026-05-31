import { describe, expect, it } from 'vitest';

import { createEmptyWorkflowSnapshot, mergeWorkflowStepResult } from './workflow-snapshot';

describe('mergeWorkflowStepResult', () => {
  it('merges forEach array outputs without clobbering completed iterations', () => {
    const snapshot = createEmptyWorkflowSnapshot('run-1');
    snapshot.context.foreach = {
      status: 'success',
      output: ['done', null, 'tail'],
      payload: ['a', 'b', 'c'],
      startedAt: 1,
    } as any;
    snapshot.requestContext = { existing: true };

    const context = mergeWorkflowStepResult({
      snapshot,
      stepId: 'foreach',
      result: {
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
    } as any;
    const output = Array(3);
    output[1] = 3;

    mergeWorkflowStepResult({
      snapshot,
      stepId: 'foreach',
      result: {
        status: 'success',
        output,
      } as any,
      requestContext: {},
    });

    expect(snapshot.context.foreach?.output).toEqual([1, 3, null]);
    expect(2 in (snapshot.context.foreach?.output as unknown[])).toBe(true);
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
        null,
        null,
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
});
