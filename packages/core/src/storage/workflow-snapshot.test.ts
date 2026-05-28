import { describe, expect, it } from 'vitest';

import { createEmptyWorkflowSnapshot, mergeWorkflowStepResult } from './workflow-snapshot';

describe('mergeWorkflowStepResult', () => {
  it('merges forEach array outputs without clobbering completed iterations', () => {
    const snapshot = createEmptyWorkflowSnapshot('run-1');
    snapshot.context.foreach = {
      status: 'success',
      output: ['done', { status: 'suspended' }, 'tail'],
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
    } as any;

    mergeWorkflowStepResult({
      snapshot,
      stepId: 'foreach',
      result: {
        status: 'success',
        output: [null, 3, null],
      } as any,
      requestContext: {},
    });

    expect(snapshot.context.foreach?.output).toEqual([1, 3, null]);
    expect(2 in (snapshot.context.foreach?.output as unknown[])).toBe(true);
  });
});
