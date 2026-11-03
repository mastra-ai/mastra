import { describe, expect, it } from 'vitest';
import { createEmptyWorkflowSnapshot, mergeWorkflowStepResult } from './workflow-snapshot';

describe('mergeWorkflowStepResult', () => {
  it('claims queued recovery slots without applying stale child metadata', () => {
    const snapshot = createEmptyWorkflowSnapshot('run-1');
    snapshot.context.foreach = {
      status: 'running',
      startedAt: 1,
      payload: [1, 2],
      output: [{ __mastra_foreach_queued__: true, nestedRunId: 'child-0' }, 'done'],
      metadata: { foreachNestedRunIds: { 0: 'child-0' } },
    };
    mergeWorkflowStepResult({
      snapshot,
      stepId: 'foreach',
      requestContext: {},
      result: {
        status: 'running',
        startedAt: 1,
        payload: [1, 2],
        output: [{ __mastra_pending__: true }, 'stale'],
        metadata: { foreachNestedRunIds: { 0: 'stale-child' } },
      },
    });
    expect(snapshot.context.foreach?.output).toEqual([null, 'done']);
    expect(snapshot.context.foreach?.metadata?.foreachNestedRunIds).toEqual({ 0: 'child-0' });
  });
  it('preserves per-iteration child identities across partial and stale foreach writes', () => {
    const snapshot = createEmptyWorkflowSnapshot('run-1');
    const write = (metadata: Record<string, unknown> | undefined) =>
      mergeWorkflowStepResult({
        snapshot,
        stepId: 'foreach',
        result: { status: 'running', startedAt: 1, payload: [1, 2], output: [null, null], metadata },
        requestContext: {},
      });

    write({ nestedRunId: 'child-0', foreachNestedRunIds: { 0: 'child-0' } });
    write({ nestedRunId: 'child-1', foreachNestedRunIds: { 1: 'child-1' } });
    write({ nestedRunId: 'child-0', foreachNestedRunIds: { 0: 'child-0' } });
    write(undefined);

    expect(snapshot.context.foreach?.metadata?.foreachNestedRunIds).toEqual({ 0: 'child-0', 1: 'child-1' });
  });
});
