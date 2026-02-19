/**
 * Clone step and workflow tests
 *
 * Tests for cloneStep and cloneWorkflow functionality.
 */

import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import type { WorkflowTestContext, WorkflowRegistry, WorkflowCreatorContext } from '../types';
import { MockRegistry } from '../mock-registry';

/**
 * Create all workflows needed for clone tests.
 */
export function createCloneWorkflows(ctx: WorkflowCreatorContext) {
  const { createWorkflow, createStep, cloneStep, cloneWorkflow } = ctx;
  const workflows: WorkflowRegistry = {};

  // Skip if clone functions are not available
  if (!cloneStep || !cloneWorkflow) {
    return workflows;
  }

  const mockRegistry = new MockRegistry();

  // Test: should be able to clone workflows as steps
  {
    mockRegistry.register('clone-workflow:start', () =>
      vi.fn().mockImplementation(async ({ inputData }) => {
        const currentValue = inputData.startValue || 0;
        return { newValue: currentValue + 1 };
      }),
    );
    mockRegistry.register('clone-workflow:other', () => vi.fn().mockResolvedValue({ other: 26 }));
    mockRegistry.register('clone-workflow:final', () =>
      vi.fn().mockImplementation(async ({ getStepResult }) => {
        const startVal = getStepResult('start')?.newValue ?? 0;
        const otherVal = getStepResult('other-clone')?.other ?? 0;
        return { finalValue: startVal + otherVal };
      }),
    );
    mockRegistry.register('clone-workflow:last', () => vi.fn().mockResolvedValue({ success: true }));

    const startStep = createStep({
      id: 'start',
      inputSchema: z.object({ startValue: z.number() }),
      outputSchema: z.object({ newValue: z.number() }),
      execute: async ctx => mockRegistry.get('clone-workflow:start')(ctx),
    });

    const otherStep = createStep({
      id: 'other',
      inputSchema: z.object({ newValue: z.number() }),
      outputSchema: z.object({ other: z.number() }),
      execute: async ctx => mockRegistry.get('clone-workflow:other')(ctx),
    });

    const finalStep = createStep({
      id: 'final',
      inputSchema: z.object({ newValue: z.number().optional(), other: z.number().optional() }),
      outputSchema: z.object({ finalValue: z.number() }),
      execute: async ctx => mockRegistry.get('clone-workflow:final')(ctx),
    });

    // Create nested workflow A using cloned step
    const nestedWfA = createWorkflow({
      id: 'clone-nested-wf-a',
      inputSchema: z.object({ startValue: z.number() }),
      outputSchema: z.object({ finalValue: z.number() }),
      options: { validateInputs: false },
    })
      .then(startStep)
      .then(cloneStep(otherStep, { id: 'other-clone' }))
      .then(finalStep)
      .commit();

    // Create nested workflow B without the other step
    const nestedWfB = createWorkflow({
      id: 'clone-nested-wf-b',
      inputSchema: z.object({ startValue: z.number() }),
      outputSchema: z.object({ finalValue: z.number() }),
      options: { validateInputs: false },
    })
      .then(startStep)
      .then(
        createStep({
          id: 'final-b',
          inputSchema: z.object({ newValue: z.number() }),
          outputSchema: z.object({ finalValue: z.number() }),
          execute: async ({ inputData }) => ({ finalValue: inputData.newValue }),
        }),
      )
      .commit();

    // Clone workflow A
    const nestedWfAClone = cloneWorkflow(nestedWfA, { id: 'clone-nested-wf-a-clone' });

    // Create main workflow that runs cloned workflows in parallel
    const lastStep = createStep({
      id: 'last-step',
      inputSchema: z.object({
        'clone-nested-wf-b': z.object({ finalValue: z.number() }),
        'clone-nested-wf-a-clone': z.object({ finalValue: z.number() }),
      }),
      outputSchema: z.object({ success: z.boolean() }),
      execute: async ctx => mockRegistry.get('clone-workflow:last')(ctx),
    });

    const mainWorkflow = createWorkflow({
      id: 'clone-workflow-test',
      inputSchema: z.object({ startValue: z.number() }),
      outputSchema: z.object({ success: z.boolean() }),
      options: { validateInputs: false },
    })
      .parallel([nestedWfAClone, nestedWfB])
      .then(lastStep)
      .commit();

    workflows['clone-workflow-test'] = {
      workflow: mainWorkflow,
      mocks: {
        get start() {
          return mockRegistry.get('clone-workflow:start');
        },
        get other() {
          return mockRegistry.get('clone-workflow:other');
        },
        get final() {
          return mockRegistry.get('clone-workflow:final');
        },
        get last() {
          return mockRegistry.get('clone-workflow:last');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should be able to spec out workflow result via variables
  {
    mockRegistry.register('spec-result:start', () =>
      vi.fn().mockImplementation(async ({ inputData }) => {
        const currentValue = inputData.startValue || 0;
        return { newValue: currentValue + 1 };
      }),
    );
    mockRegistry.register('spec-result:other', () => vi.fn().mockResolvedValue({ other: 26 }));
    mockRegistry.register('spec-result:final', () =>
      vi.fn().mockImplementation(async ({ getStepResult }) => {
        const startVal = getStepResult('start')?.newValue ?? 0;
        const otherVal = getStepResult('other')?.other ?? 0;
        return { finalValue: startVal + otherVal };
      }),
    );
    mockRegistry.register('spec-result:last', () => vi.fn().mockResolvedValue({ success: true }));

    const startStep = createStep({
      id: 'start',
      inputSchema: z.object({ startValue: z.number() }),
      outputSchema: z.object({ newValue: z.number() }),
      execute: async ctx => mockRegistry.get('spec-result:start')(ctx),
    });

    const otherStep = createStep({
      id: 'other',
      inputSchema: z.object({ newValue: z.number() }),
      outputSchema: z.object({ newValue: z.number(), other: z.number() }),
      execute: async ctx => mockRegistry.get('spec-result:other')(ctx),
    });

    const finalStep = createStep({
      id: 'final',
      inputSchema: z.object({ newValue: z.number().optional(), other: z.number().optional() }),
      outputSchema: z.object({ finalValue: z.number() }),
      execute: async ctx => mockRegistry.get('spec-result:final')(ctx),
    });

    // Create nested workflow
    const nestedWf = createWorkflow({
      id: 'nested-spec-workflow',
      inputSchema: z.object({ startValue: z.number() }),
      outputSchema: z.object({ finalValue: z.number() }),
      options: { validateInputs: false },
    })
      .then(startStep)
      .then(otherStep)
      .then(finalStep)
      .commit();

    // Create main workflow that uses nested workflow's output schema
    const mainWorkflow = createWorkflow({
      id: 'spec-result-workflow',
      inputSchema: z.object({ startValue: z.number() }),
      outputSchema: z.object({ success: z.boolean() }),
      options: { validateInputs: false },
    })
      .then(nestedWf)
      .then(
        createStep({
          id: 'last-step',
          inputSchema: nestedWf.outputSchema as any, // Use workflow's output schema as input
          outputSchema: z.object({ success: z.boolean() }),
          execute: async ctx => mockRegistry.get('spec-result:last')(ctx),
        }),
      )
      .commit();

    workflows['spec-result-workflow'] = {
      workflow: mainWorkflow,
      nestedWf,
      mocks: {
        get start() {
          return mockRegistry.get('spec-result:start');
        },
        get other() {
          return mockRegistry.get('spec-result:other');
        },
        get final() {
          return mockRegistry.get('spec-result:final');
        },
        get last() {
          return mockRegistry.get('spec-result:last');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  return workflows;
}

export function createCloneTests(ctx: WorkflowTestContext, registry?: WorkflowRegistry) {
  const { execute, skipTests, cloneStep, cloneWorkflow } = ctx;

  describe('Clone workflows', () => {
    // Note: This test is skipped by default because cloned workflows need special
    // registration handling with Mastra when using parallel nested workflows.
    // The original test in workflow.test.ts doesn't use Mastra registration.
    it.skipIf(skipTests.cloneWorkflows !== false || !cloneStep || !cloneWorkflow)(
      'should be able to clone workflows as steps',
      async () => {
        const entry = registry!['clone-workflow-test']!;
        if (!entry) {
          // Skip if workflows weren't created (clone functions not available)
          return;
        }
        const { workflow, mocks, resetMocks } = entry;
        resetMocks?.();

        const result = await execute(workflow, { startValue: 0 });

        expect(result.status).toBe('success');
        // start should be called twice (once in each parallel nested workflow)
        expect(mocks.start).toHaveBeenCalledTimes(2);
        // other should be called once (only in the cloned workflow A)
        expect(mocks.other).toHaveBeenCalledTimes(1);
        // final should be called once (only in cloned workflow A)
        expect(mocks.final).toHaveBeenCalledTimes(1);
        // last should be called once
        expect(mocks.last).toHaveBeenCalledTimes(1);

        // Check cloned workflow output
        expect(result.steps['clone-nested-wf-a-clone']).toMatchObject({
          status: 'success',
          output: { finalValue: 27 }, // 1 + 26
        });

        // Check workflow B output
        expect(result.steps['clone-nested-wf-b']).toMatchObject({
          status: 'success',
          output: { finalValue: 1 },
        });
      },
    );

    it.skipIf(skipTests.specResultVariables || !cloneStep || !cloneWorkflow)(
      'should be able to spec out workflow result via variables',
      async () => {
        const entry = registry!['spec-result-workflow']!;
        if (!entry) {
          return;
        }
        const { workflow, mocks, resetMocks } = entry;
        resetMocks?.();

        const result = await execute(workflow, { startValue: 0 });

        expect(result.status).toBe('success');
        expect(mocks.start).toHaveBeenCalledTimes(1);
        expect(mocks.other).toHaveBeenCalledTimes(1);
        expect(mocks.final).toHaveBeenCalledTimes(1);
        expect(mocks.last).toHaveBeenCalledTimes(1);

        // Check nested workflow output
        expect(result.steps['nested-spec-workflow']).toMatchObject({
          status: 'success',
          output: { finalValue: 27 }, // 1 + 26
        });

        // Check last step received correct payload from nested workflow
        expect(result.steps['last-step']).toMatchObject({
          status: 'success',
          output: { success: true },
          payload: { finalValue: 27 },
        });
      },
    );
  });
}
