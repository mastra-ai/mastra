/**
 * Regression test for issue #21639.
 *
 * `persistStepUpdate` derives its durable-operation id from the run id and the
 * current execution path, with an optional `phase` suffix. Replay engines
 * (`@mastra/inngest`) feed that id straight into `step.run`, so two persists
 * on the same execution path within one function execution produce duplicate
 * step ids and trigger Inngest's `AUTOMATIC_PARALLEL_INDEXING` warning.
 *
 * Every `persistStepUpdate` call site must therefore carry a distinct phase.
 * These tests record the operation ids passed to `wrapDurableOperation` during
 * a single execution and assert they are unique.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createWorkflow } from './create';
import { DefaultExecutionEngine } from './default';
import { createStep } from './workflow';

function recordOperationIds() {
  const ids: string[] = [];
  const spy = vi.spyOn(DefaultExecutionEngine.prototype, 'wrapDurableOperation').mockImplementation(async function (
    this: DefaultExecutionEngine,
    operationId: string,
    operationFn: () => any,
  ) {
    ids.push(operationId);
    return operationFn();
  } as any);

  return {
    spy,
    /** Every durable operation id recorded since the last take, then reset. */
    takeAll() {
      const all = [...ids];
      ids.length = 0;
      return all;
    },
    /** Step-update ids recorded since the last take, then reset. */
    take() {
      const stepUpdateIds = ids.filter(id => id.includes('.stepUpdate'));
      ids.length = 0;
      return stepUpdateIds;
    },
  };
}

function duplicatesOf(ids: string[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) dupes.add(id);
    seen.add(id);
  }
  return [...dupes];
}

const ioSchema = z.object({ n: z.number() });

const firstStep = () =>
  createStep({
    id: 'first',
    inputSchema: ioSchema,
    outputSchema: ioSchema,
    execute: async ({ inputData }) => ({ n: inputData.n + 1 }),
  });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('durable operation ids — persistStepUpdate (issue #21639)', () => {
  it('emits unique stepUpdate operation ids across suspend and resume executions', async () => {
    const recorder = recordOperationIds();

    const second = createStep({
      id: 'second',
      inputSchema: ioSchema,
      outputSchema: ioSchema,
      resumeSchema: z.object({ approved: z.boolean() }),
      execute: async ({ inputData, resumeData, suspend }) => {
        if (!resumeData) {
          await suspend({});
          return { n: inputData.n };
        }
        return { n: inputData.n + 1 };
      },
    });

    const workflow = createWorkflow({
      id: 'dup-op-id-suspend-wf',
      inputSchema: ioSchema,
      outputSchema: ioSchema,
    })
      .then(firstStep())
      .then(second)
      .commit();

    const storage = new MockStore();
    new Mastra({ logger: false, storage, workflows: { 'dup-op-id-suspend-wf': workflow } });

    const run = await workflow.createRun();

    const suspended = await run.start({ inputData: { n: 0 } });
    expect(suspended.status).toBe('suspended');

    const suspendIds = recorder.take();
    expect(suspendIds.length).toBeGreaterThan(0);
    expect(duplicatesOf(suspendIds)).toEqual([]);

    const resumed = await run.resume({ step: 'second', resumeData: { approved: true } });
    expect(resumed.status).toBe('success');

    const resumeIds = recorder.take();
    expect(resumeIds.length).toBeGreaterThan(0);
    expect(duplicatesOf(resumeIds)).toEqual([]);
  });

  it('emits unique stepUpdate operation ids for a fully successful run', async () => {
    const recorder = recordOperationIds();

    const second = createStep({
      id: 'second',
      inputSchema: ioSchema,
      outputSchema: ioSchema,
      execute: async ({ inputData }) => ({ n: inputData.n + 1 }),
    });

    const workflow = createWorkflow({
      id: 'dup-op-id-success-wf',
      inputSchema: ioSchema,
      outputSchema: ioSchema,
    })
      .then(firstStep())
      .then(second)
      .commit();

    const storage = new MockStore();
    new Mastra({ logger: false, storage, workflows: { 'dup-op-id-success-wf': workflow } });

    const run = await workflow.createRun();
    const result = await run.start({ inputData: { n: 0 } });
    expect(result.status).toBe('success');

    const ids = recorder.take();
    expect(ids.length).toBeGreaterThan(0);
    expect(duplicatesOf(ids)).toEqual([]);
  });

  it('emits unique stepUpdate operation ids for a run containing a sleep', async () => {
    const recorder = recordOperationIds();

    const last = createStep({
      id: 'last',
      inputSchema: ioSchema,
      outputSchema: ioSchema,
      execute: async ({ inputData }) => ({ n: inputData.n + 1 }),
    });

    const workflow = createWorkflow({
      id: 'dup-op-id-sleep-wf',
      inputSchema: ioSchema,
      outputSchema: ioSchema,
    })
      .sleep(1)
      .then(last)
      .commit();

    const storage = new MockStore();
    new Mastra({ logger: false, storage, workflows: { 'dup-op-id-sleep-wf': workflow } });

    const run = await workflow.createRun();
    const result = await run.start({ inputData: { n: 0 } });
    expect(result.status).toBe('success');

    const ids = recorder.take();
    expect(ids.length).toBeGreaterThan(0);
    expect(duplicatesOf(ids)).toEqual([]);
  });
});

