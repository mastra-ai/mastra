import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createWorkflow } from './create';
import { createStep } from './workflow';

/**
 * Concurrent resume of a single suspension must run downstream steps exactly once.
 *
 * Two callers can both load the same `suspended` snapshot before either of them starts
 * executing, because the execution engine does not persist `running` until the resumed step
 * begins. Without an atomic claim both callers enter the engine and every downstream step —
 * and every external side effect it performs — runs twice.
 *
 * See https://github.com/mastra-ai/mastra/issues/20443.
 */
describe('concurrent resume', () => {
  /**
   * Builds a workflow that suspends on approval and counts downstream executions.
   *
   * The downstream step blocks on `release` so both resume calls are guaranteed to be
   * in-flight at the same time. This makes the race deterministic instead of timing-dependent:
   * without the fix the second caller enters the engine while the first is still parked.
   */
  function createApprovalWorkflow() {
    let downstreamExecutions = 0;
    let releaseDownstream!: () => void;
    const downstreamReleased = new Promise<void>(resolve => {
      releaseDownstream = resolve;
    });

    let downstreamStarted!: () => void;
    const downstreamHasStarted = new Promise<void>(resolve => {
      downstreamStarted = resolve;
    });

    const approvalStep = createStep({
      id: 'approval',
      inputSchema: z.object({ item: z.string() }),
      outputSchema: z.object({ item: z.string(), approved: z.boolean() }),
      suspendSchema: z.object({ reason: z.string() }),
      resumeSchema: z.object({ approved: z.boolean() }),
      execute: async ({ inputData, resumeData, suspend }) => {
        if (!resumeData) {
          await suspend({ reason: `Needs approval: ${inputData.item}` });
          return { item: inputData.item, approved: false };
        }
        return { item: inputData.item, approved: resumeData.approved };
      },
    });

    const downstreamStep = createStep({
      id: 'downstream',
      inputSchema: z.object({ item: z.string(), approved: z.boolean() }),
      outputSchema: z.object({ executions: z.number() }),
      execute: async () => {
        downstreamExecutions++;
        downstreamStarted();
        await downstreamReleased;
        return { executions: downstreamExecutions };
      },
    });

    const workflow = createWorkflow({
      id: 'concurrent-resume-wf',
      inputSchema: z.object({ item: z.string() }),
      outputSchema: z.object({ executions: z.number() }),
      steps: [approvalStep, downstreamStep],
      options: { validateInputs: false },
    })
      .then(approvalStep)
      .then(downstreamStep)
      .commit();

    return {
      workflow,
      getDownstreamExecutions: () => downstreamExecutions,
      releaseDownstream,
      downstreamHasStarted,
    };
  }

  async function suspendRun(workflow: ReturnType<typeof createApprovalWorkflow>['workflow']) {
    const mastra = new Mastra({
      storage: new MockStore(),
      workflows: { 'concurrent-resume-wf': workflow },
      logger: false,
    });

    const run = await workflow.createRun();
    const started = await run.start({ inputData: { item: 'widget' } });
    expect(started.status).toBe('suspended');

    return { mastra, run };
  }

  it('runs downstream steps once when two resume() calls race', async () => {
    const harness = createApprovalWorkflow();
    const { run } = await suspendRun(harness.workflow);

    const inFlight = [
      run.resume({ step: 'approval', resumeData: { approved: true } }),
      run.resume({ step: 'approval', resumeData: { approved: true } }),
    ];

    // Both callers have raced past the claim by the time downstream starts; releasing it lets
    // the winner finish so the assertions below run against a settled workflow.
    await harness.downstreamHasStarted;
    harness.releaseDownstream();
    const results = await Promise.allSettled(inFlight);

    expect(harness.getDownstreamExecutions()).toBe(1);

    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((fulfilled[0] as PromiseFulfilledResult<any>).value.status).toBe('success');

    const reason = (rejected[0] as PromiseRejectedResult).reason;
    expect(reason.id).toBe('WORKFLOW_RESUME_ALREADY_CLAIMED');
    expect(reason.message).toContain('already resumed by another caller');
  });

  it('runs downstream steps once when two resumeStream() calls race', async () => {
    const harness = createApprovalWorkflow();
    const { run } = await suspendRun(harness.workflow);

    // resumeStream returns its output handle synchronously and reports failures through the
    // stream, so the observable guarantee here is that downstream ran exactly once.
    run.resumeStream({ step: 'approval', resumeData: { approved: true } });
    run.resumeStream({ step: 'approval', resumeData: { approved: true } });

    await harness.downstreamHasStarted;
    harness.releaseDownstream();
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(harness.getDownstreamExecutions()).toBe(1);
  });

  it('rejects a resume issued while an earlier resume is still executing', async () => {
    const harness = createApprovalWorkflow();
    const { run } = await suspendRun(harness.workflow);

    const first = run.resume({ step: 'approval', resumeData: { approved: true } });
    await harness.downstreamHasStarted;

    // The first resume owns the suspension and is mid-flight; a late caller must be rejected
    // rather than starting a second continuation.
    await expect(run.resume({ step: 'approval', resumeData: { approved: true } })).rejects.toThrow(
      /was not suspended|already resumed by another caller/,
    );

    harness.releaseDownstream();
    await first;

    expect(harness.getDownstreamExecutions()).toBe(1);
  });

  it('still resumes on stores that cannot claim, without calling updateWorkflowState', async () => {
    const harness = createApprovalWorkflow();

    // Cloudflare D1/KV/DO, ClickHouse and LanceDB report no concurrent-update support and throw
    // from `updateWorkflowState`. Claiming is best-effort, so those stores must keep resuming
    // exactly as they did before rather than having every resume fail.
    const storage = new MockStore();
    const workflowsStore = storage.stores.workflows as any;
    vi.spyOn(workflowsStore, 'supportsConcurrentUpdates').mockReturnValue(false);
    const updateSpy = vi.spyOn(workflowsStore, 'updateWorkflowState').mockImplementation(() => {
      throw new Error('updateWorkflowState is not implemented for Cloudflare D1 storage.');
    });

    const mastra = new Mastra({
      storage,
      workflows: { 'concurrent-resume-wf': harness.workflow },
      logger: false,
    });
    void mastra;

    const run = await harness.workflow.createRun();
    const started = await run.start({ inputData: { item: 'widget' } });
    expect(started.status).toBe('suspended');

    const resumed = run.resume({ step: 'approval', resumeData: { approved: true } });
    await harness.downstreamHasStarted;
    harness.releaseDownstream();

    expect((await resumed).status).toBe('success');
    expect(harness.getDownstreamExecutions()).toBe(1);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('releases the claim when the engine fails before executing anything', async () => {
    const harness = createApprovalWorkflow();
    const { run } = await suspendRun(harness.workflow);

    const executeSpy = vi
      .spyOn((run as any).executionEngine, 'execute')
      .mockRejectedValueOnce(new Error('engine boom'));

    await expect(run.resume({ step: 'approval', resumeData: { approved: true } })).rejects.toThrow('engine boom');
    executeSpy.mockRestore();

    // A failed claim that never ran anything must leave the run resumable, otherwise the run is
    // permanently stuck in `running`.
    harness.releaseDownstream();
    const retried = await run.resume({ step: 'approval', resumeData: { approved: true } });

    expect(retried.status).toBe('success');
    expect(harness.getDownstreamExecutions()).toBe(1);
  });

  function fakeLogger() {
    return {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      trackException: vi.fn(),
    } as any;
  }

  function createUnclaimableWorkflow(options: { allowUnclaimedResumes?: boolean }) {
    const approvalStep = createStep({
      id: 'approval',
      inputSchema: z.object({ item: z.string() }),
      outputSchema: z.object({ approved: z.boolean() }),
      suspendSchema: z.object({ reason: z.string() }),
      resumeSchema: z.object({ approved: z.boolean() }),
      execute: async ({ inputData, resumeData, suspend }) => {
        if (!resumeData) {
          await suspend({ reason: `Needs approval: ${inputData.item}` });
          return { approved: false };
        }
        return { approved: resumeData.approved };
      },
    });

    const workflow = createWorkflow({
      id: 'unclaimable-resume-wf',
      inputSchema: z.object({ item: z.string() }),
      outputSchema: z.object({ approved: z.boolean() }),
      options: {
        validateInputs: false,
        // Same persistence shape as the internal agent loop: never persist
        // `running`, so the resume claim cannot be written.
        shouldPersistSnapshot: ({ workflowStatus }) => workflowStatus !== 'running',
        ...options,
      },
    })
      .then(approvalStep)
      .commit();
    return { workflow };
  }

  it('warns when shouldPersistSnapshot excludes "running" and the resume cannot be claimed', async () => {
    const harness = createUnclaimableWorkflow({});
    const logger = fakeLogger();
    new Mastra({
      storage: new MockStore(),
      workflows: { 'unclaimable-resume-wf': harness.workflow },
      logger,
    });

    const run = await harness.workflow.createRun();
    const started = await run.start({ inputData: { item: 'widget' } });
    expect(started.status).toBe('suspended');

    const result = await run.resume({ step: 'approval', resumeData: { approved: true } });
    expect(result.status).toBe('success');

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('cannot be de-duplicated'));
  });

  it('does not warn when allowUnclaimedResumes acknowledges the unclaimable resume', async () => {
    const harness = createUnclaimableWorkflow({ allowUnclaimedResumes: true });
    const logger = fakeLogger();
    new Mastra({
      storage: new MockStore(),
      workflows: { 'unclaimable-resume-wf': harness.workflow },
      logger,
    });

    const run = await harness.workflow.createRun();
    const started = await run.start({ inputData: { item: 'widget' } });
    expect(started.status).toBe('suspended');

    const result = await run.resume({ step: 'approval', resumeData: { approved: true } });
    expect(result.status).toBe('success');

    const warnings = logger.warn.mock.calls.map((c: any[]) => String(c[0]));
    expect(warnings.filter((m: string) => m.includes('cannot be de-duplicated'))).toHaveLength(0);
  });

  it('still resumes normally when there is no contention', async () => {
    const harness = createApprovalWorkflow();
    const { run } = await suspendRun(harness.workflow);

    harness.releaseDownstream();
    const result = await run.resume({ step: 'approval', resumeData: { approved: true } });

    expect(result.status).toBe('success');
    expect(harness.getDownstreamExecutions()).toBe(1);
  });
});
