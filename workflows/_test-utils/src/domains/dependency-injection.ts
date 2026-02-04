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
        return mock.mock.calls.length > 0 ? mock.mock.calls[0][0] : undefined;
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

  return workflows;
}

export function createDependencyInjectionTests(ctx: WorkflowTestContext, registry?: WorkflowRegistry) {
  const { execute, skipTests } = ctx;

  describe('Dependency Injection', () => {
    it('should provide requestContext to step execute function', async () => {
      const { workflow, getReceivedContext } = registry!['di-test-workflow'];

      // requestContext is always provided by the workflow engine
      const result = await execute(workflow, {});

      expect(result.status).toBe('success');
      // requestContext is always provided (may be empty if not explicitly passed)
      expect(getReceivedContext()).toBeDefined();
    });

    it.skipIf(skipTests.requestContextPropagation)('should propagate requestContext values through workflow steps', async () => {
      const { workflow, getContextValues } = registry!['di-propagation-workflow'];

      const result = await execute(workflow, {});

      expect(result.status).toBe('success');
      const contextValues = getContextValues();
      expect(contextValues.length).toBe(2);
      // Both steps should have access to the value
      expect(contextValues[0]).toBe('test-value');
      expect(contextValues[1]).toBe('test-value');
    });
  });
}
