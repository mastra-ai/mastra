/**
 * Apps usually register a workflow under a camelCase key while its `id` is
 * kebab-case: `new Mastra({ workflows: { approvalWorkflow } })` with
 * `id: 'approval-workflow'`. Events and run state carry the workflow's `id`, so
 * the evented engine must look the workflow up by id. Its resume, time-travel
 * and restart paths looked it up by registration key, threw
 * `Workflow with ID approval-workflow not found`, and left the run where it
 * was. See https://github.com/mastra-ai/mastra/issues/29359.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { createStep, createWorkflow } from '.';

const REGISTRATION_KEY = 'approvalWorkflow';
const WORKFLOW_ID = 'approval-workflow';

const instances: Mastra[] = [];

afterEach(async () => {
  await Promise.all(instances.splice(0).map(mastra => mastra.stopWorkers()));
});

async function startMastra(storage: MockStore, workflow: ReturnType<typeof createApprovalWorkflow>) {
  const mastra = new Mastra({ logger: false, storage, workflows: { [REGISTRATION_KEY]: workflow } });
  instances.push(mastra);
  await mastra.startWorkers();
  return mastra;
}

function createApprovalWorkflow({
  onPrepare,
  autoApprove = false,
}: { onPrepare?: () => Promise<void>; autoApprove?: boolean } = {}) {
  const prepare = createStep({
    id: 'prepare',
    inputSchema: z.object({ amount: z.number() }),
    outputSchema: z.object({ amount: z.number() }),
    execute: async ({ inputData }) => {
      await onPrepare?.();
      return { amount: inputData.amount * 2 };
    },
  });

  const approval = createStep({
    id: 'approval',
    inputSchema: z.object({ amount: z.number() }),
    outputSchema: z.object({ amount: z.number(), decision: z.string() }),
    resumeSchema: z.object({ decision: z.string() }),
    execute: async ({ inputData, resumeData, suspend }) => {
      if (resumeData) {
        return { amount: inputData.amount, decision: resumeData.decision };
      }
      if (autoApprove) {
        return { amount: inputData.amount, decision: 'auto-approved' };
      }
      return await suspend({});
    },
  });

  return createWorkflow({
    id: WORKFLOW_ID,
    inputSchema: z.object({ amount: z.number() }),
    outputSchema: z.object({ amount: z.number(), decision: z.string() }),
  })
    .then(prepare)
    .then(approval)
    .commit();
}

describe('evented workflow registered under a key that differs from its id (#29359)', () => {
  it('resumes a suspended run to success', async () => {
    const storage = new MockStore();
    const mastra = await startMastra(storage, createApprovalWorkflow());

    const run = await mastra.getWorkflow(REGISTRATION_KEY).createRun();
    const started = await run.start({ inputData: { amount: 5 } });
    expect(started.status).toBe('suspended');

    const resumed = await run.resume({ step: 'approval', resumeData: { decision: 'approve' } });

    expect(resumed.status).toBe('success');
    expect(resumed.status === 'success' && resumed.result).toEqual({ amount: 10, decision: 'approve' });
    const stored = await mastra.getWorkflow(REGISTRATION_KEY).getWorkflowRunById(run.runId);
    expect(stored?.status).toBe('success');
  });

  it('time travels to a step and runs the workflow from there', async () => {
    const storage = new MockStore();
    const mastra = await startMastra(storage, createApprovalWorkflow());

    const run = await mastra.getWorkflow(REGISTRATION_KEY).createRun();
    expect((await run.start({ inputData: { amount: 5 } })).status).toBe('suspended');

    const replayed = await run.timeTravel({
      step: 'approval',
      inputData: { amount: 7 },
      resumeData: { decision: 'reject' },
    });

    expect(replayed.status).toBe('success');
    expect(replayed.status === 'success' && replayed.result).toEqual({ amount: 7, decision: 'reject' });
  });

  it('restarts a run left running by another process', async () => {
    const storage = new MockStore();
    let releaseFirstProcess!: () => void;
    const firstProcessParked = new Promise<void>(resolve => (releaseFirstProcess = resolve));
    let firstProcessEntered = false;

    // The first process parks inside `prepare`, as if it died mid-step. Both
    // processes auto-approve so the restarted run can finish on its own.
    const firstProcess = await startMastra(
      storage,
      createApprovalWorkflow({
        autoApprove: true,
        onPrepare: async () => {
          firstProcessEntered = true;
          await firstProcessParked;
        },
      }),
    );
    const firstRun = await firstProcess.getWorkflow(REGISTRATION_KEY).createRun();
    const firstResult = firstRun.start({ inputData: { amount: 5 } });
    await vi.waitFor(() => expect(firstProcessEntered).toBe(true));

    const secondProcess = await startMastra(storage, createApprovalWorkflow({ autoApprove: true }));
    const secondRun = await secondProcess.getWorkflow(REGISTRATION_KEY).createRun({ runId: firstRun.runId });

    try {
      const restarted = await secondRun.restart();
      expect(restarted.status).toBe('success');
      expect(restarted.status === 'success' && restarted.result).toEqual({ amount: 10, decision: 'auto-approved' });
      const stored = await secondProcess.getWorkflow(REGISTRATION_KEY).getWorkflowRunById(firstRun.runId);
      expect(stored?.status).toBe('success');
    } finally {
      releaseFirstProcess();
      await firstResult.catch(() => undefined);
    }
  });
});
