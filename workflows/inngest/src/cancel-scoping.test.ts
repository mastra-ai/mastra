/**
 * A cancel event must only cancel the run it names.
 *
 * The Inngest function registered `cancelOn: [{ event: 'cancel.workflow.<id>' }]`
 * with no `match`, so the event cancelled every in-flight run of the function.
 * All durable agents share a single function, so cancelling one run tore down
 * every other run in the deployment — and only the targeted run's snapshot was
 * marked canceled, so the rest died silently.
 *
 * A cancel can also arrive after the run already finished (a retried or late
 * cancel event). It must leave the finished run's final status and results
 * untouched, while still cancelling a run that is live.
 */
import { Mastra } from '@mastra/core/mastra';
import { MockStore } from '@mastra/core/storage';
import type { WorkflowRunStatus } from '@mastra/core/workflows';
import { Inngest } from 'inngest';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { InngestExecutionEngine } from './execution-engine';
import { init } from './index';

function createFunctionConfigs(workflowId: string, opts: Record<string, unknown> = {}) {
  const inngest = new Inngest({ id: 'cancel-scoping-test' });
  const configs: any[] = [];
  vi.spyOn(inngest, 'createFunction').mockImplementation(((config: any, ...rest: any[]) => {
    configs.push(config);
    return { id: config.id, rest } as any;
  }) as any);

  const { createWorkflow, createStep } = init(inngest);
  const step = createStep({
    id: 'step1',
    inputSchema: z.object({ value: z.string() }),
    outputSchema: z.object({ value: z.string() }),
    execute: async ({ inputData }) => inputData,
  });
  const workflow = createWorkflow({
    id: workflowId,
    inputSchema: z.object({ value: z.string() }),
    outputSchema: z.object({ value: z.string() }),
    steps: [step],
    ...opts,
  } as any)
    .then(step)
    .commit();

  return { workflow: workflow as any, configs };
}

// Builds a workflow registered on a fresh Mastra with a real in-memory store,
// then creates a run so a snapshot exists to cancel.
async function createStoredRun(workflowId: string) {
  const inngest = new Inngest({ id: 'cancel-terminal-test' });
  const { createWorkflow, createStep } = init(inngest);
  const step = createStep({
    id: 'step1',
    inputSchema: z.object({ value: z.string() }),
    outputSchema: z.object({ value: z.string() }),
    execute: async ({ inputData }) => inputData,
  });
  const workflow = createWorkflow({
    id: workflowId,
    inputSchema: z.object({ value: z.string() }),
    outputSchema: z.object({ value: z.string() }),
    steps: [step],
  })
    .then(step)
    .commit();

  const store = new MockStore();
  const mastra = new Mastra({
    workflows: { [workflowId]: workflow as any },
    storage: store as any,
  });
  // The same workflows domain store `cancel()` reads and writes.
  const workflowsStore = (await mastra.getStorage()!.getStore('workflows'))!;

  const run = await workflow.createRun({ runId: `${workflowId}-run` });
  return { inngest, run, store: workflowsStore, workflowId };
}

// A distinctive payload so an overwrite is visible even if the status happened
// to survive, e.g. a write that kept the status but dropped the results.
const SEEDED_VALUE = { step: 'done' };
const SEEDED_RESULT = { value: 'done' };

// `createRun` persists a 'pending' snapshot; overwrite its status and payload to
// set up the state a late cancel would see.
async function seedSnapshot(
  store: MockStore['stores']['workflows'],
  workflowName: string,
  runId: string,
  status: WorkflowRunStatus,
) {
  const snapshot = await store.loadWorkflowSnapshot({ workflowName, runId });
  await store.persistWorkflowSnapshot({
    workflowName,
    runId,
    snapshot: { ...snapshot!, status, value: SEEDED_VALUE, result: SEEDED_RESULT },
  });
}

