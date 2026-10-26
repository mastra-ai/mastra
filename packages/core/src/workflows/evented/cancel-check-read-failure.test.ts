import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../events/event-emitter';
import type { PubSub } from '../../events/pubsub';
import { UnixSocketPubSub } from '../../events/unix-socket-pubsub';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { WorkflowEventProcessor } from './workflow-event-processor';
import { createStep, createWorkflow } from '.';

// Before a step runs, the processor re-reads the persisted status of the step's
// run (and its ancestors) to catch a cancel whose broadcast it could not hear.
// A failed read must not be treated as "not cancelled": the step event is
// retried, and if the read keeps failing the run settles as failed.
const transports: Array<[string, () => Promise<{ pubsub: PubSub; close: () => Promise<void> }>]> = [
  ['EventEmitterPubSub', async () => ({ pubsub: new EventEmitterPubSub(), close: async () => {} })],
  [
    'UnixSocketPubSub',
    async () => {
      const dir = await mkdtemp(join(tmpdir(), 'mastra-cancel-read-'));
      const pubsub = new UnixSocketPubSub(join(dir, 'events.sock'));
      return {
        pubsub,
        close: async () => {
          await pubsub.close();
          await rm(dir, { recursive: true, force: true });
        },
      };
    },
  ],
];

describe.each(transports)('evented workflow: pre-step cancel check read failure (%s)', (_name, makeTransport) => {
  const cleanups: Array<() => Promise<void>> = [];
  afterEach(async () => {
    vi.restoreAllMocks();
    for (const fn of cleanups.splice(0).reverse()) await fn().catch(() => {});
  });

  async function run(failingReads: number) {
    const { pubsub, close } = await makeTransport();
    cleanups.push(close);
    const id = `cancel-read-${Math.random().toString(36).slice(2)}`;
    let executions = 0;
    const step = createStep({
      id: 'work',
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.boolean() }),
      execute: async () => {
        executions++;
        return { ok: true };
      },
    });
    const workflow = createWorkflow({ id, inputSchema: z.object({}), outputSchema: z.object({ ok: z.boolean() }) })
      .then(step)
      .commit();
    const mastra = new Mastra({ workflows: { [id]: workflow }, storage: new MockStore(), pubsub, logger: false });

    // Storage wrapper: snapshot reads throw while `armed` is set. Only the
    // pre-step cancel check arms it, so other reads (dispatch guard, step
    // results, finalization) are unaffected.
    const workflowsStore = (await mastra.getStorage()!.getStore('workflows'))!;
    const load = workflowsStore.loadWorkflowSnapshot.bind(workflowsStore);
    let armed = false;
    let failed = 0;
    vi.spyOn(workflowsStore, 'loadWorkflowSnapshot').mockImplementation(async args => {
      if (armed && failed < failingReads) {
        failed++;
        throw new Error('storage unavailable');
      }
      return load(args);
    });
    const proto = WorkflowEventProcessor.prototype as any;
    const check = proto.abortRunsCanceledInStorage;
    vi.spyOn(proto, 'abortRunsCanceledInStorage').mockImplementation(async function (this: any, ...args: any[]) {
      armed = true;
      try {
        return await check.apply(this, args);
      } finally {
        armed = false;
      }
    });
    const stepRunResults: Array<{ ok: boolean; retry?: boolean }> = [];
    const handle = proto.handle;
    vi.spyOn(proto, 'handle').mockImplementation(async function (this: any, event: any) {
      const result = await handle.call(this, event);
      if (event?.type === 'workflow.step.run' && event.runId === wfRun.runId) stepRunResults.push(result);
      return result;
    });

    await mastra.startWorkers();
    cleanups.push(() => mastra.stopWorkers());

    const wfRun = await workflow.createRun();
    const result = await Promise.race([
      wfRun.start({ inputData: {} }),
      new Promise<'HANG'>(resolve => setTimeout(() => resolve('HANG'), 5000)),
    ]);
    const stored = await workflowsStore.loadWorkflowSnapshot({ workflowName: id, runId: wfRun.runId });
    return { result, stored, executions, failed, stepRunResults };
  }

  it('retries the step event when the read fails, then runs the step once reads succeed', async () => {
    const { result, executions, failed, stepRunResults } = await run(2);
    expect(failed).toBe(2);
    await vi.waitFor(() => expect(stepRunResults).toHaveLength(3));
    expect(stepRunResults).toEqual([{ ok: false, retry: true }, { ok: false, retry: true }, { ok: true }]);
    expect(result).not.toBe('HANG');
    expect((result as any).status).toBe('success');
    expect(executions).toBe(1);
  });

  it('fails the run without running the step when the read keeps failing', async () => {
    const { result, stored, executions, stepRunResults } = await run(Number.POSITIVE_INFINITY);
    // workflow.fail is published inside the last delivery's handle(), so the
    // run can settle before that call returns.
    await vi.waitFor(() => expect(stepRunResults).toHaveLength(3));
    expect(stepRunResults).toEqual([
      { ok: false, retry: true },
      { ok: false, retry: true },
      { ok: false, retry: false },
    ]);
    expect(result).not.toBe('HANG');
    expect((result as any).status).toBe('failed');
    expect((result as any).error?.message).toContain('storage unavailable');
    expect(stored?.status).toBe('failed');
    expect(executions).toBe(0);
  });
});
