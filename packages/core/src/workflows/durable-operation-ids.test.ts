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

/** Records every durable operation id: wrapped operations plus child span start/end/error. */
function recordAllOperationIds() {
  const ids: string[] = [];
  vi.spyOn(DefaultExecutionEngine.prototype, 'wrapDurableOperation').mockImplementation(async function (
    this: DefaultExecutionEngine,
    operationId: string,
    operationFn: () => any,
  ) {
    ids.push(operationId);
    return operationFn();
  } as any);
  for (const method of ['createChildSpan', 'endChildSpan', 'errorChildSpan'] as const) {
    const original = DefaultExecutionEngine.prototype[method] as (...args: any[]) => any;
    vi.spyOn(DefaultExecutionEngine.prototype, method).mockImplementation(function (
      this: DefaultExecutionEngine,
      params: { operationId: string },
      ...rest: any[]
    ) {
      ids.push(params.operationId);
      return original.call(this, params, ...rest);
    } as any);
  }
  return {
    take() {
      const taken = [...ids];
      ids.length = 0;
      return taken;
    },
  };
}

const incStep = () =>
  createStep({
    id: 'inc',
    inputSchema: ioSchema,
    outputSchema: ioSchema,
    execute: async ({ inputData }) => ({ n: inputData.n + 1 }),
  });