describe('inngest cancel event scoping', () => {
  it('scopes cancellation to the run named by the cancel event', () => {
    const { workflow, configs } = createFunctionConfigs('scoped-workflow');
    workflow.getFunction();

    const config = configs.find(c => c.id === 'workflow.scoped-workflow');
    expect(config).toBeDefined();
    expect(config.cancelOn).toEqual([{ event: 'cancel.workflow.scoped-workflow', match: 'data.runId' }]);
  });

  it('matches on the same field the run sends when cancelling', async () => {
    // `Run.cancel()` sends `{ name: 'cancel.workflow.<id>', data: { runId } }`,
    // so the match expression has to point at `data.runId` for Inngest to pair
    // the cancel event with the run's trigger event.
    const { workflow, configs } = createFunctionConfigs('field-workflow');
    workflow.getFunction();

    const config = configs.find(c => c.id === 'workflow.field-workflow');
    const [cancelOn] = config.cancelOn;
    expect(cancelOn.match).toBe('data.runId');
    expect(config.triggers).toEqual({ event: 'workflow.field-workflow' });
  });

  // `match: 'data.runId'` compares the cancel event against the *trigger* event,
  // so a run is only cancellable if its trigger named it. The run id generated
  // inside the function never reaches the trigger event, so these tests pin the
  // property the match expression depends on: the trigger carries the same run
  // id that `cancel()` later sends.
  it('names the run on the trigger event so the cancel event can pair with it', async () => {
    const inngest = new Inngest({ id: 'cancel-pairing-test' });
    const { createWorkflow, createStep } = init(inngest);

    const step = createStep({
      id: 's',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      execute: async ({ inputData }) => inputData,
    });
    const workflow = createWorkflow({
      id: 'pairing-workflow',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      steps: [step],
    })
      .then(step)
      .commit();

    const mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      workflows: { 'pairing-workflow': workflow as any },
    });
    workflow.__registerMastra(mastra);

    const run = await workflow.createRun();
    // start() awaits getRunOutput, which polls a live Inngest server.
    vi.spyOn(run as any, 'getRunOutput').mockResolvedValue({ output: { result: { status: 'success' } } });
    const sendSpy = vi.spyOn(inngest, 'send').mockResolvedValue({ ids: ['evt-1'] } as any);

    await run.start({ inputData: { value: 'ok' } });
    const trigger = sendSpy.mock.calls[0]![0] as any;

    sendSpy.mockClear();
    await run.cancel();
    const cancel = sendSpy.mock.calls[0]![0] as any;

    expect(trigger.name).toBe('workflow.pairing-workflow');
    expect(cancel.name).toBe('cancel.workflow.pairing-workflow');
    // The field named by `match` has to be present and equal on both events.
    expect(trigger.data.runId).toBe(run.runId);
    expect(cancel.data.runId).toBe(run.runId);
  });

  it('warns that a run triggered without a runId cannot be cancelled by id', async () => {
    const { workflow } = createFunctionConfigs('unnamed-run-workflow');
    const warn = vi.fn();
    (workflow as any).__setLogger({ warn, debug: vi.fn(), info: vi.fn(), error: vi.fn() });
    workflow.getFunction();

    // Drive the generated-runId branch through the registered handler.
    const registered = workflow.getFunction() as any;
    const fn = registered.rest[0];
    const step: any = {
      run: async (id: string, cb: () => Promise<any>) => {
        if (id.endsWith('.runIdGen')) return cb();
        throw new Error(`stop-after-runIdGen:${id}`);
      },
    };

    await expect(fn({ event: { data: { inputData: { value: 'x' } } }, step, attempt: 0 })).rejects.toThrow(
      /stop-after-runIdGen/,
    );

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('cannot be cancelled by id'));
  });

  // A nested workflow is invoked by the parent's execution engine, not by a user
  // sending an event. If that invoke omits `data.runId`, the child lands in the
  // unnamed-run branch: it warns advice nobody can act on, and `match` can never
  // pair a cancel event with it, so nested runs stop being cancellable at all.
  it('names the run when a parent invokes a nested workflow', async () => {
    const { workflow } = createFunctionConfigs('nested-child-workflow');
    const warn = vi.fn();
    (workflow as any).__setLogger({ warn, debug: vi.fn(), info: vi.fn(), error: vi.fn() });

    const registered = workflow.getFunction() as any;
    const fn = registered.rest[0];
    const step: any = {
      run: async (id: string, cb: () => Promise<any>) => {
        if (id.endsWith('.runIdGen')) return cb();
        throw new Error(`stop-after-runIdGen:${id}`);
      },
    };

    // Captured from the real engine rather than hand-copied, so this test still
    // reflects the payload if the invoke block changes.
    const nestedInvokeData = await captureNestedInvokeData(workflow);

    await expect(fn({ event: { data: nestedInvokeData }, step, attempt: 0 })).rejects.toThrow(/stop-after/);

    expect(nestedInvokeData.runId).toBeTruthy();
    expect(warn).not.toHaveBeenCalled();
  });
});

