import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { createStep, createWorkflow } from '.';

const hosts: Mastra[] = [];

async function makeHost(workflow: ReturnType<typeof createWorkflow>, storage: InstanceType<typeof MockStore>) {
  const mastra = new Mastra({
    logger: false,
    storage,
    workflows: { [workflow.id]: workflow as any },
    pubsub: new EventEmitterPubSub(),
  });
  await mastra.startWorkers();
  hosts.push(mastra);
  return mastra;
}

afterEach(async () => {
  await Promise.all(hosts.splice(0).map(host => host.stopWorkers()));
});

describe('evented pre-first-step restart', () => {
  it('restarts a top-level workflow with its original input', async () => {
    const storage = new MockStore();
    const execute = vi.fn(async ({ inputData }: { inputData: { value: string } }) => ({ got: inputData.value }));
    const first = createStep({
      id: 'first',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ got: z.string() }),
      execute,
    });
    const workflow = createWorkflow({
      id: 'pre-first-step-restart',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ got: z.string() }),
      steps: [first],
    })
      .then(first)
      .commit();

    await makeHost(workflow, storage);

    const runId = `pre-first-step-${Date.now()}`;
    const workflowsStore = (await storage.getStore('workflows'))!;
    await workflowsStore.persistWorkflowSnapshot({
      workflowName: workflow.id,
      runId,
      snapshot: {
        activePaths: [],
        suspendedPaths: {},
        resumeLabels: {},
        waitingPaths: {},
        activeStepsPath: {},
        serializedStepGraph: workflow.serializedStepGraph,
        timestamp: Date.now(),
        runId,
        context: { input: { value: 'original-input' }, __state: {} } as any,
        status: 'running',
        value: {},
      } as any,
    });

    const run = await workflow.createRun({ runId });
    const result = await run.restart();

    expect(result.status).toBe('success');
    expect((result as any).result).toEqual({ got: 'original-input' });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0]![0].inputData).toEqual({ value: 'original-input' });
  });

  it('restarts a nested workflow with its original input', async () => {
    const storage = new MockStore();
    const execute = vi.fn(async ({ inputData }: { inputData: { value: string } }) => ({ got: inputData.value }));
    const nestedFirst = createStep({
      id: 'nested-first',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ got: z.string() }),
      execute,
    });
    const nestedWorkflow = createWorkflow({
      id: 'nested-pre-first-step',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ got: z.string() }),
      steps: [nestedFirst],
    })
      .then(nestedFirst)
      .commit();
    const parentWorkflow = createWorkflow({
      id: 'parent-pre-first-step',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ got: z.string() }),
      steps: [nestedWorkflow],
    })
      .then(nestedWorkflow)
      .commit();

    await makeHost(parentWorkflow, storage);

    const runId = `parent-pre-first-step-${Date.now()}`;
    const nestedRunId = `nested-pre-first-step-${Date.now()}`;
    const originalInput = { value: 'nested-original-input' };
    const workflowsStore = (await storage.getStore('workflows'))!;
    await workflowsStore.persistWorkflowSnapshot({
      workflowName: parentWorkflow.id,
      runId,
      snapshot: {
        activePaths: [0],
        suspendedPaths: {},
        resumeLabels: {},
        waitingPaths: {},
        activeStepsPath: { [nestedWorkflow.id]: [0] },
        serializedStepGraph: parentWorkflow.serializedStepGraph,
        timestamp: Date.now(),
        runId,
        context: {
          input: originalInput,
          [nestedWorkflow.id]: {
            status: 'running',
            payload: originalInput,
            startedAt: Date.now(),
            metadata: { nestedRunId },
          },
          __state: {},
        } as any,
        status: 'running',
        value: {},
      } as any,
    });
    await workflowsStore.persistWorkflowSnapshot({
      workflowName: nestedWorkflow.id,
      runId: nestedRunId,
      snapshot: {
        activePaths: [],
        suspendedPaths: {},
        resumeLabels: {},
        waitingPaths: {},
        activeStepsPath: {},
        serializedStepGraph: nestedWorkflow.serializedStepGraph,
        timestamp: Date.now(),
        runId: nestedRunId,
        context: { input: originalInput, __state: {} } as any,
        status: 'running',
        value: {},
      } as any,
    });

    const run = await parentWorkflow.createRun({ runId });
    const result = await run.restart();

    expect(result.status).toBe('success');
    expect((result as any).result).toEqual({ got: 'nested-original-input' });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0]![0].inputData).toEqual(originalInput);
  });
});
