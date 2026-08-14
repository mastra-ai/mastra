import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { InMemoryStore } from '../storage';
import { createWorkflow } from '../workflows/create';
import type { DynamicWorkflowGraph } from '../workflows/dynamic';
import { createStep } from '../workflows/workflow';
import { Mastra } from './index';

const emptyObjectSchema = { type: 'object', properties: {}, additionalProperties: false } as const;
const valueSchema = {
  type: 'object',
  properties: { value: { type: 'string' } },
  required: ['value'],
  additionalProperties: false,
} as const;

function valueWorkflow(id: string, value: string): DynamicWorkflowGraph {
  return {
    id,
    inputSchema: emptyObjectSchema,
    outputSchema: valueSchema,
    graph: [
      {
        type: 'mapping',
        id: 'result',
        mapConfig: JSON.stringify({ value: { value } }),
      },
    ],
  };
}

function nestedRoot(id: string, childId: string): DynamicWorkflowGraph {
  return {
    id,
    inputSchema: emptyObjectSchema,
    outputSchema: valueSchema,
    graph: [{ type: 'workflow', id: 'child-result', workflowId: childId }],
  };
}

function approvalWorkflow() {
  const approval = createStep({
    id: 'approval',
    inputSchema: z.object({}),
    outputSchema: z.object({ value: z.string() }),
    suspendSchema: z.object({ reason: z.string() }),
    resumeSchema: z.object({ approved: z.boolean() }),
    execute: async ({ resumeData, suspend }) => {
      if (!resumeData) await suspend({ reason: 'Approve' });
      return { value: 'v1' };
    },
  });
  return createWorkflow({
    id: 'approval-workflow',
    inputSchema: z.object({}),
    outputSchema: z.object({ value: z.string() }),
    steps: [approval],
  })
    .then(approval)
    .commit();
}

async function runValue(mastra: Mastra, workflowId: string, runId?: string): Promise<string> {
  const run = await mastra.getWorkflow(workflowId).createRun(runId ? { runId } : undefined);
  const result = await run.start({ inputData: {} });
  expect(result.status).toBe('success');
  return (result as { result: { value: string } }).result.value;
}

