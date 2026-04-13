/**
 * Dependency Injection tests for workflows
 *
 * Uses MockRegistry pattern to decouple mocks from workflow definitions,
 * enabling proper test isolation via resetMocks().
 */

import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { RequestContext } from '@mastra/core/di';
import type { WorkflowTestContext, WorkflowRegistry, WorkflowCreatorContext } from '../types';
import { MockRegistry } from '../mock-registry';

/**
 * Create all workflows needed for dependency injection tests.
 */
export function createDependencyInjectionWorkflows(ctx: WorkflowCreatorContext) {
  const { createWorkflow, createStep } = ctx;
  const workflows: WorkflowRegistry = {};

  // Create a mock registry for this domain
  const mockRegistry = new MockRegistry();

  // Test: should provide requestContext to step execute function
  {
    // Use mock to capture received context
    mockRegistry.register('di-test-workflow:receivedContext', () => vi.fn());

    const step1 = createStep({
      id: 'step1',
      execute: async ({ requestContext }) => {
        mockRegistry.get('di-test-workflow:receivedContext')(requestContext);
        return { result: 'success' };
      },
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'di-test-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    workflow.then(step1).commit();

    workflows['di-test-workflow'] = {
      workflow,
      mocks: {},
      getReceivedContext: (): RequestContext | undefined => {
        const mock = mockRegistry.get('di-test-workflow:receivedContext');
        return mock.mock.calls.length > 0 ? mock.mock.calls[0]![0] : undefined;
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should propagate requestContext values through workflow steps
  {
    // Use mock to capture context values from each step
    mockRegistry.register('di-propagation-workflow:contextValues', () => vi.fn());

    const step1 = createStep({
      id: 'step1',
      execute: async ({ requestContext }) => {
        // Set a value in requestContext
        requestContext.set('testKey', 'test-value');
        mockRegistry.get('di-propagation-workflow:contextValues')(requestContext.get('testKey'));
        return { value: 'step1' };
      },
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.string() }),
    });

    const step2 = createStep({
      id: 'step2',
      execute: async ({ requestContext }) => {
        // Read the value set by step1
        mockRegistry.get('di-propagation-workflow:contextValues')(requestContext.get('testKey'));
        return { value: 'step2' };
      },
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'di-propagation-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.string() }),
    });

    workflow.then(step1).then(step2).commit();

    workflows['di-propagation-workflow'] = {
      workflow,
      mocks: {},
      getContextValues: (): (string | undefined)[] => {
        const mock = mockRegistry.get('di-propagation-workflow:contextValues');
        return mock.mock.calls.map((call: any[]) => call[0]);
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should not show removed requestContext values in subsequent steps
  {
    mockRegistry.register('di-removed-requestcontext-workflow:finalContextValue', () => vi.fn());

    const incrementStep = createStep({
      id: 'increment',
      execute: async ({ inputData, requestContext }) => {
        requestContext.set('testKey', 'test-dependency');
        return { value: inputData.value + 1 };
      },
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
    });

    const resumeStep = createStep({
      id: 'resume',
      execute: async ({ suspend, resumeData, requestContext }) => {
        if (!resumeData) {
          return suspend({});
        }
        // On resume, read and then delete the requestContext value
        requestContext.delete('testKey');
        return { value: resumeData.value };
      },
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
      resumeSchema: z.object({ value: z.number() }),
    });

    const finalStep = createStep({
      id: 'final',
      execute: async ({ requestContext }) => {
        const value = requestContext.get('testKey');
        mockRegistry.get('di-removed-requestcontext-workflow:finalContextValue')(value);
        return { result: 'done' };
      },
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'di-removed-requestcontext-workflow',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ result: z.string() }),
    });

    workflow.then(incrementStep).then(resumeStep).then(finalStep).commit();

    workflows['di-removed-requestcontext-workflow'] = {
      workflow,
      mocks: {},
      getFinalContextValue: (): any => {
        const mock = mockRegistry.get('di-removed-requestcontext-workflow:finalContextValue');
        return mock.mock.calls.length > 0 ? mock.mock.calls[0]![0] : 'NOT_CALLED';
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should work with custom requestContext - bug #4442
  {
    const getUserInputStep = createStep({
      id: 'getUserInput',
      execute: async () => {
        return { userInput: 'test input' };
      },
      inputSchema: z.object({}),
      outputSchema: z.object({ userInput: z.string() }),
    });

    const promptAgentStep = createStep({
      id: 'promptAgent',
      execute: async ({ suspend, resumeData, requestContext }) => {
        if (!resumeData) {
          // First call: append to responses array and suspend
          requestContext.set('responses', [...((requestContext.get('responses') as string[]) ?? []), 'first message']);
          return suspend({});
        }
        // On resume: append to responses array and return
        requestContext.set('responses', [
          ...((requestContext.get('responses') as string[]) ?? []),
          'promptAgentAction',
        ]);
        return { result: 'done' };
      },
      inputSchema: z.object({ userInput: z.string() }),
      outputSchema: z.object({ result: z.string() }),
      resumeSchema: z.object({ userInput: z.string() }),
    });

    const requestContextActionStep = createStep({
      id: 'requestContextAction',
      execute: async ({ requestContext }) => {
        const responses = requestContext.get('responses');
        return responses as any;
      },
      inputSchema: z.object({ result: z.string() }),
      outputSchema: z.object({}),
    });

    const workflow = createWorkflow({
      id: 'di-bug-4442-workflow',
      inputSchema: z.object({ input: z.string() }),
      outputSchema: z.object({}),
    });

    workflow.then(getUserInputStep).then(promptAgentStep).then(requestContextActionStep).commit();

    workflows['di-bug-4442-workflow'] = {
      workflow,
      mocks: {},
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should inject requestContext into steps during resume
  {
    mockRegistry.register('di-resume-requestcontext-workflow:capturedValue', () => vi.fn());

    const suspendResumeStep = createStep({
      id: 'suspend-resume',
      execute: async ({ suspend, resumeData, requestContext }) => {
        if (!resumeData) {
          return suspend({});
        }
        // On resume, read requestContext value
        const value = requestContext.get('injectedKey');
        mockRegistry.get('di-resume-requestcontext-workflow:capturedValue')(value);
        return { result: 'resumed', contextValue: value };
      },
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string(), contextValue: z.any() }),
      resumeSchema: z.object({ data: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'di-resume-requestcontext-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string(), contextValue: z.any() }),
    });

    workflow.then(suspendResumeStep).commit();

    workflows['di-resume-requestcontext-workflow'] = {
      workflow,
      mocks: {},
      getCapturedValue: (): any => {
        const mock = mockRegistry.get('di-resume-requestcontext-workflow:capturedValue');
        return mock.mock.calls.length > 0 ? mock.mock.calls[0]![0] : 'NOT_CALLED';
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should preserve requestContext values set before suspension through resume
  {
    mockRegistry.register('di-requestcontext-before-suspension-workflow:finalContextValue', () => vi.fn());

    const incrementStep = createStep({
      id: 'increment',
      execute: async ({ inputData, requestContext }) => {
        // Set a value in requestContext before the suspend step
        requestContext.set('testKey', 'test-value');
        return { value: inputData.value + 1 };
      },
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
    });

    const resumeStep = createStep({
      id: 'resume',
      execute: async ({ inputData, suspend, resumeData }) => {
        if (!resumeData) {
          return suspend({});
        }
        return { value: (resumeData as any).value + inputData.value };
      },
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
      resumeSchema: z.object({ value: z.number() }),
    });

    const finalStep = createStep({
      id: 'final',
      execute: async ({ inputData, requestContext }) => {
        // Read the requestContext value set before suspension
        const value = requestContext.get('testKey');
        mockRegistry.get('di-requestcontext-before-suspension-workflow:finalContextValue')(value);
        return { value: inputData.value };
      },
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
    });

    const workflow = createWorkflow({
      id: 'di-requestcontext-before-suspension-workflow',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
    });

    workflow.then(incrementStep).then(resumeStep).then(finalStep).commit();

    workflows['di-requestcontext-before-suspension-workflow'] = {
      workflow,
      mocks: {},
      getFinalContextValue: (): any => {
        const mock = mockRegistry.get('di-requestcontext-before-suspension-workflow:finalContextValue');
        return mock.mock.calls.length > 0 ? mock.mock.calls[0]![0] : 'NOT_CALLED';
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  return workflows;
}

export function createDependencyInjectionTests(ctx: WorkflowTestContext, registry?: WorkflowRegistry) {
  const { execute, skipTests } = ctx;

  describe('Dependency Injection', () => {
    it('should provide requestContext to step execute function', async () => {
      const { workflow, getReceivedContext } = registry!['di-test-workflow']!;

      // requestContext is always provided by the workflow engine
      const result = await execute(workflow, {});

      expect(result.status).toBe('success');
      // requestContext is always provided (may be empty if not explicitly passed)
      expect(getReceivedContext()).toBeDefined();
    });

    it.skipIf(skipTests.requestContextPropagation)(
      'should propagate requestContext values through workflow steps',
      async () => {
        const { workflow, getContextValues } = registry!['di-propagation-workflow']!;

        const result = await execute(workflow, {});

        expect(result.status).toBe('success');
        const contextValues = getContextValues();
        expect(contextValues.length).toBe(2);
        // Both steps should have access to the value
        expect(contextValues[0]).toBe('test-value');
        expect(contextValues[1]).toBe('test-value');
      },
    );

    it.skipIf(skipTests.diRemovedRequestContext || !ctx.resume)(
      'should not show removed requestContext values in subsequent steps',
      async () => {
        const { workflow, resetMocks, getFinalContextValue } = registry!['di-removed-requestcontext-workflow']!;
        resetMocks?.();
        const runId = `di-removed-${Date.now()}`;
        const result = await execute(workflow, { value: 0 }, { runId });
        expect(result.status).toBe('suspended');
        const resumeResult = await ctx.resume!(workflow, {
          runId,
          step: 'resume',
          resumeData: { value: 21 },
        });
        expect(resumeResult.status).toBe('success');
        expect(getFinalContextValue()).toBeUndefined();
      },
    );

    it.skipIf(skipTests.diBug4442 || !ctx.resume)('should work with custom requestContext - bug #4442', async () => {
      const { workflow, resetMocks } = registry!['di-bug-4442-workflow']!;
      resetMocks?.();
      const runId = `di-4442-${Date.now()}`;
      const requestContext = new Map([['responses', []]]) as any;
      const result = await execute(workflow, { input: 'test' }, { runId, requestContext });
      expect(result.status).toBe('suspended');
      expect(result.steps.promptAgent!.status).toBe('suspended');
      const resumeResult = await ctx.resume!(workflow, {
        runId,
        step: 'promptAgent',
        resumeData: { userInput: 'test input for resumption' },
      });
      expect(resumeResult.status).toBe('success');
      expect(resumeResult.steps.requestContextAction!.status).toBe('success');
      expect((resumeResult.steps.requestContextAction as any)!.output).toEqual(['first message', 'promptAgentAction']);
    });

    it.skipIf(skipTests.diResumeRequestContext || !ctx.resume)(
      'should inject requestContext into steps during resume',
      async () => {
        const { workflow, resetMocks, getCapturedValue } = registry!['di-resume-requestcontext-workflow']!;
        resetMocks?.();
        const runId = `di-resume-ctx-${Date.now()}`;
        const requestContext = new Map([['injectedKey', 'injected-value']]) as any;
        const result = await execute(workflow, {}, { runId, requestContext });
        expect(result.status).toBe('suspended');
        const resumeResult = await ctx.resume!(workflow, {
          runId,
          step: 'suspend-resume',
          resumeData: { data: 'test' },
        });
        expect(resumeResult.status).toBe('success');
        expect(getCapturedValue()).toBe('injected-value');
      },
    );

    it.skipIf(skipTests.diRequestContextBeforeSuspension || !ctx.resume)(
      'should preserve requestContext values set before suspension through resume',
      async () => {
        const { workflow, resetMocks, getFinalContextValue } =
          registry!['di-requestcontext-before-suspension-workflow']!;
        resetMocks?.();

        const runId = `di-before-suspension-${Date.now()}`;

        // Execute with value: 0 - increment sets requestContext('testKey', 'test-value'),
        // returns {value: 1}, resume step suspends
        const result = await execute(workflow, { value: 0 }, { runId });
        expect(result.status).toBe('suspended');

        // Resume with value: 21 - resume step computes: resumeData.value (21) + inputData.value (1) = 22
        // final step reads requestContext('testKey') which should still be 'test-value'
        const resumeResult = await ctx.resume!(workflow, {
          runId,
          step: 'resume',
          resumeData: { value: 21 },
        });

        expect(resumeResult.status).toBe('success');
        if (resumeResult.status === 'success') {
          expect((resumeResult.result as any).value).toBe(22);
        }
        // Verify that the requestContext value set before suspension is available after resume
        expect(getFinalContextValue()).toBe('test-value');
      },
    );
  });
}
