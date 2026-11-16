import { describe, expectTypeOf, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { cloneWorkflow, createWorkflow } from './create';
import type { StepResult, WorkflowResult } from './types';
import { createStep } from './workflow';
import type { AnyWorkflow, Workflow } from './workflow';

const step = createStep({
  id: 'double',
  inputSchema: z.object({ n: z.number() }),
  outputSchema: z.object({ n: z.number() }),
  execute: async ({ inputData }) => ({ n: inputData.n * 2 }),
});

function workflowOn<const TStorageVersion extends 1 | 2>(storageVersion: TStorageVersion) {
  return createWorkflow({
    id: 'wf',
    inputSchema: z.object({ n: z.number() }),
    outputSchema: z.object({ n: z.number() }),
    steps: [step],
    options: { storageVersion },
  })
    .then(step)
    .commit();
}

type DoubleResult = StepResult<{ n: number }, unknown, unknown, { n: number }>;

describe('a run result’s steps, by storage version', () => {
  it('is the record without a storageVersion', async () => {
    const wf = createWorkflow({
      id: 'wf',
      inputSchema: z.object({ n: z.number() }),
      outputSchema: z.object({ n: z.number() }),
      steps: [step],
    })
      .then(step)
      .commit();
    const result = await (await wf.createRun()).start({ inputData: { n: 1 } });
    expectTypeOf(result.steps.double).toEqualTypeOf<DoubleResult>();
  });

  it('is the record on storageVersion 1', async () => {
    const result = await (await workflowOn(1).createRun()).start({ inputData: { n: 1 } });
    expectTypeOf(result.steps.double).toEqualTypeOf<DoubleResult>();
  });

  it('is an async loader on storageVersion 2, through every result-returning run method', async () => {
    const run = await workflowOn(2).createRun();
    const started = await run.start({ inputData: { n: 1 } });
    expectTypeOf(started.steps).toBeFunction();
    expectTypeOf((await started.steps()).double).toEqualTypeOf<DoubleResult>();
    // @ts-expect-error a v2 result's steps aren't a record
    void started.steps.double;

    expectTypeOf((await run.resume({ step: 'double' })).steps).toBeFunction();
    expectTypeOf((await run.restart()).steps).toBeFunction();
    expectTypeOf((await run.timeTravel({ step: 'double' })).steps).toBeFunction();
    expectTypeOf((await run.stream({ inputData: { n: 1 } }).result).steps).toBeFunction();
  });

  it('is either when the version is only known at runtime, told apart by typeof', async () => {
    const result = await (await workflowOn<1 | 2>(2).createRun()).start({ inputData: { n: 1 } });
    if (typeof result.steps === 'function') {
      expectTypeOf((await result.steps()).double).toEqualTypeOf<DoubleResult>();
    } else {
      expectTypeOf(result.steps.double).toEqualTypeOf<DoubleResult>();
    }
  });

  it('types the lifecycle callbacks the same way', () => {
    createWorkflow({
      id: 'wf',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      options: {
        storageVersion: 2,
        onFinish: async ({ steps }) => {
          expectTypeOf(await steps()).toEqualTypeOf<Record<string, StepResult<any, any, any, any>>>();
        },
        onError: async ({ steps }) => {
          expectTypeOf(steps).toBeFunction();
        },
      },
    });
    createWorkflow({
      id: 'wf',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      options: {
        onFinish: ({ steps }) => {
          expectTypeOf(steps).toEqualTypeOf<Record<string, StepResult<any, any, any, any>>>();
        },
      },
    });
  });

  it('keeps the version through cloneWorkflow', async () => {
    const result = await (
      await cloneWorkflow(workflowOn(2), { id: 'clone' }).createRun()
    ).start({
      inputData: { n: 1 },
    });
    expectTypeOf(result.steps).toBeFunction();
  });

  it('is the record where the version is left loose', () => {
    type AnyRunResult = Awaited<ReturnType<Awaited<ReturnType<AnyWorkflow['createRun']>>['start']>>;
    expectTypeOf<Extract<WorkflowResult<any, any, any, any>['steps'], Function>>().toBeNever();
    expectTypeOf<Extract<WorkflowResult<any, any, any, any, any>['steps'], Function>>().toBeNever();
    expectTypeOf<Extract<AnyRunResult['steps'], Function>>().toBeNever();
  });

  it('lets a storage v2 workflow go anywhere a workflow of any version goes', () => {
    const v2 = workflowOn(2);
    expectTypeOf(v2).toExtend<AnyWorkflow>();
    expectTypeOf(v2).toExtend<Workflow<any, any, any, any, any, any, any, any>>();
    new Mastra({ workflows: { v2, v1: workflowOn(1) } });
    createWorkflow({
      id: 'parent',
      inputSchema: z.object({ n: z.number() }),
      outputSchema: z.object({ n: z.number() }),
    })
      .then(v2)
      .commit();
  });
});
