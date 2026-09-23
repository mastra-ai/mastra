import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import type { UpdateWorkflowStateOptions } from '../storage/types';
import { createWorkflow } from './create';
import { createStep } from './workflow';

/**
 * Restart and time travel mint a fresh lifecycle generation, so on stores that
 * fence the row's lifetime discriminator their ownership claim must name the
 * generation it succeeds. An unconditional generation overwrite is
 * indistinguishable from a delayed dead-lifetime write, and a claim that loses
 * must never enter the execution engine — every step persist would land as
 * `stale_execution` and surface as a synthetic cancellation.
 */
describe('restart lifecycle claim', () => {
  function createApprovalWorkflow() {
    let downstreamExecutions = 0;

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
        return { item: inputData.item, approved: (resumeData as { approved: boolean }).approved };
      },
    });

    const downstreamStep = createStep({
      id: 'downstream',
      inputSchema: z.object({ item: z.string(), approved: z.boolean() }),
      outputSchema: z.object({ executions: z.number() }),
      execute: async () => {
        downstreamExecutions++;
        return { executions: downstreamExecutions };
      },
    });

    const workflow = createWorkflow({
      id: 'restart-claim-wf',
      inputSchema: z.object({ item: z.string() }),
      outputSchema: z.object({ executions: z.number() }),
      steps: [approvalStep, downstreamStep],
      options: { validateInputs: false },
    })
      .then(approvalStep)
      .then(downstreamStep)
      .commit();

    return { workflow, getDownstreamExecutions: () => downstreamExecutions };
  }

  /**
   * Produces the stranded-run shape a recovery sweep restarts: a durably
   * `running` snapshot whose owning process is gone. The approval step is
   * marked active so the restart re-executes it and suspends again.
   */
  async function strandedRun() {
    const storage = new MockStore();
    const { workflow, getDownstreamExecutions } = createApprovalWorkflow();
    const mastra = new Mastra({
      storage,
      workflows: { 'restart-claim-wf': workflow },
      logger: false,
    });

    const run = await workflow.createRun();
    const started = await run.start({ inputData: { item: 'widget' } });
    expect(started.status).toBe('suspended');

    const workflowsStore = await storage.getStore('workflows');
    const suspended = await workflowsStore.loadWorkflowSnapshot({
      workflowName: 'restart-claim-wf',
      runId: run.runId,
    });
    expect(suspended?.executionGeneration).toEqual(expect.any(String));

    await workflowsStore.persistWorkflowSnapshot({
      workflowName: 'restart-claim-wf',
      runId: run.runId,
      snapshot: {
        ...suspended!,
        status: 'running',
        suspendedPaths: {},
        activePaths: [0],
        activeStepsPath: { approval: [0] },
      },
    });
    const snapshot = await workflowsStore.loadWorkflowSnapshot({
      workflowName: 'restart-claim-wf',
      runId: run.runId,
    });

    return { mastra, run, storage, workflowsStore, snapshot: snapshot!, getDownstreamExecutions };
  }

  it('names the claimed generation when adopting a stranded run', async () => {
    const { mastra, run, workflowsStore, snapshot } = await strandedRun();
    const updates: UpdateWorkflowStateOptions[] = [];
    const original = workflowsStore.updateWorkflowState.bind(workflowsStore);
    vi.spyOn(workflowsStore, 'updateWorkflowState').mockImplementation(async args => {
      updates.push(args.opts);
      return original(args);
    });

    const result = await run.restart();
    // The restarted run re-executes the approval step and suspends again.
    expect(result.status).toBe('suspended');

    const claim = updates.find(opts => typeof opts.executionGeneration === 'string');
    expect(claim).toBeDefined();
    expect(claim!.executionGeneration).not.toBe(snapshot.executionGeneration);
    expect(claim!.expectedExecutionGeneration).toBe(snapshot.executionGeneration);
    expect(claim!.expectedLifecycleResumeAttempt).toBe(snapshot.lifecycleResumeAttempt);
    expect(claim!.expectedStatus).toBe(snapshot.status);

    const adopted = await workflowsStore.loadWorkflowSnapshot({
      workflowName: 'restart-claim-wf',
      runId: run.runId,
    });
    expect(adopted?.executionGeneration).toBe(claim!.executionGeneration);
    await mastra.shutdown();
  });

  it('throws WORKFLOW_RESTART_NOT_CLAIMED and never executes when the claim loses', async () => {
    const { mastra, run, workflowsStore, snapshot, getDownstreamExecutions } = await strandedRun();
    const original = workflowsStore.updateWorkflowState.bind(workflowsStore);
    let competingAdopted = false;
    vi.spyOn(workflowsStore, 'updateWorkflowState').mockImplementation(async args => {
      // A competing lifetime adopts the row between this run's snapshot load
      // and its claim — the same shape a second recovery sweep produces. The
      // winner names the stored lifetime, matching the fenced-storage
      // succession contract rather than an unconditional overwrite.
      if (!competingAdopted && typeof args.opts.executionGeneration === 'string') {
        competingAdopted = true;
        await original({
          workflowName: args.workflowName,
          runId: args.runId,
          opts: {
            status: 'running',
            executionGeneration: 'competing-generation',
            expectedExecutionGeneration: snapshot.executionGeneration,
            expectedLifecycleResumeAttempt: snapshot.lifecycleResumeAttempt,
            expectedStatus: snapshot.status,
          },
        });
      }
      return original(args);
    });

    const rejected = await run.restart().then(
      () => undefined,
      (error: unknown) => error,
    );
    expect(rejected).toBeInstanceOf(Error);
    expect((rejected as { id?: string }).id).toBe('WORKFLOW_RESTART_NOT_CLAIMED');
    expect(getDownstreamExecutions()).toBe(0);

    const stored = await workflowsStore.loadWorkflowSnapshot({
      workflowName: 'restart-claim-wf',
      runId: run.runId,
    });
    expect(stored?.executionGeneration).toBe('competing-generation');
    expect(stored?.status).toBe('running');
    expect(snapshot.executionGeneration).not.toBe('competing-generation');
    await mastra.shutdown();
  });

  it('claims unconditionally when the store cannot compare-and-set', async () => {
    const { mastra, run, workflowsStore } = await strandedRun();
    vi.spyOn(workflowsStore, 'supportsConcurrentUpdates').mockReturnValue(false);
    const updates: UpdateWorkflowStateOptions[] = [];
    const original = workflowsStore.updateWorkflowState.bind(workflowsStore);
    vi.spyOn(workflowsStore, 'updateWorkflowState').mockImplementation(async args => {
      updates.push(args.opts);
      return original(args);
    });

    const result = await run.restart();
    expect(result.status).toBe('suspended');

    const claim = updates.find(opts => typeof opts.executionGeneration === 'string');
    expect(claim).toBeDefined();
    expect(claim).not.toHaveProperty('expectedExecutionGeneration');
    expect(claim).not.toHaveProperty('expectedLifecycleResumeAttempt');
    expect(claim).not.toHaveProperty('expectedStatus');
    await mastra.shutdown();
  });
});
