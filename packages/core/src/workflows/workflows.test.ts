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
      const handler = jest.fn().mockResolvedValue({ result: 'success' });

      workflow.addStep('step1', { handler });

      const result = await workflow.executeWorkflow();

      expect(handler).toHaveBeenCalled();
      expect(result.results['step1']).toEqual({ result: 'success' });
    });

    it('should execute multiple steps in order', async () => {
      const executionOrder: string[] = [];
      const step1Handler = jest.fn().mockImplementation(async () => {
        executionOrder.push('step1');
        return { value: 'step1' };
      });
      const step2Handler = jest.fn().mockImplementation(async () => {
        executionOrder.push('step2');
        return { value: 'step2' };
      });

      workflow
        .addStep('step1', {
          handler: step1Handler,
        })
        .addStep('step2', {
          handler: step2Handler,
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
      const handler = jest.fn().mockResolvedValue({ success: true });

      workflow.addStep('step1', {
        handler,
        inputSchema: z.object({ inputValue: z.string() }),
        variables: {
          inputValue: { stepId: 'trigger', path: 'data.value' },
        },
      });

      await workflow.executeWorkflow({ data: { value: 'test' } });

      expect(handler).toHaveBeenCalledWith({ inputValue: 'test' });
    });

    it('should resolve variables from previous steps', async () => {
      const step1Handler = jest
        .fn()
        .mockResolvedValue({ value: 'step1-result' });
      const step2Handler = jest.fn().mockResolvedValue({});

      workflow
        .addStep('step1', {
          handler: step1Handler,
        })
        .addStep('step2', {
          handler: step2Handler,
          inputSchema: z.object({ previousValue: z.string() }),
          variables: {
            previousValue: { stepId: 'step1', path: 'value' },
          },
        });

      await workflow.executeWorkflow();

      expect(step2Handler).toHaveBeenCalledWith({
        previousValue: 'step1-result',
      });
    });

    it('should return an error for invalid variable path', async () => {
      workflow.addStep('step1', {
        handler: async () => ({}),
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
      const handler = jest.fn().mockResolvedValue({ success: true });

      workflow.addStep('step1', {
        handler,
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

      expect(handler).toHaveBeenCalledWith({
        userId: 'user-123',
        includeDetails: true,
        format: 'json',
      });
    });

    it('should override payload with variables', async () => {
      const handler = jest.fn().mockResolvedValue({ success: true });

      workflow.addStep('step1', {
        handler,
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
      expect(handler).toHaveBeenCalledWith({
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
        handler: async () => ({}),
      });

      await expect(workflow.executeWorkflow()).rejects.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle step execution errors', async () => {
      const error = new Error('Step failed');

      workflow.addStep('step1', {
        handler: async () => {
          throw error;
        },
      });

      await expect(workflow.executeWorkflow()).rejects.toEqual({
        error: error.message,
      });
    });

    it('should stop execution on first error', async () => {
      const step2Handler = jest.fn();

      workflow
        .addStep('step1', {
          handler: async () => {
            throw new Error('Failed');
          },
        })
        .addStep('step2', {
          handler: step2Handler,
        });

      await expect(workflow.executeWorkflow()).rejects.toEqual({
        error: 'Failed',
      });
      expect(step2Handler).not.toHaveBeenCalled();
    });

    it('should throw error when adding duplicate step ID', () => {
      workflow.addStep('step1', {
        handler: async () => ({ result: 'success' }),
      });

      expect(() =>
        workflow.addStep('step1', {
          handler: async () => ({ result: 'another' }),
        })
      ).toThrow(
        'Step with ID "step1" already exists in workflow "test-workflow"'
      );
    });
  });

  describe('Condition Evaluation', () => {
    it('should skip step when condition is not met', async () => {
      const step1Handler = jest.fn().mockResolvedValue({ status: 'failed' });
      const step2Handler = jest.fn().mockResolvedValue({ result: 'step2' });

      workflow
        .addStep('step1', {
          handler: step1Handler,
        })
        .addStep('step2', {
          handler: step2Handler,
          conditions: {
            ref: { stepId: 'step1', path: 'status' },
            query: { $eq: 'success' },
          },
        });

      const result = await workflow.executeWorkflow();

      expect(step1Handler).toHaveBeenCalled();
      expect(step2Handler).not.toHaveBeenCalled();
      expect(result.results).not.toHaveProperty('step2');
    });

    it('should execute step when condition is met', async () => {
      const step1Handler = jest
        .fn()
        .mockResolvedValue({ status: 'success', count: 5 });
      const step2Handler = jest.fn().mockResolvedValue({ result: 'step2' });

      workflow
        .addStep('step1', {
          handler: step1Handler,
        })
        .addStep('step2', {
          handler: step2Handler,
          conditions: {
            ref: { stepId: 'step1', path: 'status' },
            query: { $eq: 'success' },
          },
        });

      const result = await workflow.executeWorkflow();

      expect(step2Handler).toHaveBeenCalled();
      expect(result.results.step2).toEqual({ result: 'step2' });
    });

    it('should handle AND conditions', async () => {
      const step1Handler = jest.fn().mockResolvedValue({
        status: 'success',
        count: 5,
      });
      const step2Handler = jest.fn().mockResolvedValue({ result: 'step2' });

      workflow
        .addStep('step1', {
          handler: step1Handler,
        })
        .addStep('step2', {
          handler: step2Handler,
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

      expect(step2Handler).toHaveBeenCalled();
      expect(result.results.step2).toEqual({ result: 'step2' });
    });

    it('should handle OR conditions', async () => {
      const step1Handler = jest.fn().mockResolvedValue({
        status: 'failed',
        count: 5,
      });
      const step2Handler = jest.fn().mockResolvedValue({ result: 'step2' });

      workflow
        .addStep('step1', {
          handler: step1Handler,
        })
        .addStep('step2', {
          handler: step2Handler,
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

      expect(step2Handler).toHaveBeenCalled();
      expect(result.results.step2).toEqual({ result: 'step2' });
    });

    it('should handle conditions on trigger data', async () => {
      const handler = jest.fn().mockResolvedValue({ result: 'success' });

      workflow.addStep('step1', {
        handler,
        conditions: {
          ref: { stepId: 'trigger', path: 'shouldRun' },
          query: { $eq: true },
        },
      });

      await workflow.executeWorkflow({ shouldRun: false });
      expect(handler).not.toHaveBeenCalled();

      await workflow.executeWorkflow({ shouldRun: true });
      expect(handler).toHaveBeenCalled();
    });

    it('should handle complex nested conditions', async () => {
      const step1Handler = jest.fn().mockResolvedValue({
        status: 'success',
        count: 5,
        error: null,
        name: 'fabregas',
      });
      const step2Handler = jest.fn().mockResolvedValue({ result: 'step2' });

      workflow
        .addStep('step1', {
          handler: step1Handler,
        })
        .addStep('step2', {
          handler: step2Handler,
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
        });

      const result = await workflow.executeWorkflow();

      expect(step2Handler).toHaveBeenCalled();
      expect(result.results.step2).toEqual({ result: 'step2' });
    });
  });
});
