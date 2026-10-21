/**
 * foreach tests for workflows
 *
 * Uses MockRegistry pattern to decouple mocks from workflow definitions,
 * enabling proper test isolation via resetMocks().
 */

import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { MockRegistry } from '../mock-registry';
import type { WorkflowTestContext, WorkflowRegistry, WorkflowCreatorContext } from '../types';

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
    // Track peak concurrent executions to verify the concurrency limit directly,
    // instead of inferring it from wall-clock duration (which is flaky under load).
    const concurrencyTracker = {
      activeCount: 0,
      peakActive: 0,
    };

    // Register mock factory
    mockRegistry.register('foreach-partial-concurrency:map', () =>
      vi.fn().mockImplementation(async ({ inputData }) => {
        concurrencyTracker.activeCount++;
        concurrencyTracker.peakActive = Math.max(concurrencyTracker.peakActive, concurrencyTracker.activeCount);
        // Hold long enough for additional items to enter if the engine permits.
        await new Promise(resolve => setTimeout(resolve, 100));
        concurrencyTracker.activeCount--;
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
      concurrencyTracker,
      resetMocks: () => {
        mockRegistry.reset();
        concurrencyTracker.activeCount = 0;
        concurrencyTracker.peakActive = 0;
      },
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

  {
    const item = createStep({
      id: 'item',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
      execute: async ({ inputData }) => ({ value: inputData.value * 2 + 1 }),
    });
    const child = createWorkflow({
      id: 'foreach-occurrence-child',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
    })
      .then(item)
      .commit();
    const workflow = createWorkflow({
      id: 'foreach-occurrence-parent',
      inputSchema: z.array(z.object({ value: z.number() })),
      outputSchema: z.array(z.object({ value: z.number() })),
    })
      .foreach(child, { concurrency: 3 })
      .commit();
    workflows['foreach-occurrence-parent'] = { workflow };
  }

  // Tests: a failing foreach iteration fails the run (#26390). Each workflow runs two items
  // concurrently. Item 2 waits until the run reports item 1's failed iteration, so item 1 is
  // always the first failure regardless of engine scheduling.
  for (const id of ['foreach-iteration-fails', 'foreach-two-iterations-fail', 'foreach-time-travel-refail']) {
    const gate = createIterationGate();
    let item2Attempts = 0;
    const item = z.object({ n: z.number() });

    const boom = createStep({
      id: 'boom',
      inputSchema: item,
      outputSchema: item,
      retries: 0,
      execute: async ({ inputData }) => {
        if (inputData.n === 1) {
          throw new Error(id === 'foreach-time-travel-refail' ? 'always fails' : 'first failure');
        }
        if (id === 'foreach-iteration-fails') return inputData;
        const attempt = ++item2Attempts;
        await gate.firstFailureReported;
        // On a time-travel replay item 2 succeeds, after item 1 has failed again.
        if (id === 'foreach-time-travel-refail' && attempt > 1) return inputData;
        throw new Error('second failure');
      },
    });

    const workflow = createWorkflow({
      steps: [boom],
      id,
      inputSchema: z.array(item),
      outputSchema: z.array(item),
      options: { validateInputs: false },
    });
    workflow.foreach(boom, { concurrency: 2 }).commit();

    workflows[id] = {
      workflow,
      mocks: { gate },
      resetMocks: () => {
        gate.reset();
        item2Attempts = 0;
      },
    };
  }

  return workflows;
}

function createIterationGate() {
  let release!: () => void;
  const gate = {
    firstFailureReported: Promise.resolve(),
    release: () => release(),
    reset: () => {
      gate.firstFailureReported = new Promise<void>(resolve => (release = resolve));
    },
  };
  gate.reset();
  return gate;
}

/**
 * Create tests for foreach.
 */
export function createForeachTests(ctx: WorkflowTestContext, registry?: WorkflowRegistry) {
  const { execute, skipTests } = ctx;

  describe('foreach', () => {
    it('keeps nested workflow outputs distinct for each concurrent foreach item', async () => {
      const { workflow } = registry!['foreach-occurrence-parent']!;
      const result = await execute(workflow, [{ value: 1 }, { value: 10 }, { value: 100 }]);

      expect(result.status).toBe('success');
      expect(result.result).toEqual([{ value: 3 }, { value: 21 }, { value: 201 }]);
    });

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
            startedAt: expect.any(Number),
            endedAt: expect.any(Number),
          },
          final: {
            status: 'success',
            output: { finalValue: 1 + 11 + (22 + 11) + (333 + 11) },
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

    it.skipIf(skipTests.foreachPartialConcurrencyTiming)('should run a partial concurrency for loop', async () => {
      const { workflow, concurrencyTracker } = registry!['foreach-partial-concurrency']!;
      const result = await execute(workflow, [{ value: 1 }, { value: 2 }, { value: 3 }, { value: 4 }]);

      // 4 items with concurrency=2: peak concurrent executions must be exactly 2.
      // peak < 2 => engine ran sequentially; peak > 2 => engine exceeded the limit.
      expect(concurrencyTracker.peakActive).toBe(2);

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

    // #26390: the evented engine left the run hanging when a foreach iteration failed, and
    // iterations failing after that could fail the run again or replace the first error.
    describe('when a foreach iteration fails (#26390)', () => {
      async function startRun(id: string) {
        const entry = registry![id]!;
        entry.resetMocks?.();
        const { workflow } = entry;
        const run = await workflow.createRun();
        const failedIterations: number[] = [];
        let resolveItem2Failed!: () => void;
        const item2Failed = new Promise<void>(resolve => (resolveItem2Failed = resolve));
        let resolveItem2Succeeded!: () => void;
        const item2Succeeded = new Promise<void>(resolve => (resolveItem2Succeeded = resolve));
        const unwatch = run.watch((event: any) => {
          if (event.type !== 'workflow-step-progress') return;
          const { currentIndex, iterationStatus } = event.payload ?? {};
          if (iterationStatus === 'success' && currentIndex === 1) resolveItem2Succeeded();
          if (iterationStatus !== 'failed') return;
          failedIterations.push(currentIndex);
          if (currentIndex === 0) entry.mocks.gate.release();
          if (currentIndex === 1) resolveItem2Failed();
        });
        return { workflow, run, failedIterations, item2Failed, item2Succeeded, unwatch };
      }

      // Bounds a wait that hangs when the bug is present, so the failure names the symptom.
      async function within<T>(promise: Promise<T>, symptom: string): Promise<T> {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          return await Promise.race([
            promise,
            new Promise<never>((_, reject) => {
              timer = setTimeout(() => reject(new Error(`${symptom} (#26390)`)), 10_000);
            }),
          ]);
        } finally {
          clearTimeout(timer);
        }
      }

      it('fails the run with the error of the failing iteration', async () => {
        const { run, unwatch } = await startRun('foreach-iteration-fails');
        try {
          const result: any = await within(
            run.start({ inputData: [{ n: 1 }, { n: 2 }] }),
            'the run never finished after a foreach iteration failed',
          );
          expect(result.status, 'run status after a foreach iteration failed').toBe('failed');
          expect(result.error?.message).toBe('first failure');
          expect(result.steps.boom.status).toBe('failed');
        } finally {
          unwatch();
        }
      });

      it('keeps the first failure when another iteration fails after it', async () => {
        const { workflow, run, failedIterations, item2Failed, unwatch } = await startRun('foreach-two-iterations-fail');
        try {
          const result: any = await within(
            run.start({ inputData: [{ n: 1 }, { n: 2 }] }),
            'the run never finished after a foreach iteration failed',
          );
          expect(result.status).toBe('failed');
          expect(result.error?.message, 'run error when two iterations fail').toBe('first failure');

          // Item 2's failure is recorded before its progress event goes out on every engine.
          await within(item2Failed, 'the second failing iteration was never reported');
          const stored: any = await workflow.getWorkflowRunById(run.runId);
          expect(stored?.status, 'stored run status after the second iteration failed').toBe('failed');
          expect(stored?.error?.message, 'a later failing iteration failed the run again with its own error').toBe(
            'first failure',
          );
          expect(stored?.steps?.boom?.status, 'stored foreach status after the second iteration failed').toBe('failed');
          expect(
            stored?.steps?.boom?.error?.message,
            'a later failing iteration replaced the first failure on the stored foreach',
          ).toBe('first failure');
          expect(failedIterations, 'failed iterations reported, in order, each once').toEqual([0, 1]);
        } finally {
          unwatch();
        }
      });

      it.skipIf(!ctx.timeTravel)(
        'fails a time-travel replay when a previously failed iteration fails again',
        async () => {
          const { workflow, run, item2Failed, item2Succeeded, failedIterations, unwatch } =
            await startRun('foreach-time-travel-refail');
          const { gate } = registry!['foreach-time-travel-refail']!.mocks;
          try {
            const first: any = await within(
              run.start({ inputData: [{ n: 1 }, { n: 2 }] }),
              'the run never finished after a foreach iteration failed',
            );
            expect(first.status).toBe('failed');
            await within(item2Failed, 'the second failing iteration was never reported');

            gate.reset();
            const replay: any = await within(
              run.timeTravel({ step: 'boom' }),
              'the time-travel replay never finished after the previously failed iteration failed again',
            );
            expect(replay.status, 'time-travel replay status').toBe('failed');
            expect(replay.error?.message).toBe('always fails');
            expect(replay.steps.boom.status).toBe('failed');

            await within(item2Succeeded, 'the replayed second iteration was never reported');
            const stored: any = await workflow.getWorkflowRunById(run.runId);
            expect(stored?.status, 'stored run status after the replay failed').toBe('failed');
            expect(
              stored?.steps?.boom?.error?.message,
              'the replay kept a failure from the previous attempt on the stored foreach',
            ).toBe('always fails');
            expect(
              failedIterations,
              'the replay ran the failure path more than once: failed iterations reported across the run and its replay',
            ).toEqual([0, 1, 0]);
          } finally {
            unwatch();
          }
        },
      );
    });
  });
}
