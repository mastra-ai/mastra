import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createStep, createWorkflow } from './workflow';

/**
 * Regression test for parallel-foreach `suspendPayload` being wiped between
 * resumes.
 *
 * The default-engine `foreach` loop persists each iteration's result into
 * `__workflow_meta.foreachOutput` so that, on resume, completed/suspended
 * iterations can be reconstructed without re-running. Previously every entry's
 * `suspendPayload` was forced to `{}` regardless of status, which threw away
 * resume state for iterations that were still suspended. That caused
 * downstream consumers — most notably the agent loop, which stores its
 * `__streamState` (message list, etc.) in `suspendPayload` while waiting for
 * tool-call approval — to lose conversation context as soon as a sibling
 * iteration in the same foreach was resumed.
 *
 * The fix preserves `suspendPayload` for suspended results and continues to
 * wipe it for success/failed results.
 */
describe('foreach: suspendPayload preservation across resumes', () => {
  const makeWorkflow = () => {
    const approvalStep = createStep({
      id: 'approval-step',
      inputSchema: z.object({ name: z.string() }),
      outputSchema: z.object({ name: z.string(), approved: z.boolean() }),
      suspendSchema: z.object({
        // Mirrors the kind of payload the agent loop stores while waiting for
        // approval: arbitrary per-iteration state that must round-trip through
        // the snapshot.
        streamState: z.object({ name: z.string(), token: z.string() }),
      }),
      resumeSchema: z.object({ approved: z.boolean() }),
      execute: async ({ inputData, resumeData, suspend }) => {
        if (!resumeData) {
          await suspend({
            streamState: { name: inputData.name, token: `tok-${inputData.name}` },
          });
          // suspend() throws/short-circuits; the return below is unreachable
          // but satisfies the type checker.
          return { name: inputData.name, approved: false };
        }
        return { name: inputData.name, approved: resumeData.approved };
      },
    });

    const workflow = createWorkflow({
      id: 'foreach-suspend-payload-workflow',
      inputSchema: z.array(z.object({ name: z.string() })),
      outputSchema: z.array(z.object({ name: z.string(), approved: z.boolean() })),
      steps: [approvalStep],
      options: { validateInputs: false },
    })
      .foreach(approvalStep, { concurrency: 3 })
      .commit();

    return { workflow, approvalStep };
  };

  const readForeachOutput = async (storage: MockStore, runId: string) => {
    const store = await storage.getStore('workflows');
    const snapshot = await store?.loadWorkflowSnapshot({
      workflowName: 'foreach-suspend-payload-workflow',
      runId,
    });
    const stepCtx = snapshot?.context?.['approval-step'] as
      | { suspendPayload?: { __workflow_meta?: { foreachOutput?: any[] } } }
      | undefined;
    return {
      snapshot,
      foreachOutput: stepCtx?.suspendPayload?.__workflow_meta?.foreachOutput ?? [],
    };
  };

  it('preserves per-iteration suspendPayload after the initial parallel suspension', async () => {
    const storage = new MockStore();
    const { workflow } = makeWorkflow();
    new Mastra({ logger: false, storage, workflows: { 'foreach-suspend-payload-workflow': workflow } });

    const run = await workflow.createRun();
    const result = await run.start({
      inputData: [{ name: 'alpha' }, { name: 'beta' }, { name: 'gamma' }],
    });

    expect(result.status).toBe('suspended');

    const { foreachOutput } = await readForeachOutput(storage, run.runId);
    expect(foreachOutput).toHaveLength(3);
    for (const [idx, name] of ['alpha', 'beta', 'gamma'].entries()) {
      expect(foreachOutput[idx]?.status).toBe('suspended');
      expect(foreachOutput[idx]?.suspendPayload?.streamState).toEqual({
        name,
        token: `tok-${name}`,
      });
    }
  });

  it("keeps unresumed siblings' suspendPayload intact after a sibling iteration is resumed", async () => {
    const storage = new MockStore();
    const { workflow } = makeWorkflow();
    new Mastra({ logger: false, storage, workflows: { 'foreach-suspend-payload-workflow': workflow } });

    const run = await workflow.createRun();
    const start = await run.start({
      inputData: [{ name: 'alpha' }, { name: 'beta' }, { name: 'gamma' }],
    });
    expect(start.status).toBe('suspended');

    // Resume only iteration 0. The other two iterations must remain suspended
    // AND retain their original suspendPayload so the next resume can rebuild
    // their per-iteration state.
    const afterFirstResume = await run.resume({
      forEachIndex: 0,
      resumeData: { approved: true },
    });
    expect(afterFirstResume.status).toBe('suspended');

    const { foreachOutput } = await readForeachOutput(storage, run.runId);

    // Iteration 0 is now success — suspendPayload may legitimately be cleared.
    expect(foreachOutput[0]?.status).toBe('success');

    // Iterations 1 and 2 are still suspended — their original suspendPayload
    // (including the `streamState` we stored) MUST survive.
    expect(foreachOutput[1]?.status).toBe('suspended');
    expect(foreachOutput[1]?.suspendPayload?.streamState).toEqual({
      name: 'beta',
      token: 'tok-beta',
    });

    expect(foreachOutput[2]?.status).toBe('suspended');
    expect(foreachOutput[2]?.suspendPayload?.streamState).toEqual({
      name: 'gamma',
      token: 'tok-gamma',
    });
  });

  it('completes the workflow when all suspended iterations are resumed sequentially', async () => {
    const storage = new MockStore();
    const { workflow } = makeWorkflow();
    new Mastra({ logger: false, storage, workflows: { 'foreach-suspend-payload-workflow': workflow } });

    const run = await workflow.createRun();
    expect(
      (
        await run.start({
          inputData: [{ name: 'alpha' }, { name: 'beta' }, { name: 'gamma' }],
        })
      ).status,
    ).toBe('suspended');

    expect((await run.resume({ forEachIndex: 0, resumeData: { approved: true } })).status).toBe('suspended');
    expect((await run.resume({ forEachIndex: 1, resumeData: { approved: false } })).status).toBe('suspended');

    const final = await run.resume({ forEachIndex: 2, resumeData: { approved: true } });
    expect(final.status).toBe('success');
    if (final.status === 'success') {
      expect(final.steps['approval-step']).toMatchObject({
        status: 'success',
        output: [
          { name: 'alpha', approved: true },
          { name: 'beta', approved: false },
          { name: 'gamma', approved: true },
        ],
      });
    }
  });
});
