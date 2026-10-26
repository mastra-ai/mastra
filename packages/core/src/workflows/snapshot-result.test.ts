import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { createSerializingStore } from '../storage/domains/workflows/serializing-store.test-utils';
import { createWorkflow } from './create';
import type { WorkflowRunState } from './types';
import { createStep } from './workflow';

// #28169: a successful run's `result` is the last step's output. Persisting both put every
// foreach item's output into the completion snapshot twice.
const ITEMS = 20;
const ITEM_BYTES = 10_000;

function setup() {
  const serializing = createSerializingStore();
  const step = createStep({
    id: 'item',
    inputSchema: z.number(),
    outputSchema: z.object({ i: z.number(), blob: z.string() }),
    execute: async ({ inputData }) => ({ i: inputData, blob: 'x'.repeat(ITEM_BYTES) }),
  });
  const workflow = createWorkflow({
    id: 'big-foreach',
    inputSchema: z.array(z.number()),
    outputSchema: z.array(z.object({ i: z.number(), blob: z.string() })),
  })
    .foreach(step, { concurrency: 4 })
    .commit();
  const mastra = new Mastra({ workflows: { workflow }, storage: serializing.store, logger: false });
  return { ...serializing, mastra, workflow: mastra.getWorkflow('workflow') };
}

describe('completion snapshot result (#28169)', () => {
  it('stores the foreach output once and reads the same result back', async () => {
    const { workflow, inspect, store } = setup();
    const run = await workflow.createRun();
    const started = await run.start({ inputData: Array.from({ length: ITEMS }, (_, i) => i) });
    expect(started.status).toBe('success');
    if (started.status !== 'success') return;

    const row = inspect().find(r => r.runId === run.runId)!;
    const outputBytes = Buffer.byteLength(JSON.stringify(started.result), 'utf8');
    // ≈1× the output plus snapshot overhead; on main this was ≈2×.
    expect(row.snapshotBytes).toBeLessThan(outputBytes * 1.2);
    const stored = JSON.parse(row.snapshot) as WorkflowRunState;
    expect(stored.result).toBeUndefined();
    expect(stored.resultFromStep).toBe('item');

    const workflows = (await store.getStore('workflows'))!;
    const loaded = await workflows.loadWorkflowSnapshot({ workflowName: 'big-foreach', runId: run.runId });
    expect(loaded?.result).toEqual(started.result);
    expect(loaded).not.toHaveProperty('resultFromStep');

    const byId = await workflows.getWorkflowRunById({ runId: run.runId, workflowName: 'big-foreach' });
    expect((byId?.snapshot as WorkflowRunState).result).toEqual(started.result);

    const listed = await workflows.listWorkflowRuns({ workflowName: 'big-foreach' });
    expect((listed.runs[0]!.snapshot as WorkflowRunState).result).toEqual(started.result);

    const viaWorkflow = await workflow.getWorkflowRunById(run.runId);
    expect(viaWorkflow?.status).toBe('success');
    expect(viaWorkflow?.result).toEqual(started.result);
  });

  it('reads rows written with an inline result unchanged', async () => {
    const { store } = setup();
    const workflows = (await store.getStore('workflows'))!;
    const output = [{ i: 0, blob: 'old' }];
    const legacy = {
      runId: 'legacy-run',
      status: 'success',
      // Not the same reference as the step output, so the write keeps `result` inline,
      // which is the shape every row written before #28169 has.
      result: structuredClone(output),
      context: { input: [0], item: { status: 'success', output, payload: [0], startedAt: 1, endedAt: 2 } },
      value: {},
      activePaths: [],
      activeStepsPath: {},
      serializedStepGraph: [],
      suspendedPaths: {},
      resumeLabels: {},
      waitingPaths: {},
      timestamp: 1,
    } as unknown as WorkflowRunState;
    await workflows.persistWorkflowSnapshot({ workflowName: 'big-foreach', runId: 'legacy-run', snapshot: legacy });

    const loaded = await workflows.loadWorkflowSnapshot({ workflowName: 'big-foreach', runId: 'legacy-run' });
    expect(loaded).toEqual(legacy);
  });
});
