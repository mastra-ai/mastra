/**
 * Regression for https://github.com/mastra-ai/mastra/issues/30774.
 *
 * A run that suspends and is never resumed must not stay in `workflow.runs` once
 * its suspension is persisted, unless something still watches it — on both engines.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { createWorkflow as createDefaultWorkflow } from '../create';
import { createStep as createDefaultStep } from '../workflow';
import { createStep as createEventedStep, createWorkflow as createEventedWorkflow } from '.';

const engines = [
  { engine: 'default', createWorkflow: createDefaultWorkflow, createStep: createDefaultStep, evented: false },
  { engine: 'evented', createWorkflow: createEventedWorkflow, createStep: createEventedStep, evented: true },
] as const;

describe.each(engines)('$engine engine: suspended run eviction', ({ createWorkflow, createStep, evented }) => {
  let mastra: Mastra | undefined;

  afterEach(async () => {
    if (evented) await mastra?.stopWorkers();
    mastra = undefined;
  });

  /** A resume waits in its resume-data validation until `validated()` resolves. */
  async function setup(validated: () => Promise<unknown> = async () => {}) {
    const approve = createStep({
      id: 'approve',
      inputSchema: z.object({}),
      outputSchema: z.object({ by: z.string() }),
      resumeSchema: z.object({ by: z.string() }).refine(async () => {
        await validated();
        return true;
      }),
      execute: async ({ resumeData, suspend }: any) =>
        resumeData && resumeData.by !== 'again' ? { by: resumeData.by } : suspend({}),
    });
    const workflow = createWorkflow({
      id: 'approval',
      inputSchema: z.object({}),
      outputSchema: z.object({ by: z.string() }),
    })
      .then(approve)
      .commit();
    mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      ...(evented ? { pubsub: new EventEmitterPubSub() } : {}),
      workflows: { approval: workflow },
    });
    if (evented) await mastra.startWorkers();
    // Wrapped: a workflow has a builder `.then()`, so awaiting it directly never settles.
    return { workflow: mastra.getWorkflow('approval') };
  }

  it('evicts a run once its suspension is persisted', async () => {
    const { workflow } = await setup();
    const run = await workflow.createRun();
    expect((await run.start({ inputData: {} })).status).toBe('suspended');

    await expect.poll(() => workflow.runs.has(run.runId)).toBe(false);

    const resumed = await (
      await workflow.createRun({ runId: run.runId })
    ).resume({
      step: 'approve',
      resumeData: { by: 'ana' },
    });
    expect(resumed.status).toBe('success');
  });

  it('evicts a run started in the background once its suspension is persisted', async () => {
    const { workflow } = await setup();
    const run = await workflow.createRun();
    await run.startAsync({ inputData: {} });

    await expect.poll(async () => (await workflow.getWorkflowRunById(run.runId))?.status).toBe('suspended');
    await expect.poll(() => workflow.runs.has(run.runId)).toBe(false);
  });

  it('keeps a watched suspended run until its last watcher leaves', async () => {
    const { workflow } = await setup();
    const run = await workflow.createRun();
    const unwatch = run.watch(() => {});
    expect((await run.start({ inputData: {} })).status).toBe('suspended');
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(workflow.runs.has(run.runId)).toBe(true);

    unwatch();
    await expect.poll(() => workflow.runs.has(run.runId)).toBe(false);
  });

  it('keeps a run whose last watcher leaves while a resume of it is setting up', async () => {
    let validate!: () => void;
    const gate = new Promise<void>(resolve => (validate = resolve));
    const { workflow } = await setup(() => gate);
    const run = await workflow.createRun();
    const unwatch = run.watch(() => {});
    expect((await run.start({ inputData: {} })).status).toBe('suspended');

    const resumed = run.resume({ step: 'approve', resumeData: { by: 'ana' } });
    unwatch();
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(workflow.runs.get(run.runId)).toBe(run);

    validate();
    expect((await resumed).status).toBe('success');
  });

  it('evicts a run once a resume of a step that is not suspended is rejected', async () => {
    const { workflow } = await setup();
    const run = await workflow.createRun();
    const unwatch = run.watch(() => {});
    expect((await run.start({ inputData: {} })).status).toBe('suspended');

    await expect(run.resume({ step: 'missing', resumeData: { by: 'ana' } })).rejects.toThrow();
    unwatch();
    await expect.poll(() => workflow.runs.has(run.runId)).toBe(false);
  });

  it('evicts a run once a resume with invalid resume data is rejected', async () => {
    const { workflow } = await setup();
    const run = await workflow.createRun();
    const unwatch = run.watch(() => {});
    expect((await run.start({ inputData: {} })).status).toBe('suspended');

    await expect(run.resume({ step: 'approve', resumeData: { by: 1 } as any })).rejects.toThrow();
    unwatch();
    await expect.poll(() => workflow.runs.has(run.runId)).toBe(false);
  });

  it('keeps a run whose resume is setting up while another resume of it is rejected', async () => {
    let validate!: () => void;
    const gate = new Promise<void>(resolve => (validate = resolve));
    const { workflow } = await setup(() => gate);
    const run = await workflow.createRun();
    const unwatch = run.watch(() => {});
    expect((await run.start({ inputData: {} })).status).toBe('suspended');

    const resumed = run.resume({ step: 'approve', resumeData: { by: 'ana' } });
    await expect(run.resume({ step: 'missing', resumeData: { by: 'bo' } })).rejects.toThrow();
    unwatch();
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(workflow.runs.get(run.runId)).toBe(run);

    validate();
    expect((await resumed).status).toBe('success');
    await expect.poll(() => workflow.runs.has(run.runId)).toBe(false);
  });

  it('releases a run by the status its executions leave when their results arrive out of order', async () => {
    let validate!: () => void;
    let gate: Promise<void> | undefined = new Promise<void>(resolve => (validate = resolve));
    const { workflow } = await setup(async () => gate);
    const run = await workflow.createRun();
    expect((await run.start({ inputData: {} })).status).toBe('suspended');

    // The older resume waits in validation while a newer one suspends the run again.
    const older = run.resume({ step: 'approve', resumeData: { by: 'ana' } });
    await new Promise(resolve => setTimeout(resolve, 20));
    gate = undefined;
    expect((await run.resume({ step: 'approve', resumeData: { by: 'again' } })).status).toBe('suspended');

    validate();
    expect((await older).status).toBe('success');
    await expect.poll(() => workflow.runs.has(run.runId)).toBe(false);
  });

  it('evicts a run started in the background when a resume rejected meanwhile', async () => {
    const { workflow } = await setup();
    const run = await workflow.createRun();
    await run.startAsync({ inputData: {} });
    await expect(run.resume({ step: 'missing', resumeData: { by: 'ana' } })).rejects.toThrow();

    await expect.poll(async () => (await workflow.getWorkflowRunById(run.runId))?.status).toBe('suspended');
    await expect.poll(() => workflow.runs.has(run.runId)).toBe(false);
  });

  it('releases a finished run when an older execution reports its suspension after the finish', async () => {
    const { workflow } = await setup();
    const run = await workflow.createRun();
    expect((await run.start({ inputData: {} })).status).toBe('suspended');

    // Stands in for an evented background start whose result arrives after a newer resume finished.
    let report!: () => void;
    const reported = new Promise<void>(resolve => (report = resolve));
    const stale = run as unknown as {
      runExecution(
        execute: (epoch: number, holdUntil: (work: Promise<unknown>) => void) => Promise<void>,
      ): Promise<void>;
      releaseAfterExecution(status: 'suspended', epoch: number): Promise<void>;
    };
    await stale.runExecution(async (epoch, holdUntil) => {
      holdUntil(reported.then(() => stale.releaseAfterExecution('suspended', epoch)));
    });

    expect((await run.resume({ step: 'approve', resumeData: { by: 'ana' } })).status).toBe('success');
    report();
    await expect.poll(() => workflow.runs.has(run.runId)).toBe(false);
  });

  it('releases a run canceled while an execution of it later reports a suspension', async () => {
    const { workflow } = await setup();
    const run = await workflow.createRun();
    expect((await run.start({ inputData: {} })).status).toBe('suspended');

    let report!: () => void;
    const reported = new Promise<void>(resolve => (report = resolve));
    const stale = run as unknown as {
      runExecution(
        execute: (epoch: number, holdUntil: (work: Promise<unknown>) => void) => Promise<void>,
      ): Promise<void>;
      releaseAfterExecution(status: 'suspended', epoch: number): Promise<void>;
    };
    await stale.runExecution(async (epoch, holdUntil) => {
      holdUntil(reported.then(() => stale.releaseAfterExecution('suspended', epoch)));
    });

    await run.cancel();
    report();
    await expect.poll(() => workflow.runs.has(run.runId)).toBe(false);
  });
});
