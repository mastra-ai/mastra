/**
 * Time travel tests for workflows (sleep steps and timeTravel API)
 */

import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import type { WorkflowTestContext, WorkflowRegistry, WorkflowCreatorContext } from '../types';
import { MockRegistry } from '../mock-registry';

/**
 * Create all workflows needed for time travel tests.
 */
export function createTimeTravelWorkflows(ctx: WorkflowCreatorContext) {
  const { createWorkflow, createStep } = ctx;
  const workflows: WorkflowRegistry = {};

  // Test: should execute a sleep step
  {
    const executeFn = vi.fn().mockResolvedValue({ result: 'success' });
    const step1 = createStep({
      id: 'step1',
      execute: executeFn,
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });
    const step2 = createStep({
      id: 'step2',
      execute: async ({ inputData }) => {
        return { result: 'slept successfully: ' + inputData.result };
      },
      inputSchema: z.object({ result: z.string() }),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'sleep-test-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({
        result: z.string(),
      }),
      steps: [step1, step2],
    });

    workflow.then(step1).sleep(100).then(step2).commit();

    workflows['sleep-test-workflow'] = { workflow, mocks: { executeFn } };
  }

  // Test: should execute a sleep step with fn parameter
  {
    const executeFn = vi.fn().mockResolvedValue({ value: 100 });
    const step1 = createStep({
      id: 'step1',
      execute: executeFn,
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.number() }),
    });
    const step2 = createStep({
      id: 'step2',
      execute: async ({ inputData }) => {
        return { result: 'slept for: ' + inputData.value };
      },
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'sleep-fn-test-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({
        result: z.string(),
      }),
      steps: [step1, step2],
    });

    workflow
      .then(step1)
      .sleep(async ({ getStepResult }) => {
        const step1Result = getStepResult(step1);
        return step1Result?.value ?? 50;
      })
      .then(step2)
      .commit();

    workflows['sleep-fn-test-workflow'] = { workflow, mocks: { executeFn }, step1 };
  }

  // Test: should handle sleep in conditional branch
  {
    const checkStep = vi.fn().mockResolvedValue({ shouldSleep: true });
    const afterSleepStep = vi.fn().mockResolvedValue({ result: 'completed after sleep' });
    const noSleepStep = vi.fn().mockResolvedValue({ result: 'completed without sleep' });

    const check = createStep({
      id: 'check',
      execute: checkStep,
      inputSchema: z.object({}),
      outputSchema: z.object({ shouldSleep: z.boolean() }),
    });

    const afterSleep = createStep({
      id: 'afterSleep',
      execute: afterSleepStep,
      inputSchema: z.object({ shouldSleep: z.boolean() }),
      outputSchema: z.object({ result: z.string() }),
    });

    const noSleep = createStep({
      id: 'noSleep',
      execute: noSleepStep,
      inputSchema: z.object({ shouldSleep: z.boolean() }),
      outputSchema: z.object({ result: z.string() }),
    });

    // Build the sleep branch as a nested workflow
    const sleepBranch = createWorkflow({
      id: 'sleep-branch-inner',
      inputSchema: z.object({ shouldSleep: z.boolean() }),
      outputSchema: z.object({ result: z.string() }),
    })
      .sleep(50)
      .then(afterSleep)
      .commit();

    const workflow = createWorkflow({
      id: 'sleep-in-branch-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    workflow
      .then(check)
      .branch([
        [async ({ inputData }) => inputData.shouldSleep === true, sleepBranch],
        [async ({ inputData }) => inputData.shouldSleep === false, noSleep],
      ])
      .commit();

    workflows['sleep-in-branch-workflow'] = {
      workflow,
      mocks: { checkStep, afterSleepStep, noSleepStep },
    };
  }

  // Test: should preserve step results across sleep
  {
    const step1Fn = vi.fn().mockResolvedValue({ value: 'before-sleep' });
    const step2Fn = vi.fn().mockImplementation(async ({ getStepResult }) => {
      // Access step1 result after the sleep to verify it's preserved
      const step1Result = getStepResult('step1');
      return { combined: `${step1Result?.value || 'missing'} + after-sleep` };
    });

    const step1 = createStep({
      id: 'step1',
      execute: step1Fn,
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.string() }),
    });

    const step2 = createStep({
      id: 'step2',
      execute: step2Fn,
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ combined: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'preserve-results-across-sleep-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ combined: z.string() }),
    });

    workflow.then(step1).sleep(50).then(step2).commit();

    workflows['preserve-results-across-sleep-workflow'] = {
      workflow,
      mocks: { step1Fn, step2Fn },
    };
  }

  // Test: should execute a sleepUntil step
  {
    const executeFn = vi.fn().mockResolvedValue({ result: 'success' });
    const step1 = createStep({
      id: 'step1',
      execute: executeFn,
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });
    const step2 = createStep({
      id: 'step2',
      execute: async ({ inputData }) => {
        return { result: 'slept until successfully: ' + inputData.result };
      },
      inputSchema: z.object({ result: z.string() }),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'sleep-until-test-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({
        result: z.string(),
      }),
      steps: [step1, step2],
    });

    // Sleep until 100ms from now (computed at execution time)
    workflow
      .then(step1)
      .sleepUntil(async () => new Date(Date.now() + 100))
      .then(step2)
      .commit();

    workflows['sleep-until-test-workflow'] = { workflow, mocks: { executeFn } };
  }

  // Test: should execute a sleepUntil step with fn parameter
  {
    const executeFn = vi.fn().mockResolvedValue({ value: 100 });
    const step1 = createStep({
      id: 'step1',
      execute: executeFn,
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.number() }),
    });
    const step2 = createStep({
      id: 'step2',
      execute: async ({ inputData }) => {
        return { result: 'slept until fn: ' + inputData.value };
      },
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'sleep-until-fn-test-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({
        result: z.string(),
      }),
      steps: [step1, step2],
    });

    workflow
      .then(step1)
      .sleepUntil(async ({ inputData }) => {
        // Sleep until inputData.value ms from now
        return new Date(Date.now() + inputData.value);
      })
      .then(step2)
      .commit();

    workflows['sleep-until-fn-test-workflow'] = { workflow, mocks: { executeFn }, step1 };
  }

  // Create a mock registry for time travel tests
  const mockRegistry = new MockRegistry();

  // Test: should timeTravel a workflow execution
  {
    mockRegistry.register('timetravel-basic:step1', () => vi.fn().mockResolvedValue({ step1Result: 2 }));
    mockRegistry.register('timetravel-basic:step2', () =>
      vi.fn().mockImplementation(async ({ inputData }) => ({ step2Result: inputData.step1Result + 1 })),
    );
    mockRegistry.register('timetravel-basic:step3', () =>
      vi.fn().mockImplementation(async ({ inputData }) => ({ final: inputData.step2Result + 1 })),
    );

    const step1 = createStep({
      id: 'step1',
      execute: async ctx => mockRegistry.get('timetravel-basic:step1')(ctx),
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ step1Result: z.number() }),
    });

    const step2 = createStep({
      id: 'step2',
      execute: async ctx => mockRegistry.get('timetravel-basic:step2')(ctx),
      inputSchema: z.object({ step1Result: z.number() }),
      outputSchema: z.object({ step2Result: z.number() }),
    });

    const step3 = createStep({
      id: 'step3',
      execute: async ctx => mockRegistry.get('timetravel-basic:step3')(ctx),
      inputSchema: z.object({ step2Result: z.number() }),
      outputSchema: z.object({ final: z.number() }),
    });

    const workflow = createWorkflow({
      id: 'timetravel-basic-workflow',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ final: z.number() }),
      steps: [step1, step2, step3],
    });

    workflow.then(step1).then(step2).then(step3).commit();

    workflows['timetravel-basic-workflow'] = {
      workflow,
      step1,
      step2,
      step3,
      mocks: {
        get step1() {
          return mockRegistry.get('timetravel-basic:step1');
        },
        get step2() {
          return mockRegistry.get('timetravel-basic:step2');
        },
        get step3() {
          return mockRegistry.get('timetravel-basic:step3');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should timeTravel a workflow with parallel steps
  {
    mockRegistry.register('timetravel-parallel:step1', () => vi.fn().mockResolvedValue({ value: 'step1' }));
    mockRegistry.register('timetravel-parallel:step2', () => vi.fn().mockResolvedValue({ value: 'step2' }));
    mockRegistry.register('timetravel-parallel:final', () =>
      vi.fn().mockImplementation(async ({ inputData }) => ({
        combined: `${inputData.step1?.value || 'none'}-${inputData.step2?.value || 'none'}`,
      })),
    );

    const step1 = createStep({
      id: 'step1',
      execute: async ctx => mockRegistry.get('timetravel-parallel:step1')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.string() }),
    });

    const step2 = createStep({
      id: 'step2',
      execute: async ctx => mockRegistry.get('timetravel-parallel:step2')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.string() }),
    });

    const finalStep = createStep({
      id: 'final',
      execute: async ctx => mockRegistry.get('timetravel-parallel:final')(ctx),
      inputSchema: z.object({
        step1: z.object({ value: z.string() }).optional(),
        step2: z.object({ value: z.string() }).optional(),
      }),
      outputSchema: z.object({ combined: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'timetravel-parallel-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ combined: z.string() }),
      steps: [step1, step2, finalStep],
    });

    workflow.parallel([step1, step2]).then(finalStep).commit();

    workflows['timetravel-parallel-workflow'] = {
      workflow,
      step1,
      step2,
      finalStep,
      mocks: {
        get step1() {
          return mockRegistry.get('timetravel-parallel:step1');
        },
        get step2() {
          return mockRegistry.get('timetravel-parallel:step2');
        },
        get final() {
          return mockRegistry.get('timetravel-parallel:final');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should timeTravel parallel steps with perStep: true
  // This needs a workflow with a step BEFORE the parallel group (matching main branch structure)
  {
    mockRegistry.register('timetravel-parallel-perstep:init', () => vi.fn().mockResolvedValue({ result: 'init done' }));
    mockRegistry.register('timetravel-parallel-perstep:p1', () => vi.fn().mockResolvedValue({ result: 'p1 done' }));
    mockRegistry.register('timetravel-parallel-perstep:p2', () => vi.fn().mockResolvedValue({ result: 'p2 done' }));
    mockRegistry.register('timetravel-parallel-perstep:final', () =>
      vi.fn().mockImplementation(async ({ inputData }) => ({
        result: `${inputData.p1?.result || 'none'}-${inputData.p2?.result || 'none'}`,
      })),
    );

    const initStep = createStep({
      id: 'initStep',
      execute: async ctx => mockRegistry.get('timetravel-parallel-perstep:init')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    const p1 = createStep({
      id: 'p1',
      execute: async ctx => mockRegistry.get('timetravel-parallel-perstep:p1')(ctx),
      inputSchema: z.object({ result: z.string() }),
      outputSchema: z.object({ result: z.string() }),
    });

    const p2 = createStep({
      id: 'p2',
      execute: async ctx => mockRegistry.get('timetravel-parallel-perstep:p2')(ctx),
      inputSchema: z.object({ result: z.string() }),
      outputSchema: z.object({ result: z.string() }),
    });

    const finalStep = createStep({
      id: 'final',
      execute: async ctx => mockRegistry.get('timetravel-parallel-perstep:final')(ctx),
      inputSchema: z.object({
        p1: z.object({ result: z.string() }).optional(),
        p2: z.object({ result: z.string() }).optional(),
      }),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'timetravel-parallel-perstep-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
      steps: [initStep, p1, p2, finalStep],
    });

    workflow.then(initStep).parallel([p1, p2]).then(finalStep).commit();

    workflows['timetravel-parallel-perstep-workflow'] = {
      workflow,
      initStep,
      p1,
      p2,
      finalStep,
      mocks: {
        get init() {
          return mockRegistry.get('timetravel-parallel-perstep:init');
        },
        get p1() {
          return mockRegistry.get('timetravel-parallel-perstep:p1');
        },
        get p2() {
          return mockRegistry.get('timetravel-parallel-perstep:p2');
        },
        get final() {
          return mockRegistry.get('timetravel-parallel-perstep:final');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should timeTravel with perStep: true
  {
    mockRegistry.register('timetravel-perstep:step1', () => vi.fn().mockResolvedValue({ step1Result: 2 }));
    mockRegistry.register('timetravel-perstep:step2', () =>
      vi.fn().mockImplementation(async ({ inputData }) => ({ step2Result: inputData.step1Result + 1 })),
    );
    mockRegistry.register('timetravel-perstep:step3', () =>
      vi.fn().mockImplementation(async ({ inputData }) => ({ final: inputData.step2Result + 1 })),
    );

    const step1 = createStep({
      id: 'step1',
      execute: async ctx => mockRegistry.get('timetravel-perstep:step1')(ctx),
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ step1Result: z.number() }),
    });

    const step2 = createStep({
      id: 'step2',
      execute: async ctx => mockRegistry.get('timetravel-perstep:step2')(ctx),
      inputSchema: z.object({ step1Result: z.number() }),
      outputSchema: z.object({ step2Result: z.number() }),
    });

    const step3 = createStep({
      id: 'step3',
      execute: async ctx => mockRegistry.get('timetravel-perstep:step3')(ctx),
      inputSchema: z.object({ step2Result: z.number() }),
      outputSchema: z.object({ final: z.number() }),
    });

    const workflow = createWorkflow({
      id: 'timetravel-perstep-workflow',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ final: z.number() }),
      steps: [step1, step2, step3],
    });

    workflow.then(step1).then(step2).then(step3).commit();

    workflows['timetravel-perstep-workflow'] = {
      workflow,
      step1,
      step2,
      step3,
      mocks: {
        get step1() {
          return mockRegistry.get('timetravel-perstep:step1');
        },
        get step2() {
          return mockRegistry.get('timetravel-perstep:step2');
        },
        get step3() {
          return mockRegistry.get('timetravel-perstep:step3');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should timeTravel with previously ran workflow
  {
    mockRegistry.register('timetravel-prevrun:step1', () => vi.fn().mockResolvedValue({ step1Result: 2 }));
    mockRegistry.register('timetravel-prevrun:step2', () =>
      vi.fn().mockImplementation(async ({ inputData }) => ({ step2Result: inputData.step1Result + 1 })),
    );
    mockRegistry.register('timetravel-prevrun:step3', () =>
      vi.fn().mockImplementation(async ({ inputData }) => ({ final: inputData.step2Result + 1 })),
    );

    const step1 = createStep({
      id: 'step1',
      execute: async ctx => mockRegistry.get('timetravel-prevrun:step1')(ctx),
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ step1Result: z.number() }),
    });

    const step2 = createStep({
      id: 'step2',
      execute: async ctx => mockRegistry.get('timetravel-prevrun:step2')(ctx),
      inputSchema: z.object({ step1Result: z.number() }),
      outputSchema: z.object({ step2Result: z.number() }),
    });

    const step3 = createStep({
      id: 'step3',
      execute: async ctx => mockRegistry.get('timetravel-prevrun:step3')(ctx),
      inputSchema: z.object({ step2Result: z.number() }),
      outputSchema: z.object({ final: z.number() }),
    });

    const workflow = createWorkflow({
      id: 'timetravel-prevrun-workflow',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ final: z.number() }),
      steps: [step1, step2, step3],
    });

    workflow.then(step1).then(step2).then(step3).commit();

    workflows['timetravel-prevrun-workflow'] = {
      workflow,
      step1,
      step2,
      step3,
      mocks: {
        get step1() {
          return mockRegistry.get('timetravel-prevrun:step1');
        },
        get step2() {
          return mockRegistry.get('timetravel-prevrun:step2');
        },
        get step3() {
          return mockRegistry.get('timetravel-prevrun:step3');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should timeTravel a workflow execution that has nested workflows
  {
    mockRegistry.register('timetravel-nested:step1', () => vi.fn().mockResolvedValue({ step1Result: 2 }));
    mockRegistry.register('timetravel-nested:step2', () => vi.fn().mockResolvedValue({ step2Result: 3 }));
    mockRegistry.register('timetravel-nested:step3', () =>
      vi.fn().mockImplementation(async ({ inputData }) => ({ nestedFinal: inputData.step2Result + 1 })),
    );
    mockRegistry.register('timetravel-nested:step4', () =>
      vi.fn().mockImplementation(async ({ inputData }) => ({ final: inputData.nestedFinal + 1 })),
    );

    const step1 = createStep({
      id: 'step1',
      execute: async ctx => mockRegistry.get('timetravel-nested:step1')(ctx),
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ step1Result: z.number() }),
    });

    const step2 = createStep({
      id: 'step2',
      execute: async ctx => mockRegistry.get('timetravel-nested:step2')(ctx),
      inputSchema: z.object({ step1Result: z.number() }),
      outputSchema: z.object({ step2Result: z.number() }),
    });

    const step3 = createStep({
      id: 'step3',
      execute: async ctx => mockRegistry.get('timetravel-nested:step3')(ctx),
      inputSchema: z.object({ step2Result: z.number() }),
      outputSchema: z.object({ nestedFinal: z.number() }),
    });

    const step4 = createStep({
      id: 'step4',
      execute: async ctx => mockRegistry.get('timetravel-nested:step4')(ctx),
      inputSchema: z.object({ nestedFinal: z.number() }),
      outputSchema: z.object({ final: z.number() }),
    });

    const nestedWorkflow = createWorkflow({
      id: 'nested-inner',
      inputSchema: z.object({ step1Result: z.number() }),
      outputSchema: z.object({ nestedFinal: z.number() }),
      steps: [step2, step3],
    })
      .then(step2)
      .then(step3)
      .commit();

    const workflow = createWorkflow({
      id: 'timetravel-nested-workflow',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ final: z.number() }),
    })
      .then(step1)
      .then(nestedWorkflow)
      .then(step4)
      .commit();

    workflows['timetravel-nested-workflow'] = {
      workflow,
      nestedWorkflow,
      step1,
      step2,
      step3,
      step4,
      mocks: {
        get step1() {
          return mockRegistry.get('timetravel-nested:step1');
        },
        get step2() {
          return mockRegistry.get('timetravel-nested:step2');
        },
        get step3() {
          return mockRegistry.get('timetravel-nested:step3');
        },
        get step4() {
          return mockRegistry.get('timetravel-nested:step4');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should timeTravel with suspend and resume
  {
    mockRegistry.register('timetravel-suspend:step1', () => vi.fn().mockResolvedValue({ step1Result: 2 }));
    mockRegistry.register('timetravel-suspend:suspend', () =>
      vi.fn().mockImplementation(async ({ suspend }) => {
        await suspend();
        return { suspended: true };
      }),
    );
    mockRegistry.register('timetravel-suspend:step3', () =>
      vi.fn().mockImplementation(async ({ inputData }) => ({ final: inputData.step1Result + 10 })),
    );

    const step1 = createStep({
      id: 'step1',
      execute: async ctx => mockRegistry.get('timetravel-suspend:step1')(ctx),
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ step1Result: z.number() }),
    });

    const suspendStep = createStep({
      id: 'suspendStep',
      execute: async ctx => mockRegistry.get('timetravel-suspend:suspend')(ctx),
      inputSchema: z.object({ step1Result: z.number() }),
      outputSchema: z.object({ suspended: z.boolean() }),
    });

    const step3 = createStep({
      id: 'step3',
      execute: async ctx => mockRegistry.get('timetravel-suspend:step3')(ctx),
      inputSchema: z.object({ step1Result: z.number() }),
      outputSchema: z.object({ final: z.number() }),
    });

    const workflow = createWorkflow({
      id: 'timetravel-suspend-workflow',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ final: z.number() }),
      steps: [step1, suspendStep, step3],
    });

    workflow
      .then(step1)
      .then(suspendStep)
      .then(step3 as any)
      .commit();

    workflows['timetravel-suspend-workflow'] = {
      workflow,
      step1,
      suspendStep,
      step3,
      mocks: {
        get step1() {
          return mockRegistry.get('timetravel-suspend:step1');
        },
        get suspendStep() {
          return mockRegistry.get('timetravel-suspend:suspend');
        },
        get step3() {
          return mockRegistry.get('timetravel-suspend:step3');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should timeTravel to step in conditional chains
  {
    mockRegistry.register('timetravel-conditional:check', () => vi.fn().mockResolvedValue({ branch: 'A' }));
    mockRegistry.register('timetravel-conditional:branchA', () => vi.fn().mockResolvedValue({ result: 'from A' }));
    mockRegistry.register('timetravel-conditional:branchB', () => vi.fn().mockResolvedValue({ result: 'from B' }));

    const check = createStep({
      id: 'check',
      execute: async ctx => mockRegistry.get('timetravel-conditional:check')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({ branch: z.string() }),
    });

    const branchA = createStep({
      id: 'branchA',
      execute: async ctx => mockRegistry.get('timetravel-conditional:branchA')(ctx),
      inputSchema: z.object({ branch: z.string() }),
      outputSchema: z.object({ result: z.string() }),
    });

    const branchB = createStep({
      id: 'branchB',
      execute: async ctx => mockRegistry.get('timetravel-conditional:branchB')(ctx),
      inputSchema: z.object({ branch: z.string() }),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'timetravel-conditional-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    workflow
      .then(check)
      .branch([
        [async ({ inputData }) => inputData.branch === 'A', branchA],
        [async ({ inputData }) => inputData.branch === 'B', branchB],
      ])
      .commit();

    workflows['timetravel-conditional-workflow'] = {
      workflow,
      check,
      branchA,
      branchB,
      mocks: {
        get check() {
          return mockRegistry.get('timetravel-conditional:check');
        },
        get branchA() {
          return mockRegistry.get('timetravel-conditional:branchA');
        },
        get branchB() {
          return mockRegistry.get('timetravel-conditional:branchB');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should timeTravel workflow execution for a do-until workflow
  {
    let loopCounter = 0;
    mockRegistry.register('timetravel-loop:loopStep', () =>
      vi.fn().mockImplementation(async ({ inputData }) => {
        loopCounter++;
        return { counter: inputData.counter + 1 };
      }),
    );
    mockRegistry.register('timetravel-loop:finalStep', () =>
      vi.fn().mockImplementation(async ({ inputData }) => ({ final: inputData.counter })),
    );

    const loopStep = createStep({
      id: 'loopStep',
      execute: async ctx => mockRegistry.get('timetravel-loop:loopStep')(ctx),
      inputSchema: z.object({ counter: z.number() }),
      outputSchema: z.object({ counter: z.number() }),
    });

    const finalStep = createStep({
      id: 'finalStep',
      execute: async ctx => mockRegistry.get('timetravel-loop:finalStep')(ctx),
      inputSchema: z.object({ counter: z.number() }),
      outputSchema: z.object({ final: z.number() }),
    });

    const workflow = createWorkflow({
      id: 'timetravel-loop-workflow',
      inputSchema: z.object({ counter: z.number() }),
      outputSchema: z.object({ final: z.number() }),
      steps: [loopStep, finalStep],
    });

    workflow
      .dountil(loopStep, async ({ inputData }) => inputData.counter >= 3)
      .then(finalStep)
      .commit();

    workflows['timetravel-loop-workflow'] = {
      workflow,
      loopStep,
      finalStep,
      mocks: {
        get loopStep() {
          return mockRegistry.get('timetravel-loop:loopStep');
        },
        get finalStep() {
          return mockRegistry.get('timetravel-loop:finalStep');
        },
      },
      resetMocks: () => {
        mockRegistry.reset();
        loopCounter = 0;
      },
      getLoopCounter: () => loopCounter,
    };
  }

  // Test: should throw error if trying to timetravel a workflow execution that is still running
  {
    mockRegistry.register('timetravel-error-running:step1', () => vi.fn().mockResolvedValue({ step1Result: 2 }));
    mockRegistry.register('timetravel-error-running:step2', () =>
      vi.fn().mockImplementation(async ({ inputData }) => ({ step2Result: inputData.step1Result + 1 })),
    );
    mockRegistry.register('timetravel-error-running:step3', () =>
      vi.fn().mockImplementation(async ({ inputData }) => ({ final: inputData.step2Result + 1 })),
    );

    const step1 = createStep({
      id: 'step1',
      execute: async ctx => mockRegistry.get('timetravel-error-running:step1')(ctx),
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ step1Result: z.number() }),
    });

    const step2 = createStep({
      id: 'step2',
      execute: async ctx => mockRegistry.get('timetravel-error-running:step2')(ctx),
      inputSchema: z.object({ step1Result: z.number() }),
      outputSchema: z.object({ step2Result: z.number() }),
    });

    const step3 = createStep({
      id: 'step3',
      execute: async ctx => mockRegistry.get('timetravel-error-running:step3')(ctx),
      inputSchema: z.object({ step2Result: z.number() }),
      outputSchema: z.object({ final: z.number() }),
    });

    const workflow = createWorkflow({
      id: 'tt-error-running-workflow',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ final: z.number() }),
      steps: [step1, step2, step3],
    });

    workflow.then(step1).then(step2).then(step3).commit();

    workflows['tt-error-running-workflow'] = {
      workflow,
      step1,
      step2,
      step3,
      mocks: {
        get step1() {
          return mockRegistry.get('timetravel-error-running:step1');
        },
        get step2() {
          return mockRegistry.get('timetravel-error-running:step2');
        },
        get step3() {
          return mockRegistry.get('timetravel-error-running:step3');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should throw error if validateInputs is true and trying to timetravel with invalid inputData
  {
    mockRegistry.register('timetravel-error-invalid:step1', () => vi.fn().mockResolvedValue({ step1Result: 2 }));
    mockRegistry.register('timetravel-error-invalid:step2', () =>
      vi.fn().mockImplementation(async ({ inputData }) => ({ step2Result: inputData.step1Result + 1 })),
    );
    mockRegistry.register('timetravel-error-invalid:step3', () =>
      vi.fn().mockImplementation(async ({ inputData }) => ({ final: inputData.step2Result + 1 })),
    );

    const step1 = createStep({
      id: 'step1',
      execute: async ctx => mockRegistry.get('timetravel-error-invalid:step1')(ctx),
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ step1Result: z.number() }),
    });

    const step2 = createStep({
      id: 'step2',
      execute: async ctx => mockRegistry.get('timetravel-error-invalid:step2')(ctx),
      inputSchema: z.object({ step1Result: z.number() }),
      outputSchema: z.object({ step2Result: z.number() }),
    });

    const step3 = createStep({
      id: 'step3',
      execute: async ctx => mockRegistry.get('timetravel-error-invalid:step3')(ctx),
      inputSchema: z.object({ step2Result: z.number() }),
      outputSchema: z.object({ final: z.number() }),
    });

    const workflow = createWorkflow({
      id: 'tt-error-invalid-input-workflow',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ final: z.number() }),
      steps: [step1, step2, step3],
      options: {
        validateInputs: true,
      },
    });

    workflow.then(step1).then(step2).then(step3).commit();

    workflows['tt-error-invalid-input-workflow'] = {
      workflow,
      step1,
      step2,
      step3,
      mocks: {
        get step1() {
          return mockRegistry.get('timetravel-error-invalid:step1');
        },
        get step2() {
          return mockRegistry.get('timetravel-error-invalid:step2');
        },
        get step3() {
          return mockRegistry.get('timetravel-error-invalid:step3');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should timetravel a suspended workflow execution
  {
    mockRegistry.register('timetravel-suspended-wf:getUserInput', () =>
      vi.fn().mockResolvedValue({ userInput: 'test input' }),
    );
    mockRegistry.register('timetravel-suspended-wf:promptAgent', () =>
      vi
        .fn()
        .mockImplementationOnce(async ({ suspend }: any) => {
          return suspend({ testPayload: 'hello' });
        })
        .mockImplementationOnce(() => ({ modelOutput: 'test output' })),
    );
    mockRegistry.register('timetravel-suspended-wf:evaluateTone', () =>
      vi.fn().mockResolvedValue({
        toneScore: { score: 0.8 },
        completenessScore: { score: 0.7 },
      }),
    );
    mockRegistry.register('timetravel-suspended-wf:improveResponse', () =>
      vi
        .fn()
        .mockImplementationOnce(async ({ suspend }: any) => {
          await suspend();
          return undefined;
        })
        .mockImplementationOnce(() => ({ improvedOutput: 'improved output' })),
    );
    mockRegistry.register('timetravel-suspended-wf:evaluateImproved', () =>
      vi.fn().mockResolvedValue({
        toneScore: { score: 0.9 },
        completenessScore: { score: 0.8 },
      }),
    );

    const getUserInput = createStep({
      id: 'getUserInput',
      execute: async ctx => mockRegistry.get('timetravel-suspended-wf:getUserInput')(ctx),
      inputSchema: z.object({ input: z.string() }),
      outputSchema: z.object({ userInput: z.string() }),
    });

    const promptAgent = createStep({
      id: 'promptAgent',
      execute: async ctx => mockRegistry.get('timetravel-suspended-wf:promptAgent')(ctx),
      inputSchema: z.object({ userInput: z.string() }),
      outputSchema: z.object({ modelOutput: z.string() }),
      suspendSchema: z.object({ testPayload: z.string() }),
      resumeSchema: z.object({ userInput: z.string() }),
    });

    const evaluateTone = createStep({
      id: 'evaluateToneConsistency',
      execute: async ctx => mockRegistry.get('timetravel-suspended-wf:evaluateTone')(ctx),
      inputSchema: z.object({ modelOutput: z.string() }),
      outputSchema: z.object({
        toneScore: z.any(),
        completenessScore: z.any(),
      }),
    });

    const improveResponse = createStep({
      id: 'improveResponse',
      execute: async ctx => mockRegistry.get('timetravel-suspended-wf:improveResponse')(ctx),
      resumeSchema: z.object({
        toneScore: z.object({ score: z.number() }),
        completenessScore: z.object({ score: z.number() }),
      }),
      inputSchema: z.object({ toneScore: z.any(), completenessScore: z.any() }),
      outputSchema: z.object({ improvedOutput: z.string() }),
    });

    const evaluateImproved = createStep({
      id: 'evaluateImprovedResponse',
      execute: async ctx => mockRegistry.get('timetravel-suspended-wf:evaluateImproved')(ctx),
      inputSchema: z.object({ improvedOutput: z.string() }),
      outputSchema: z.object({
        toneScore: z.any(),
        completenessScore: z.any(),
      }),
    });

    const workflow = createWorkflow({
      id: 'tt-suspended-workflow',
      inputSchema: z.object({ input: z.string() }),
      outputSchema: z.object({}),
    });

    workflow
      .then(getUserInput)
      .then(promptAgent)
      .then(evaluateTone)
      .then(improveResponse)
      .then(evaluateImproved)
      .commit();

    workflows['tt-suspended-workflow'] = {
      workflow,
      getUserInput,
      promptAgent,
      evaluateTone,
      improveResponse,
      evaluateImproved,
      mocks: {
        get getUserInput() {
          return mockRegistry.get('timetravel-suspended-wf:getUserInput');
        },
        get promptAgent() {
          return mockRegistry.get('timetravel-suspended-wf:promptAgent');
        },
        get evaluateTone() {
          return mockRegistry.get('timetravel-suspended-wf:evaluateTone');
        },
        get improveResponse() {
          return mockRegistry.get('timetravel-suspended-wf:improveResponse');
        },
        get evaluateImproved() {
          return mockRegistry.get('timetravel-suspended-wf:evaluateImproved');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  return workflows;
}

export function createTimeTravelTests(ctx: WorkflowTestContext, registry?: WorkflowRegistry) {
  const { execute, skipTests, timeTravel } = ctx;

  describe('Time travel', () => {
    it('should execute a sleep step', async () => {
      const { workflow, mocks } = registry!['sleep-test-workflow']!;

      const startTime = Date.now();
      const result = await execute(workflow, {});
      const endTime = Date.now();

      expect(mocks.executeFn).toHaveBeenCalled();
      expect(result.steps['step1']).toMatchObject({
        status: 'success',
        output: { result: 'success' },
        payload: {},
      });

      expect(result.steps['step2']).toMatchObject({
        status: 'success',
        output: { result: 'slept successfully: success' },
        payload: { result: 'success' },
      });

      // Allow for slight timing variance
      expect(endTime - startTime).toBeGreaterThanOrEqual(90);
    });

    it('should execute a sleep step with fn parameter', async () => {
      const { workflow, mocks } = registry!['sleep-fn-test-workflow']!;

      const startTime = Date.now();
      const result = await execute(workflow, {});
      const endTime = Date.now();

      expect(mocks.executeFn).toHaveBeenCalled();
      expect(result.steps['step2']).toMatchObject({
        status: 'success',
        output: { result: 'slept for: 100' },
      });

      // Allow for slight timing variance
      expect(endTime - startTime).toBeGreaterThanOrEqual(90);
    });

    it('should handle sleep in conditional branch', async () => {
      const { workflow, mocks } = registry!['sleep-in-branch-workflow']!;

      const startTime = Date.now();
      const result = await execute(workflow, {});
      const endTime = Date.now();

      expect(result.status).toBe('success');
      expect(mocks.checkStep).toHaveBeenCalledTimes(1);
      expect(mocks.afterSleepStep).toHaveBeenCalledTimes(1);
      expect(mocks.noSleepStep).toHaveBeenCalledTimes(0);

      // Should have slept ~50ms in the branch
      expect(endTime - startTime).toBeGreaterThanOrEqual(40);

      expect(result.steps['sleep-branch-inner']?.output).toEqual({
        result: 'completed after sleep',
      });
    });

    it('should preserve step results across sleep', async () => {
      const { workflow, mocks } = registry!['preserve-results-across-sleep-workflow']!;

      const result = await execute(workflow, {});

      expect(result.status).toBe('success');
      expect(mocks.step1Fn).toHaveBeenCalledTimes(1);
      expect(mocks.step2Fn).toHaveBeenCalledTimes(1);

      expect(result.steps['step1']).toMatchObject({
        status: 'success',
        output: { value: 'before-sleep' },
      });

      expect(result.steps['step2']).toMatchObject({
        status: 'success',
        output: { combined: 'before-sleep + after-sleep' },
      });
    });

    it('should execute a sleepUntil step', async () => {
      const { workflow, mocks } = registry!['sleep-until-test-workflow']!;

      const startTime = Date.now();
      const result = await execute(workflow, {});
      const endTime = Date.now();

      expect(mocks.executeFn).toHaveBeenCalled();
      expect(result.steps['step1']).toMatchObject({
        status: 'success',
        output: { result: 'success' },
      });

      expect(result.steps['step2']).toMatchObject({
        status: 'success',
        output: { result: 'slept until successfully: success' },
      });

      // Should have slept ~100ms
      expect(endTime - startTime).toBeGreaterThanOrEqual(90);
    });

    it('should execute a sleepUntil step with fn parameter', async () => {
      const { workflow, mocks } = registry!['sleep-until-fn-test-workflow']!;

      const startTime = Date.now();
      const result = await execute(workflow, {});
      const endTime = Date.now();

      expect(mocks.executeFn).toHaveBeenCalled();
      expect(result.steps['step2']).toMatchObject({
        status: 'success',
        output: { result: 'slept until fn: 100' },
      });

      // Should have slept ~100ms
      expect(endTime - startTime).toBeGreaterThanOrEqual(90);
    });

    // Time travel API tests
    it.skipIf(skipTests.timeTravelBasic || !timeTravel)('should timeTravel a workflow execution', async () => {
      const { workflow, step2, mocks, resetMocks } = registry!['timetravel-basic-workflow']!;
      resetMocks?.();

      // Time travel to step2 with pre-populated step1 result
      const result = await timeTravel!(workflow, {
        step: step2,
        context: {
          step1: {
            payload: { value: 0 },
            startedAt: Date.now(),
            status: 'success',
            output: { step1Result: 2 },
            endedAt: Date.now(),
          },
        },
      });

      expect(result.status).toBe('success');
      // step1 should not have been called (it was provided in context)
      expect(mocks.step1).not.toHaveBeenCalled();
      // step2 and step3 should have been called
      expect(mocks.step2).toHaveBeenCalled();
      expect(mocks.step3).toHaveBeenCalled();
      // Final result should be 4 (2 + 1 + 1)
      expect(result.result).toEqual({ final: 4 });
    });

    it.skipIf(skipTests.timeTravelParallel || !timeTravel)(
      'should timeTravel workflow execution for workflow with parallel steps',
      async () => {
        const { workflow, finalStep, mocks, resetMocks } = registry!['timetravel-parallel-workflow']!;
        resetMocks?.();

        // Time travel to final step with pre-populated parallel step results
        const result = await timeTravel!(workflow, {
          step: finalStep,
          context: {
            step1: {
              payload: {},
              startedAt: Date.now(),
              status: 'success',
              output: { value: 'pre-step1' },
              endedAt: Date.now(),
            },
            step2: {
              payload: {},
              startedAt: Date.now(),
              status: 'success',
              output: { value: 'pre-step2' },
              endedAt: Date.now(),
            },
          },
        });

        expect(result.status).toBe('success');
        // Parallel steps should not have been called
        expect(mocks.step1).not.toHaveBeenCalled();
        expect(mocks.step2).not.toHaveBeenCalled();
        // Final step should have been called
        expect(mocks.final).toHaveBeenCalled();
        // Result should combine the pre-populated values
        expect(result.result).toEqual({ combined: 'pre-step1-pre-step2' });
      },
    );

    it.skipIf(skipTests.timeTravelPerStep || !timeTravel)(
      'should timeTravel a workflow execution and run only one step when perStep is true',
      async () => {
        const { workflow, step2, mocks, resetMocks } = registry!['timetravel-perstep-workflow']!;
        resetMocks?.();

        // Time travel to step2 with perStep=true
        const result = await timeTravel!(workflow, {
          step: step2,
          context: {
            step1: {
              payload: { value: 0 },
              startedAt: Date.now(),
              status: 'success',
              output: { step1Result: 2 },
              endedAt: Date.now(),
            },
          },
          perStep: true,
        });

        // Should be paused after running one step
        expect(result.status).toBe('paused');
        // step1 should not have been called
        expect(mocks.step1).not.toHaveBeenCalled();
        // step2 should have been called (the one step we're time traveling to)
        expect(mocks.step2).toHaveBeenCalled();
        // step3 should not have been called (perStep stops after one step)
        expect(mocks.step3).not.toHaveBeenCalled();
        // step2 result should be present
        expect(result.steps['step2']).toMatchObject({
          status: 'success',
          output: { step2Result: 3 },
        });
      },
    );

    it.skipIf(skipTests.timeTravelPreviousRun || !timeTravel)(
      'should timeTravel a workflow execution that was previously ran',
      async () => {
        const { workflow, step2, mocks, resetMocks } = registry!['timetravel-prevrun-workflow']!;
        resetMocks?.();

        // First, run the workflow normally
        const result1 = await ctx.execute(workflow, { value: 1 });
        expect(result1.status).toBe('success');
        expect(mocks.step1).toHaveBeenCalledTimes(1);
        expect(mocks.step2).toHaveBeenCalledTimes(1);
        expect(mocks.step3).toHaveBeenCalledTimes(1);

        // Now time travel to step2 with different context
        resetMocks?.();
        const result2 = await timeTravel!(workflow, {
          step: step2,
          context: {
            step1: {
              payload: { value: 0 },
              startedAt: Date.now(),
              status: 'success',
              output: { step1Result: 10 }, // Different value than original run
              endedAt: Date.now(),
            },
          },
        });

        expect(result2.status).toBe('success');
        // step1 should not have been called (provided in context)
        expect(mocks.step1).not.toHaveBeenCalled();
        // step2 and step3 should have been called
        expect(mocks.step2).toHaveBeenCalled();
        expect(mocks.step3).toHaveBeenCalled();
        // Final result should use the new value: 10 + 1 + 1 = 12
        expect(result2.result).toEqual({ final: 12 });
      },
    );

    it.skipIf(skipTests.timeTravelNested || !timeTravel)(
      'should timeTravel a workflow execution that has nested workflows',
      async () => {
        const { workflow, nestedWorkflow, mocks, resetMocks } = registry!['timetravel-nested-workflow']!;
        resetMocks?.();

        // Time travel to the nested workflow
        const result = await timeTravel!(workflow, {
          step: nestedWorkflow,
          context: {
            step1: {
              payload: { value: 0 },
              startedAt: Date.now(),
              status: 'success',
              output: { step1Result: 2 },
              endedAt: Date.now(),
            },
          },
        });

        expect(result.status).toBe('success');
        // step1 should not have been called (provided in context)
        expect(mocks.step1).not.toHaveBeenCalled();
        // nested workflow steps and step4 should have been called
        expect(mocks.step2).toHaveBeenCalled();
        expect(mocks.step3).toHaveBeenCalled();
        expect(mocks.step4).toHaveBeenCalled();
        // Final result: step2=3, step3=4, step4=5
        expect(result.result).toEqual({ final: 5 });
      },
    );

    it.skipIf(skipTests.timeTravelSuspendResume || !timeTravel)(
      'should successfully suspend and resume a timeTravelled workflow execution',
      async () => {
        const { workflow, suspendStep, mocks, resetMocks } = registry!['timetravel-suspend-workflow']!;
        resetMocks?.();

        // Time travel to suspend step
        const result = await timeTravel!(workflow, {
          step: suspendStep,
          context: {
            step1: {
              payload: { value: 0 },
              startedAt: Date.now(),
              status: 'success',
              output: { step1Result: 2 },
              endedAt: Date.now(),
            },
          },
        });

        // Should be paused/suspended (different engines may use different terminology)
        expect(['paused', 'suspended']).toContain(result.status);
        expect(mocks.step1).not.toHaveBeenCalled();
        expect(mocks.suspendStep).toHaveBeenCalled();
        expect(mocks.step3).not.toHaveBeenCalled();
      },
    );

    it.skipIf(skipTests.timeTravelConditional || !timeTravel)(
      'should timeTravel to step in conditional chains',
      async () => {
        const { workflow, branchA, mocks, resetMocks } = registry!['timetravel-conditional-workflow']!;
        resetMocks?.();

        // Time travel to branchA with check result showing branch A should be taken
        const result = await timeTravel!(workflow, {
          step: branchA,
          context: {
            check: {
              payload: {},
              startedAt: Date.now(),
              status: 'success',
              output: { branch: 'A' },
              endedAt: Date.now(),
            },
          },
        });

        expect(result.status).toBe('success');
        // check step should not have been called (provided in context)
        expect(mocks.check).not.toHaveBeenCalled();
        // branchA should have been called
        expect(mocks.branchA).toHaveBeenCalled();
        // branchB should not have been called
        expect(mocks.branchB).not.toHaveBeenCalled();
        // Result is wrapped in branch step name when using branch()
        expect(result.result).toEqual({ branchA: { result: 'from A' } });
      },
    );

    it.skipIf(skipTests.timeTravelLoop || !timeTravel)(
      'should timeTravel workflow execution for a do-until workflow',
      async () => {
        const { workflow, finalStep, mocks, resetMocks } = registry!['timetravel-loop-workflow']!;
        resetMocks?.();

        // Time travel to the final step with pre-completed loop iterations
        const result = await timeTravel!(workflow, {
          step: finalStep,
          context: {
            // Provide loop results as if loop already completed
            loopStep: {
              payload: { counter: 2 },
              startedAt: Date.now(),
              status: 'success',
              output: { counter: 3 },
              endedAt: Date.now(),
            },
          },
        });

        expect(result.status).toBe('success');
        // The loop step should not have been called (provided in context)
        expect(mocks.loopStep).not.toHaveBeenCalled();
        // The final step should have been called
        expect(mocks.finalStep).toHaveBeenCalled();
        expect(result.result).toEqual({ final: 3 });
      },
    );

    it.skipIf(skipTests.timeTravelPreviousRunPerStep || !timeTravel)(
      'should timeTravel previously ran workflow with perStep',
      async () => {
        const { workflow, step2, mocks, resetMocks } = registry!['timetravel-prevrun-workflow']!;
        resetMocks?.();

        // First, run the workflow normally
        const result1 = await ctx.execute(workflow, { value: 1 });
        expect(result1.status).toBe('success');

        // Now time travel to step2 with perStep=true
        resetMocks?.();
        const result2 = await timeTravel!(workflow, {
          step: step2,
          context: {
            step1: {
              payload: { value: 0 },
              startedAt: Date.now(),
              status: 'success',
              output: { step1Result: 10 },
              endedAt: Date.now(),
            },
          },
          perStep: true,
        });

        // Should be paused after running one step (step2)
        expect(result2.status).toBe('paused');
        expect(mocks.step1).not.toHaveBeenCalled();
        expect(mocks.step2).toHaveBeenCalled();
        expect(mocks.step3).not.toHaveBeenCalled();
        expect(result2.steps['step2']).toMatchObject({
          status: 'success',
          output: { step2Result: 11 }, // 10 + 1
        });
      },
    );

    it.skipIf(skipTests.timeTravelParallelPerStep || !timeTravel)(
      'should timeTravel parallel steps with perStep',
      async () => {
        const { workflow, p1, mocks, resetMocks } = registry!['timetravel-parallel-perstep-workflow']!;
        resetMocks?.();

        // Time travel to p1 with perStep=true
        // Provide context for initStep and the other parallel step (p2)
        const result = await timeTravel!(workflow, {
          step: p1,
          context: {
            initStep: {
              status: 'success' as const,
              payload: {},
              output: { result: 'init done' },
              startedAt: Date.now(),
              endedAt: Date.now(),
            },
            p2: {
              status: 'success' as const,
              payload: { result: 'init done' },
              output: { result: 'p2 done' },
              startedAt: Date.now(),
              endedAt: Date.now(),
            },
          },
          perStep: true,
        });

        // Should be paused after running the parallel step (perStep stops after one "step")
        expect(result.status).toBe('paused');
        // p1 should have been called (it's the target of time travel)
        expect(mocks.p1).toHaveBeenCalled();
        // Final step should not have been called (perStep stops after the parallel group)
        expect(mocks.final).not.toHaveBeenCalled();
      },
    );

    it.skipIf(skipTests.timeTravelConditionalPerStep || !timeTravel)(
      'should timeTravel conditional chains with perStep',
      async () => {
        const { workflow, branchA, mocks, resetMocks } = registry!['timetravel-conditional-workflow']!;
        resetMocks?.();

        // Time travel to branchA with perStep=true
        const result = await timeTravel!(workflow, {
          step: branchA,
          context: {
            check: {
              payload: {},
              startedAt: Date.now(),
              status: 'success',
              output: { branch: 'A' },
              endedAt: Date.now(),
            },
          },
          perStep: true,
        });

        // Should be paused after running one step
        expect(result.status).toBe('paused');
        expect(mocks.check).not.toHaveBeenCalled();
        expect(mocks.branchA).toHaveBeenCalled();
        expect(mocks.branchB).not.toHaveBeenCalled();
        // branchA result should be present
        expect(result.steps['branchA']).toMatchObject({
          status: 'success',
          output: { result: 'from A' },
        });
      },
    );

    it.skipIf(skipTests.timeTravelNonExistentStep || !timeTravel)(
      'should throw error if trying to timetravel to a non-existent step',
      async () => {
        const { workflow, resetMocks } = registry!['timetravel-basic-workflow']!;
        resetMocks?.();

        try {
          const result = await timeTravel!(workflow, {
            step: 'nonExistent',
            context: {
              step1: {
                status: 'success' as const,
                output: { step1Result: 2 },
                startedAt: Date.now(),
                endedAt: Date.now(),
              },
            },
          });
          // If it doesn't throw, expect failed status
          expect(result.status).toBe('failed');
        } catch (error: any) {
          // Some engines throw instead
          expect(error.message).toContain('nonExistent');
        }
      },
    );

    it.skipIf(skipTests.timeTravelErrorRunning || !timeTravel || !ctx.getStorage)(
      'should throw error if trying to timetravel a workflow execution that is still running',
      async () => {
        const { workflow, resetMocks } = registry!['tt-error-running-workflow']!;
        resetMocks?.();

        const storage = ctx.getStorage!();
        if (!storage) {
          return;
        }

        const runId = 'tt-error-running-test-run-id';
        const workflowsStore = await storage.getStore('workflows');
        expect(workflowsStore).toBeDefined();

        // Persist a snapshot that indicates the workflow is still running
        await workflowsStore?.persistWorkflowSnapshot({
          workflowName: 'tt-error-running-workflow',
          runId,
          snapshot: {
            runId,
            status: 'running',
            activePaths: [1],
            activeStepsPath: { step2: [1] },
            value: {},
            context: {
              input: { value: 0 },
              step1: {
                payload: { value: 0 },
                startedAt: Date.now(),
                status: 'success',
                output: { step1Result: 2 },
                endedAt: Date.now(),
              },
              step2: {
                payload: { step1Result: 2 },
                startedAt: Date.now(),
                status: 'running',
              },
            } as any,
            serializedStepGraph: (workflow as any).serializedStepGraph as any,
            suspendedPaths: {},
            waitingPaths: {},
            resumeLabels: {},
            timestamp: Date.now(),
          },
        });

        try {
          const result = await timeTravel!(workflow, {
            step: 'step2',
            runId,
            inputData: { step1Result: 2 },
          });
          // If it doesn't throw, expect failed status
          expect(result.status).toBe('failed');
        } catch (error: any) {
          // Expect the error about still running
          expect(error.message).toContain('still running');
        }
      },
    );

    it.skipIf(skipTests.timeTravelErrorInvalidInput || !timeTravel)(
      'should throw error if validateInputs is true and trying to timetravel with invalid inputData',
      async () => {
        const { workflow, resetMocks } = registry!['tt-error-invalid-input-workflow']!;
        resetMocks?.();

        try {
          const result = await timeTravel!(workflow, {
            step: 'step2',
            inputData: { invalidPayload: 2 },
          });
          // If it doesn't throw, expect failed status
          expect(result.status).toBe('failed');
        } catch (error: any) {
          // Expect validation error about missing step1Result
          expect(error.message).toContain('step1Result');
        }
      },
    );

    it.skipIf(skipTests.timeTravelSuspended || !timeTravel)(
      'should timetravel a suspended workflow execution',
      async () => {
        const { workflow, mocks, resetMocks } = registry!['tt-suspended-workflow']!;
        resetMocks?.();

        const runId = `tt-suspended-test-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        // First, run the workflow normally - it should suspend at promptAgent
        const result1 = await ctx.execute(workflow, { input: 'test input' }, { runId });
        expect(result1.steps['promptAgent']?.status).toBe('suspended');
        expect(mocks.promptAgent).toHaveBeenCalledTimes(1);

        // Now time travel from getUserInput step on the SAME run - this should re-run from that point
        const timeTravelResult = await timeTravel!(workflow, {
          step: 'getUserInput',
          runId,
          resumeData: {
            userInput: 'test input for resumption',
          },
        });

        // The workflow should hit the second suspend (improveResponse) after successfully
        // resuming promptAgent via time travel
        expect(['paused', 'suspended']).toContain(timeTravelResult.status);

        // getUserInput should have been called again (we're time-traveling from that step)
        expect(mocks.getUserInput).toHaveBeenCalledTimes(2);
        // promptAgent should have been called again
        expect(mocks.promptAgent).toHaveBeenCalledTimes(2);
      },
    );
  });
}
