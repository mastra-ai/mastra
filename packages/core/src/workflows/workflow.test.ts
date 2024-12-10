import { describe, it, expect, jest } from '@jest/globals';
import { z } from 'zod';

import { Step } from './step';
import { Workflow } from './workflow';

describe('Workflow', () => {
  describe('Basic Workflow Execution', () => {
    it('should execute a single step workflow successfully', async () => {
      const action = jest.fn<any>().mockResolvedValue({ result: 'success' });
      const step1 = new Step({ id: 'step1', action });

      const workflow = new Workflow({
        name: 'test-workflow',
      });

      workflow.step(step1).commit();

      const result = await workflow.execute();

      expect(action).toHaveBeenCalled();
      expect(result.results['step1']).toEqual({
        status: 'success',
        payload: { result: 'success' },
      });
    });

    it('should execute multiple steps in parallel', async () => {
      const step1Action = jest.fn<any>().mockImplementation(async () => {
        return { value: 'step1' };
      });
      const step2Action = jest.fn<any>().mockImplementation(async () => {
        return { value: 'step2' };
      });

      const step1 = new Step({ id: 'step1', action: step1Action });
      const step2 = new Step({ id: 'step2', action: step2Action });

      const workflow = new Workflow({
        name: 'test-workflow',
      });

      workflow.step(step1).step(step2).commit();

      const result = await workflow.execute();

      expect(step1Action).toHaveBeenCalled();
      expect(step2Action).toHaveBeenCalled();
      expect(result.results).toEqual({
        step1: { status: 'success', payload: { value: 'step1' } },
        step2: { status: 'success', payload: { value: 'step2' } },
      });
    });

    it('should execute steps sequentially', async () => {
      const executionOrder: string[] = [];

      const step1Action = jest.fn<any>().mockImplementation(async () => {
        executionOrder.push('step1');
        return { value: 'step1' };
      });
      const step2Action = jest.fn<any>().mockImplementation(async () => {
        executionOrder.push('step2');
        return { value: 'step2' };
      });

      const step1 = new Step({ id: 'step1', action: step1Action });
      const step2 = new Step({ id: 'step2', action: step2Action });

      const workflow = new Workflow({
        name: 'test-workflow',
      });

      workflow.step(step1).then(step2).commit();

      const result = await workflow.execute();

      expect(executionOrder).toEqual(['step1', 'step2']);
      expect(result.results).toEqual({
        step1: { status: 'success', payload: { value: 'step1' } },
        step2: { status: 'success', payload: { value: 'step2' } },
      });
    });
  });

  describe('Dependency Conditions', () => {
    it('should follow conditional dependencies', async () => {
      const step1Action = jest.fn<any>().mockImplementation(() => {
        console.log('step1Action');
        return Promise.resolve({ status: 'success' });
      });
      const step2Action = jest.fn<any>().mockImplementation(() => {
        console.log('step2Action');
        return Promise.resolve({ result: 'step2' });
      });
      const step3Action = jest.fn<any>().mockImplementation(() => {
        console.log('step3Action');
        return Promise.resolve({ result: 'step3' });
      });

      const step1 = new Step({
        id: 'step1',
        action: step1Action,
        outputSchema: z.object({ status: z.string() }),
      });
      const step2 = new Step({
        id: 'step2',
        action: step2Action,
      });
      const step3 = new Step({ id: 'step3', action: step3Action });

      const workflow = new Workflow({
        name: 'test-workflow',
      });

      workflow
        .step(step1)
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

      const result = await workflow.execute();

      expect(step1Action).toHaveBeenCalled();
      expect(step2Action).toHaveBeenCalled();
      expect(step3Action).not.toHaveBeenCalled();
      expect(result.results).toEqual({
        step1: { status: 'success', payload: { status: 'success' } },
        step2: { status: 'success', payload: { result: 'step2' } },
        step3: { status: 'failed', error: 'Step:step3 condition check failed' },
      });
    });

    it('should handle failing dependencies', async () => {
      const step1Action = jest.fn<any>().mockRejectedValue(new Error('Failed'));
      const step2Action = jest.fn<any>();

      const step1 = new Step({ id: 'step1', action: step1Action });
      const step2 = new Step({ id: 'step2', action: step2Action });

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

    // it('should support custom condition functions', async () => {
    //   const step1Action = jest.fn<any>().mockResolvedValue({ count: 5 });
    //   const step2Action = jest.fn<any>();

    //   const step1 = new Step({
    //     id: 'step1',
    //     action: step1Action,
    //     outputSchema: z.object({ count: z.number() }),
    //   });
    //   const step2 = new Step({ id: 'step2', action: step2Action });

    //   const workflow = new Workflow({
    //     name: 'test-workflow',
    //     steps: [step1, step2],
    //   });

    //   workflow
    //     .config('step2', {
    //       dependsOn: ['step1'],
    //       conditionFn: async ({ context }) => {
    //         const step1Result = context.stepResults.step1;
    //         return step1Result && step1Result.status === 'success' && step1Result.payload.count > 3;
    //       },
    //     })
    //     .commit();

    //   const result = await workflow.execute();

    //   expect(step2Action).toHaveBeenCalled();
    //   expect(result.results.step1).toEqual({
    //     status: 'success',
    //     payload: { count: 5 },
    //   });
    //   expect(result.results.step2).toEqual({
    //     status: 'success',
    //     payload: undefined,
    //   });
    // });
  });

  describe('Variable Resolution', () => {
    it('should resolve variables from trigger data', async () => {
      const action = jest.fn<any>().mockResolvedValue({ result: 'success' });
      const triggerSchema = z.object({
        inputData: z.string(),
      });

      const step1 = new Step({ id: 'step1', action });

      const workflow = new Workflow({
        name: 'test-workflow',
        triggerSchema,
      });

      workflow
        .step(step1, {
          variables: {
            input: { step: 'trigger', path: 'inputData' },
          },
        })
        .commit();

      const results = await workflow.execute({
        triggerData: { inputData: 'test-input' },
      });

      expect(action).toHaveBeenCalledWith({
        data: { input: 'test-input' },
        runId: results.runId,
      });
    });

    it('should resolve variables from previous steps', async () => {
      const step1Action = jest.fn<any>().mockResolvedValue({
        nested: { value: 'step1-data' },
      });
      const step2Action = jest.fn<any>().mockResolvedValue({ result: 'success' });

      const step1 = new Step({
        id: 'step1',
        action: step1Action,
        outputSchema: z.object({ nested: z.object({ value: z.string() }) }),
      });
      const step2 = new Step({
        id: 'step2',
        action: step2Action,
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

      expect(step2Action).toHaveBeenCalledWith({
        data: {
          previousValue: 'step1-data',
        },
        runId: results.runId,
      });
    });
  });

  // describe('Error Handling', () => {
  //   it('should handle step execution errors', async () => {
  //     const error = new Error('Step execution failed');
  //     const failingAction = jest.fn<any>().mockRejectedValue(error);

  //     const step1 = new Step({ id: 'step1', action: failingAction });

  //     const workflow = new Workflow({
  //       name: 'test-workflow',
  //       steps: [step1],
  //     });

  //     await expect(workflow.execute()).resolves.toEqual({
  //       results: {
  //         step1: {
  //           error: 'Step execution failed',
  //           status: 'failed',
  //         },
  //       },
  //       runId: expect.any(String),
  //       triggerData: undefined,
  //     });
  //   });

  //   it('should handle variable resolution errors', async () => {
  //     const step1 = new Step({
  //       id: 'step1',
  //       action: jest.fn<any>().mockResolvedValue({ data: 'success' }),
  //       outputSchema: z.object({ data: z.string() }),
  //     });
  //     const step2 = new Step({ id: 'step2', action: jest.fn<any>() });

  //     const workflow = new Workflow({
  //       name: 'test-workflow',
  //       steps: [step1, step2],
  //     });

  //     workflow
  //       .config('step2', {
  //         dependsOn: ['step1'],
  //         variables: {
  //           // @ts-expect-error
  //           data: { stepId: 'step1', path: 'nonexistent.path' },
  //         },
  //       })
  //       .commit();

  //     await expect(workflow.execute()).resolves.toEqual({
  //       results: {
  //         step1: {
  //           status: 'success',
  //           payload: {
  //             data: 'success',
  //           },
  //         },
  //         step2: {
  //           payload: undefined,
  //           status: 'success',
  //         },
  //       },
  //       runId: expect.any(String),
  //       triggerData: undefined,
  //     });
  //   });
  // });

  // describe('Complex Conditions', () => {
  //   it('should handle nested AND/OR conditions', async () => {
  //     const step1Action = jest.fn<any>().mockResolvedValue({
  //       status: 'partial',
  //       score: 75,
  //       flags: { isValid: true },
  //     });
  //     const step2Action = jest.fn<any>().mockResolvedValue({ result: 'step2' });
  //     const step3Action = jest.fn<any>().mockResolvedValue({ result: 'step3' });

  //     const step1 = new Step({
  //       id: 'step1',
  //       action: step1Action,
  //       outputSchema: z.object({
  //         status: z.string(),
  //         score: z.number(),
  //         flags: z.object({ isValid: z.boolean() }),
  //       }),
  //     });
  //     const step2 = new Step({
  //       id: 'step2',
  //       action: step2Action,
  //       outputSchema: z.object({ result: z.string() }),
  //     });
  //     const step3 = new Step({ id: 'step3', action: step3Action });

  //     const workflow = new Workflow({
  //       name: 'test-workflow',
  //       steps: [step1, step2, step3],
  //     });

  //     workflow
  //       .config('step2', {
  //         dependsOn: ['step1'],
  //         condition: {
  //           and: [
  //             {
  //               or: [
  //                 {
  //                   ref: { stepId: 'step1', path: 'status' },
  //                   query: { $eq: 'success' },
  //                 },
  //                 {
  //                   and: [
  //                     {
  //                       ref: { stepId: 'step1', path: 'status' },
  //                       query: { $eq: 'partial' },
  //                     },
  //                     {
  //                       ref: { stepId: 'step1', path: 'score' },
  //                       query: { $gte: 70 },
  //                     },
  //                   ],
  //                 },
  //               ],
  //             },
  //             {
  //               ref: { stepId: 'step1', path: 'flags.isValid' },
  //               query: { $eq: true },
  //             },
  //           ],
  //         },
  //       })
  //       .config('step3', {
  //         dependsOn: ['step1'],
  //         condition: {
  //           or: [
  //             {
  //               ref: { stepId: 'step1', path: 'status' },
  //               query: { $eq: 'failed' },
  //             },
  //             {
  //               ref: { stepId: 'step1', path: 'score' },
  //               query: { $lt: 70 },
  //             },
  //           ],
  //         },
  //       })
  //       .commit();

  //     const result = await workflow.execute();

  //     expect(step2Action).toHaveBeenCalled();
  //     expect(step3Action).not.toHaveBeenCalled();
  //     // expect(result.results.step2).toEqual({ result: 'step2' });
  //   });
  // });

  // describe('Schema Validation', () => {
  //   it('should validate trigger data against schema', async () => {
  //     const triggerSchema = z.object({
  //       required: z.string(),
  //       nested: z.object({
  //         value: z.number(),
  //       }),
  //     });

  //     const step1 = new Step({
  //       id: 'step1',
  //       action: jest.fn<any>().mockResolvedValue({ result: 'success' }),
  //     });

  //     const workflow = new Workflow({
  //       name: 'test-workflow',
  //       triggerSchema,
  //       steps: [step1],
  //     });

  //     // Should fail validation
  //     await expect(
  //       workflow.execute({
  //         triggerData: {
  //           required: 'test',
  //           // @ts-expect-error
  //           nested: { value: 'not-a-number' },
  //         },
  //       }),
  //     ).rejects.toThrow();

  //     // Should pass validation
  //     await workflow.execute({
  //       triggerData: {
  //         required: 'test',
  //         nested: { value: 42 },
  //       },
  //     });
  //   });
  // });

  // describe('Complex Workflow Scenarios', () => {
  //   it('should handle a multi-step workflow with data transformations', async () => {
  //     const triggerSchema = z.object({
  //       items: z.array(
  //         z.object({
  //           id: z.number(),
  //           value: z.number(),
  //         }),
  //       ),
  //     });

  //     const filter = new Step({
  //       id: 'filter',
  //       action: async ({ data }: { data: any; runId: string }) => {
  //         return {
  //           filtered: data.items.filter((item: any) => item.value > 50),
  //         };
  //       },
  //       outputSchema: z.object({
  //         filtered: z.array(
  //           z.object({
  //             id: z.number(),
  //             value: z.number(),
  //           }),
  //         ),
  //       }),
  //     });
  //     const process = new Step({
  //       id: 'process',
  //       action: async ({ data }: { data: any; runId: string }) => {
  //         return {
  //           processed: data.items.map((item: any) => ({
  //             id: item.id,
  //             doubled: item.value * 2,
  //           })),
  //         };
  //       },
  //       outputSchema: z.object({
  //         processed: z.array(
  //           z.object({
  //             id: z.number(),
  //             doubled: z.number(),
  //           }),
  //         ),
  //       }),
  //     });
  //     const noResults = new Step({
  //       id: 'noResults',
  //       action: async () => ({ status: 'no-items-to-process' }),
  //       outputSchema: z.object({ status: z.string() }),
  //     });

  //     const workflow = new Workflow({
  //       name: 'test-workflow',
  //       triggerSchema,
  //       steps: [filter, process, noResults],
  //     });

  //     workflow
  //       .config('filter', {
  //         variables: {
  //           items: { stepId: 'trigger', path: '.' },
  //         },
  //         dependsOn: [],
  //       })
  //       .config('process', {
  //         dependsOn: ['filter'],
  //         condition: {
  //           ref: { stepId: 'filter', path: 'filtered' },
  //           query: { $where: (value: any) => value.length > 0 },
  //         },
  //         variables: {
  //           items: { stepId: 'filter', path: 'filtered' },
  //         },
  //       })
  //       .config('noResults', {
  //         dependsOn: ['filter'],
  //         condition: {
  //           ref: { stepId: 'filter', path: 'filtered' },
  //           query: { $where: (value: any) => value.length === 0 },
  //         },
  //       })
  //       .commit();

  //     const result = await workflow.execute({
  //       triggerData: {
  //         items: [
  //           { id: 1, value: 25 },
  //           { id: 2, value: 75 },
  //           { id: 3, value: 100 },
  //         ],
  //       },
  //     });

  //     expect((result.results.filter as any).payload.filtered).toHaveLength(2);
  //     expect((result.results.process as any).payload.processed).toEqual([
  //       { id: 2, doubled: 150 },
  //       { id: 3, doubled: 200 },
  //     ]);
  //   });
  // });

  // describe('New Workflow API', () => {
  //   it('should add a step to the graph', () => {
  //     const step1 = new Step({ id: 'step1', action: jest.fn<any>() });
  //     const step2 = new Step({ id: 'step2', action: jest.fn<any>() });
  //     const workflow = new Workflow({ name: 'test-workflow', steps: [step1, step2] });
  //     workflow.step(step1).step(step2).step(step1);
  //     expect(workflow.stepGraph).toEqual({
  //       step1: [],
  //       step2: [],
  //     });
  //   });

  //   it('should handle then', async () => {
  //     const step1 = new Step({ id: 'step1', action: jest.fn<any>() });
  //     const step2 = new Step({ id: 'step2', action: jest.fn<any>() });
  //     const workflow = new Workflow({ name: 'test-workflow', steps: [] });
  //     workflow.step(step1).then(step2).then(step2);
  //     expect(workflow.stepGraph).toEqual({
  //       step1: ['step2', 'step2'],
  //     });
  //   });

  //   it('should handle complex then and step combos', () => {
  //     const step1 = new Step({ id: 'step1', action: jest.fn<any>() });
  //     const step2 = new Step({ id: 'step2', action: jest.fn<any>() });
  //     const step3 = new Step({ id: 'step3', action: jest.fn<any>() });
  //     const step4 = new Step({ id: 'step4', action: jest.fn<any>() });
  //     const workflow = new Workflow({ name: 'test-workflow', steps: [] });

  //     workflow.step(step1).then(step2).then(step3).step(step2).then(step1).step(step4).then(step3).then(step4);
  //     expect(workflow.stepGraph).toEqual({
  //       step1: ['step2', 'step3'],
  //       step2: ['step1'],
  //       step4: ['step3', 'step4'],
  //     });
  //   });

  //   it('should execute a single step workflow', async () => {
  //     const step1 = new Step({ id: 'step1', action: jest.fn<any>() });
  //     const workflow = new Workflow({
  //       name: 'test-workflow',
  //       steps: [],
  //       logger: createLogger({ type: 'CONSOLE' }),
  //     });
  //     workflow.step(step1).commit();
  //     const result = await workflow.execute();
  //     expect(result.results['step1']).toEqual({ status: 'success', payload: undefined });
  //   });

  //   it('should execute a multi-step workflow', async () => {
  //     const act1 = jest.fn<any>().mockResolvedValue({ status: 'success' });
  //     const act2 = jest.fn<any>().mockResolvedValue({ status: 'success' });

  //     const step1 = new Step({ id: 'step1', action: act1 });
  //     const step2 = new Step({ id: 'step2', action: act2 });

  //     const workflow = new Workflow({ name: 'test-workflow', steps: [], logger: createLogger({ type: 'CONSOLE' }) });
  //     workflow.step(step1).then(step2).step(step2).then(step1).commit();

  //     const result = await workflow.execute();

  //     expect(result.results['step1']).toEqual({ status: 'success', payload: { status: 'success' } });
  //     expect(result.results['step2']).toEqual({ status: 'success', payload: { status: 'success' } });
  //     expect(act1).toHaveBeenCalledTimes(2);
  //     expect(act2).toHaveBeenCalledTimes(2);
  //   });

  //   it('should execute a multi-step workflow in order', async () => {
  //     const executionOrder: string[] = [];

  //     const step1Action = jest.fn<any>().mockImplementation(async () => {
  //       executionOrder.push('step1');
  //       return { value: 'step1' };
  //     });
  //     const step2Action = jest.fn<any>().mockImplementation(async () => {
  //       executionOrder.push('step2');
  //       return { value: 'step2' };
  //     });
  //     const step3Action = jest.fn<any>().mockImplementation(async () => {
  //       executionOrder.push('step3');
  //       return { value: 'step3' };
  //     });

  //     const step1 = new Step({ id: 'step1', action: step1Action });
  //     const step2 = new Step({ id: 'step2', action: step2Action });
  //     const step3 = new Step({ id: 'step3', action: step3Action });

  //     const workflow = new Workflow({
  //       name: 'test-workflow',
  //       steps: [],
  //     });

  //     workflow.step(step1).then(step3).then(step2).commit();

  //     const result = await workflow.execute();

  //     expect(result.results['step1']).toEqual({ status: 'success', payload: { value: 'step1' } });
  //     expect(result.results['step2']).toEqual({ status: 'success', payload: { value: 'step2' } });
  //     expect(result.results['step3']).toEqual({ status: 'success', payload: { value: 'step3' } });
  //     expect(executionOrder).toEqual(['step1', 'step3', 'step2']);
  //   });
  // });
});
