/**
 * Retry tests for workflows
 *
 * Uses MockRegistry pattern to decouple mocks from workflow definitions,
 * enabling proper test isolation via resetMocks().
 */

import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import type { WorkflowTestContext, WorkflowRegistry, WorkflowCreatorContext } from '../types';
import { MockRegistry } from '../mock-registry';

/**
 * Create all workflows needed for retry tests.
 */
export function createRetryWorkflows(ctx: WorkflowCreatorContext) {
  const { createWorkflow, createStep } = ctx;
  const workflows: WorkflowRegistry = {};

  // Create a mock registry for this domain
  const mockRegistry = new MockRegistry();

  // Test: should retry a step default 0 times
  {
    // Register mock factories
    mockRegistry.register('retry-default:step1', () => vi.fn().mockResolvedValue({ result: 'success' }));
    mockRegistry.register('retry-default:step2', () =>
      vi.fn().mockImplementation(() => {
        throw new Error('Step failed');
      }),
    );

    const step1 = createStep({
      id: 'step1',
      execute: async ctx => mockRegistry.get('retry-default:step1')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });
    const step2 = createStep({
      id: 'step2',
      execute: async ctx => mockRegistry.get('retry-default:step2')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });

    const workflow = createWorkflow({
      id: 'retry-default',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });

    workflow.then(step1).then(step2).commit();

    workflows['retry-default'] = {
      workflow,
      mocks: {
        get step1Execute() {
          return mockRegistry.get('retry-default:step1');
        },
        get step2Execute() {
          return mockRegistry.get('retry-default:step2');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should retry a step with a custom retry config
  {
    // Register mock factories
    mockRegistry.register('retry-custom-config:step1', () => vi.fn().mockResolvedValue({ result: 'success' }));
    mockRegistry.register('retry-custom-config:step2', () =>
      vi.fn().mockImplementation(() => {
        throw new Error('Step failed');
      }),
    );

    const step1 = createStep({
      id: 'step1',
      execute: async ctx => mockRegistry.get('retry-custom-config:step1')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });
    const step2 = createStep({
      id: 'step2',
      execute: async ctx => mockRegistry.get('retry-custom-config:step2')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });

    const workflow = createWorkflow({
      id: 'retry-custom-config',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      retryConfig: { attempts: 5, delay: 10 },
    });

    workflow.then(step1).then(step2).commit();

    workflows['retry-custom-config'] = {
      workflow,
      mocks: {
        get step1Execute() {
          return mockRegistry.get('retry-custom-config:step1');
        },
        get step2Execute() {
          return mockRegistry.get('retry-custom-config:step2');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should retry a step with step retries option, overriding the workflow retry config
  {
    // Register mock factories
    mockRegistry.register('retry-step-override:step1', () => vi.fn().mockResolvedValue({ result: 'success' }));
    mockRegistry.register('retry-step-override:step2', () =>
      vi.fn().mockImplementation(() => {
        throw new Error('Step failed');
      }),
    );

    const step1 = createStep({
      id: 'step1',
      execute: async ctx => mockRegistry.get('retry-step-override:step1')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      retries: 5,
    });
    const step2 = createStep({
      id: 'step2',
      execute: async ctx => mockRegistry.get('retry-step-override:step2')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      retries: 5,
    });

    const workflow = createWorkflow({
      id: 'retry-step-override',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      retryConfig: { delay: 10, attempts: 10 },
    });

    workflow.then(step1).then(step2).commit();

    workflows['retry-step-override'] = {
      workflow,
      mocks: {
        get step1Execute() {
          return mockRegistry.get('retry-step-override:step1');
        },
        get step2Execute() {
          return mockRegistry.get('retry-step-override:step2');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  return workflows;
}

/**
 * Create tests for retry.
 */
export function createRetryTests(ctx: WorkflowTestContext, registry?: WorkflowRegistry) {
  const { execute } = ctx;

  describe('Retry', () => {
    it('should retry a step default 0 times', async () => {
      const { workflow, mocks } = registry!['retry-default']!;
      const result = await execute(workflow, {});

      expect(result.steps.step1).toMatchObject({
        status: 'success',
        output: { result: 'success' },
        payload: {},
      });
      expect(result.steps.step2).toMatchObject({
        status: 'failed',
        payload: { result: 'success' },
      });
      expect((result.steps.step2 as any)?.error).toBeInstanceOf(Error);
      expect((result.steps.step2 as any)?.error.message).toMatch(/Step failed/);
      expect(mocks.step1Execute).toHaveBeenCalledTimes(1);
      expect(mocks.step2Execute).toHaveBeenCalledTimes(1); // 0 retries + 1 initial call
    });

    it('should retry a step with a custom retry config', async () => {
      const { workflow, mocks } = registry!['retry-custom-config']!;
      const result = await execute(workflow, {});

      expect(result.steps.step1).toMatchObject({
        status: 'success',
        output: { result: 'success' },
        payload: {},
      });
      expect(result.steps.step2).toMatchObject({
        status: 'failed',
        payload: { result: 'success' },
      });
      expect((result.steps.step2 as any)?.error).toBeInstanceOf(Error);
      expect((result.steps.step2 as any)?.error.message).toMatch(/Step failed/);
      expect(mocks.step1Execute).toHaveBeenCalledTimes(1);
      expect(mocks.step2Execute).toHaveBeenCalledTimes(6); // 5 retries + 1 initial call
    });

    it('should retry a step with step retries option, overriding the workflow retry config', async () => {
      const { workflow, mocks } = registry!['retry-step-override']!;
      const result = await execute(workflow, {});

      expect(result.steps.step1).toMatchObject({
        status: 'success',
        output: { result: 'success' },
        payload: {},
      });
      expect(result.steps.step2).toMatchObject({
        status: 'failed',
        payload: { result: 'success' },
      });
      expect((result.steps.step2 as any)?.error).toBeInstanceOf(Error);
      expect((result.steps.step2 as any)?.error.message).toMatch(/Step failed/);
      expect(mocks.step1Execute).toHaveBeenCalledTimes(1);
      expect(mocks.step2Execute).toHaveBeenCalledTimes(6); // 5 retries + 1 initial call
    });
  });
}
