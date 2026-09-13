import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { RequestContext } from '../request-context';
import { InMemoryStore } from '../storage/mock';
import { createTool } from '../tools';
import { createWorkflow, createEventedWorkflow } from './create';
import type { WorkflowRunIdentity } from './types';
import { createStep } from './workflow';

const instances: Mastra[] = [];
afterEach(async () => {
  await Promise.all(instances.splice(0).map(mastra => mastra.stopWorkers()));
});

async function graph(
  storage: InMemoryStore,
  seen: Array<{ rootRun?: WorkflowRunIdentity; runId: string; workflowId: string }>,
  evented = false,
) {
  const build = evented ? createEventedWorkflow : createWorkflow;
  const inputSchema = z.object({ item: z.string() });
  const outputSchema = z.object({ item: z.string(), approved: z.boolean() });
  const tool = createTool({
    id: 'approval-tool',
    inputSchema,
    outputSchema,
    suspendSchema: inputSchema,
    resumeSchema: z.object({ approved: z.boolean() }),
    execute: async (input, context) => {
      const workflow = context.workflow!;
      seen.push({ rootRun: workflow.rootRun, runId: workflow.runId, workflowId: workflow.workflowId });
      if (!workflow.resumeData) {
        await workflow.suspend(input, { resumeLabel: `callback:${input.item}` });
        return { ...input, approved: false };
      }
      return { ...input, approved: workflow.resumeData.approved };
    },
  });
  const helper = build({ id: 'helper', inputSchema, outputSchema }).then(createStep(tool)).commit();
  const middle = build({ id: 'middle', inputSchema, outputSchema }).then(helper).commit();
  const finish = createStep({
    id: 'finish',
    inputSchema: outputSchema,
    outputSchema,
    execute: async ({ inputData }) => inputData,
  });
  const root = build({ id: 'root', inputSchema, outputSchema }).then(middle).then(finish).commit();
  const mastra = new Mastra({ storage, workflows: { root, middle, helper }, logger: false });
  instances.push(mastra);
  if (evented) await mastra.startWorkers();
  return { root, helper, mastra };
}

describe.each(['default', 'evented'])('native root workflow identity (%s)', engine => {
  it('lets a nested tool identify and resume the outer run after a fresh Mastra instance', async () => {
    const storage = new InMemoryStore();
    const seen: Array<{ rootRun?: WorkflowRunIdentity; runId: string; workflowId: string }> = [];
    const first = await graph(storage, seen, engine === 'evented');
    const run = await first.root.createRun({ runId: 'outer-run', resourceId: 'tenant-one' });
    expect(await run.start({ inputData: { item: 'document' } })).toMatchObject({ status: 'suspended' });
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ workflowId: 'helper', rootRun: { workflowId: 'root', runId: 'outer-run' } });
    expect(seen[0]!.workflowId).not.toBe(seen[0]!.rootRun!.workflowId);

    await first.mastra.stopWorkers();
    const fresh = await graph(storage, seen, engine === 'evented');
    const identity = seen[0]!.rootRun!;
    const restored = await fresh.mastra.getWorkflow(identity.workflowId).createRun({ runId: identity.runId });
    expect(await restored.resume({ label: 'callback:document', resumeData: { approved: true } })).toMatchObject({
      status: 'success',
      result: { item: 'document', approved: true },
    });
    expect(seen).toHaveLength(2);
    expect(seen[1]!.rootRun).toEqual(identity);
    const snapshot = await (await storage.getStore('workflows'))!.loadWorkflowSnapshot({
      workflowName: 'root',
      runId: 'outer-run',
    });
    expect(snapshot).toMatchObject({ status: 'success', rootRun: identity });
  });

  it('keeps concurrent roots separate even when they share the same request context and helper', async () => {
    const storage = new InMemoryStore();
    const seen: Array<{ rootRun?: WorkflowRunIdentity; runId: string; workflowId: string }> = [];
    const { root } = await graph(storage, seen, engine === 'evented');
    const forgedRoot = { workflowId: 'other-tenant', runId: 'forged-run' };
    const context = new RequestContext([['rootRun', forgedRoot]]);
    const runs = await Promise.all(['outer-a', 'outer-b'].map(runId => root.createRun({ runId })));
    const results = await Promise.all(
      runs.map((run, index) => run.start({ inputData: { item: String(index) }, requestContext: context })),
    );
    expect(results.map(result => result.status)).toEqual(['suspended', 'suspended']);
    expect(seen.map(item => item.rootRun?.runId).sort()).toEqual(['outer-a', 'outer-b']);
    expect([...context.entries()]).toEqual([['rootRun', forgedRoot]]);
  });

  it('retains the outer identity for each suspended foreach invocation and its continuation', async () => {
    const storage = new InMemoryStore();
    const seen: Array<{ rootRun?: WorkflowRunIdentity; runId: string; workflowId: string }> = [];
    const { helper, mastra: unused } = await graph(storage, seen, engine === 'evented');
    await unused.stopWorkers();
    const build = engine === 'evented' ? createEventedWorkflow : createWorkflow;
    const batch = build({
      id: 'batch',
      inputSchema: z.array(z.object({ item: z.string() })),
      outputSchema: z.array(z.object({ item: z.string(), approved: z.boolean() })),
    })
      .foreach(helper, { concurrency: 2 })
      .commit();
    const mastra = new Mastra({ storage, workflows: { batch, helper }, logger: false });
    instances.push(mastra);
    if (engine === 'evented') await mastra.startWorkers();
    const run = await batch.createRun({ runId: 'batch-run' });
    expect(await run.start({ inputData: [{ item: 'a' }, { item: 'b' }] })).toMatchObject({ status: 'suspended' });
    expect(seen).toHaveLength(2);
    expect(new Set(seen.map(item => item.runId)).size).toBe(2);
    expect(seen.every(item => item.rootRun?.workflowId === 'batch' && item.rootRun.runId === 'batch-run')).toBe(true);
    const snapshot = await (await storage.getStore('workflows'))!.loadWorkflowSnapshot({
      workflowName: 'batch',
      runId: 'batch-run',
    });
    expect(snapshot?.resumeLabels).toMatchObject({
      'callback:a': { stepId: 'helper', foreachIndex: 0 },
      'callback:b': { stepId: 'helper', foreachIndex: 1 },
    });
    const firstResume = await run.resume({ label: 'callback:a', resumeData: { approved: true } });
    expect(firstResume, JSON.stringify(firstResume)).toMatchObject({ status: 'suspended' });
    expect(await run.resume({ label: 'callback:b', resumeData: { approved: true } })).toMatchObject({
      status: 'success',
      result: [
        { item: 'a', approved: true },
        { item: 'b', approved: true },
      ],
    });
    expect(seen).toHaveLength(4);
    expect(seen.every(item => item.rootRun?.workflowId === 'batch' && item.rootRun.runId === 'batch-run')).toBe(true);
  });
});
