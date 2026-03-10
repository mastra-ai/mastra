/**
 * Tracing/observability tests for workflows
 *
 * Tests that tracingContext is provided to steps and spans are created correctly.
 */

import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import type { WorkflowTestContext, WorkflowRegistry, WorkflowCreatorContext } from '../types';
import { MockRegistry } from '../mock-registry';

/**
 * Create all workflows needed for tracing tests.
 */
export function createTracingWorkflows(ctx: WorkflowCreatorContext) {
  const { createWorkflow, createStep } = ctx;
  const workflows: WorkflowRegistry = {};

  const mockRegistry = new MockRegistry();

  // Test: should provide tracingContext to step
  {
    let capturedTracingContext: any = null;

    mockRegistry.register('tracing-context:step1', () =>
      vi.fn().mockImplementation(async ({ tracingContext }) => {
        capturedTracingContext = tracingContext;
        return { result: 'done' };
      }),
    );

    const step1 = createStep({
      id: 'step1',
      inputSchema: z.object({ input: z.string() }),
      outputSchema: z.object({ result: z.string() }),
      execute: async ctx => mockRegistry.get('tracing-context:step1')(ctx),
    });

    const workflow = createWorkflow({
      id: 'tracing-context',
      steps: [step1],
      inputSchema: z.object({ input: z.string() }),
      outputSchema: z.object({ result: z.string() }),
    });

    workflow.then(step1).commit();

    workflows['tracing-context'] = {
      workflow,
      mocks: {
        get step1() {
          return mockRegistry.get('tracing-context:step1');
        },
      },
      resetMocks: () => {
        mockRegistry.reset();
        capturedTracingContext = null;
      },
      getCapturedTracingContext: () => capturedTracingContext,
    };
  }

  // Test: should provide tracingContext to multiple steps
  {
    const capturedContexts: any[] = [];

    mockRegistry.register('tracing-multistep:step1', () =>
      vi.fn().mockImplementation(async ({ tracingContext }) => {
        capturedContexts.push({ step: 'step1', context: tracingContext });
        return { value: 'step1-done' };
      }),
    );

    mockRegistry.register('tracing-multistep:step2', () =>
      vi.fn().mockImplementation(async ({ tracingContext }) => {
        capturedContexts.push({ step: 'step2', context: tracingContext });
        return { value: 'step2-done' };
      }),
    );

    const step1 = createStep({
      id: 'step1',
      inputSchema: z.object({ input: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      execute: async ctx => mockRegistry.get('tracing-multistep:step1')(ctx),
    });

    const step2 = createStep({
      id: 'step2',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      execute: async ctx => mockRegistry.get('tracing-multistep:step2')(ctx),
    });

    const workflow = createWorkflow({
      id: 'tracing-multistep',
      steps: [step1, step2],
      inputSchema: z.object({ input: z.string() }),
      outputSchema: z.object({ value: z.string() }),
    });

    workflow.then(step1).then(step2).commit();

    workflows['tracing-multistep'] = {
      workflow,
      mocks: {
        get step1() {
          return mockRegistry.get('tracing-multistep:step1');
        },
        get step2() {
          return mockRegistry.get('tracing-multistep:step2');
        },
      },
      resetMocks: () => {
        mockRegistry.reset();
        capturedContexts.length = 0;
      },
      getCapturedContexts: () => capturedContexts,
    };
  }

  return workflows;
}

/**
 * Create tests for tracing/observability.
 */
export function createTracingTests(ctx: WorkflowTestContext, registry?: WorkflowRegistry) {
  const { execute, skipTests } = ctx;

  describe('tracing', () => {
    it.skipIf(skipTests.tracingContext)('should provide tracingContext to step execution', async () => {
      const { workflow, getCapturedTracingContext } = registry!['tracing-context']!;
      const result = await execute(workflow, { input: 'test' });

      expect(result.status).toBe('success');

      // Verify tracingContext was provided (structure may vary by engine)
      const tracingContext = getCapturedTracingContext();
      expect(tracingContext).toBeDefined();
      // tracingContext is an object (may be empty or have currentSpan depending on engine)
      expect(typeof tracingContext).toBe('object');
    });

    it.skipIf(skipTests.tracingTypeScript)('should provide full TypeScript support for tracingContext', () => {
      const { createStep } = ctx;

      const typedStep = createStep({
        id: 'typed-step',
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        execute: async ({ inputData, tracingContext }) => {
          expect(tracingContext).toBeDefined();
          expect(typeof tracingContext.currentSpan).toBeDefined();

          return { result: `processed: ${inputData.value}` };
        },
      });

      expect(typedStep).toBeDefined();
    });

    it.skipIf(skipTests.tracingMultistep)('should provide tracingContext to all steps in workflow', async () => {
      const { workflow, getCapturedContexts } = registry!['tracing-multistep']!;
      const result = await execute(workflow, { input: 'test' });

      expect(result.status).toBe('success');

      // Verify both steps received tracingContext
      const contexts = getCapturedContexts();
      expect(contexts).toHaveLength(2);
      expect(contexts[0].step).toBe('step1');
      expect(contexts[0].context).toBeDefined();
      expect(typeof contexts[0].context).toBe('object');
      expect(contexts[1].step).toBe('step2');
      expect(contexts[1].context).toBeDefined();
      expect(typeof contexts[1].context).toBe('object');
    });
  });
}
