import { createLogger } from '../logger';
import { z } from 'zod';

import { Workflow } from './index';

describe('Workflow', () => {
  let workflow: Workflow;

  beforeEach(() => {
    workflow = new Workflow('test-workflow', createLogger({ type: 'CONSOLE' }));
  });

  describe('Basic Workflow Execution', () => {
    it('should execute a single step workflow successfully', async () => {
      const action = jest.fn().mockResolvedValue({ result: 'success' });

      workflow.addStep('step1', { action });

      const result = await workflow.executeWorkflow();

      expect(action).toHaveBeenCalled();
      expect(result.results['step1']).toEqual({ result: 'success' });
    });

    it('should execute multiple steps in order', async () => {
      const executionOrder: string[] = [];
      const step1Action = jest.fn().mockImplementation(async () => {
        executionOrder.push('step1');
        return { value: 'step1' };
      });
      const step2Action = jest.fn().mockImplementation(async () => {
        executionOrder.push('step2');
        return { value: 'step2' };
      });

      workflow
        .addStep('step1', {
          action: step1Action,
        })
        .addStep('step2', {
          action: step2Action,
        });

      const result = await workflow.executeWorkflow();

      expect(executionOrder).toEqual(['step1', 'step2']);
      expect(result.results).toEqual({
        step1: { value: 'step1' },
        step2: { value: 'step2' },
      });
    });
  });

  describe('Variable Resolution', () => {
    it('should resolve variables from trigger data', async () => {
      const action = jest.fn().mockResolvedValue({ success: true });

      workflow.addStep('step1', {
        action,
        inputSchema: z.object({ inputValue: z.string() }),
        variables: {
          inputValue: { stepId: 'trigger', path: 'data.value' },
        },
      });

      await workflow.executeWorkflow({ data: { value: 'test' } });

      expect(action).toHaveBeenCalledWith({ inputValue: 'test' });
    });

    it('should resolve variables from previous steps', async () => {
      const step1Action = jest
        .fn()
        .mockResolvedValue({ value: 'step1-result' });
      const step2Action = jest.fn().mockResolvedValue({});

      workflow
        .addStep('step1', {
          action: step1Action,
        })
        .addStep('step2', {
          action: step2Action,
          inputSchema: z.object({ previousValue: z.string() }),
          variables: {
            previousValue: { stepId: 'step1', path: 'value' },
          },
        });

      await workflow.executeWorkflow();

      expect(step2Action).toHaveBeenCalledWith({
        previousValue: 'step1-result',
      });
    });

    it('should return an error for invalid variable path', async () => {
      workflow.addStep('step1', {
        action: async () => ({}),
        inputSchema: z.object({ value: z.string() }),
        variables: {
          value: { stepId: 'trigger', path: 'nonexistent.path' },
        },
      });

      await expect(workflow.executeWorkflow()).rejects.toEqual({
        error: 'Cannot resolve path "nonexistent.path" from trigger',
      });
    });

    it('should handle step payload', async () => {
      const action = jest.fn().mockResolvedValue({ success: true });

      workflow.addStep('step1', {
        action,
        inputSchema: z.object({
          userId: z.string(),
          includeDetails: z.boolean(),
          format: z.string(),
        }),
        variables: {
          userId: { stepId: 'trigger', path: 'user.id' },
        },
        payload: {
          includeDetails: true,
          format: 'json',
        },
      });

      await workflow.executeWorkflow({
        user: { id: 'user-123' },
      });

      expect(action).toHaveBeenCalledWith({
        userId: 'user-123',
        includeDetails: true,
        format: 'json',
      });
    });

    it('should override payload with variables', async () => {
      const action = jest.fn().mockResolvedValue({ success: true });

      workflow.addStep('step1', {
        action,
        inputSchema: z.object({
          value: z.string(),
        }),
        variables: {
          value: { stepId: 'trigger', path: 'data' },
        },
        payload: {
          value: 'default',
        },
      });

      await workflow.executeWorkflow({
        data: 'override',
      });

      // Variables should take precedence over payload
      expect(action).toHaveBeenCalledWith({
        value: 'override',
      });
    });
  });

  describe('Trigger Schema Validation', () => {
    it('should validate trigger data against schema', async () => {
      const schema = z.object({
        value: z.string(),
      });

      workflow.setTriggerSchema(schema).addStep('step1', {
        action: async () => ({}),
      });

      await expect(workflow.executeWorkflow()).rejects.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle step execution errors', async () => {
      const error = new Error('Step failed');

      workflow.addStep('step1', {
        action: async () => {
          throw error;
        },
      });

      await expect(workflow.executeWorkflow()).rejects.toEqual({
        error: error.message,
      });
    });

    it('should stop execution on first error', async () => {
      const step2Action = jest.fn();

      workflow
        .addStep('step1', {
          action: async () => {
            throw new Error('Failed');
          },
        })
        .addStep('step2', {
          action: step2Action,
        });

      await expect(workflow.executeWorkflow()).rejects.toEqual({
        error: 'Failed',
      });
      expect(step2Action).not.toHaveBeenCalled();
    });

    it('should throw error when adding duplicate step ID', () => {
      workflow.addStep('step1', {
        action: async () => ({ result: 'success' }),
      });

      expect(() =>
        workflow.addStep('step1', {
          action: async () => ({ result: 'another' }),
        })
      ).toThrow(
        'Step with ID "step1" already exists in workflow "test-workflow"'
      );
    });
  });

  describe('Condition Evaluation', () => {
    it('should skip step when condition is not met', async () => {
      const step1Action = jest.fn().mockResolvedValue({ status: 'failed' });
      const step2Action = jest.fn().mockResolvedValue({ result: 'step2' });

      workflow
        .addStep('step1', {
          action: step1Action,
        })
        .addStep('step2', {
          action: step2Action,
          conditions: {
            ref: { stepId: 'step1', path: 'status' },
            query: { $eq: 'success' },
          },
        });

      const result = await workflow.executeWorkflow();

      expect(step1Action).toHaveBeenCalled();
      expect(step2Action).not.toHaveBeenCalled();
      expect(result.results).not.toHaveProperty('step2');
    });

    it('should execute step when condition is met', async () => {
      const step1Action = jest
        .fn()
        .mockResolvedValue({ status: 'success', count: 5 });
      const step2Action = jest.fn().mockResolvedValue({ result: 'step2' });

      workflow
        .addStep('step1', {
          action: step1Action,
        })
        .addStep('step2', {
          action: step2Action,
          conditions: {
            ref: { stepId: 'step1', path: 'status' },
            query: { $eq: 'success' },
          },
        });

      const result = await workflow.executeWorkflow();

      expect(step2Action).toHaveBeenCalled();
      expect(result.results.step2).toEqual({ result: 'step2' });
    });

    it('should handle AND conditions', async () => {
      const step1Action = jest.fn().mockResolvedValue({
        status: 'success',
        count: 5,
      });
      const step2Action = jest.fn().mockResolvedValue({ result: 'step2' });

      workflow
        .addStep('step1', {
          action: step1Action,
        })
        .addStep('step2', {
          action: step2Action,
          conditions: {
            and: [
              {
                ref: { stepId: 'step1', path: 'status' },
                query: { $eq: 'success' },
              },
              {
                ref: { stepId: 'step1', path: 'count' },
                query: { $gte: 3 },
              },
            ],
          },
        });

      const result = await workflow.executeWorkflow();

      expect(step2Action).toHaveBeenCalled();
      expect(result.results.step2).toEqual({ result: 'step2' });
    });

    it('should handle OR conditions', async () => {
      const step1Action = jest.fn().mockResolvedValue({
        status: 'failed',
        count: 5,
      });
      const step2Action = jest.fn().mockResolvedValue({ result: 'step2' });

      workflow
        .addStep('step1', {
          action: step1Action,
        })
        .addStep('step2', {
          action: step2Action,
          conditions: {
            or: [
              {
                ref: { stepId: 'step1', path: 'status' },
                query: { $eq: 'success' },
              },
              {
                ref: { stepId: 'step1', path: 'count' },
                query: { $gte: 3 },
              },
            ],
          },
        });

      const result = await workflow.executeWorkflow();

      expect(step2Action).toHaveBeenCalled();
      expect(result.results.step2).toEqual({ result: 'step2' });
    });

    it('should handle conditions on trigger data', async () => {
      const action = jest.fn().mockResolvedValue({ result: 'success' });

      workflow.addStep('step1', {
        action,
        conditions: {
          ref: { stepId: 'trigger', path: 'shouldRun' },
          query: { $eq: true },
        },
      });

      await workflow.executeWorkflow({ shouldRun: false });
      expect(action).not.toHaveBeenCalled();

      await workflow.executeWorkflow({ shouldRun: true });
      expect(action).toHaveBeenCalled();
    });

    it('should handle complex nested conditions', async () => {
      const step1Action = jest.fn().mockResolvedValue({
        status: 'success',
        count: 5,
        error: null,
        name: 'fabregas',
      });
      const step2Action = jest.fn().mockResolvedValue({ result: 'step2' });
      const step3Action = jest.fn().mockResolvedValue({ result: 'step3' });

      workflow
        .addStep('step1', {
          action: step1Action,
        })
        .addStep('step2', {
          action: step2Action,
          conditions: {
            ref: { stepId: 'step1', path: 'name' },
            query: { $eq: 'fabregas' },
            and: [
              {
                ref: { stepId: 'step1', path: 'status' },
                query: { $eq: 'success' },
              },
              {
                or: [
                  {
                    ref: { stepId: 'step1', path: 'count' },
                    query: { $gte: 3 },
                  },
                  {
                    ref: { stepId: 'step1', path: 'error' },
                    query: { $exists: false },
                  },
                ],
              },
            ],
            or: [
              {
                ref: { stepId: 'step1', path: 'stat' },
                query: { $eq: 'success' },
              },
              {
                ref: { stepId: 'step1', path: 'count' },
                query: { $gte: 3 },
              },
            ],
          },
        })
        .addStep('step3', {
          action: step3Action,
          variables: {
            step2Result: { stepId: 'step2', path: 'result' },
          },
        });

      const result = await workflow.executeWorkflow();

      expect(step2Action).toHaveBeenCalled();
      expect(step3Action).toHaveBeenCalled();
      expect(result.results.step2).toEqual({ result: 'step2' });
    });
  });
});
