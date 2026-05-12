import { describe, it, expect } from 'vitest';
import { startWorkflow, resumeWorkflow } from '../utils.js';

describe('advanced nested workflows', () => {
  describe('deep-nested-workflow', () => {
    it('should execute through 2 levels of nesting', async () => {
      const { data } = await startWorkflow('deep-nested-workflow', {
        inputData: { text: 'hello' },
      });

      expect(data.status).toBe('success');
      // inner-most uppercases → middle wraps in brackets → outer prepends "result:"
      expect(data.result).toEqual({ final: 'result:[HELLO]' });
    });
  });

  describe('nested-suspend-workflow', () => {
    it('should suspend inside a nested workflow and resume', async () => {
      const { runId, data: startData } = await startWorkflow('nested-suspend-workflow', {
        inputData: { input: 'test' },
      });

      expect(startData.status).toBe('suspended');
      // The suspend payload is keyed by the nested workflow ID, not the inner step ID
      expect(startData.suspendPayload).toHaveProperty('nested-suspend-inner');
      expect(startData.suspendPayload['nested-suspend-inner']).toMatchObject({
        waitingFor: 'prepared:test',
      });

      // Resume the suspended step inside the nested workflow (use nested workflow ID as step)
      const { data: resumeData } = await resumeWorkflow('nested-suspend-workflow', runId, {
        step: 'nested-suspend-inner',
        resumeData: { extra: 'added' },
      });

      expect(resumeData.status).toBe('success');
      expect(resumeData.result).toEqual({ result: 'prepared:test+added' });
    });
  });
});
