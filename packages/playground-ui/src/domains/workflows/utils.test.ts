import { describe, expect, it } from 'vitest';
import type { WorkflowRunStreamResult } from './context/workflow-run-context';
import { resolveWorkflowRunResult } from './utils';

const replayedSuspension = {
  status: 'suspended',
  input: { request: 'refund' },
  steps: { approval: { status: 'suspended', payload: {}, startedAt: 100, suspendedAt: 105 } },
} as WorkflowRunStreamResult;

function storedRun(steps: Record<string, unknown>, status = 'running') {
  return { status, input: { request: 'refund' }, steps } as WorkflowRunStreamResult;
}

describe('resolveWorkflowRunResult', () => {
  describe('when an observed suspension was already resumed in storage', () => {
    it('uses the stored run', () => {
      const stored = storedRun({
        approval: { status: 'success', output: { approved: true }, startedAt: 100, endedAt: 120 },
        slow: { status: 'running', startedAt: 120 },
      });
      expect(resolveWorkflowRunResult(replayedSuspension, stored)).toEqual(stored);
    });
  });

  describe('when storage has not caught up with the suspension', () => {
    it('keeps the observed suspension', () => {
      const stored = storedRun({ approval: { status: 'running', startedAt: 100 } });
      expect(resolveWorkflowRunResult(replayedSuspension, stored)?.status).toBe('suspended');
      expect(resolveWorkflowRunResult(replayedSuspension, stored)?.steps.approval.status).toBe('suspended');
    });
  });

  describe('when storage has no record of the suspended step', () => {
    it('keeps the observed suspension', () => {
      const stored = storedRun({});
      expect(resolveWorkflowRunResult(replayedSuspension, stored)?.status).toBe('suspended');
    });
  });

  describe('when the observed run finished', () => {
    it('keeps the observed status', () => {
      const live = { ...replayedSuspension, status: 'success', steps: {} } as WorkflowRunStreamResult;
      const stored = storedRun({ approval: { status: 'success', startedAt: 100, endedAt: 120 } });
      expect(resolveWorkflowRunResult(live, stored)?.status).toBe('success');
    });
  });
});
