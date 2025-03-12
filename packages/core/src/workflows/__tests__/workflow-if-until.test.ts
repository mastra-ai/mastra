import { describe, expect, it, vi } from 'vitest';
import { Workflow } from '../workflow';
import { Step } from '../step';

describe('Workflow', () => {
  describe('if/else with until', () => {
    it('should execute else branch when if condition is false with until', async () => {
      const ifStepMock = vi.fn();
      const elseStepMock = vi.fn();
      
      const workflow = new Workflow({ name: 'test-workflow' });

      workflow
        .step(new Step({
          id: 'main',
          execute: async () => ({ value: 5 })
        }))
        .if(async () => false)  // Always false to test else branch
        .then(new Step({
          id: 'if-step',
          execute: async () => {
            ifStepMock();
            return { value: true };
          }
        }))
        .until(async () => false, new Step({
          id: 'until-step',
          execute: async () => ({ value: true })
        }))
        .else()
        .then(new Step({
          id: 'else-step',
          execute: async () => {
            elseStepMock();
            return { value: true };
          }
        }))
        .commit();

      const result = await workflow.execute();

      // Verify else branch executed and if branch was skipped
      expect(ifStepMock).not.toHaveBeenCalled();
      expect(elseStepMock).toHaveBeenCalledOnce();
      expect(result.results['if-step']).toBeUndefined();
      expect(result.results['else-step'].status).toBe('success');
    });
  });
});
