/**
 * Basic Workflow Execution tests for workflows
 */

import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import type { WorkflowTestContext, WorkflowRegistry } from '../types';
import { MockRegistry } from '../mock-registry';

/**
 * Create all workflows needed for basic execution tests.
 * These are created once and registered with Mastra/Inngest upfront.
 *
 * Uses MockRegistry pattern to decouple mocks from workflow definitions,
 * enabling proper test isolation via resetMocks().
 */
export function createBasicExecutionWorkflows(ctx: Pick<WorkflowTestContext, 'createWorkflow' | 'createStep'>) {
  const { createWorkflow, createStep } = ctx;
  const workflows: WorkflowRegistry = {};

  // Create a mock registry for this domain
  const mockRegistry = new MockRegistry();

  // Test: should execute a single step workflow successfully
  {
    // Register mock factory
    mockRegistry.register('basic-single-step:executeAction', () => vi.fn().mockResolvedValue({ result: 'success' }));

    const step1 = createStep({
      id: 'step1',
      execute: async ctx => {
        // Call mock at runtime via registry lookup
        return mockRegistry.get('basic-single-step:executeAction')(ctx);
      },
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'basic-single-step',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
      steps: [step1],
    });
    workflow.then(step1).commit();

    workflows['basic-single-step'] = {
      workflow,
      mocks: {
        get executeAction() {
          return mockRegistry.get('basic-single-step:executeAction');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should execute a single step workflow successfully with state
  {
    // Register a counter mock that tracks calls
    mockRegistry.register('basic-single-step-with-state:calls', () => vi.fn().mockReturnValue(0));

    const step1 = createStep({
      id: 'step1',
      execute: async ({ state, setState }: any) => {
        // Track call via mock
        const callsMock = mockRegistry.get('basic-single-step-with-state:calls');
        callsMock();

        const newState = state.value + '!!!';
        await setState({ value: newState });
        return { result: 'success', value: newState };
      },
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string(), value: z.string() }),
      stateSchema: z.object({ value: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'basic-single-step-with-state',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string(), value: z.string() }),
      stateSchema: z.object({ value: z.string() }),
      steps: [step1],
    });
    workflow.then(step1).commit();

    workflows['basic-single-step-with-state'] = {
      workflow,
      mocks: {},
      getCalls: () => mockRegistry.get('basic-single-step-with-state:calls').mock.calls.length,
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should execute multiple steps in sequence
  {
    mockRegistry.register('basic-two-step-sequence:step1Action', () =>
      vi.fn().mockResolvedValue({ value: 'step1-result' }),
    );
    mockRegistry.register('basic-two-step-sequence:step2Action', () =>
      vi.fn().mockResolvedValue({ value: 'step2-result' }),
    );

    const step1 = createStep({
      id: 'step1',
      execute: async ctx => mockRegistry.get('basic-two-step-sequence:step1Action')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.string() }),
    });
    const step2 = createStep({
      id: 'step2',
      execute: async ctx => mockRegistry.get('basic-two-step-sequence:step2Action')(ctx),
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'basic-two-step-sequence',
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.string() }),
      steps: [step1, step2],
    });
    workflow.then(step1).then(step2).commit();

    workflows['basic-two-step-sequence'] = {
      workflow,
      mocks: {
        get step1Action() {
          return mockRegistry.get('basic-two-step-sequence:step1Action');
        },
        get step2Action() {
          return mockRegistry.get('basic-two-step-sequence:step2Action');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should execute multiple steps in parallel
  {
    mockRegistry.register('basic-parallel-steps:step1Action', () => vi.fn().mockResolvedValue({ value: 'step1' }));
    mockRegistry.register('basic-parallel-steps:step2Action', () => vi.fn().mockResolvedValue({ value: 'step2' }));

    const step1 = createStep({
      id: 'step1',
      execute: async ctx => mockRegistry.get('basic-parallel-steps:step1Action')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.string() }),
    });
    const step2 = createStep({
      id: 'step2',
      execute: async ctx => mockRegistry.get('basic-parallel-steps:step2Action')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'basic-parallel-steps',
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.string() }),
      steps: [step1, step2],
    });
    workflow.parallel([step1, step2]).commit();

    workflows['basic-parallel-steps'] = {
      workflow,
      mocks: {
        get step1Action() {
          return mockRegistry.get('basic-parallel-steps:step1Action');
        },
        get step2Action() {
          return mockRegistry.get('basic-parallel-steps:step2Action');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should be able to bail workflow execution
  // No mocks needed - uses inline logic
  {
    const step1 = createStep({
      id: 'step1',
      execute: async ({ bail, inputData }: any) => {
        if (inputData.value === 'bail') {
          return bail({ result: 'bailed' });
        }
        return { result: 'step1: ' + inputData.value };
      },
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ result: z.string() }),
    });
    const step2 = createStep({
      id: 'step2',
      execute: async ({ inputData }: any) => {
        return { result: 'step2: ' + inputData.result };
      },
      inputSchema: z.object({ result: z.string() }),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'basic-bail',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ result: z.string() }),
      steps: [step1, step2],
    });
    workflow.then(step1).then(step2).commit();

    workflows['basic-bail'] = { workflow, mocks: {} };
  }

  // Test: should have runId in the step execute function
  {
    // Use mock to capture runId
    mockRegistry.register('basic-runid:capturedRunId', () => vi.fn());

    const step1 = createStep({
      id: 'step1',
      execute: async ({ runId }: any) => {
        // Capture runId via mock call
        mockRegistry.get('basic-runid:capturedRunId')(runId);
        return { result: 'success' };
      },
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'basic-runid',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
      steps: [step1],
    });
    workflow.then(step1).commit();

    workflows['basic-runid'] = {
      workflow,
      mocks: {},
      getCapturedRunId: () => {
        const mock = mockRegistry.get('basic-runid:capturedRunId');
        return mock.mock.calls.length > 0 ? mock.mock.calls[0]![0] : undefined;
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should execute multiple steps in parallel with state
  {
    mockRegistry.register('basic-parallel-with-state:step1Action', () =>
      vi.fn().mockImplementation(async ({ state }: any) => {
        return { value: 'step1', stateValue: state.value };
      }),
    );
    mockRegistry.register('basic-parallel-with-state:step2Action', () =>
      vi.fn().mockImplementation(async ({ state }: any) => {
        return { value: 'step2', stateValue: state.value };
      }),
    );

    const step1 = createStep({
      id: 'step1',
      execute: async ctx => mockRegistry.get('basic-parallel-with-state:step1Action')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.string(), stateValue: z.string() }),
      stateSchema: z.object({ value: z.string() }),
    });
    const step2 = createStep({
      id: 'step2',
      execute: async ctx => mockRegistry.get('basic-parallel-with-state:step2Action')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.string(), stateValue: z.string() }),
      stateSchema: z.object({ value: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'basic-parallel-with-state',
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.string() }),
      stateSchema: z.object({ value: z.string() }),
      steps: [step1, step2],
    });
    workflow.parallel([step1, step2]).commit();

    workflows['basic-parallel-with-state'] = {
      workflow,
      mocks: {
        get step1Action() {
          return mockRegistry.get('basic-parallel-with-state:step1Action');
        },
        get step2Action() {
          return mockRegistry.get('basic-parallel-with-state:step2Action');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should have access to typed workflow results
  // No mocks needed
  {
    const step1 = createStep({
      id: 'step1',
      execute: async () => ({ nested: { value: 'step1-data' } }),
      inputSchema: z.object({}),
      outputSchema: z.object({ nested: z.object({ value: z.string() }) }),
    });

    const workflow = createWorkflow({
      id: 'basic-typed-results',
      inputSchema: z.object({}),
      outputSchema: z.object({ nested: z.object({ value: z.string() }) }),
      steps: [step1],
    });
    workflow.then(step1).commit();

    workflows['basic-typed-results'] = { workflow, mocks: {} };
  }

  // Test: should pass input data through to steps
  {
    // Use mock to capture received input
    mockRegistry.register('basic-input-data:receivedInput', () => vi.fn());

    const step1 = createStep({
      id: 'step1',
      execute: async ({ inputData }: any) => {
        // Capture input via mock call
        mockRegistry.get('basic-input-data:receivedInput')(inputData);
        return { result: 'success' };
      },
      inputSchema: z.object({ foo: z.string(), bar: z.number() }),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'basic-input-data',
      inputSchema: z.object({ foo: z.string(), bar: z.number() }),
      outputSchema: z.object({ result: z.string() }),
      steps: [step1],
    });
    workflow.then(step1).commit();

    workflows['basic-input-data'] = {
      workflow,
      mocks: {},
      getReceivedInput: () => {
        const mock = mockRegistry.get('basic-input-data:receivedInput');
        return mock.mock.calls.length > 0 ? mock.mock.calls[0]![0] : undefined;
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should handle missing suspendData gracefully
  {
    const step1 = createStep({
      id: 'no-suspend-step',
      execute: async ({ inputData, suspendData }: any) => {
        // Should handle missing suspendData gracefully
        const message = suspendData ? 'Had suspend data' : 'No suspend data';
        return { result: `${inputData.value}: ${message}` };
      },
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'basic-missing-suspend-data',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ result: z.string() }),
    });
    workflow.then(step1).commit();

    workflows['basic-missing-suspend-data'] = { workflow, mocks: {} };
  }

  return workflows;
}

/**
 * Create tests for basic workflow execution.
 * Tests use pre-registered workflows from the registry.
 */
export function createBasicExecutionTests(ctx: WorkflowTestContext, registry: WorkflowRegistry) {
  const { execute, skipTests } = ctx;

  describe('Basic Workflow Execution', () => {
    it('should execute a single step workflow successfully', async () => {
      const { workflow, mocks } = registry['basic-single-step']!;
      const result = await execute(workflow, {});

      expect(mocks.executeAction).toHaveBeenCalled();
      expect(result.status).toBe('success');
      expect(result.steps.step1).toMatchObject({
        status: 'success',
        output: { result: 'success' },
        payload: {},
      });
    });

    // Alias test - same functionality, different name for compatibility
    it('should start workflow and complete successfully', async () => {
      const { workflow, resetMocks } = registry['basic-single-step']!;
      resetMocks?.();
      const result = await execute(workflow, {});

      expect(result.status).toBe('success');
      expect(result.steps.step1).toMatchObject({
        status: 'success',
        output: { result: 'success' },
      });
    });

    it('should execute multiple runs of a workflow', async () => {
      const { workflow, mocks, resetMocks } = registry['basic-single-step']!;

      // First run
      resetMocks?.();
      const result1 = await execute(workflow, {});
      expect(result1.status).toBe('success');
      expect(mocks.executeAction).toHaveBeenCalledTimes(1);

      // Second run
      resetMocks?.();
      const result2 = await execute(workflow, {});
      expect(result2.status).toBe('success');
      expect(mocks.executeAction).toHaveBeenCalledTimes(1);

      // Third run
      resetMocks?.();
      const result3 = await execute(workflow, {});
      expect(result3.status).toBe('success');
      expect(mocks.executeAction).toHaveBeenCalledTimes(1);
    });

    it.skipIf(skipTests.state)('should execute a single step workflow successfully with state', async () => {
      const entry = registry['basic-single-step-with-state']!;

      const result = await execute(entry.workflow, {}, { initialState: { value: 'test-state' } });

      expect(entry.getCalls?.()).toBe(1);
      expect(result.steps.step1).toMatchObject({
        status: 'success',
        output: { result: 'success', value: 'test-state!!!' },
      });
    });

    it('should execute multiple steps in sequence', async () => {
      const { workflow, mocks } = registry['basic-two-step-sequence']!;
      const result = await execute(workflow, {});

      expect(mocks.step1Action).toHaveBeenCalled();
      expect(mocks.step2Action).toHaveBeenCalled();
      expect(result.status).toBe('success');
      expect(result.steps.step1).toMatchObject({
        status: 'success',
        output: { value: 'step1-result' },
      });
      expect(result.steps.step2).toMatchObject({
        status: 'success',
        output: { value: 'step2-result' },
      });
    });

    it('should execute multiple steps in parallel', async () => {
      const { workflow, mocks } = registry['basic-parallel-steps']!;
      const result = await execute(workflow, {});

      expect(mocks.step1Action).toHaveBeenCalled();
      expect(mocks.step2Action).toHaveBeenCalled();
      expect(result.status).toBe('success');
      expect(result.steps.step1).toMatchObject({
        status: 'success',
        output: { value: 'step1' },
      });
      expect(result.steps.step2).toMatchObject({
        status: 'success',
        output: { value: 'step2' },
      });
    });

    it('should be able to bail workflow execution', async () => {
      const { workflow } = registry['basic-bail']!;

      // Test bail scenario
      const result = await execute(workflow, { value: 'bail' });
      expect(result.steps.step1).toMatchObject({
        status: 'success',
        output: { result: 'bailed' },
      });
      expect(result.steps.step2).toBeUndefined();

      // Test non-bail scenario
      const result2 = await execute(workflow, { value: 'no-bail' });
      expect(result2.steps.step1).toMatchObject({
        status: 'success',
        output: { result: 'step1: no-bail' },
      });
      expect(result2.steps.step2).toMatchObject({
        status: 'success',
        output: { result: 'step2: step1: no-bail' },
      });
    });

    it('should have runId in the step execute function', async () => {
      const entry = registry['basic-runid']!;

      await execute(entry.workflow, {});

      expect(entry.getCapturedRunId?.()).toBeDefined();
      expect(typeof entry.getCapturedRunId?.()).toBe('string');
    });

    it.skipIf(skipTests.state)('should execute multiple steps in parallel with state', async () => {
      const { workflow } = registry['basic-parallel-with-state']!;
      const result = await execute(workflow, {}, { initialState: { value: 'test-state' } });

      expect(result.status).toBe('success');
      expect(result.steps.step1).toMatchObject({
        status: 'success',
        output: { value: 'step1', stateValue: 'test-state' },
      });
      expect(result.steps.step2).toMatchObject({
        status: 'success',
        output: { value: 'step2', stateValue: 'test-state' },
      });
    });

    it('should have access to typed workflow results', async () => {
      const { workflow } = registry['basic-typed-results']!;
      const result = await execute(workflow, {});

      expect(result.status).toBe('success');
      expect(result.result).toMatchObject({ nested: { value: 'step1-data' } });
    });

    it('should pass input data through to steps', async () => {
      const entry = registry['basic-input-data']!;

      await execute(entry.workflow, { foo: 'hello', bar: 42 });

      expect(entry.getReceivedInput?.()).toEqual({ foo: 'hello', bar: 42 });
    });

    it.skipIf(skipTests.executionFlowNotDefined)('should throw error when execution flow not defined', async () => {
      const { createWorkflow, createStep } = ctx;

      const step1 = createStep({
        id: 'step1',
        execute: async () => ({ result: 'success' }),
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'no-execution-flow',
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
        steps: [step1],
      });

      // Don't add any execution flow (.then, .branch, etc.)
      await expect(workflow.createRun()).rejects.toThrowError(/Execution flow of workflow is not defined/);
    });

    it.skipIf(skipTests.executionGraphNotCommitted)(
      'should throw error when execution graph is not committed',
      async () => {
        const { createWorkflow, createStep } = ctx;

        const step1 = createStep({
          id: 'step1',
          execute: async () => ({ result: 'success' }),
          inputSchema: z.object({}),
          outputSchema: z.object({ result: z.string() }),
        });

        const workflow = createWorkflow({
          id: 'uncommitted-graph',
          inputSchema: z.object({}),
          outputSchema: z.object({ result: z.string() }),
          steps: [step1],
        });

        workflow.then(step1);
        // Don't call .commit()

        expect(workflow.committed).toBe(false);

        await expect(workflow.createRun()).rejects.toThrowError(/Uncommitted step flow changes detected/);
      },
    );

    it.skipIf(skipTests.missingSuspendData)('should handle missing suspendData gracefully', async () => {
      const { workflow } = registry['basic-missing-suspend-data']!;

      const result = await execute(workflow, { value: 'test' });

      expect(result.status).toBe('success');
      expect(result.result).toMatchObject({ result: 'test: No suspend data' });
    });
  });
}