describe('dynamic workflow run revisions', () => {
  it('refreshes a stale replica for a new run while a run created before the update keeps its graph', async () => {
    const storage = new InMemoryStore({ id: 'dynamic-replica-refresh' });
    const writer = new Mastra({ logger: false, storage });
    const reader = new Mastra({ logger: false, storage });
    const secondReader = new Mastra({ logger: false, storage });

    await writer.addDynamicWorkflow(valueWorkflow('campaign', 'v1'));
    await reader.startWorkers();
    await secondReader.startWorkers();

    const oldRun = await reader.getWorkflow('campaign').createRun();
    await writer.addDynamicWorkflow(valueWorkflow('campaign', 'v2'));

    expect(await Promise.all([runValue(reader, 'campaign'), runValue(secondReader, 'campaign')])).toEqual(['v2', 'v2']);
    const oldResult = await oldRun.start({ inputData: {} });
    expect(oldResult.status).toBe('success');
    expect((oldResult as { result: { value: string } }).result.value).toBe('v1');

    await reader.stopWorkers();
    await secondReader.stopWorkers();
  });

  it('restores the persisted run revision after a process restart', async () => {
    const storage = new InMemoryStore({ id: 'dynamic-revision-restart' });
    const writer = new Mastra({ logger: false, storage });
    const firstReader = new Mastra({ logger: false, storage });

    await writer.addDynamicWorkflow(valueWorkflow('campaign', 'v1'));
    await firstReader.startWorkers();
    const pendingRun = await firstReader.getWorkflow('campaign').createRun({ runId: 'pinned-run' });
    expect(pendingRun.runId).toBe('pinned-run');
    await firstReader.stopWorkers();

    await writer.addDynamicWorkflow(valueWorkflow('campaign', 'v2'));
    const restartedReader = new Mastra({ logger: false, storage });
    await restartedReader.startWorkers();

    expect(await runValue(restartedReader, 'campaign', 'pinned-run')).toBe('v1');
    expect(await runValue(restartedReader, 'campaign')).toBe('v2');

    await restartedReader.stopWorkers();
  });

  it('resumes a suspended run from its pinned dynamic revision after restart', async () => {
    const storage = new InMemoryStore({ id: 'dynamic-suspended-revision' });
    const writer = new Mastra({ logger: false, storage, workflows: { approval: approvalWorkflow() } });
    const firstReader = new Mastra({ logger: false, storage, workflows: { approval: approvalWorkflow() } });

    await writer.addDynamicWorkflow(nestedRoot('campaign', 'approval-workflow'));
    await firstReader.startWorkers();
    const run = await firstReader.getWorkflow('campaign').createRun({ runId: 'suspended-run' });
    expect(await run.start({ inputData: {} })).toMatchObject({ status: 'suspended' });
    const workflowStore = await storage.getStore('workflows');
    expect(
      await workflowStore?.loadWorkflowSnapshot({ workflowName: 'campaign', runId: 'suspended-run' }),
    ).toMatchObject({ status: 'suspended' });

    await writer.addDynamicWorkflow(valueWorkflow('campaign', 'v2'));
    await firstReader.stopWorkers();

    const restartedReader = new Mastra({ logger: false, storage, workflows: { approval: approvalWorkflow() } });
    await restartedReader.startWorkers();
    expect(
      await workflowStore?.loadWorkflowSnapshot({ workflowName: 'campaign', runId: 'suspended-run' }),
    ).toMatchObject({ status: 'suspended' });
    const resumedRun = await restartedReader.getWorkflow('campaign').createRun({ runId: 'suspended-run' });
    expect(
      await workflowStore?.loadWorkflowSnapshot({ workflowName: 'campaign', runId: 'suspended-run' }),
    ).toMatchObject({ status: 'suspended' });
    const resumed = await resumedRun.resume({ resumeData: { approved: true } });
    expect(resumed).toMatchObject({ status: 'success', result: { value: 'v1' } });
    expect(await runValue(restartedReader, 'campaign')).toBe('v2');

    await restartedReader.stopWorkers();
  });

  it('fails closed for a legacy stored run without a pinned definition revision', async () => {
    const storage = new InMemoryStore({ id: 'dynamic-legacy-run' });
    const mastra = new Mastra({ logger: false, storage });
    await mastra.addDynamicWorkflow(valueWorkflow('campaign', 'v1'));

    const workflowStore = await storage.getStore('workflows');
    await workflowStore!.persistWorkflowSnapshot({
      workflowName: 'campaign',
      runId: 'legacy-run',
      snapshot: {
        runId: 'legacy-run',
        status: 'suspended',
        value: {},
        context: {},
        serializedStepGraph: [],
        activePaths: [],
        activeStepsPath: {},
        suspendedPaths: {},
        resumeLabels: {},
        waitingPaths: {},
        timestamp: Date.now(),
      },
    });

    await expect(mastra.getWorkflow('campaign').createRun({ runId: 'legacy-run' })).rejects.toThrow(
      /does not contain a pinned definition revision/,
    );
  });

  it('refreshes the full nested definition closure rather than retaining a stale child', async () => {
    const storage = new InMemoryStore({ id: 'dynamic-nested-replica-refresh' });
    const writer = new Mastra({ logger: false, storage });
    const reader = new Mastra({ logger: false, storage });

    await writer.addDynamicWorkflows([valueWorkflow('child', 'v1'), nestedRoot('root', 'child')]);
    await reader.startWorkers();
    expect(await runValue(reader, 'root')).toBe('v1');

    const oldRootRun = await reader.getWorkflow('root').createRun();

    await writer.addDynamicWorkflow(valueWorkflow('child', 'v2'));
    expect(await runValue(reader, 'root')).toBe('v2');
    const oldRootResult = await oldRootRun.start({ inputData: {} });
    expect(oldRootResult.status).toBe('success');
    expect((oldRootResult as { result: { value: string } }).result.value).toBe('v1');

    await reader.stopWorkers();
  });

  it('does not fall back to a stale live child when its stored definition becomes inactive', async () => {
    const storage = new InMemoryStore({ id: 'dynamic-inactive-child' });
    const writer = new Mastra({ logger: false, storage });
    const reader = new Mastra({ logger: false, storage });

    await writer.addDynamicWorkflows([valueWorkflow('child', 'v1'), nestedRoot('root', 'child')]);
    await reader.startWorkers();
    const definitionStore = await storage.getStore('workflowDefinitions');
    await definitionStore!.upsert({ id: 'child', status: 'archived' });

    await expect(reader.getWorkflow('root').createRun()).rejects.toThrow(/inactive or missing stored workflow "child"/);

    await reader.stopWorkers();
  });
});
