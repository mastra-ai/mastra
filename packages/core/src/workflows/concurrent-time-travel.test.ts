import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createWorkflow } from './create';
import { createStep } from './workflow';

/**
 * Concurrent time travel on a single run must execute the target step exactly once.
 *
 * Two callers can both load the same non-running snapshot before either of them starts
 * executing, because the execution engine does not persist `running` until the target step
 * begins. Without an atomic claim both callers enter the engine and the step runs twice.
 *
 * See https://github.com/mastra-ai/mastra/issues/27279.
 */
describe('concurrent time travel', () => {
  /**
   * Builds `work -> finish`, where `finish` either suspends or completes.
   *
   * Once `block()` is called, `work` parks on a gate so both time-travel calls are in flight at
   * the same time. This makes the race deterministic instead of timing-dependent.
   */
  function createHarness({ suspendAtEnd }: { suspendAtEnd: boolean }) {
    let workExecutions = 0;
    let gate: Promise<void> | undefined;
    let openGate!: () => void;
    let workStarted!: () => void;
    let workHasStarted!: Promise<void>;

    const block = () => {
      gate = new Promise<void>(resolve => {
        openGate = resolve;
      });
      workHasStarted = new Promise<void>(resolve => {
        workStarted = resolve;
      });
      return {
        started: () => workHasStarted,
        release: () => openGate(),
      };
    };

    const workStep = createStep({
      id: 'work',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      execute: async () => {
        workExecutions++;
        if (gate) {
          workStarted();
          await gate;
        }
        return {};
      },
    });

    const finishStep = createStep({
      id: 'finish',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      resumeSchema: z.object({ ok: z.boolean() }),
      execute: async ({ resumeData, suspend }) => {
        if (suspendAtEnd && !resumeData) {
          await suspend({});
        }
        return {};
      },
    });

    const workflow = createWorkflow({
      id: 'concurrent-time-travel-wf',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      steps: [workStep, finishStep],
      options: { validateInputs: false },
    })
      .then(workStep)
      .then(finishStep)
      .commit();

    return {
      workflow,
      block,
      getWorkExecutions: () => workExecutions,
      resetWorkExecutions: () => {
        workExecutions = 0;
      },
    };
  }

  async function startRun(harness: ReturnType<typeof createHarness>, storage = new MockStore()) {
    const mastra = new Mastra({
      storage,
      workflows: { 'concurrent-time-travel-wf': harness.workflow },
      logger: false,
    });
    void mastra;

    const run = await harness.workflow.createRun();
    const started = await run.start({ inputData: {} });
    harness.resetWorkExecutions();
    return { run, started, storage };
  }

  /**
   * Issues two timeTravel() calls on separate Run instances for the same runId.
   *
   * `simultaneous` fires both in the same tick, so both read the pre-claim snapshot and the
   * compare-and-set decides the winner. Otherwise the second call is issued while the first is
   * already executing the target step, which is what two separate HTTP requests look like.
   */
  async function raceTimeTravel(harness: ReturnType<typeof createHarness>, runId: string, simultaneous: boolean) {
    const gate = harness.block();
    const first = await harness.workflow.createRun({ runId });
    const second = await harness.workflow.createRun({ runId });

    const inFlight = [first.timeTravel({ step: 'work', inputData: {} })];
    if (simultaneous) {
      inFlight.push(second.timeTravel({ step: 'work', inputData: {} }));
      await gate.started();
    } else {
      await gate.started();
      inFlight.push(second.timeTravel({ step: 'work', inputData: {} }));
    }

    // Let the losing call settle before the winner finishes. Without the claim the second call
    // parks on the gate too, so bound the wait instead of deadlocking.
    await Promise.race([Promise.allSettled([inFlight[1]]), new Promise(resolve => setTimeout(resolve, 200))]);
    gate.release();

    return Promise.allSettled(inFlight);
  }

  function expectOneWinner(results: PromiseSettledResult<any>[], loserId: string) {
    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason.id).toBe(loserId);
    return (fulfilled[0] as PromiseFulfilledResult<any>).value;
  }

  it('runs the target step once when two timeTravel() calls race on a suspended run', async () => {
    const harness = createHarness({ suspendAtEnd: true });
    const { run, started } = await startRun(harness);
    expect(started.status).toBe('suspended');

    const results = await raceTimeTravel(harness, run.runId, true);

    expect(harness.getWorkExecutions()).toBe(1);
    expect(expectOneWinner(results, 'WORKFLOW_TIME_TRAVEL_ALREADY_CLAIMED').status).toBe('suspended');
    expect((results.find(r => r.status === 'rejected') as PromiseRejectedResult).reason.message).toContain(
      'already claimed by another caller',
    );
  });

  it('runs the target step once when two timeTravel() calls race on a finished run', async () => {
    const harness = createHarness({ suspendAtEnd: false });
    const { run, started } = await startRun(harness);
    expect(started.status).toBe('success');

    const results = await raceTimeTravel(harness, run.runId, true);

    expect(harness.getWorkExecutions()).toBe(1);
    expect(expectOneWinner(results, 'WORKFLOW_TIME_TRAVEL_ALREADY_CLAIMED').status).toBe('success');
  });

  it('rejects a timeTravel() issued while an earlier one is still executing', async () => {
    const harness = createHarness({ suspendAtEnd: true });
    const { run } = await startRun(harness);

    const results = await raceTimeTravel(harness, run.runId, false);

    expect(harness.getWorkExecutions()).toBe(1);
    expect(expectOneWinner(results, 'WORKFLOW_TIME_TRAVEL_RUN_RUNNING').status).toBe('suspended');
  });

  it('allows a second timeTravel() once the first one has finished', async () => {
    const harness = createHarness({ suspendAtEnd: true });
    const { run } = await startRun(harness);

    expect((await run.timeTravel({ step: 'work', inputData: {} })).status).toBe('suspended');
    expect((await run.timeTravel({ step: 'work', inputData: {} })).status).toBe('suspended');
    expect(harness.getWorkExecutions()).toBe(2);
  });

  it('still time travels on stores that cannot claim, without calling updateWorkflowState', async () => {
    const harness = createHarness({ suspendAtEnd: true });
    const storage = new MockStore();
    const workflowsStore = storage.stores.workflows as any;
    vi.spyOn(workflowsStore, 'supportsConcurrentUpdates').mockReturnValue(false);
    const updateSpy = vi.spyOn(workflowsStore, 'updateWorkflowState').mockImplementation(() => {
      throw new Error('updateWorkflowState is not implemented for Cloudflare D1 storage.');
    });

    const { run } = await startRun(harness, storage);
    const result = await run.timeTravel({ step: 'work', inputData: {} });

    expect(result.status).toBe('suspended');
    expect(harness.getWorkExecutions()).toBe(1);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('releases the claim when the engine fails before executing anything', async () => {
    const harness = createHarness({ suspendAtEnd: true });
    const { run, storage } = await startRun(harness);

    const executeSpy = vi
      .spyOn((run as any).executionEngine, 'execute')
      .mockRejectedValueOnce(new Error('engine boom'));

    await expect(run.timeTravel({ step: 'work', inputData: {} })).rejects.toThrow('engine boom');
    executeSpy.mockRestore();

    const snapshot = await (await storage.getStore('workflows'))!.loadWorkflowSnapshot({
      workflowName: 'concurrent-time-travel-wf',
      runId: run.runId,
    });
    expect(snapshot?.status).toBe('suspended');

    const retried = await run.timeTravel({ step: 'work', inputData: {} });
    expect(retried.status).toBe('suspended');
    expect(harness.getWorkExecutions()).toBe(1);
  });
  it('keeps the claim when the engine fails after it already started tracking the run', async () => {
    const harness = createHarness({ suspendAtEnd: true });
    const { run, storage } = await startRun(harness);
    const workflowsStore = (await storage.getStore('workflows'))!;

    const executeSpy = vi.spyOn((run as any).executionEngine, 'execute').mockImplementationOnce(async () => {
      const current = await workflowsStore.loadWorkflowSnapshot({
        workflowName: 'concurrent-time-travel-wf',
        runId: run.runId,
      });
      await workflowsStore.persistWorkflowSnapshot({
        workflowName: 'concurrent-time-travel-wf',
        runId: run.runId,
        snapshot: { ...current!, activePaths: [0], activeStepsPath: { work: [0] } },
      });
      throw new Error('engine boom');
    });

    await expect(run.timeTravel({ step: 'work', inputData: {} })).rejects.toThrow('engine boom');
    executeSpy.mockRestore();

    const snapshot = await workflowsStore.loadWorkflowSnapshot({
      workflowName: 'concurrent-time-travel-wf',
      runId: run.runId,
    });
    expect(snapshot?.status).toBe('running');
  });
});
