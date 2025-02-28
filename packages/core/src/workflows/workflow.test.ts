import fs from 'fs';
import path from 'path';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { createLogger } from '../logger';
import { Mastra } from '../mastra';
import { DefaultStorage } from '../storage/libsql';
import { createTool } from '../tools';

import { Step } from './step';
import type { WorkflowContext, WorkflowResumeResult } from './types';
import { Workflow } from './workflow';

const storage = new DefaultStorage({
  config: {
    url: 'file:mastra.db',
  },
});

const logger = createLogger({
  level: 'info',
});

describe('Workflow', async () => {
  beforeEach(async () => {
    await storage.init();
  });

  describe('Basic Workflow Execution', () => {
    it('should execute a single step workflow successfully', async () => {
      const execute = vi.fn<any>().mockResolvedValue({ result: 'success' });
      const step1 = new Step({ id: 'step1', execute });

      const workflow = new Workflow({
        name: 'test-workflow',
      });

      workflow.step(step1).commit();

      const run = workflow.createRun();
      const result = await run.start();

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

      const run = workflow.createRun();
      const result = await run.start();

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

      const run = workflow.createRun();
      const result = await run.start();

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

      const run = workflow.createRun();
      const result = await run.start({ triggerData: { status: 'pending' } });

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

      const run = workflow.createRun();
      let result: Awaited<ReturnType<typeof run.start>> | undefined = undefined;
      try {
        result = await run.start();
      } catch {
        // do nothing
      }

      expect(step1Action).toHaveBeenCalled();
      expect(step2Action).not.toHaveBeenCalled();
      expect(result?.results).toEqual({
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

      const run = workflow.createRun();
      const result = await run.start();

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
            const step1Result = context.getStepResult<{ count: number }>('step1');
            return step1Result ? step1Result.count > 3 : false;
          },
        })
        .commit();

      const run = workflow.createRun();
      const result = await run.start();

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

      const run = workflow.createRun();
      const result = await run.start({ triggerData: { inputData: 'test-input' } });

      expect(result.results.step1).toEqual({ status: 'success', output: { result: 'success' } });
      expect(result.results.step2).toEqual({ status: 'success', output: { result: 'success' } });
    });

    it('should provide access to step results and trigger data via getStepResult helper', async () => {
      type TestTriggerSchema = z.ZodObject<{ inputValue: z.ZodString }>;

      const step1Action = vi
        .fn()
        .mockImplementation(async ({ context }: { context: WorkflowContext<TestTriggerSchema> }) => {
          // Test accessing trigger data with correct type
          const triggerData = context?.getStepResult<{ inputValue: string }>('trigger');
          expect(triggerData).toEqual({ inputValue: 'test-input' });
          return { value: 'step1-result' };
        });

      const step2Action = vi
        .fn()
        .mockImplementation(async ({ context }: { context: WorkflowContext<TestTriggerSchema> }) => {
          // Test accessing previous step result with type
          type Step1Result = { value: string };
          const step1Result = context?.getStepResult<Step1Result>('step1');
          expect(step1Result).toEqual({ value: 'step1-result' });

          // Verify that failed steps return undefined
          const failedStep = context?.getStepResult<never>('non-existent-step');
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

      const run = workflow.createRun();
      const result = await run.start({ triggerData: { inputValue: 'test-input' } });

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

      const run = workflow.createRun();
      const results = await run.start({ triggerData: { inputData: 'test-input' } });

      const baseContext = {
        attempts: { step1: 3 },
        steps: {},
        triggerData: { inputData: 'test-input' },
        getStepResult: expect.any(Function),
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
        getStepResult: expect.any(Function),
      };

      const run = workflow.createRun();
      await run.start({ triggerData: { inputData: { nested: { value: 'test' } } } });

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

      const run = workflow.createRun();
      const results = await run.start();

      const baseContext = {
        attempts: { step1: 3, step2: 3 },
        steps: {},
        triggerData: {},
        getStepResult: expect.any(Function),
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

      const run = workflow.createRun();

      await expect(run.start()).resolves.toMatchObject({
        results: {
          step1: {
            error: 'Step execution failed',
            status: 'failed',
          },
        },
        runId: expect.any(String),
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

      const run = workflow.createRun();
      await expect(run.start()).resolves.toMatchObject({
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

      const run = workflow.createRun();
      const result = await run.start();

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
      const run = workflow.createRun();
      await run.start({
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
        getStepResult: expect.any(Function),
      };

      const workflow = new Workflow({
        name: 'test-workflow',
      });

      workflow.step(step1).then(step2).then(step3).step(step4).then(step5).commit();

      const run = workflow.createRun();
      await run.start();

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

      const run = workflow.createRun();
      const result = await run.start();

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

        retryConfig: { attempts: 3, delay: 10 },
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

      const run = workflow.createRun();
      const result = await run.start();

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

      const run = workflow.createRun();
      const result = await run.start();

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

      const run = workflow.createRun();
      const result = await run.start();

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

      const run = workflow.createRun();
      const result = await run.start();

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

  describe('Suspend and Resume', () => {
    afterAll(async () => {
      const pathToDb = path.join(process.cwd(), 'mastra.db');

      if (fs.existsSync(pathToDb)) {
        fs.rmSync(pathToDb);
      }
    });
    it('should handle basic suspend and resume flow', async () => {
      const getUserInputAction = vi.fn().mockResolvedValue({ userInput: 'test input' });
      const promptAgentAction = vi
        .fn()
        .mockImplementationOnce(async ({ suspend }) => {
          await suspend();
          return undefined;
        })
        .mockImplementationOnce(() => ({ modelOutput: 'test output' }));
      const evaluateToneAction = vi.fn().mockResolvedValue({
        toneScore: { score: 0.8 },
        completenessScore: { score: 0.7 },
      });
      const improveResponseAction = vi.fn().mockResolvedValue({ improvedOutput: 'improved output' });
      const evaluateImprovedAction = vi.fn().mockResolvedValue({
        toneScore: { score: 0.9 },
        completenessScore: { score: 0.8 },
      });

      const getUserInput = new Step({
        id: 'getUserInput',
        execute: getUserInputAction,
        outputSchema: z.object({ userInput: z.string() }),
      });
      const promptAgent = new Step({
        id: 'promptAgent',
        execute: promptAgentAction,
        outputSchema: z.object({ modelOutput: z.string() }),
      });
      const evaluateTone = new Step({
        id: 'evaluateToneConsistency',
        execute: evaluateToneAction,
        outputSchema: z.object({
          toneScore: z.any(),
          completenessScore: z.any(),
        }),
      });
      const improveResponse = new Step({
        id: 'improveResponse',
        execute: improveResponseAction,
        outputSchema: z.object({ improvedOutput: z.string() }),
      });
      const evaluateImproved = new Step({
        id: 'evaluateImprovedResponse',
        execute: evaluateImprovedAction,
        outputSchema: z.object({
          toneScore: z.any(),
          completenessScore: z.any(),
        }),
      });

      const promptEvalWorkflow = new Workflow({
        name: 'test-workflow',
        triggerSchema: z.object({ input: z.string() }),
      });

      promptEvalWorkflow
        .step(getUserInput)
        .then(promptAgent)
        .then(evaluateTone)
        .then(improveResponse)
        .then(evaluateImproved)
        .commit();

      // Create a new storage instance for initial run
      const initialStorage = new DefaultStorage({
        config: {
          url: 'file:mastra.db',
        },
      });
      await initialStorage.init();

      const mastra = new Mastra({
        logger,
        storage: initialStorage,
        workflows: { 'test-workflow': promptEvalWorkflow },
      });

      const wf = mastra.getWorkflow('test-workflow');
      const run = wf.createRun();

      // Create a promise to track when the workflow is ready to resume
      let resolveWorkflowSuspended: (value: unknown) => void;
      const workflowSuspended = new Promise(resolve => {
        resolveWorkflowSuspended = resolve;
      });

      wf.watch(data => {
        const suspended = data.activePaths.find(p => p.status === 'suspended');
        if (suspended?.stepId === 'promptAgent') {
          const newCtx = {
            ...data.context,
          };
          // @ts-ignore
          newCtx.steps.getUserInput.output = {
            userInput: 'test input for resumption',
          };
          resolveWorkflowSuspended({ runId: run.runId, stepId: suspended.stepId, context: newCtx });
        }
      });

      const initialResult = await run.start({ triggerData: { input: 'test' } });
      expect(initialResult.results.promptAgent.status).toBe('suspended');
      expect(promptAgentAction).toHaveBeenCalledTimes(1);

      // Wait for the workflow to be ready to resume
      const resumeData = await workflowSuspended;
      const resumeWf = mastra.getWorkflow('test-workflow');
      const resumeResult = await resumeWf.resume(resumeData as any);

      if (!resumeResult) {
        throw new Error('Resume failed to return a result');
      }

      expect(resumeResult.results).toEqual({
        getUserInput: { status: 'success', output: { userInput: 'test input for resumption' } },
        promptAgent: { status: 'success', output: { modelOutput: 'test output' } },
        evaluateToneConsistency: {
          status: 'success',
          output: { toneScore: { score: 0.8 }, completenessScore: { score: 0.7 } },
        },
        improveResponse: { status: 'success', output: { improvedOutput: 'improved output' } },
        evaluateImprovedResponse: {
          status: 'success',
          output: { toneScore: { score: 0.9 }, completenessScore: { score: 0.8 } },
        },
      });
    });

    it('should handle parallel steps with conditional suspend', async () => {
      const getUserInputAction = vi.fn().mockResolvedValue({ userInput: 'test input' });
      const promptAgentAction = vi.fn().mockResolvedValue({ modelOutput: 'test output' });
      const evaluateToneAction = vi.fn().mockResolvedValue({
        toneScore: { score: 0.8 },
        completenessScore: { score: 0.7 },
      });
      const humanInterventionAction = vi
        .fn()
        .mockImplementationOnce(async ({ suspend, context }) => {
          const { humanPrompt } = context.getStepResult('humanIntervention') ?? {};

          if (!humanPrompt) {
            await suspend();
          }
        })
        .mockImplementationOnce(() => ({ improvedOutput: 'human intervention output' }));
      const explainResponseAction = vi.fn().mockResolvedValue({
        improvedOutput: 'explanation output',
      });

      const getUserInput = new Step({
        id: 'getUserInput',
        execute: getUserInputAction,
        outputSchema: z.object({ userInput: z.string() }),
      });
      const promptAgent = new Step({
        id: 'promptAgent',
        execute: promptAgentAction,
        outputSchema: z.object({ modelOutput: z.string() }),
      });
      const evaluateTone = new Step({
        id: 'evaluateToneConsistency',
        execute: evaluateToneAction,
        outputSchema: z.object({
          toneScore: z.any(),
          completenessScore: z.any(),
        }),
      });
      const humanIntervention = new Step({
        id: 'humanIntervention',
        execute: humanInterventionAction,
        outputSchema: z.object({ improvedOutput: z.string() }),
      });
      const explainResponse = new Step({
        id: 'explainResponse',
        execute: explainResponseAction,
        outputSchema: z.object({ improvedOutput: z.string() }),
      });

      const workflow = new Workflow({
        name: 'test-workflow',
        triggerSchema: z.object({ input: z.string() }),
      });

      workflow
        .step(getUserInput)
        .then(promptAgent)
        .then(evaluateTone)
        .after(evaluateTone)
        .step(humanIntervention, {
          when: () => Promise.resolve(true),
        })
        .step(explainResponse, {
          when: () => Promise.resolve(false),
        })
        .commit();

      const mastra = new Mastra({
        logger,
        workflows: { 'test-workflow': workflow },
      });

      const wf = mastra.getWorkflow('test-workflow');
      const run = wf.createRun();

      const started = run.start({ triggerData: { input: 'test' } });

      const result = await new Promise<WorkflowResumeResult<any>>((resolve, reject) => {
        let hasResumed = false;
        wf.watch(async data => {
          const suspended = data.activePaths.find(p => p.status === 'suspended');
          if (suspended?.stepId === 'humanIntervention') {
            const newCtx = {
              ...data.context,
              humanPrompt: 'What improvements would you suggest?',
            };
            if (!hasResumed) {
              hasResumed = true;

              try {
                const resumed = await wf.resume({
                  runId: run.runId,
                  stepId: suspended.stepId,
                  context: newCtx,
                });
                resolve(resumed as any);
              } catch (error) {
                reject(error);
              }
            }
          }
        });
      });

      const initialResult = await started;
      expect(initialResult.results.humanIntervention.status).toBe('suspended');
      expect(initialResult.results.explainResponse.status).toBe('failed');
      expect(humanInterventionAction).toHaveBeenCalledTimes(2);
      expect(explainResponseAction).not.toHaveBeenCalled();

      if (!result) {
        throw new Error('Resume failed to return a result');
      }

      expect(result.results).toEqual({
        getUserInput: { status: 'success', output: { userInput: 'test input' } },
        promptAgent: { status: 'success', output: { modelOutput: 'test output' } },
        evaluateToneConsistency: {
          status: 'success',
          output: { toneScore: { score: 0.8 }, completenessScore: { score: 0.7 } },
        },
        humanIntervention: { status: 'success', output: { improvedOutput: 'human intervention output' } },
        explainResponse: { status: 'failed', error: 'Step:explainResponse condition check failed' },
      });
    });

    it('should handle complex workflow with multiple suspends', async () => {
      const getUserInputAction = vi.fn().mockResolvedValue({ userInput: 'test input' });
      const promptAgentAction = vi.fn().mockResolvedValue({ modelOutput: 'test output' });

      const evaluateToneAction = vi.fn().mockResolvedValue({
        toneScore: { score: 0.8 },
        completenessScore: { score: 0.7 },
      });
      const improveResponseAction = vi
        .fn()
        .mockImplementationOnce(async ({ suspend }) => {
          await suspend();
        })
        .mockImplementationOnce(() => ({ improvedOutput: 'improved output' }));
      const evaluateImprovedAction = vi.fn().mockResolvedValue({
        toneScore: { score: 0.9 },
        completenessScore: { score: 0.8 },
      });
      const humanInterventionAction = vi
        .fn()
        .mockImplementationOnce(async ({ suspend }) => {
          await suspend();
        })
        .mockImplementationOnce(() => ({ improvedOutput: 'human intervention output' }));
      const explainResponseAction = vi.fn().mockResolvedValue({
        improvedOutput: 'explanation output',
      });

      const getUserInput = new Step({
        id: 'getUserInput',
        execute: getUserInputAction,
        outputSchema: z.object({ userInput: z.string() }),
      });
      const promptAgent = new Step({
        id: 'promptAgent',
        execute: promptAgentAction,
        outputSchema: z.object({ modelOutput: z.string() }),
      });
      const evaluateTone = new Step({
        id: 'evaluateToneConsistency',
        execute: evaluateToneAction,
        outputSchema: z.object({
          toneScore: z.any(),
          completenessScore: z.any(),
        }),
      });
      const improveResponse = new Step({
        id: 'improveResponse',
        execute: improveResponseAction,
        outputSchema: z.object({ improvedOutput: z.string() }),
      });
      const evaluateImproved = new Step({
        id: 'evaluateImprovedResponse',
        execute: evaluateImprovedAction,
        outputSchema: z.object({
          toneScore: z.any(),
          completenessScore: z.any(),
        }),
      });
      const humanIntervention = new Step({
        id: 'humanIntervention',
        execute: humanInterventionAction,
        outputSchema: z.object({ improvedOutput: z.string() }),
      });
      const explainResponse = new Step({
        id: 'explainResponse',
        execute: explainResponseAction,
        outputSchema: z.object({ improvedOutput: z.string() }),
      });

      const workflow = new Workflow({
        name: 'test-workflow',
        triggerSchema: z.object({ input: z.string() }),
      });

      workflow
        .step(getUserInput)
        .then(promptAgent)
        .then(evaluateTone)
        .then(improveResponse)
        .then(evaluateImproved)
        .after(evaluateImproved)
        .step(humanIntervention, {
          when: () => Promise.resolve(true),
        })
        .step(explainResponse, {
          when: () => Promise.resolve(false),
        })
        .commit();

      const mastra = new Mastra({
        logger,
        workflows: { 'test-workflow': workflow },
      });

      const wf = mastra.getWorkflow('test-workflow');
      const run = wf.createRun();
      const started = run.start({ triggerData: { input: 'test' } });
      let improvedResponseResultPromise: Promise<WorkflowResumeResult<any> | undefined>;

      const result = await new Promise<WorkflowResumeResult<any>>((resolve, reject) => {
        let hasResumed = false;
        wf.watch(async data => {
          const suspended = data.activePaths.find(p => p.status === 'suspended');

          if (suspended?.stepId === 'humanIntervention') {
            const newCtx = {
              ...data.context,
              humanPrompt: 'What improvements would you suggest?',
            };
            if (!hasResumed) {
              hasResumed = true;

              try {
                const resumed = await wf.resume({
                  runId: run.runId,
                  stepId: suspended.stepId,
                  context: newCtx,
                });
                resolve(resumed as any);
              } catch (error) {
                reject(error);
              }
            }
          } else if (suspended?.stepId === 'improveResponse') {
            const resumed = wf.resume({
              runId: run.runId,
              stepId: suspended.stepId,
              context: {
                ...data.context,
              },
            });
            improvedResponseResultPromise = resumed;
          }
        });
      });

      const initialResult = await started;

      // @ts-ignore
      const improvedResponseResult = await improvedResponseResultPromise;
      expect(initialResult?.results.improveResponse.status).toBe('suspended');

      expect(improvedResponseResult?.results.humanIntervention.status).toBe('suspended');
      expect(improvedResponseResult?.results.improveResponse.status).toBe('success');
      expect(improvedResponseResult?.results.evaluateImprovedResponse.status).toBe('success');
      expect(improvedResponseResult?.results.explainResponse.status).toBe('failed');
      expect(humanInterventionAction).toHaveBeenCalledTimes(2);
      expect(explainResponseAction).not.toHaveBeenCalled();

      if (!result) {
        throw new Error('Resume failed to return a result');
      }

      expect(result.results).toEqual({
        getUserInput: { status: 'success', output: { userInput: 'test input' } },
        promptAgent: { status: 'success', output: { modelOutput: 'test output' } },
        evaluateToneConsistency: {
          status: 'success',
          output: { toneScore: { score: 0.8 }, completenessScore: { score: 0.7 } },
        },
        improveResponse: { status: 'success', output: { improvedOutput: 'improved output' } },
        evaluateImprovedResponse: {
          status: 'success',
          output: { toneScore: { score: 0.9 }, completenessScore: { score: 0.8 } },
        },
        humanIntervention: { status: 'success', output: { improvedOutput: 'human intervention output' } },
        explainResponse: { status: 'failed', error: 'Step:explainResponse condition check failed' },
      });
    });

    it('should handle basic suspend and resume flow with async await syntax', async () => {
      const getUserInputAction = vi.fn().mockResolvedValue({ userInput: 'test input' });
      const promptAgentAction = vi
        .fn()
        .mockImplementationOnce(async ({ suspend }) => {
          await suspend();
          return undefined;
        })
        .mockImplementationOnce(() => ({ modelOutput: 'test output' }));
      const evaluateToneAction = vi.fn().mockResolvedValue({
        toneScore: { score: 0.8 },
        completenessScore: { score: 0.7 },
      });
      const improveResponseAction = vi
        .fn()
        .mockImplementationOnce(async ({ suspend }) => {
          await suspend();
          return undefined;
        })
        .mockImplementationOnce(() => ({ improvedOutput: 'improved output' }));
      const evaluateImprovedAction = vi.fn().mockResolvedValue({
        toneScore: { score: 0.9 },
        completenessScore: { score: 0.8 },
      });

      const getUserInput = new Step({
        id: 'getUserInput',
        execute: getUserInputAction,
        outputSchema: z.object({ userInput: z.string() }),
      });
      const promptAgent = new Step({
        id: 'promptAgent',
        execute: promptAgentAction,
        outputSchema: z.object({ modelOutput: z.string() }),
      });
      const evaluateTone = new Step({
        id: 'evaluateToneConsistency',
        execute: evaluateToneAction,
        outputSchema: z.object({
          toneScore: z.any(),
          completenessScore: z.any(),
        }),
      });
      const improveResponse = new Step({
        id: 'improveResponse',
        execute: improveResponseAction,
        outputSchema: z.object({ improvedOutput: z.string() }),
      });
      const evaluateImproved = new Step({
        id: 'evaluateImprovedResponse',
        execute: evaluateImprovedAction,
        outputSchema: z.object({
          toneScore: z.any(),
          completenessScore: z.any(),
        }),
      });

      const promptEvalWorkflow = new Workflow({
        name: 'test-workflow',
        triggerSchema: z.object({ input: z.string() }),
      });

      promptEvalWorkflow
        .step(getUserInput)
        .then(promptAgent)
        .then(evaluateTone)
        .then(improveResponse)
        .then(evaluateImproved)
        .commit();

      const mastra = new Mastra({
        logger,
        workflows: { 'test-workflow': promptEvalWorkflow },
      });

      const wf = mastra.getWorkflow('test-workflow');
      const run = wf.createRun();

      const initialResult = await run.start({ triggerData: { input: 'test' } });
      expect(initialResult.results.promptAgent.status).toBe('suspended');
      expect(promptAgentAction).toHaveBeenCalledTimes(1);
      expect(initialResult.activePaths.size).toBe(1);
      expect(initialResult.activePaths.get('promptAgent')?.status).toBe('suspended');

      expect(initialResult.results).toEqual({
        getUserInput: { status: 'success', output: { userInput: 'test input' } },
        promptAgent: { status: 'suspended' },
      });

      const newCtx = {
        userInput: 'test input for resumption',
      };

      expect(initialResult.results.promptAgent.status).toBe('suspended');
      expect(promptAgentAction).toHaveBeenCalledTimes(1);

      const firstResumeResult = await wf.resume({ runId: run.runId, stepId: 'promptAgent', context: newCtx });

      if (!firstResumeResult) {
        throw new Error('Resume failed to return a result');
      }

      expect(firstResumeResult.activePaths.size).toBe(1);
      expect(firstResumeResult.activePaths.get('improveResponse')?.status).toBe('suspended');
      expect(firstResumeResult.results).toEqual({
        getUserInput: { status: 'success', output: { userInput: 'test input' } },
        promptAgent: { status: 'success', output: { modelOutput: 'test output' } },
        evaluateToneConsistency: {
          status: 'success',
          output: {
            toneScore: { score: 0.8 },
            completenessScore: { score: 0.7 },
          },
        },
        improveResponse: { status: 'suspended' },
      });

      const secondResumeResult = await wf.resume({ runId: run.runId, stepId: 'improveResponse', context: newCtx });
      if (!secondResumeResult) {
        throw new Error('Resume failed to return a result');
      }

      expect(secondResumeResult.results).toEqual({
        getUserInput: { status: 'success', output: { userInput: 'test input' } },
        promptAgent: { status: 'success', output: { modelOutput: 'test output' } },
        evaluateToneConsistency: {
          status: 'success',
          output: { toneScore: { score: 0.8 }, completenessScore: { score: 0.7 } },
        },
        improveResponse: { status: 'success', output: { improvedOutput: 'improved output' } },
        evaluateImprovedResponse: {
          status: 'success',
          output: { toneScore: { score: 0.9 }, completenessScore: { score: 0.8 } },
        },
      });
    });
  });
});
