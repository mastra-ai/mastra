/**
 * A cancel event must only cancel the run it names.
 *
 * The Inngest function registered `cancelOn: [{ event: 'cancel.workflow.<id>' }]`
 * with no `match`, so the event cancelled every in-flight run of the function.
 * All durable agents share a single function, so cancelling one run tore down
 * every other run in the deployment — and only the targeted run's snapshot was
 * marked canceled, so the rest died silently.
 */
import { Mastra } from '@mastra/core/mastra';
import { MockStore } from '@mastra/core/storage';
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