describe('durable operation ids — loops and foreach', () => {
  it('gives every dountil iteration its own step operation ids', async () => {
    const recorder = recordOperationIds();
    const executions: number[] = [];
    const increment = createStep({
      id: 'increment',
      inputSchema: ioSchema,
      outputSchema: ioSchema,
      execute: async ({ inputData }) => {
        executions.push(inputData.n);
        return { n: inputData.n + 1 };
      },
    });
    const workflow = createWorkflow({ id: 'loop-op-id-wf', inputSchema: ioSchema, outputSchema: ioSchema })
      .dountil(increment, async ({ inputData }) => inputData.n >= 3)
      .commit();
    new Mastra({ logger: false, storage: new MockStore(), workflows: { 'loop-op-id-wf': workflow } });

    const run = await workflow.createRun({ runId: 'loop-run' });
    const result = await run.start({ inputData: { n: 0 } });

    expect(result.status).toBe('success');
    expect(executions).toEqual([0, 1, 2]);
    const ids = recorder.takeAll();
    expect(duplicatesOf(ids)).toEqual([]);
    expect(ids).toContain('workflow.loop-op-id-wf.run.loop-run.step.increment.running_ev');
    expect(ids).toContain('workflow.loop-op-id-wf.run.loop-run.path.[0].iteration.2.step.increment.running_ev');
    expect(ids).toContain('workflow.loop-op-id-wf.run.loop-run.path.[0].iteration.3.stepUpdate.start');
  });

  it('gives every foreach item its own step operation ids', async () => {
    const recorder = recordOperationIds();
    const double = createStep({
      id: 'double',
      inputSchema: z.number(),
      outputSchema: z.number(),
      execute: async ({ inputData }) => inputData * 2,
    });
    const workflow = createWorkflow({
      id: 'foreach-op-id-wf',
      inputSchema: z.array(z.number()),
      outputSchema: z.array(z.number()),
    })
      .foreach(double, { concurrency: 3 })
      .commit();
    new Mastra({ logger: false, storage: new MockStore(), workflows: { 'foreach-op-id-wf': workflow } });

    const run = await workflow.createRun({ runId: 'foreach-run' });
    const result = await run.start({ inputData: [1, 2, 3] });

    expect(result.status).toBe('success');
    const ids = recorder.takeAll();
    expect(duplicatesOf(ids)).toEqual([]);
    expect(ids).toContain('workflow.foreach-op-id-wf.run.foreach-run.path.[0].stepUpdate.start');
    expect(ids).toContain('workflow.foreach-op-id-wf.run.foreach-run.path.[0].foreach.2.stepUpdate.start');
  });
});
