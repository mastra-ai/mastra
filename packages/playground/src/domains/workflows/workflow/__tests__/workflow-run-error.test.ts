import { describe, expect, it } from 'vitest';
import { getWorkflowRunErrors } from '../workflow-run-errors';

describe('getWorkflowRunErrors', () => {
  describe('when a workflow run has persisted failures', () => {
    it('returns the top-level and failed-step messages', () => {
      expect(
        getWorkflowRunErrors({
          status: 'failed',
          error: { message: 'Workflow execution failed' },
          steps: {
            lookup: { status: 'success', output: {} },
            createTicket: {
              status: 'failed',
              error: { message: 'Required string field summary was undefined' },
            },
          },
        }),
      ).toEqual(['Workflow execution failed', 'createTicket: Required string field summary was undefined']);
    });
  });

  describe('when the run repeats its failed step error', () => {
    it('shows the cause once with the failed step name', () => {
      expect(
        getWorkflowRunErrors(
          {
            error: { message: 'Invalid risk' },
            steps: { approval: { error: { message: 'Invalid risk' } } },
          },
          new Error('Invalid risk'),
        ),
      ).toEqual(['approval: Invalid risk']);
    });
  });

  describe('when separate steps fail with the same message', () => {
    it('preserves both step names', () => {
      expect(
        getWorkflowRunErrors({
          error: 'Timeout',
          steps: { inventory: { error: 'Timeout' }, payment: { error: 'Timeout' } },
        }),
      ).toEqual(['inventory: Timeout', 'payment: Timeout']);
    });
  });

  describe('when the workflow context reports a streaming failure', () => {
    it('returns the streaming error message', () => {
      expect(getWorkflowRunErrors(null, new Error('Connection interrupted'))).toEqual(['Connection interrupted']);
    });
  });
});
