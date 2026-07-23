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

  describe('when the workflow context reports a streaming failure', () => {
    it('returns the streaming error message', () => {
      expect(getWorkflowRunErrors(null, new Error('Connection interrupted'))).toEqual(['Connection interrupted']);
    });
  });
});
