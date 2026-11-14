import { afterEach, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createGate, createRestartScenario } from '../../agent/durable/__tests__/restart-harness';

const ID = 'foreach-legacy-resume-restart';
type Seen = { generation: number; item: number; suspendData: unknown; resumeData: unknown };

const gate = createGate();
let scenario: { stop(): Promise<void> } | undefined;
afterEach(async () => {
  gate.release();
  await scenario?.stop();
});

// A run suspended on an earlier version has no per-item records in its suspended foreach record.
// A resume of every item resets their output slots before they run, so after a crash the restart
// reruns them with nothing of their own stored. They must still see a suspend payload (the one the
// earlier version gave them) so an agent's tool call counts as suspended and asks again, instead
// of looking like a fresh call that may run without approval.
it('keeps a restarted item of a resume-all on a run from an earlier version suspended with suspend data', async () => {
  const seen: Seen[] = [];
  const restartScenario = createRestartScenario({
    kind: 'workflow',
    runId: 'legacy-resume-all',
    build: ({ core, generation }) => {
      const approve = core.createEventedStep({
        id: 'approve',
        inputSchema: z.object({ item: z.number() }),
        resumeSchema: z.object({ approved: z.boolean() }),
        outputSchema: z.object({ item: z.number() }),
        execute: async ({ inputData, suspendData, resumeData, suspend }: any) => {
          seen.push({ generation, item: inputData.item, suspendData, resumeData });
          if (!resumeData) return suspend({ item: inputData.item });
          if (generation === 1) await gate.wait();
          return { item: inputData.item };
        },
      });
      return core
        .createEventedWorkflow({
          id: ID,
          inputSchema: z.array(z.object({ item: z.number() })),
          outputSchema: z.array(z.object({ item: z.number() })),
        })
        .foreach(approve, { concurrency: 3 })
        .commit();
    },
  });
  scenario = restartScenario;

  const original = await restartScenario.start(async ({ workflow, workflows, runId }) => {
    const run = await workflow.createRun({ runId });
    const started = await run.start({ inputData: [0, 1, 2].map(item => ({ item })) });
    expect(started.status).toBe('suspended');
    const snapshot = await workflows.loadWorkflowSnapshot({ workflowName: ID, runId });
    delete snapshot.context.approve.suspendPayload.__workflow_meta.foreachOutput;
    await workflows.persistWorkflowSnapshot({ workflowName: ID, runId, snapshot });
    return run.resume({ step: 'approve', resumeData: { approved: true } });
  });
  await vi.waitFor(() => expect(gate.waiters).toBe(3));

  const { result } = await restartScenario.restart(await original.checkpoint());

  expect(result.status).toBe('suspended');
  expect(seen.filter(s => s.generation === 2).sort((a, b) => a.item - b.item)).toEqual(
    [0, 1, 2].map(item => ({ generation: 2, item, suspendData: { item: 0 }, resumeData: undefined })),
  );
});