// A cancel event can arrive after the run already finished (Inngest retries, a
// client cancels late, a resume races a failure). The cancel must not rewrite a
// terminal snapshot back to `canceled`, but it must still cancel a live run.
describe('inngest cancel leaves terminal snapshots alone', () => {
  const TERMINAL = ['success', 'failed', 'canceled', 'tripwire', 'bailed'] as const;
  const LIVE = ['running', 'pending', 'waiting', 'suspended', 'paused', 'skipped'] as const;

  it.each(TERMINAL)('keeps a %s run as-is and sends no cancel event', async status => {
    const { inngest, run, store, workflowId } = await createStoredRun(`cancel-terminal-${status}`);
    await seedSnapshot(store, workflowId, run.runId, status);
    const sendSpy = vi.spyOn(inngest, 'send').mockResolvedValue({ ids: ['evt'] } as any);
    const persistSpy = vi.spyOn(store, 'persistWorkflowSnapshot');

    await run.cancel();

    const stored = await store.loadWorkflowSnapshot({ workflowName: workflowId, runId: run.runId });
    expect(stored?.status).toBe(status);
    expect(stored?.value).toEqual(SEEDED_VALUE);
    expect(stored?.result).toEqual(SEEDED_RESULT);
    expect(sendSpy).not.toHaveBeenCalled();
    expect(persistSpy).not.toHaveBeenCalled();
  });

  it.each(LIVE)('cancels a live %s run', async status => {
    const { inngest, run, store, workflowId } = await createStoredRun(`cancel-live-${status}`);
    await seedSnapshot(store, workflowId, run.runId, status);
    const sendSpy = vi.spyOn(inngest, 'send').mockResolvedValue({ ids: ['evt'] } as any);
    const persistSpy = vi.spyOn(store, 'persistWorkflowSnapshot');

    await run.cancel();

    const stored = await store.loadWorkflowSnapshot({ workflowName: workflowId, runId: run.runId });
    expect(stored?.status).toBe('canceled');
    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({ name: `cancel.workflow.${workflowId}`, data: { runId: run.runId } }),
    );
    // The write must list every nonterminal status, or cancellation would no-op
    // for the states it leaves out.
    expect(persistSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedStatus: expect.arrayContaining(['running', 'pending', 'waiting', 'suspended', 'paused', 'skipped']),
      }),
    );
  });

  // The run can finish between the terminal-status check and the write. The
  // compare-and-set is what keeps a finished run's snapshot from being rewritten.
  it('does not overwrite a snapshot that finished between the check and the write', async () => {
    const { inngest, run, store, workflowId } = await createStoredRun('cancel-race');
    await seedSnapshot(store, workflowId, run.runId, 'success');
    vi.spyOn(inngest, 'send').mockResolvedValue({ ids: ['evt'] } as any);

    // Report a live status to the caller while the stored row is already terminal,
    // so the early check passes and only the guarded write can save the snapshot.
    const realLoad = store.loadWorkflowSnapshot.bind(store);
    vi.spyOn(store, 'loadWorkflowSnapshot').mockImplementation(async args => {
      const snapshot = await realLoad(args);
      return snapshot ? { ...snapshot, status: 'running' } : snapshot;
    });
    const persistSpy = vi.spyOn(store, 'persistWorkflowSnapshot');

    await run.cancel();

    expect(persistSpy).toHaveBeenCalledWith(expect.objectContaining({ expectedStatus: expect.any(Array) }));
    // The guarded write was refused, so the terminal snapshot survives untouched.
    expect(await persistSpy.mock.results[0]!.value).toBe(false);
    const stored = await realLoad({ workflowName: workflowId, runId: run.runId });
    expect(stored?.status).toBe('success');
    expect(stored?.value).toEqual(SEEDED_VALUE);
    expect(stored?.result).toEqual(SEEDED_RESULT);
  });
});

/**
 * Runs the parent-side nested-workflow invoke and returns the `data` block it
 * hands to Inngest, driving the plain (non-resume, non-time-travel) branch.
 */
async function captureNestedInvokeData(childWorkflow: any): Promise<Record<string, any>> {
  let captured: Record<string, any> | undefined;
  const inngestStep: any = {
    invoke: async (_id: string, opts: any) => {
      captured = opts.data;
      return { result: { status: 'success', result: {}, state: {} }, runId: 'child-run' };
    },
    run: async (_id: string, cb: () => Promise<any>) => cb(),
  };

  const mastra = new Mastra({
    logger: false,
    storage: new MockStore(),
    workflows: { [childWorkflow.id]: childWorkflow },
  });
  childWorkflow.__registerMastra(mastra);

  const engine = new InngestExecutionEngine(mastra, inngestStep, 0, {} as any);
  await engine.executeWorkflowStep({
    step: childWorkflow,
    stepResults: {},
    executionContext: { workflowId: 'parent-workflow', runId: 'parent-run', state: {} } as any,
    prevOutput: {},
    inputData: { value: 'x' },
    pubsub: { publish: async () => {}, subscribe: async () => {}, flush: async () => {} } as any,
    startedAt: Date.now(),
  });

  if (!captured) throw new Error('nested invoke was never issued');
  return captured;
}
