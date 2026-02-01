/**
 * Streaming tests for workflows
 * Note: Basic streaming tests that don't require full stream consumption
 *
 * Uses MockRegistry pattern to decouple mocks from workflow definitions,
 * enabling proper test isolation via resetMocks().
 */

import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import type { WorkflowTestContext, WorkflowRegistry, WorkflowCreatorContext } from '../types';
import { MockRegistry } from '../mock-registry';

/**
 * Create all workflows needed for streaming tests.
 */
export function createStreamingWorkflows(ctx: WorkflowCreatorContext) {
  const { createWorkflow, createStep } = ctx;
  const workflows: WorkflowRegistry = {};

  // Create a mock registry for this domain
  const mockRegistry = new MockRegistry();

  // Test: should execute workflow that could be streamed
  {
    // Register mock factories
    mockRegistry.register('streaming-test-workflow:step1Action', () =>
      vi.fn().mockResolvedValue({ result: 'success1' }),
    );
    mockRegistry.register('streaming-test-workflow:step2Action', () =>
      vi.fn().mockResolvedValue({ result: 'success2' }),
    );

    const step1 = createStep({
      id: 'step1',
      execute: async ctx => mockRegistry.get('streaming-test-workflow:step1Action')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.string() }),
    });
    const step2 = createStep({
      id: 'step2',
      execute: async ctx => mockRegistry.get('streaming-test-workflow:step2Action')(ctx),
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({}),
    });

    const workflow = createWorkflow({
      id: 'streaming-test-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      steps: [step1, step2],
      options: {
        validateInputs: false,
      },
    });
    workflow.then(step1).then(step2).commit();

    workflows['streaming-test-workflow'] = {
      workflow,
      mocks: {
        get step1Action() {
          return mockRegistry.get('streaming-test-workflow:step1Action');
        },
        get step2Action() {
          return mockRegistry.get('streaming-test-workflow:step2Action');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should track step execution order in workflow result
  {
    // Use a mock to track execution order
    mockRegistry.register('execution-order-workflow:order', () => vi.fn());

    const step1 = createStep({
      id: 'step1',
      execute: async () => {
        mockRegistry.get('execution-order-workflow:order')('step1');
        return { value: 'step1-done' };
      },
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.string() }),
    });

    const step2 = createStep({
      id: 'step2',
      execute: async () => {
        mockRegistry.get('execution-order-workflow:order')('step2');
        return { value: 'step2-done' };
      },
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
    });

    const step3 = createStep({
      id: 'step3',
      execute: async () => {
        mockRegistry.get('execution-order-workflow:order')('step3');
        return { result: 'complete' };
      },
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'execution-order-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    workflow.then(step1).then(step2).then(step3).commit();

    workflows['execution-order-workflow'] = {
      workflow,
      mocks: {},
      getExecutionOrder: () => {
        const mock = mockRegistry.get('execution-order-workflow:order');
        return mock.mock.calls.map((call: any[]) => call[0]);
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should execute workflow with state that could be streamed
  {
    mockRegistry.register('streaming-with-state-workflow:step1Action', () =>
      vi.fn().mockImplementation(async ({ state, setState }) => {
        await setState({ ...state, counter: (state?.counter || 0) + 1 });
        return { value: 'step1-done' };
      }),
    );
    mockRegistry.register('streaming-with-state-workflow:step2Action', () =>
      vi.fn().mockImplementation(async ({ state, setState }) => {
        await setState({ ...state, counter: (state?.counter || 0) + 1 });
        return { value: 'step2-done', finalCounter: state?.counter };
      }),
    );

    const step1 = createStep({
      id: 'step1',
      execute: async ctx => mockRegistry.get('streaming-with-state-workflow:step1Action')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.string() }),
      stateSchema: z.object({ counter: z.number() }),
    });

    const step2 = createStep({
      id: 'step2',
      execute: async ctx => mockRegistry.get('streaming-with-state-workflow:step2Action')(ctx),
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string(), finalCounter: z.number().optional() }),
      stateSchema: z.object({ counter: z.number() }),
    });

    const workflow = createWorkflow({
      id: 'streaming-with-state-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.string(), finalCounter: z.number().optional() }),
      stateSchema: z.object({ counter: z.number() }),
    });

    workflow.then(step1).then(step2).commit();

    workflows['streaming-with-state-workflow'] = {
      workflow,
      mocks: {
        get step1Action() {
          return mockRegistry.get('streaming-with-state-workflow:step1Action');
        },
        get step2Action() {
          return mockRegistry.get('streaming-with-state-workflow:step2Action');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should execute workflow with parallel steps that could be streamed
  {
    mockRegistry.register('streaming-parallel-workflow:step1Action', () =>
      vi.fn().mockResolvedValue({ result: 'parallel-1' }),
    );
    mockRegistry.register('streaming-parallel-workflow:step2Action', () =>
      vi.fn().mockResolvedValue({ result: 'parallel-2' }),
    );
    mockRegistry.register('streaming-parallel-workflow:step3Action', () =>
      vi.fn().mockResolvedValue({ result: 'parallel-3' }),
    );

    const step1 = createStep({
      id: 'step1',
      execute: async ctx => mockRegistry.get('streaming-parallel-workflow:step1Action')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    const step2 = createStep({
      id: 'step2',
      execute: async ctx => mockRegistry.get('streaming-parallel-workflow:step2Action')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    const step3 = createStep({
      id: 'step3',
      execute: async ctx => mockRegistry.get('streaming-parallel-workflow:step3Action')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'streaming-parallel-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });

    workflow.parallel([step1, step2, step3]).commit();

    workflows['streaming-parallel-workflow'] = {
      workflow,
      mocks: {
        get step1Action() {
          return mockRegistry.get('streaming-parallel-workflow:step1Action');
        },
        get step2Action() {
          return mockRegistry.get('streaming-parallel-workflow:step2Action');
        },
        get step3Action() {
          return mockRegistry.get('streaming-parallel-workflow:step3Action');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should execute workflow that suspends (could be streamed without closing)
  {
    mockRegistry.register('streaming-suspend-workflow:step1Action', () =>
      vi.fn().mockResolvedValue({ value: 'step1-done' }),
    );
    mockRegistry.register('streaming-suspend-workflow:step2Action', () =>
      vi.fn().mockImplementation(async ({ suspend }) => {
        return suspend({ reason: 'waiting for input' });
      }),
    );

    const step1 = createStep({
      id: 'step1',
      execute: async ctx => mockRegistry.get('streaming-suspend-workflow:step1Action')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.string() }),
    });

    const step2 = createStep({
      id: 'step2',
      execute: async ctx => mockRegistry.get('streaming-suspend-workflow:step2Action')(ctx),
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ result: z.string() }),
      suspendSchema: z.object({ reason: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'streaming-suspend-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    workflow.then(step1).then(step2).commit();

    workflows['streaming-suspend-workflow'] = {
      workflow,
      mocks: {
        get step1Action() {
          return mockRegistry.get('streaming-suspend-workflow:step1Action');
        },
        get step2Action() {
          return mockRegistry.get('streaming-suspend-workflow:step2Action');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  return workflows;
}

export function createStreamingTests(ctx: WorkflowTestContext, registry?: WorkflowRegistry) {
  const { execute, skipTests } = ctx;

  describe('Streaming', () => {
    it('should execute workflow that could be streamed', async () => {
      const { workflow, mocks } = registry!['streaming-test-workflow'];

      const result = await execute(workflow, {});

      expect(result.status).toBe('success');
      expect(result.steps.step1).toMatchObject({
        status: 'success',
        output: { result: 'success1' },
        payload: {},
      });
      expect(result.steps.step2).toMatchObject({
        status: 'success',
        output: { result: 'success2' },
        payload: { result: 'success1' },
      });
    });

    it.skipIf(skipTests.stepExecutionOrder)('should track step execution order in workflow result', async () => {
      const { workflow, getExecutionOrder } = registry!['execution-order-workflow'];

      const result = await execute(workflow, {});

      expect(result.status).toBe('success');
      expect(getExecutionOrder()).toEqual(['step1', 'step2', 'step3']);

      // Verify all steps are in the result
      expect(result.steps.step1).toMatchObject({ status: 'success' });
      expect(result.steps.step2).toMatchObject({ status: 'success' });
      expect(result.steps.step3).toMatchObject({ status: 'success' });
    });

    it.skipIf(skipTests.state)('should execute workflow with state that could be streamed', async () => {
      const { workflow, mocks, resetMocks } = registry!['streaming-with-state-workflow'];
      resetMocks?.();

      const result = await execute(workflow, {}, { initialState: { counter: 0 } });

      expect(result.status).toBe('success');
      expect(result.steps.step1).toMatchObject({
        status: 'success',
        output: { value: 'step1-done' },
      });
      expect(result.steps.step2).toMatchObject({
        status: 'success',
      });
      // Verify state was updated
      expect((result.steps.step2 as any).output?.finalCounter).toBe(1);
    });

    it('should execute workflow with parallel steps that could be streamed', async () => {
      const { workflow, mocks, resetMocks } = registry!['streaming-parallel-workflow'];
      resetMocks?.();

      const result = await execute(workflow, {});

      expect(result.status).toBe('success');
      expect(result.steps.step1).toMatchObject({
        status: 'success',
        output: { result: 'parallel-1' },
      });
      expect(result.steps.step2).toMatchObject({
        status: 'success',
        output: { result: 'parallel-2' },
      });
      expect(result.steps.step3).toMatchObject({
        status: 'success',
        output: { result: 'parallel-3' },
      });
    });

    it('should execute workflow that suspends (streamable without closing)', async () => {
      const { workflow, mocks, resetMocks } = registry!['streaming-suspend-workflow'];
      resetMocks?.();

      const result = await execute(workflow, {});

      expect(result.status).toBe('suspended');
      expect(result.steps.step1).toMatchObject({
        status: 'success',
        output: { value: 'step1-done' },
      });
      expect(result.steps.step2).toMatchObject({
        status: 'suspended',
        suspendPayload: { reason: 'waiting for input' },
      });
    });
  });
}
