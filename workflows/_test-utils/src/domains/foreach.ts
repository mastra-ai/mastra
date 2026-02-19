/**
 * foreach tests for workflows
 *
 * Uses MockRegistry pattern to decouple mocks from workflow definitions,
 * enabling proper test isolation via resetMocks().
 */

import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import type { WorkflowTestContext, WorkflowRegistry, WorkflowCreatorContext } from '../types';
import { MockRegistry } from '../mock-registry';

/**
 * Create all workflows needed for foreach tests.
 */
export function createForeachWorkflows(ctx: WorkflowCreatorContext) {
  const { createWorkflow, createStep } = ctx;
  const workflows: WorkflowRegistry = {};

  // Create a mock registry for this domain
  const mockRegistry = new MockRegistry();

  // Test: should run a single item concurrency (default) for loop
  {
    // Register mock factory
    mockRegistry.register('foreach-single-concurrency:map', () =>
      vi.fn().mockImplementation(async ({ inputData }) => {
        await new Promise(resolve => setTimeout(resolve, 1e3));
        return { value: inputData.value + 11 };
      }),
    );

    const mapStep = createStep({
      id: 'map',
      description: 'Maps (+11) on the current value',
      inputSchema: z.object({
        value: z.number(),
      }),
      outputSchema: z.object({
        value: z.number(),
      }),
      execute: async ctx => mockRegistry.get('foreach-single-concurrency:map')(ctx),
    });

    const finalStep = createStep({
      id: 'final',
      description: 'Final step that prints the result',
      inputSchema: z.array(z.object({ value: z.number() })),
      outputSchema: z.object({
        finalValue: z.number(),
      }),
      execute: async ({ inputData }) => {
        return { finalValue: inputData.reduce((acc, curr) => acc + curr.value, 0) };
      },
    });

    const counterWorkflow = createWorkflow({
      steps: [mapStep, finalStep],
      id: 'foreach-single-concurrency',
      inputSchema: z.array(z.object({ value: z.number() })),
      outputSchema: z.object({
        finalValue: z.number(),
      }),
      options: {
        validateInputs: false,
      },
    });

    counterWorkflow.foreach(mapStep).then(finalStep).commit();

    workflows['foreach-single-concurrency'] = {
      workflow: counterWorkflow,
      mocks: {
        get map() {
          return mockRegistry.get('foreach-single-concurrency:map');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should run a concurrent for loop
  {
    // Register mock factory
    mockRegistry.register('foreach-concurrent:map', () =>
      vi.fn().mockImplementation(async ({ inputData }) => {
        await new Promise(resolve => setTimeout(resolve, 1e3));
        return { value: inputData.value + 11 };
      }),
    );

    const mapStep = createStep({
      id: 'map',
      description: 'Maps (+11) on the current value',
      inputSchema: z.object({
        value: z.number(),
      }),
      outputSchema: z.object({
        value: z.number(),
      }),
      execute: async ctx => mockRegistry.get('foreach-concurrent:map')(ctx),
    });

    const finalStep = createStep({
      id: 'final',
      description: 'Final step that prints the result',
      inputSchema: z.array(z.object({ value: z.number() })),
      outputSchema: z.object({
        finalValue: z.number(),
      }),
      execute: async ({ inputData }) => {
        return { finalValue: inputData.reduce((acc, curr) => acc + curr.value, 0) };
      },
    });

    const counterWorkflow = createWorkflow({
      steps: [mapStep, finalStep],
      id: 'foreach-concurrent',
      inputSchema: z.array(z.object({ value: z.number() })),
      outputSchema: z.object({
        finalValue: z.number(),
      }),
      options: {
        validateInputs: false,
      },
    });

    counterWorkflow.foreach(mapStep, { concurrency: 3 }).then(finalStep).commit();

    workflows['foreach-concurrent'] = {
      workflow: counterWorkflow,
      mocks: {
        get map() {
          return mockRegistry.get('foreach-concurrent:map');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should run a partial concurrency for loop
  {
    // Register mock factory
    mockRegistry.register('foreach-partial-concurrency:map', () =>
      vi.fn().mockImplementation(async ({ inputData }) => {
        await new Promise(resolve => setTimeout(resolve, 500));
        return { value: inputData.value + 11 };
      }),
    );

    const mapStep = createStep({
      id: 'map',
      description: 'Maps (+11) on the current value',
      inputSchema: z.object({
        value: z.number(),
      }),
      outputSchema: z.object({
        value: z.number(),
      }),
      execute: async ctx => mockRegistry.get('foreach-partial-concurrency:map')(ctx),
    });

    const finalStep = createStep({
      id: 'final',
      description: 'Final step that prints the result',
      inputSchema: z.array(z.object({ value: z.number() })),
      outputSchema: z.object({
        finalValue: z.number(),
      }),
      execute: async ({ inputData }) => {
        return { finalValue: inputData.reduce((acc, curr) => acc + curr.value, 0) };
      },
    });

    const counterWorkflow = createWorkflow({
      steps: [mapStep, finalStep],
      id: 'foreach-partial-concurrency',
      inputSchema: z.array(z.object({ value: z.number() })),
      outputSchema: z.object({
        finalValue: z.number(),
      }),
      options: {
        validateInputs: false,
      },
    });

    counterWorkflow.foreach(mapStep, { concurrency: 2 }).then(finalStep).commit();

    workflows['foreach-partial-concurrency'] = {
      workflow: counterWorkflow,
      mocks: {
        get map() {
          return mockRegistry.get('foreach-partial-concurrency:map');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should handle empty array in foreach
  {
    // Register mock factory
    mockRegistry.register('foreach-empty-array:map', () => vi.fn().mockResolvedValue({ value: 100 }));

    const mapStep = createStep({
      id: 'map',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
      execute: async ctx => mockRegistry.get('foreach-empty-array:map')(ctx),
    });

    const finalStep = createStep({
      id: 'final',
      inputSchema: z.array(z.object({ value: z.number() })),
      outputSchema: z.object({ count: z.number() }),
      execute: async ({ inputData }) => {
        return { count: inputData.length };
      },
    });

    const workflow = createWorkflow({
      steps: [mapStep, finalStep],
      id: 'foreach-empty-array',
      inputSchema: z.array(z.object({ value: z.number() })),
      outputSchema: z.object({ count: z.number() }),
      options: {
        validateInputs: false,
      },
    });

    workflow.foreach(mapStep).then(finalStep).commit();

    workflows['foreach-empty-array'] = {
      workflow,
      mocks: {
        get map() {
          return mockRegistry.get('foreach-empty-array:map');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should chain steps before foreach and aggregate results after
  {
    // Register mock factory
    mockRegistry.register('foreach-chained:transform', () =>
      vi.fn().mockImplementation(async ({ inputData }) => {
        return { doubled: inputData.value * 2 };
      }),
    );

    // Step 1: Generate items to iterate over - outputs an array
    const generateStep = createStep({
      id: 'generate',
      inputSchema: z.object({ count: z.number() }),
      outputSchema: z.array(z.object({ value: z.number() })),
      execute: async ({ inputData }) => {
        return Array.from({ length: inputData.count }, (_, i) => ({ value: i + 1 }));
      },
    });

    // Step 2: Transform each item (used in foreach)
    const transformStep = createStep({
      id: 'transform',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ doubled: z.number() }),
      execute: async ctx => mockRegistry.get('foreach-chained:transform')(ctx),
    });

    // Step 3: Sum all results
    const sumStep = createStep({
      id: 'sum',
      inputSchema: z.array(z.object({ doubled: z.number() })),
      outputSchema: z.object({ total: z.number() }),
      execute: async ({ inputData }) => {
        const total = inputData.reduce((acc: number, curr: { doubled: number }) => acc + curr.doubled, 0);
        return { total };
      },
    });

    const workflow = createWorkflow({
      steps: [generateStep, transformStep, sumStep],
      id: 'foreach-chained',
      inputSchema: z.object({ count: z.number() }),
      outputSchema: z.object({ total: z.number() }),
    });

    workflow.then(generateStep).foreach(transformStep).then(sumStep).commit();

    workflows['foreach-chained'] = {
      workflow,
      mocks: {
        get transform() {
          return mockRegistry.get('foreach-chained:transform');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should aggregate results correctly from foreach with different data types
  {
    // Register mock factory
    mockRegistry.register('foreach-aggregate:process', () =>
      vi.fn().mockImplementation(async ({ inputData }) => {
        return {
          name: inputData.name.toUpperCase(),
          score: inputData.score * 10,
        };
      }),
    );

    const processStep = createStep({
      id: 'process',
      inputSchema: z.object({ name: z.string(), score: z.number() }),
      outputSchema: z.object({ name: z.string(), score: z.number() }),
      execute: async ctx => mockRegistry.get('foreach-aggregate:process')(ctx),
    });

    const aggregateStep = createStep({
      id: 'aggregate',
      inputSchema: z.array(z.object({ name: z.string(), score: z.number() })),
      outputSchema: z.object({
        names: z.array(z.string()),
        totalScore: z.number(),
        count: z.number(),
      }),
      execute: async ({ inputData }) => {
        return {
          names: inputData.map(item => item.name),
          totalScore: inputData.reduce((acc, curr) => acc + curr.score, 0),
          count: inputData.length,
        };
      },
    });

    const workflow = createWorkflow({
      steps: [processStep, aggregateStep],
      id: 'foreach-aggregate',
      inputSchema: z.array(z.object({ name: z.string(), score: z.number() })),
      outputSchema: z.object({
        names: z.array(z.string()),
        totalScore: z.number(),
        count: z.number(),
      }),
      options: {
        validateInputs: false,
      },
    });

    workflow.foreach(processStep).then(aggregateStep).commit();

    workflows['foreach-aggregate'] = {
      workflow,
      mocks: {
        get process() {
          return mockRegistry.get('foreach-aggregate:process');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should update state after each concurrent batch in foreach step
  {
    const subWorkflow1 = createWorkflow({
      id: 'foreach-state-s1',
      inputSchema: z.number(),
      outputSchema: z.number(),
      stateSchema: z.object({ output: z.number() }),
    })
      .then(
        createStep({
          id: 's1s',
          inputSchema: z.number(),
          outputSchema: z.number(),
          stateSchema: z.object({ output: z.number() }),
          execute: async (ctx: any) => {
            expect(ctx.state.output).toBe(2);
            return ctx.inputData;
          },
        }),
      )
      .commit();

    const subWorkflow2 = createWorkflow({
      id: 'foreach-state-s2',
      inputSchema: z.number(),
      outputSchema: z.number(),
      stateSchema: z.object({ output: z.number() }),
    })
      .then(
        createStep({
          id: 's2s',
          inputSchema: z.number(),
          outputSchema: z.number(),
          stateSchema: z.object({ output: z.number() }),
          execute: async (ctx: any) => {
            ctx.setState({ ...ctx.state, output: 2 });
            return ctx.inputData;
          },
        }),
      )
      .commit();

    const routing = createWorkflow({
      id: 'foreach-state-routing',
      inputSchema: z.number(),
      outputSchema: z.number(),
      stateSchema: z.object({ output: z.number() }),
    })
      .branch([
        [async (s: any) => s.inputData === 1, subWorkflow1],
        [async (s: any) => s.inputData === 2, subWorkflow2],
      ])
      .map(async ({ inputData }: any) => {
        return ((inputData as any)['foreach-state-s1'] ?? 0) + ((inputData as any)['foreach-state-s2'] ?? 0);
      })
      .commit();

    const stateBatchWorkflow = createWorkflow({
      id: 'foreach-state-batch',
      inputSchema: z.array(z.number()),
      outputSchema: z.array(z.number()),
      stateSchema: z.object({ output: z.number() }),
    })
      .foreach(routing)
      .commit();

    workflows['foreach-state-batch'] = {
      workflow: stateBatchWorkflow,
      mocks: {},
      resetMocks: () => {},
    };
  }

  // Test: should bail foreach execution when called in a concurrent batch
  {
    const bailResult = [15];

    const bailWorkflow = createWorkflow({
      id: 'foreach-bail',
      inputSchema: z.array(z.number()),
      outputSchema: z.array(z.number()),
      stateSchema: z.object({ output: z.number() }),
    })
      .foreach(
        createStep({
          id: 'bail-step',
          inputSchema: z.number(),
          outputSchema: z.number(),
          stateSchema: z.object({ output: z.number() }),
          execute: async (ctx: any) => {
            if (ctx.state.output > 1) {
              return ctx.bail(bailResult);
            }
            await ctx.setState({ ...ctx.state, output: ctx.inputData });
            return ctx.inputData;
          },
        }),
      )
      .commit();

    workflows['foreach-bail'] = {
      workflow: bailWorkflow,
      mocks: {},
      bailResult,
      resetMocks: () => {},
    };
  }

  // Test: should emit per-iteration progress events during foreach streaming
  {
    mockRegistry.register('foreach-progress:map', () =>
      vi.fn().mockImplementation(async ({ inputData }) => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return { value: inputData.value + 11 };
      }),
    );

    const mapStep = createStep({
      id: 'map',
      description: 'Maps (+11) on the current value',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
      execute: async ctx => mockRegistry.get('foreach-progress:map')(ctx),
    });

    const finalStep = createStep({
      id: 'final',
      description: 'Final step',
      inputSchema: z.array(z.object({ value: z.number() })),
      outputSchema: z.object({ finalValue: z.number() }),
      execute: async ({ inputData }) => {
        return { finalValue: inputData.reduce((acc: number, curr: { value: number }) => acc + curr.value, 0) };
      },
    });

    const workflow = createWorkflow({
      steps: [mapStep, finalStep],
      id: 'foreach-progress',
      inputSchema: z.array(z.object({ value: z.number() })),
      outputSchema: z.object({ finalValue: z.number() }),
      options: { validateInputs: false },
    });

    workflow.foreach(mapStep).then(finalStep).commit();

    workflows['foreach-progress'] = {
      workflow,
      mocks: {
        get map() {
          return mockRegistry.get('foreach-progress:map');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should emit per-iteration progress events with concurrency during foreach streaming
  {
    mockRegistry.register('foreach-progress-concurrent:map', () =>
      vi.fn().mockImplementation(async ({ inputData }) => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return { value: inputData.value + 11 };
      }),
    );

    const mapStep = createStep({
      id: 'map',
      description: 'Maps (+11) on the current value',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
      execute: async ctx => mockRegistry.get('foreach-progress-concurrent:map')(ctx),
    });

    const finalStep = createStep({
      id: 'final',
      description: 'Final step',
      inputSchema: z.array(z.object({ value: z.number() })),
      outputSchema: z.object({ finalValue: z.number() }),
      execute: async ({ inputData }) => {
        return { finalValue: inputData.reduce((acc: number, curr: { value: number }) => acc + curr.value, 0) };
      },
    });

    const workflow = createWorkflow({
      steps: [mapStep, finalStep],
      id: 'foreach-progress-concurrent',
      inputSchema: z.array(z.object({ value: z.number() })),
      outputSchema: z.object({ finalValue: z.number() }),
      options: { validateInputs: false },
    });

    workflow.foreach(mapStep, { concurrency: 2 }).then(finalStep).commit();

    workflows['foreach-progress-concurrent'] = {
      workflow,
      mocks: {
        get map() {
          return mockRegistry.get('foreach-progress-concurrent:map');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should emit progress event with failed iterationStatus when a foreach iteration fails
  {
    mockRegistry.register('foreach-progress-fail:map', () =>
      vi.fn().mockImplementation(async ({ inputData }) => {
        if (inputData.value === 22) {
          throw new Error('Iteration failed for value 22');
        }
        return { value: inputData.value + 11 };
      }),
    );

    const mapStep = createStep({
      id: 'map',
      description: 'Maps (+11) on the current value',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
      execute: async ctx => mockRegistry.get('foreach-progress-fail:map')(ctx),
    });

    const finalStep = createStep({
      id: 'final',
      description: 'Final step',
      inputSchema: z.array(z.object({ value: z.number() })),
      outputSchema: z.object({ finalValue: z.number() }),
      execute: async ({ inputData }) => {
        return { finalValue: inputData.reduce((acc: number, curr: { value: number }) => acc + curr.value, 0) };
      },
    });

    const workflow = createWorkflow({
      steps: [mapStep, finalStep],
      id: 'foreach-progress-fail',
      inputSchema: z.array(z.object({ value: z.number() })),
      outputSchema: z.object({ finalValue: z.number() }),
      options: { validateInputs: false },
    });

    workflow.foreach(mapStep).then(finalStep).commit();

    workflows['foreach-progress-fail'] = {
      workflow,
      mocks: {
        get map() {
          return mockRegistry.get('foreach-progress-fail:map');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  return workflows;
}

/**
 * Create tests for foreach.
 */
export function createForeachTests(ctx: WorkflowTestContext, registry?: WorkflowRegistry) {
  const { execute, skipTests } = ctx;

  describe('foreach', () => {
    // Note: Single concurrency test is skipped for Inngest due to snapshot race condition
    // (steps show "running" instead of "success" when result is returned)
    it.skipIf(skipTests.foreachSingleConcurrency)(
      'should run a single item concurrency (default) for loop',
      async () => {
        const startTime = Date.now();
        const { workflow } = registry!['foreach-single-concurrency']!;
        const result = await execute(workflow, [{ value: 1 }, { value: 22 }, { value: 333 }]);

        const endTime = Date.now();
        const duration = endTime - startTime;
        // Sequential execution: 3 items × 1s each = ~3s minimum
        expect(duration).toBeGreaterThan(3e3 - 200);

        // Verify output (not mock counts - unreliable with memoization)
        expect(result.steps).toMatchObject({
          input: [{ value: 1 }, { value: 22 }, { value: 333 }],
          map: {
            status: 'success',
            output: [{ value: 12 }, { value: 33 }, { value: 344 }],
            payload: [{ value: 1 }, { value: 22 }, { value: 333 }],
            startedAt: expect.any(Number),
            endedAt: expect.any(Number),
          },
          final: {
            status: 'success',
            output: { finalValue: 1 + 11 + (22 + 11) + (333 + 11) },
            payload: [{ value: 12 }, { value: 33 }, { value: 344 }],
            startedAt: expect.any(Number),
            endedAt: expect.any(Number),
          },
        });
      },
    );

    // Note: Timing test skipped for Inngest - network overhead makes timing assertions unreliable
    it.skipIf(skipTests.foreachConcurrentTiming)('should run a concurrent for loop', async () => {
      const startTime = Date.now();
      const { workflow } = registry!['foreach-concurrent']!;
      const result = await execute(workflow, [{ value: 1 }, { value: 22 }, { value: 333 }]);

      const endTime = Date.now();
      const duration = endTime - startTime;
      // Concurrent execution: 3 items with concurrency=3, ~1s total
      expect(duration).toBeLessThan(2e3);

      // Verify output (not mock counts - unreliable with memoization)
      expect(result.steps).toMatchObject({
        map: {
          status: 'success',
          output: [{ value: 12 }, { value: 33 }, { value: 344 }],
        },
        final: {
          status: 'success',
          output: { finalValue: 1 + 11 + (22 + 11) + (333 + 11) },
        },
      });
    });

    // Note: Timing test skipped for Inngest - network overhead makes timing assertions unreliable
    it.skipIf(skipTests.foreachPartialConcurrencyTiming)('should run a partial concurrency for loop', async () => {
      const startTime = Date.now();
      const { workflow } = registry!['foreach-partial-concurrency']!;
      const result = await execute(workflow, [{ value: 1 }, { value: 2 }, { value: 3 }, { value: 4 }]);

      const endTime = Date.now();
      const duration = endTime - startTime;
      // Partial concurrency: 4 items with concurrency=2, ~1s (2 batches × 500ms)
      expect(duration).toBeGreaterThan(900);
      expect(duration).toBeLessThan(1500);

      // Verify output (not mock counts - unreliable with memoization)
      expect(result.steps).toMatchObject({
        map: {
          status: 'success',
          output: [{ value: 12 }, { value: 13 }, { value: 14 }, { value: 15 }],
        },
        final: {
          status: 'success',
          output: { finalValue: 12 + 13 + 14 + 15 },
        },
      });
    });

    it.skipIf(skipTests.emptyForeach)('should handle empty array in foreach', async () => {
      const { workflow } = registry!['foreach-empty-array']!;
      const result = await execute(workflow, []);

      // Empty array should pass through without calling map step
      expect(result.steps).toMatchObject({
        map: {
          status: 'success',
          output: [],
        },
        final: {
          status: 'success',
          output: { count: 0 },
        },
      });
    });

    it('should chain steps before foreach and aggregate results after', async () => {
      const { workflow } = registry!['foreach-chained']!;
      const result = await execute(workflow, { count: 3 });

      // generate produces [{ value: 1 }, { value: 2 }, { value: 3 }]
      // transform doubles each: [{ doubled: 2 }, { doubled: 4 }, { doubled: 6 }]
      // sum adds: 2 + 4 + 6 = 12
      expect(result.status).toBe('success');
      expect(result.steps).toMatchObject({
        generate: {
          status: 'success',
          output: [{ value: 1 }, { value: 2 }, { value: 3 }],
        },
        transform: {
          status: 'success',
          output: [{ doubled: 2 }, { doubled: 4 }, { doubled: 6 }],
        },
        sum: {
          status: 'success',
          output: { total: 12 },
        },
      });
    });

    it.skipIf(skipTests.foreachStateBatch)(
      'should update state after each concurrent batch in foreach step',
      async () => {
        const { workflow } = registry!['foreach-state-batch']!;
        const result = await execute(workflow, [2, 1], {
          initialState: { output: 0 },
          outputOptions: { includeState: true },
        });

        expect(result.status).toBe('success');
        expect(result.state).toEqual({ output: 2 });
      },
    );

    it.skipIf(skipTests.foreachBail)('should bail foreach execution when called in a concurrent batch', async () => {
      const { workflow, bailResult } = registry!['foreach-bail']!;
      const result = await execute(workflow, [1, 2, 3, 4], {
        initialState: { output: 0 },
        outputOptions: { includeState: true },
      });

      expect(result.status).toBe('success');
      expect((result as any).state?.output).toBe(2);
      if (result.status === 'success') {
        expect(result.result).toEqual(bailResult);
      }
    });

    it('should aggregate results correctly from foreach iterations', async () => {
      const { workflow } = registry!['foreach-aggregate']!;
      const result = await execute(workflow, [
        { name: 'alice', score: 5 },
        { name: 'bob', score: 3 },
        { name: 'charlie', score: 7 },
      ]);

      expect(result.status).toBe('success');
      expect(result.steps).toMatchObject({
        process: {
          status: 'success',
          output: [
            { name: 'ALICE', score: 50 },
            { name: 'BOB', score: 30 },
            { name: 'CHARLIE', score: 70 },
          ],
        },
        aggregate: {
          status: 'success',
          output: {
            names: ['ALICE', 'BOB', 'CHARLIE'],
            totalScore: 150,
            count: 3,
          },
        },
      });
    });

    it.skipIf(skipTests.foreachProgressStreaming)(
      'should emit per-iteration progress events during foreach streaming',
      async () => {
        const { workflow } = registry!['foreach-progress']!;
        const { stream } = ctx;

        if (!stream) {
          return;
        }

        const { events, result } = await stream(workflow, [{ value: 1 }, { value: 22 }, { value: 333 }]);

        // Filter for progress events on the foreach step
        const progressEvents = events.filter(
          (event: any) => event.type === 'workflow-step-progress' && event.payload?.id === 'map',
        );

        // Should have 3 progress events (one per iteration)
        expect(progressEvents.length).toBe(3);

        // Each progress event should include iteration tracking info
        expect(progressEvents[0]).toMatchObject({
          type: 'workflow-step-progress',
          payload: {
            id: 'map',
            completedCount: 1,
            totalCount: 3,
            currentIndex: 0,
            iterationStatus: 'success',
          },
        });

        expect(progressEvents[1]).toMatchObject({
          type: 'workflow-step-progress',
          payload: {
            id: 'map',
            completedCount: 2,
            totalCount: 3,
            currentIndex: 1,
            iterationStatus: 'success',
          },
        });

        expect(progressEvents[2]).toMatchObject({
          type: 'workflow-step-progress',
          payload: {
            id: 'map',
            completedCount: 3,
            totalCount: 3,
            currentIndex: 2,
            iterationStatus: 'success',
          },
        });

        // Final result should still be correct
        expect(result.steps?.map).toMatchObject({
          status: 'success',
          output: [{ value: 12 }, { value: 33 }, { value: 344 }],
        });
      },
    );

    it.skipIf(skipTests.foreachProgressConcurrentStreaming)(
      'should emit per-iteration progress events with concurrency during foreach streaming',
      async () => {
        const { workflow } = registry!['foreach-progress-concurrent']!;
        const { stream } = ctx;

        if (!stream) {
          return;
        }

        const { events } = await stream(workflow, [{ value: 1 }, { value: 22 }, { value: 333 }]);

        const progressEvents = events.filter(
          (event: any) => event.type === 'workflow-step-progress' && event.payload?.id === 'map',
        );

        // Should have 3 progress events even with concurrency
        expect(progressEvents.length).toBe(3);

        // All progress events should have totalCount: 3
        for (const event of progressEvents) {
          expect((event as any).payload.totalCount).toBe(3);
          expect((event as any).payload.iterationStatus).toBe('success');
        }

        // The last progress event should show all completed
        const lastProgress = progressEvents[progressEvents.length - 1] as any;
        expect(lastProgress.payload.completedCount).toBe(3);
      },
    );

    it.skipIf(skipTests.foreachProgressFailStreaming)(
      'should emit progress event with failed iterationStatus when a foreach iteration fails',
      async () => {
        const { workflow } = registry!['foreach-progress-fail']!;
        const { stream } = ctx;

        if (!stream) {
          return;
        }

        const { events } = await stream(workflow, [{ value: 1 }, { value: 22 }, { value: 333 }]);

        const progressEvents = events.filter(
          (event: any) => event.type === 'workflow-step-progress' && event.payload?.id === 'map',
        );

        // First iteration succeeds, second fails — foreach should stop at failure
        expect(progressEvents.length).toBeGreaterThanOrEqual(1);

        // The first progress event should show success for index 0
        expect(progressEvents[0]).toMatchObject({
          type: 'workflow-step-progress',
          payload: {
            id: 'map',
            completedCount: 1,
            totalCount: 3,
            currentIndex: 0,
            iterationStatus: 'success',
          },
        });

        // There should be a progress event showing the failure
        const failedProgress = progressEvents.find((e: any) => e.payload.iterationStatus === 'failed');
        expect(failedProgress).toBeDefined();
        expect(failedProgress).toMatchObject({
          type: 'workflow-step-progress',
          payload: {
            id: 'map',
            currentIndex: 1,
            iterationStatus: 'failed',
          },
        });
      },
    );
  });
}
