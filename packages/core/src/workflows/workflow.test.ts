import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { createLogger } from '../logger';
import { createTool } from '../tools';

import { Step } from './step';
import type { WorkflowContext } from './types';
import { Workflow } from './workflow';

describe('Workflow', () => {
  describe('Basic Workflow Execution', () => {
    it('should execute a single step workflow successfully', async () => {
      const execute = vi.fn<any>().mockResolvedValue({ result: 'success' });
      const step1 = new Step({ id: 'step1', execute });

      const workflow = new Workflow({
        name: 'test-workflow',
      });

      workflow.step(step1).commit();

      const result = await workflow.execute();

      expect(execute).toHaveBeenCalled();
      expect(result.results['step1']).toEqual({
        status: 'success',
        output: { result: 'success' },
      });
    });

    it('should execute multiple steps in parallel', async () => {
      const step1Action = vi.fn().mockImplementation(async () => {
        return { value: 'step1' };
      });
      const step2Action = vi.fn().mockImplementation(async () => {
        return { value: 'step2' };
      });

      const step1 = new Step({ id: 'step1', execute: step1Action });
      const step2 = new Step({ id: 'step2', execute: step2Action });

      const workflow = new Workflow({
        name: 'test-workflow',
      });

      workflow.step(step1).step(step2).commit();

      const result = await workflow.execute();

      expect(step1Action).toHaveBeenCalled();
      expect(step2Action).toHaveBeenCalled();
      expect(result.results).toEqual({
        step1: { status: 'success', output: { value: 'step1' } },
        step2: { status: 'success', output: { value: 'step2' } },
      });
    });

    it('should execute steps sequentially', async () => {
      const executionOrder: string[] = [];

      const step1Action = vi.fn().mockImplementation(() => {
        executionOrder.push('step1');
        return { value: 'step1' };
      });
      const step2Action = vi.fn().mockImplementation(() => {
        executionOrder.push('step2');
        return { value: 'step2' };
      });

      const step1 = new Step({ id: 'step1', execute: step1Action });
      const step2 = new Step({ id: 'step2', execute: step2Action });

      const workflow = new Workflow({
        name: 'test-workflow',
      });

      workflow.step(step1).then(step2).commit();

      const result = await workflow.execute();

      expect(executionOrder).toEqual(['step1', 'step2']);
      expect(result.results).toEqual({
        step1: { status: 'success', output: { value: 'step1' } },
        step2: { status: 'success', output: { value: 'step2' } },
      });
    });
  });

  describe('Simple Conditions', () => {
    it('should follow conditional chains', async () => {
      const step1Action = vi.fn().mockImplementation(() => {
        return Promise.resolve({ status: 'success' });
      });
      const step2Action = vi.fn().mockImplementation(() => {
        return Promise.resolve({ result: 'step2' });
      });
      const step3Action = vi.fn().mockImplementation(() => {
        return Promise.resolve({ result: 'step3' });
      });

      const step1 = new Step({
        id: 'step1',
        execute: step1Action,
        outputSchema: z.object({ status: z.string() }),
      });
      const step2 = new Step({
        id: 'step2',
        execute: step2Action,
      });
      const step3 = new Step({ id: 'step3', execute: step3Action });

      const workflow = new Workflow({
        name: 'test-workflow',
        triggerSchema: z.object({
          status: z.enum(['pending', 'success', 'failed']),
        }),
      });

      workflow
        .step(step1, {
          variables: {
            status: { step: 'trigger', path: 'status' },
          },
        })
        .then(step2, {
          when: {
            ref: { step: step1, path: 'status' },
            query: { $eq: 'success' },
          },
        })
        .then(step3, {
          when: {
            ref: { step: step1, path: 'status' },
            query: { $eq: 'failed' },
          },
        })
        .commit();

      const result = await workflow.execute({ triggerData: { status: 'pending' } });

      expect(step1Action).toHaveBeenCalled();
      expect(step2Action).toHaveBeenCalled();
      expect(step3Action).not.toHaveBeenCalled();
      expect(result.results).toEqual({
        step1: { status: 'success', output: { status: 'success' } },
        step2: { status: 'success', output: { result: 'step2' } },
        step3: { status: 'failed', error: 'Step:step3 condition check failed' },
      });
    });

    it('should handle failing dependencies', async () => {
      const step1Action = vi.fn<any>().mockRejectedValue(new Error('Failed'));
      const step2Action = vi.fn<any>();

      const step1 = new Step({ id: 'step1', execute: step1Action });
      const step2 = new Step({ id: 'step2', execute: step2Action });

      const workflow = new Workflow({
        name: 'test-workflow',
      });

      workflow.step(step1).then(step2).commit();

      const result = await workflow.execute().catch(err => err);

      expect(step1Action).toHaveBeenCalled();
      expect(step2Action).not.toHaveBeenCalled();
      expect(result.results).toEqual({
        step1: { status: 'failed', error: 'Failed' },
      });
    });

    it('should support simple string conditions', async () => {
      const step1Action = vi.fn<any>().mockResolvedValue({ status: 'success' });
      const step2Action = vi.fn<any>().mockResolvedValue({ result: 'step2' });
      const step3Action = vi.fn<any>().mockResolvedValue({ result: 'step3' });
      const step1 = new Step({ id: 'step1', execute: step1Action });
      const step2 = new Step({ id: 'step2', execute: step2Action });
      const step3 = new Step({ id: 'step3', execute: step3Action });

      const workflow = new Workflow({ name: 'test-workflow' });
      workflow
        .step(step1)
        .then(step2, {
          when: {
            'step1.status': 'success',
          },
        })
        .then(step3, {
          when: {
            'step2.status': 'unexpected value',
          },
        })
        .commit();

      const result = await workflow.execute();

      expect(step1Action).toHaveBeenCalled();
      expect(step2Action).toHaveBeenCalled();
      expect(step3Action).not.toHaveBeenCalled();
      expect(result.results).toEqual({
        step1: { status: 'success', output: { status: 'success' } },
        step2: { status: 'success', output: { result: 'step2' } },
        step3: { status: 'failed', error: 'Step:step3 condition check failed' },
      });
    });

    it('should support custom condition functions', async () => {
      const step1Action = vi.fn<any>().mockResolvedValue({ count: 5 });
      const step2Action = vi.fn<any>();

      const step1 = new Step({
        id: 'step1',
        execute: step1Action,
        outputSchema: z.object({ count: z.number() }),
      });
      const step2 = new Step({ id: 'step2', execute: step2Action });

      const workflow = new Workflow({
        name: 'test-workflow',
      });

      workflow
        .step(step1)
        .then(step2, {
          when: async ({ context }) => {
            const step1Result = context.steps.step1;
            return step1Result && step1Result.status === 'success' && step1Result.output.count > 3;
          },
        })
        .commit();

      const result = await workflow.execute();

      expect(step2Action).toHaveBeenCalled();
      expect(result.results.step1).toEqual({
        status: 'success',
        output: { count: 5 },
      });
      expect(result.results.step2).toEqual({
        status: 'success',
        output: undefined,
      });
    });
  });

  describe('Variable Resolution', () => {
    it('should resolve trigger data', async () => {
      const execute = vi.fn<any>().mockResolvedValue({ result: 'success' });
      const triggerSchema = z.object({
        inputData: z.string(),
      });

      const step1 = new Step({ id: 'step1', execute });
      const step2 = new Step({ id: 'step2', execute });

      const workflow = new Workflow({
        name: 'test-workflow',
        triggerSchema,
      });

      workflow
        .step(step1, {
          variables: {
            inputData: { step: 'trigger', path: 'inputData' },
          },
        })
        .then(step2)
        .commit();

      const result = await workflow.execute({ triggerData: { inputData: 'test-input' } });

      expect(result.results.step1).toEqual({ status: 'success', output: { result: 'success' } });
      expect(result.results.step2).toEqual({ status: 'success', output: { result: 'success' } });
    });

    it('should provide access to step results and trigger data via getStepPayload helper', async () => {
      type TestTriggerSchema = z.ZodObject<{ inputValue: z.ZodString }>;

      const step1Action = vi
        .fn()
        .mockImplementation(async ({ context }: { context: WorkflowContext<TestTriggerSchema> }) => {
          // Test accessing trigger data with correct type
          const triggerData = context?.getStepPayload<{ inputValue: string }>('trigger');
          expect(triggerData).toEqual({ inputValue: 'test-input' });
          return { value: 'step1-result' };
        });

      const step2Action = vi
        .fn()
        .mockImplementation(async ({ context }: { context: WorkflowContext<TestTriggerSchema> }) => {
          // Test accessing previous step result with type
          type Step1Result = { value: string };
          const step1Result = context?.getStepPayload<Step1Result>('step1');
          expect(step1Result).toEqual({ value: 'step1-result' });

          // Verify that failed steps return undefined
          const failedStep = context?.getStepPayload<never>('non-existent-step');
          expect(failedStep).toBeUndefined();

          return { value: 'step2-result' };
        });

      const step1 = new Step({ id: 'step1', execute: step1Action });
      const step2 = new Step({ id: 'step2', execute: step2Action });

      const workflow = new Workflow({
        name: 'test-workflow',
        triggerSchema: z.object({
          inputValue: z.string(),
        }),
      });

      workflow.step(step1).then(step2).commit();

      const result = await workflow.execute({
        triggerData: { inputValue: 'test-input' },
      });

      expect(step1Action).toHaveBeenCalled();
      expect(step2Action).toHaveBeenCalled();
      expect(result.results).toEqual({
        step1: { status: 'success', output: { value: 'step1-result' } },
        step2: { status: 'success', output: { value: 'step2-result' } },
      });
    });

    it('should resolve trigger data from context', async () => {
      const execute = vi.fn<any>().mockResolvedValue({ result: 'success' });
      const triggerSchema = z.object({
        inputData: z.string(),
      });

      const step1 = new Step({ id: 'step1', execute });

      const workflow = new Workflow({
        name: 'test-workflow',
        triggerSchema,
      });

      workflow.step(step1).commit();

      const results = await workflow.execute({
        triggerData: { inputData: 'test-input' },
      });

      const baseContext = {
        attempts: { step1: 3 },
        steps: {},
        triggerData: { inputData: 'test-input' },
        getStepPayload: expect.any(Function),
      };

      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining(baseContext),
          runId: results.runId,
        }),
      );
    });

    it('should resolve variables from trigger data', async () => {
      const execute = vi.fn<any>().mockResolvedValue({ result: 'success' });
      const triggerSchema = z.object({
        inputData: z.object({
          nested: z.object({
            value: z.string(),
          }),
        }),
      });

      const step1 = new Step({ id: 'step1', execute });

      const workflow = new Workflow({
        name: 'test-workflow',
        triggerSchema,
      });

      workflow
        .step(step1, {
          variables: {
            tData: { step: 'trigger', path: '.' },
          },
        })
        .commit();

      const baseContext = {
        attempts: { step1: 3 },
        steps: {},
        triggerData: { inputData: { nested: { value: 'test' } } },
        getStepPayload: expect.any(Function),
      };

      await workflow.execute({ triggerData: { inputData: { nested: { value: 'test' } } } });

      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({
          context: {
            ...baseContext,
            triggerData: { inputData: { nested: { value: 'test' } } },
            tData: { inputData: { nested: { value: 'test' } } },
          },
          runId: expect.any(String),
        }),
      );
    });

    it('should resolve variables from previous steps', async () => {
      const step1Action = vi.fn<any>().mockResolvedValue({
        nested: { value: 'step1-data' },
      });
      const step2Action = vi.fn<any>().mockResolvedValue({ result: 'success' });

      const step1 = new Step({
        id: 'step1',
        execute: step1Action,
        outputSchema: z.object({ nested: z.object({ value: z.string() }) }),
      });
      const step2 = new Step({
        id: 'step2',
        execute: step2Action,
        inputSchema: z.object({ previousValue: z.string() }),
      });

      const workflow = new Workflow({
        name: 'test-workflow',
      });

      workflow
        .step(step1)
        .then(step2, {
          variables: {
            previousValue: { step: step1, path: 'nested.value' },
          },
        })
        .commit();

      const results = await workflow.execute();

      const baseContext = {
        attempts: { step1: 3, step2: 3 },
        steps: {},
        triggerData: {},
        getStepPayload: expect.any(Function),
      };

      expect(step2Action).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            ...baseContext,
            steps: {
              step1: {
                output: {
                  nested: {
                    value: 'step1-data',
                  },
                },
                status: 'success',
              },
            },
            previousValue: 'step1-data',
          }),
          runId: results.runId,
        }),
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle step execution errors', async () => {
      const error = new Error('Step execution failed');
      const failingAction = vi.fn<any>().mockRejectedValue(error);

      const step1 = new Step({ id: 'step1', execute: failingAction });

      const workflow = new Workflow({
        name: 'test-workflow',
      });

      workflow.step(step1).commit();

      await expect(workflow.execute()).resolves.toEqual({
        results: {
          step1: {
            error: 'Step execution failed',
            status: 'failed',
          },
        },
        runId: expect.any(String),
        triggerData: undefined,
      });
    });

    it('should handle variable resolution errors', async () => {
      const step1 = new Step({
        id: 'step1',
        execute: vi.fn<any>().mockResolvedValue({ data: 'success' }),
        outputSchema: z.object({ data: z.string() }),
      });
      const step2 = new Step({ id: 'step2', execute: vi.fn<any>() });

      const workflow = new Workflow({
        name: 'test-workflow',
      });

      workflow
        .step(step1)
        .then(step2, {
          variables: {
            data: { step: step1, path: 'data' },
          },
        })
        .commit();

      await expect(workflow.execute()).resolves.toEqual({
        results: {
          step1: {
            status: 'success',
            output: {
              data: 'success',
            },
          },
          step2: {
            output: undefined,
            status: 'success',
          },
        },
        runId: expect.any(String),
        triggerData: undefined,
      });
    });
  });

  describe('Complex Conditions', () => {
    it('should handle nested AND/OR conditions', async () => {
      const step1Action = vi.fn<any>().mockResolvedValue({
        status: 'partial',
        score: 75,
        flags: { isValid: true },
      });
      const step2Action = vi.fn<any>().mockResolvedValue({ result: 'step2' });
      const step3Action = vi.fn<any>().mockResolvedValue({ result: 'step3' });

      const step1 = new Step({
        id: 'step1',
        execute: step1Action,
        outputSchema: z.object({
          status: z.string(),
          score: z.number(),
          flags: z.object({ isValid: z.boolean() }),
        }),
      });
      const step2 = new Step({
        id: 'step2',
        execute: step2Action,
        outputSchema: z.object({ result: z.string() }),
      });
      const step3 = new Step({ id: 'step3', execute: step3Action });

      const workflow = new Workflow({
        name: 'test-workflow',
      });

      workflow
        .step(step1)
        .then(step2, {
          when: {
            and: [
              {
                or: [
                  {
                    ref: { step: step1, path: 'status' },
                    query: { $eq: 'success' },
                  },
                  {
                    and: [
                      {
                        ref: { step: step1, path: 'status' },
                        query: { $eq: 'partial' },
                      },
                      {
                        ref: { step: step1, path: 'score' },
                        query: { $gte: 70 },
                      },
                    ],
                  },
                ],
              },
              {
                ref: { step: step1, path: 'flags.isValid' },
                query: { $eq: true },
              },
            ],
          },
        })
        .then(step3, {
          when: {
            or: [
              {
                ref: { step: step1, path: 'status' },
                query: { $eq: 'failed' },
              },
              {
                ref: { step: step1, path: 'score' },
                query: { $lt: 70 },
              },
            ],
          },
        })
        .commit();

      const result = await workflow.execute();

      expect(step2Action).toHaveBeenCalled();
      expect(step3Action).not.toHaveBeenCalled();
      expect(result.results.step2).toEqual({ status: 'success', output: { result: 'step2' } });
    });
  });

  describe('Schema Validation', () => {
    it('should validate trigger data against schema', async () => {
      const triggerSchema = z.object({
        required: z.string(),
        nested: z.object({
          value: z.number(),
        }),
      });

      const step1 = new Step({
        id: 'step1',
        execute: vi.fn<any>().mockResolvedValue({ result: 'success' }),
      });

      const workflow = new Workflow({
        name: 'test-workflow',
        triggerSchema,
      });

      workflow.step(step1).commit();

      // // Should fail validation
      // await expect(
      //   workflow.execute({
      //     triggerData: {
      //       required: 'test',
      //       // @ts-expect-error
      //       nested: { value: 'not-a-number' },
      //     },
      //   }),
      // ).rejects.toThrow();

      // Should pass validation
      await workflow.execute({
        triggerData: {
          required: 'test',
          nested: { value: 42 },
        },
      });
    });
  });

  describe('Action Context', () => {
    it('should pass the correct context to the action', async () => {
      const action1 = vi.fn().mockResolvedValue({ result: 'success1' });
      const action2 = vi.fn().mockResolvedValue({ result: 'success2' });
      const action3 = vi.fn().mockResolvedValue({ result: 'success3' });
      const action4 = vi.fn().mockResolvedValue({ result: 'success4' });
      const action5 = vi.fn().mockResolvedValue({ result: 'success5' });

      const step1 = new Step({ id: 'step1', execute: action1 });
      const step2 = new Step({ id: 'step2', execute: action2, payload: { name: 'Dero Israel' } });
      const step3 = new Step({ id: 'step3', execute: action3 });
      const step4 = new Step({ id: 'step4', execute: action4 });
      const step5 = new Step({ id: 'step5', execute: action5 });

      const baseContext = {
        attempts: { step1: 3, step2: 3, step3: 3, step4: 3, step5: 3 },
        steps: {},
        triggerData: {},
        getStepPayload: expect.any(Function),
      };

      const workflow = new Workflow({
        name: 'test-workflow',
      });

      workflow.step(step1).then(step2).then(step3).step(step4).then(step5).commit();

      await workflow.execute();

      expect(action1).toHaveBeenCalledWith(
        expect.objectContaining({
          mastra: undefined,
          context: expect.objectContaining(baseContext),
          suspend: expect.any(Function),
          runId: expect.any(String),
        }),
      );
      expect(action2).toHaveBeenCalledWith(
        expect.objectContaining({
          mastra: undefined,
          context: {
            ...baseContext,
            steps: {
              step1: { status: 'success', output: { result: 'success1' } },
              step4: { status: 'success', output: { result: 'success4' } },
            },
            name: 'Dero Israel',
          },
          suspend: expect.any(Function),
          runId: expect.any(String),
        }),
      );
      expect(action3).toHaveBeenCalledWith(
        expect.objectContaining({
          mastra: undefined,
          context: expect.objectContaining({
            ...baseContext,
            steps: {
              step1: { status: 'success', output: { result: 'success1' } },
              step2: { status: 'success', output: { result: 'success2' } },
              step4: { status: 'success', output: { result: 'success4' } },
              step5: { status: 'success', output: { result: 'success5' } },
            },
          }),
          suspend: expect.any(Function),
          runId: expect.any(String),
        }),
      );
      expect(action5).toHaveBeenCalledWith(
        expect.objectContaining({
          mastra: undefined,
          context: expect.objectContaining({
            ...baseContext,
            steps: {
              step1: { status: 'success', output: { result: 'success1' } },
              step4: { status: 'success', output: { result: 'success4' } },
            },
          }),
          suspend: expect.any(Function),
          runId: expect.any(String),
        }),
      );
    });
  });

  describe('multiple chains', () => {
    it('should run multiple chains in parallel', async () => {
      const step1 = new Step({ id: 'step1', execute: vi.fn<any>().mockResolvedValue({ result: 'success1' }) });
      const step2 = new Step({ id: 'step2', execute: vi.fn<any>().mockResolvedValue({ result: 'success2' }) });
      const step3 = new Step({ id: 'step3', execute: vi.fn<any>().mockResolvedValue({ result: 'success3' }) });
      const step4 = new Step({ id: 'step4', execute: vi.fn<any>().mockResolvedValue({ result: 'success4' }) });
      const step5 = new Step({ id: 'step5', execute: vi.fn<any>().mockResolvedValue({ result: 'success5' }) });

      const workflow = new Workflow({ name: 'test-workflow' });
      workflow.step(step1).then(step2).then(step3).step(step4).then(step5).commit();

      const result = await workflow.execute();

      expect(result.results.step1).toEqual({ status: 'success', output: { result: 'success1' } });
      expect(result.results.step2).toEqual({ status: 'success', output: { result: 'success2' } });
      expect(result.results.step3).toEqual({ status: 'success', output: { result: 'success3' } });
      expect(result.results.step4).toEqual({ status: 'success', output: { result: 'success4' } });
      expect(result.results.step5).toEqual({ status: 'success', output: { result: 'success5' } });
    });
  });

  describe('Retry', () => {
    it('should retry a step', async () => {
      const step1 = new Step({ id: 'step1', execute: vi.fn<any>().mockResolvedValue({ result: 'success' }) });
      const step2 = new Step({ id: 'step2', execute: vi.fn<any>().mockResolvedValue({ result: 'success 2' }) });

      const workflow = new Workflow({
        name: 'test-workflow',
        retryConfig: { attempts: 3, delay: 500 },
        mastra: {
          logger: createLogger({
            name: 'Workflow',
          }),
        },
      });

      workflow
        .step(step1)
        .then(step2, {
          snapshotOnTimeout: true,
          when: async () => {
            return await new Promise(resolve => {
              setTimeout(() => {
                resolve(false);
              }, 100);
            });
          },
        })
        .commit();

      const result = await workflow.execute();

      expect(result.results.step1).toEqual({ status: 'success', output: { result: 'success' } });
      expect(result.results.step2).toEqual({ status: 'suspended' });
    });
  });

  describe('Subscribers (.after)', () => {
    it('should spawn subscribers for each step', async () => {
      const step1Action = vi.fn<any>().mockResolvedValue({ result: 'success1' });
      const step2Action = vi.fn<any>().mockResolvedValue({ result: 'success2' });
      const step3Action = vi.fn<any>().mockResolvedValue({ result: 'success3' });
      const step4Action = vi.fn<any>().mockResolvedValue({ result: 'success4' });
      const step5Action = vi.fn<any>().mockResolvedValue({ result: 'success5' });

      const step1 = new Step({ id: 'step1', execute: step1Action });
      const step2 = new Step({ id: 'step2', execute: step2Action });
      const step3 = new Step({ id: 'step3', execute: step3Action });
      const step4 = new Step({ id: 'step4', execute: step4Action });
      const step5 = new Step({ id: 'step5', execute: step5Action });
      const workflow = new Workflow({ name: 'test-workflow' });
      workflow.step(step1).then(step2).then(step5).after(step1).step(step3).then(step4).then(step5).commit();

      const result = await workflow.execute();

      expect(step1Action).toHaveBeenCalled();
      expect(step2Action).toHaveBeenCalled();
      expect(step3Action).toHaveBeenCalled();
      expect(step4Action).toHaveBeenCalled();
      expect(step5Action).toHaveBeenCalledTimes(2);
      expect(result.results.step1).toEqual({ status: 'success', output: { result: 'success1' } });
      expect(result.results.step2).toEqual({ status: 'success', output: { result: 'success2' } });
      expect(result.results.step3).toEqual({ status: 'success', output: { result: 'success3' } });
      expect(result.results.step4).toEqual({ status: 'success', output: { result: 'success4' } });
      expect(result.results.step5).toEqual({ status: 'success', output: { result: 'success5' } });
    });

    it('should conditionally run subscribers', async () => {
      const step1Action = vi.fn<any>().mockResolvedValue({ result: 'success1' });
      const step2Action = vi.fn<any>().mockResolvedValue({ result: 'success2' });
      const step3Action = vi.fn<any>().mockResolvedValue({ result: 'success3' });
      const step4Action = vi.fn<any>().mockResolvedValue({ result: 'success4' });
      const step5Action = vi.fn<any>().mockResolvedValue({ result: 'success5' });

      const step1 = new Step({ id: 'step1', execute: step1Action, outputSchema: z.object({ status: z.string() }) });
      const step2 = new Step({ id: 'step2', execute: step2Action });
      const step3 = new Step({ id: 'step3', execute: step3Action });
      const step4 = new Step({ id: 'step4', execute: step4Action });
      const step5 = new Step({ id: 'step5', execute: step5Action });
      const workflow = new Workflow({ name: 'test-workflow' });
      workflow
        .step(step1)
        .then(step2)
        .then(step5)
        .after(step1)
        .step(step3, {
          when: {
            ref: { step: step1, path: 'status' },
            query: { $eq: 'failed' },
          },
        })
        .then(step4)
        .then(step5)
        .commit();

      const result = await workflow.execute();

      expect(step1Action).toHaveBeenCalled();
      expect(step2Action).toHaveBeenCalled();
      expect(step3Action).not.toHaveBeenCalled();
      expect(step4Action).not.toHaveBeenCalled();
      expect(step5Action).toHaveBeenCalledTimes(1);
      expect(result.results.step1).toEqual({ status: 'success', output: { result: 'success1' } });
      expect(result.results.step2).toEqual({ status: 'success', output: { result: 'success2' } });
      expect(result.results.step5).toEqual({ status: 'success', output: { result: 'success5' } });
    });

    // don't unskip this please.. actually unskip it 😈
    it.skip('should spawn cyclic subscribers for each step', async () => {
      const step1Action = vi.fn<any>().mockResolvedValue({ result: 'success1' });
      const step3Action = vi.fn<any>().mockResolvedValue({ result: 'success3' });

      const step1 = new Step({ id: 'step1', execute: step1Action });
      const step3 = new Step({ id: 'step3', execute: step3Action });

      const workflow = new Workflow({ name: 'test-workflow' });
      workflow.step(step1).step(step3).after(step1).step(step3).after(step3).step(step1).commit();

      const result = await workflow.execute();

      expect(step1Action).toHaveBeenCalled();

      expect(step3Action).toHaveBeenCalled();
      expect(result.results.step1).toEqual({ status: 'success', output: { result: 'success1' } });
      expect(result.results.step3).toEqual({ status: 'success', output: { result: 'success3' } });
    });
  });

  describe('Interoperability (Actions)', () => {
    it('should be able to use all action types in a workflow', async () => {
      const step1Action = vi.fn<any>().mockResolvedValue({ name: 'step1' });

      const step1 = new Step({ id: 'step1', execute: step1Action, outputSchema: z.object({ name: z.string() }) });

      const toolAction = vi.fn<any>().mockResolvedValue({ age: 100 });

      const randomTool = createTool({
        id: 'random-tool',
        execute: toolAction,
        description: 'random-tool',
        inputSchema: z.object({ name: z.string() }),
        outputSchema: z.object({ age: z.number() }),
      });

      const workflow = new Workflow({ name: 'test-workflow' });
      workflow.step(step1).after(step1).step(randomTool).commit();

      await workflow.createRun().start();

      expect(step1Action).toHaveBeenCalled();
      expect(toolAction).toHaveBeenCalled();
    }, 10000);
  });

  describe('Watch', () => {
    it('should watch workflow state changes and call onTransition', async () => {
      const step1Action = vi.fn<any>().mockResolvedValue({ result: 'success1' });
      const step2Action = vi.fn<any>().mockResolvedValue({ result: 'success2' });

      const step1 = new Step({ id: 'step1', execute: step1Action });
      const step2 = new Step({ id: 'step2', execute: step2Action });

      const workflow = new Workflow({ name: 'test-workflow' });
      workflow.step(step1).then(step2).commit();

      const onTransition = vi.fn();

      const run = workflow.createRun();

      // Start watching the workflow
      workflow.watch(onTransition);

      const executionResult = await run.start();

      expect(onTransition).toHaveBeenCalledTimes(6);
      expect(onTransition).toHaveBeenCalledWith(
        expect.objectContaining({
          runId: expect.any(String),
          value: { step1: 'runningSubscribers' },
          context: expect.objectContaining({
            steps: { step1: expect.any(Object) },
            triggerData: {},
            attempts: { step1: 3, step2: 3 },
          }),
          activePaths: [
            {
              stepPath: expect.any(Array),
              stepId: 'step1',
              status: 'runningSubscribers',
            },
          ],
          timestamp: expect.any(Number),
        }),
      );

      // Verify execution completed successfully
      expect(executionResult.results.step1).toEqual({
        status: 'success',
        output: { result: 'success1' },
      });
      expect(executionResult.results.step2).toEqual({
        status: 'success',
        output: { result: 'success2' },
      });
    });

    it('should unsubscribe from transitions when unwatch is called', async () => {
      const step1Action = vi.fn<any>().mockResolvedValue({ result: 'success1' });
      const step2Action = vi.fn<any>().mockResolvedValue({ result: 'success2' });

      const step1 = new Step({ id: 'step1', execute: step1Action });
      const step2 = new Step({ id: 'step2', execute: step2Action });

      const workflow = new Workflow({ name: 'test-workflow' });
      workflow.step(step1).then(step2).commit();

      const onTransition = vi.fn();
      const onTransition2 = vi.fn();

      const run = workflow.createRun();

      const unwatch = workflow.watch(onTransition);
      const unwatch2 = workflow.watch(onTransition2);

      await run.start();

      expect(onTransition).toHaveBeenCalledTimes(6);
      expect(onTransition2).toHaveBeenCalledTimes(6);

      unwatch();

      const run2 = workflow.createRun();
      await run2.start();

      expect(onTransition).toHaveBeenCalledTimes(6);
      expect(onTransition2).toHaveBeenCalledTimes(12);

      unwatch2();

      const run3 = workflow.createRun();
      await run3.start();

      expect(onTransition).toHaveBeenCalledTimes(6);
      expect(onTransition2).toHaveBeenCalledTimes(12);
    });

    it('should handle parallel transitions', async () => {
      const step1Action = vi.fn<any>().mockResolvedValue({ result: 'success1' });
      const step2Action = vi.fn<any>().mockResolvedValue({ result: 'success2' });

      const step1 = new Step({ id: 'step1', execute: step1Action });
      const step2 = new Step({ id: 'step2', execute: step2Action });

      const workflow = new Workflow({ name: 'test-workflow' });
      workflow.step(step1).step(step2).commit();

      const onTransition = vi.fn();

      const run = workflow.createRun();

      workflow.watch(onTransition);

      await run.start();

      expect(onTransition).toHaveBeenCalledTimes(6);
      expect(onTransition).toHaveBeenCalledWith(
        expect.objectContaining({
          activePaths: [
            {
              stepPath: expect.any(Array),
              stepId: 'step1',
              status: 'runningSubscribers',
            },
            {
              stepPath: expect.any(Array),
              stepId: 'step2',
              status: 'runningSubscribers',
            },
          ],
        }),
      );
    });
  });
});
