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

  describe('when only one of two parallel suspensions was resumed in storage', () => {
    it('uses the stored run, which still shows the other suspension', () => {
      const live = {
        ...replayedSuspension,
        steps: { ...replayedSuspension.steps, review: { status: 'suspended', payload: {}, startedAt: 100 } },
      } as WorkflowRunStreamResult;
      const stored = storedRun(
        {
          approval: { status: 'success', output: { approved: true }, startedAt: 100, endedAt: 120 },
          review: { status: 'suspended', payload: {}, startedAt: 100, suspendedAt: 105 },
        },
        'suspended',
      );
      const resolved = resolveWorkflowRunResult(live, stored);
      expect(resolved?.steps.approval.status).toBe('success');
      expect(resolved?.steps.review.status).toBe('suspended');
    });
  });

  describe('when the suspended step was resumed in storage and is still working', () => {
    it('uses the stored run', () => {
      const stored = storedRun({
        approval: { status: 'running', resumePayload: { approved: true }, startedAt: 100, resumedAt: 200 },
      });
      expect(resolveWorkflowRunResult(replayedSuspension, stored)).toEqual(stored);
    });
  });

  describe('when the step suspended again after an earlier resume', () => {
    it('keeps the observed suspension', () => {
      const live = {
        ...replayedSuspension,
        steps: { approval: { status: 'suspended', payload: {}, startedAt: 100, suspendedAt: 300 } },
      } as WorkflowRunStreamResult;
      const stored = storedRun({ approval: { status: 'running', startedAt: 100, resumedAt: 200 } });
      expect(resolveWorkflowRunResult(live, stored)?.steps.approval.status).toBe('suspended');
    });
  });

  describe('when storage holds an earlier settled result of a step that suspended again', () => {
    it('keeps the observed suspension', () => {
      const live = {
        ...replayedSuspension,
        steps: { approval: { status: 'suspended', payload: {}, startedAt: 300, suspendedAt: 305 } },
      } as WorkflowRunStreamResult;
      const stored = storedRun({ approval: { status: 'success', startedAt: 100, endedAt: 120 } });
      expect(resolveWorkflowRunResult(live, stored)?.steps.approval.status).toBe('suspended');
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
      const live: WorkflowRunStreamResult = { ...replayedSuspension, status: 'success', steps: {} };
      const stored = storedRun({ approval: { status: 'success', startedAt: 100, endedAt: 120 } });
      expect(resolveWorkflowRunResult(live, stored)?.status).toBe('success');
    });
  });
});