describe('durable operation ids — repeated occurrences (issue #24044)', () => {
  it.each(['dountil', 'dowhile'] as const)('emits unique ids across %s iterations', async loopType => {
    const recorder = recordAllOperationIds();
    const builder = createWorkflow({ id: `occ-${loopType}-wf`, inputSchema: ioSchema, outputSchema: ioSchema });
    const workflow = (
      loopType === 'dountil'
        ? builder.dountil(incStep(), async ({ inputData }) => inputData.n >= 3)
        : builder.dowhile(incStep(), async ({ inputData }) => inputData.n < 3)
    ).commit();
    new Mastra({ logger: false, storage: new MockStore(), workflows: { [`occ-${loopType}-wf`]: workflow } });

    const result = await (await workflow.createRun()).start({ inputData: { n: 0 } });
    expect(result.status).toBe('success');

    const ids = recorder.take();
    expect(ids.some(id => id.includes('.iter.3'))).toBe(true);
    expect(duplicatesOf(ids)).toEqual([]);
  });

  it('keeps legacy ids for the first loop iteration and one-shot steps', async () => {
    const recorder = recordAllOperationIds();
    const workflow = createWorkflow({ id: 'occ-legacy-wf', inputSchema: ioSchema, outputSchema: ioSchema })
      .dountil(incStep(), async ({ inputData }) => inputData.n >= 1)
      .commit();
    new Mastra({ logger: false, storage: new MockStore(), workflows: { 'occ-legacy-wf': workflow } });

    await (await workflow.createRun()).start({ inputData: { n: 0 } });
    const ids = recorder.take();
    expect(ids.some(id => /\.step\.inc\.running_ev$/.test(id))).toBe(true);
    expect(ids.filter(id => id.includes('.iter.') || id.includes('.fe.'))).toEqual([]);
  });

  it.each([1, 3])('emits unique ids across foreach items (concurrency %i)', async concurrency => {
    const recorder = recordAllOperationIds();
    const workflow = createWorkflow({
      id: `occ-foreach-${concurrency}-wf`,
      inputSchema: z.array(ioSchema),
      outputSchema: z.array(ioSchema),
    })
      .foreach(incStep(), { concurrency })
      .commit();
    new Mastra({ logger: false, storage: new MockStore(), workflows: { [`occ-foreach-${concurrency}-wf`]: workflow } });

    const result = await (await workflow.createRun()).start({ inputData: [{ n: 0 }, { n: 1 }, { n: 2 }] });
    expect(result.status).toBe('success');
    expect(duplicatesOf(recorder.take())).toEqual([]);
  });

  it('emits unique ids across suspend and resume inside a dountil loop', async () => {
    const recorder = recordAllOperationIds();
    const gated = createStep({
      id: 'gated',
      inputSchema: ioSchema,
      outputSchema: ioSchema,
      resumeSchema: z.object({ ok: z.boolean() }),
      execute: async ({ inputData, resumeData, suspend }) => {
        if (inputData.n === 1 && !resumeData) {
          await suspend({});
          return { n: inputData.n };
        }
        return { n: inputData.n + 1 };
      },
    });
    const workflow = createWorkflow({ id: 'occ-loop-resume-wf', inputSchema: ioSchema, outputSchema: ioSchema })
      .dountil(gated, async ({ inputData }) => inputData.n >= 3)
      .commit();
    new Mastra({ logger: false, storage: new MockStore(), workflows: { 'occ-loop-resume-wf': workflow } });

    const run = await workflow.createRun();
    expect((await run.start({ inputData: { n: 0 } })).status).toBe('suspended');
    const suspendIds = recorder.take();
    expect(duplicatesOf(suspendIds)).toEqual([]);

    expect((await run.resume({ step: 'gated', resumeData: { ok: true } })).status).toBe('success');
    const resumeIds = recorder.take();
    expect(duplicatesOf(resumeIds)).toEqual([]);

    // Across legs, only the re-entered loop container, the suspended occurrence (iteration 2)
    // and the entry completion repeat; every other occurrence gets ids the first leg never used.
    const shared = suspendIds.filter(id => resumeIds.includes(id));
    expect(
      shared.filter(
        id => !id.includes('.iter.2') && !id.endsWith('.stepUpdate.entry-end') && !id.endsWith('.loop.0.span.start'),
      ),
    ).toEqual([]);
    expect(resumeIds.some(id => id.includes('.iter.3'))).toBe(true);
  });

  it('emits unique ids for a nested workflow used as a dountil body', async () => {
    const recorder = recordAllOperationIds();
    const child = createWorkflow({ id: 'occ-loop-child', inputSchema: ioSchema, outputSchema: ioSchema })
      .dountil(incStep(), async ({ inputData }) => inputData.n % 2 === 0)
      .commit();
    const workflow = createWorkflow({ id: 'occ-loop-parent', inputSchema: ioSchema, outputSchema: ioSchema })
      .dountil(child, async ({ inputData }) => inputData.n >= 6)
      .commit();
    new Mastra({ logger: false, storage: new MockStore(), workflows: { 'occ-loop-parent': workflow } });

    const result = await (await workflow.createRun()).start({ inputData: { n: 0 } });
    expect(result.status).toBe('success');
    const ids = recorder.take();
    expect(ids.some(id => id.includes('-iter-2.'))).toBe(true);
    // The legacy one-shot retry id carries no run id; each child run is its own
    // memoization scope (an invoked function on Inngest), so it may repeat across them.
    expect(duplicatesOf(ids.filter(id => id !== 'workflow.occ-loop-child.step.inc'))).toEqual([]);
  });

  it('emits unique ids for a foreach nested inside a foreach item workflow', async () => {
    const recorder = recordAllOperationIds();
    const child = createWorkflow({ id: 'occ-fe-child', inputSchema: z.array(ioSchema), outputSchema: z.array(ioSchema) })
      .foreach(incStep())
      .commit();
    const workflow = createWorkflow({
      id: 'occ-fe-parent',
      inputSchema: z.array(z.array(ioSchema)),
      outputSchema: z.array(z.array(ioSchema)),
    })
      .foreach(child)
      .commit();
    new Mastra({ logger: false, storage: new MockStore(), workflows: { 'occ-fe-parent': workflow } });

    const result = await (await workflow.createRun()).start({
      inputData: [
        [{ n: 0 }, { n: 1 }],
        [{ n: 0 }, { n: 1 }],
      ],
    });
    expect(result.status).toBe('success');
    expect(duplicatesOf(recorder.take())).toEqual([]);
  });
});
