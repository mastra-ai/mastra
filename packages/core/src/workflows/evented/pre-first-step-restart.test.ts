import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import type { Event } from '../../events';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { createStep, createWorkflow } from '.';

const hosts: Mastra[] = [];

class DropStepRunPubSub extends EventEmitterPubSub {
  dropped = Promise.withResolvers<void>();
  dropNextStepRun = true;

  async publish(topic: string, event: Omit<Event, 'id' | 'createdAt'>, options?: { localOnly?: boolean }) {
    if (this.dropNextStepRun && event.type === 'workflow.step.run') {
      this.dropNextStepRun = false;
      this.dropped.resolve();
      return;
    }
    await super.publish(topic, event, options);
  }
}

async function makeHost(
  workflow: ReturnType<typeof createWorkflow>,
  storage: InstanceType<typeof MockStore>,
  pubsub: EventEmitterPubSub = new EventEmitterPubSub(),
) {
  const mastra = new Mastra({
    logger: false,
    storage,
    workflows: { [workflow.id]: workflow as any },
    pubsub,
  });
  await mastra.startWorkers();
  hosts.push(mastra);
  return mastra;
}

async function persistPreFirstStepSnapshot({
  storage,
  workflow,
  runId,
  input,
}: {
  storage: InstanceType<typeof MockStore>;
  workflow: ReturnType<typeof createWorkflow>;
  runId: string;
  input: unknown;
}) {
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
      context: { input, __state: {} } as any,
      status: 'running',
      value: {},
    } as any,
  });
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
    await persistPreFirstStepSnapshot({
      storage,
      workflow,
      runId,
      input: { value: 'original-input' },
    });

    const run = await workflow.createRun({ runId });
    const result = await run.restart();

    expect(result.status).toBe('success');
    expect((result as any).result).toEqual({ got: 'original-input' });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0]![0].inputData).toEqual({ value: 'original-input' });
  });

  it('restarts a parallel first entry with its original input', async () => {
    const storage = new MockStore();
    const firstExecute = vi.fn(async ({ inputData }: { inputData: { value: string } }) => ({
      branch: 'first',
      value: inputData.value,
    }));
    const secondExecute = vi.fn(async ({ inputData }: { inputData: { value: string } }) => ({
      branch: 'second',
      value: inputData.value,
    }));
    const first = createStep({
      id: 'parallel-first',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ branch: z.string(), value: z.string() }),
      execute: firstExecute,
    });
    const second = createStep({
      id: 'parallel-second',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ branch: z.string(), value: z.string() }),
      execute: secondExecute,
    });
    const workflow = createWorkflow({
      id: 'pre-first-step-parallel-restart',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.any(),
      steps: [first, second],
    })
      .parallel([first, second])
      .commit();

    await makeHost(workflow, storage);

    const runId = `pre-first-step-parallel-${Date.now()}`;
    const originalInput = { value: 'parallel-original-input' };
    await persistPreFirstStepSnapshot({ storage, workflow, runId, input: originalInput });

    const run = await workflow.createRun({ runId });
    const result = await run.restart();

    expect(result.status).toBe('success');
    expect(firstExecute).toHaveBeenCalledTimes(1);
    expect(secondExecute).toHaveBeenCalledTimes(1);
    expect(firstExecute.mock.calls[0]![0].inputData).toEqual(originalInput);
    expect(secondExecute.mock.calls[0]![0].inputData).toEqual(originalInput);
  });

  it('restarts a conditional first entry with its original input', async () => {
    const storage = new MockStore();
    const selectedExecute = vi.fn(async ({ inputData }: { inputData: { value: string } }) => ({
      selected: inputData.value,
    }));
    const skippedExecute = vi.fn(async ({ inputData }: { inputData: { value: string } }) => ({
      skipped: inputData.value,
    }));
    const selected = createStep({
      id: 'conditional-selected',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ selected: z.string() }),
      execute: selectedExecute,
    });
    const skipped = createStep({
      id: 'conditional-skipped',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ skipped: z.string() }),
      execute: skippedExecute,
    });
    const condition = vi.fn(async ({ inputData }: { inputData: { value: string } }) =>
      inputData.value.startsWith('conditional'),
    );
    const workflow = createWorkflow({
      id: 'pre-first-step-conditional-restart',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.any(),
      steps: [selected, skipped],
    })
      .branch([
        [condition, selected],
        [async () => false, skipped],
      ])
      .commit();

    await makeHost(workflow, storage);

    const runId = `pre-first-step-conditional-${Date.now()}`;
    const originalInput = { value: 'conditional-original-input' };
    await persistPreFirstStepSnapshot({ storage, workflow, runId, input: originalInput });

    const run = await workflow.createRun({ runId });
    const result = await run.restart();

    expect(result.status).toBe('success');
    expect(condition).toHaveBeenCalledTimes(1);
    expect(condition.mock.calls[0]![0].inputData).toEqual(originalInput);
    expect(selectedExecute).toHaveBeenCalledTimes(1);
    expect(selectedExecute.mock.calls[0]![0].inputData).toEqual(originalInput);
    expect(skippedExecute).not.toHaveBeenCalled();
  });

  it('does not replay completed steps when a restart crashes before republishing the active step', async () => {
    const storage = new MockStore();
    const firstExecute = vi.fn(async ({ inputData }: { inputData: { value: string } }) => ({
      value: `${inputData.value}-first`,
    }));
    const secondExecute = vi.fn(async ({ inputData }: { inputData: { value: string } }) => ({
      value: `${inputData.value}-second`,
    }));
    const first = createStep({
      id: 'restart-gap-first',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      execute: firstExecute,
    });
    const second = createStep({
      id: 'restart-gap-second',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      execute: secondExecute,
    });
    const workflow = createWorkflow({
      id: 'restart-gap-recovery',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      steps: [first, second],
    })
      .then(first)
      .then(second)
      .commit();

    const droppingPubSub = new DropStepRunPubSub();
    const firstHost = await makeHost(workflow, storage, droppingPubSub);

    const runId = `restart-gap-${Date.now()}`;
    const workflowsStore = (await storage.getStore('workflows'))!;
    await workflowsStore.persistWorkflowSnapshot({
      workflowName: workflow.id,
      runId,
      snapshot: {
        activePaths: [1],
        suspendedPaths: {},
        resumeLabels: {},
        waitingPaths: {},
        activeStepsPath: { [second.id]: [1] },
        serializedStepGraph: workflow.serializedStepGraph,
        timestamp: Date.now(),
        runId,
        context: {
          input: { value: 'original' },
          [first.id]: { status: 'success', output: { value: 'original-first' } },
          [second.id]: { status: 'running', payload: { value: 'original-first' }, startedAt: Date.now() },
          __state: {},
        },
        status: 'running',
        value: {},
      } as any,
    });

    const interruptedRun = await workflow.createRun({ runId });
    void interruptedRun.restart();
    await droppingPubSub.dropped.promise;

    const interruptedSnapshot = await workflowsStore.loadWorkflowSnapshot({ workflowName: workflow.id, runId });
    expect(interruptedSnapshot?.activePaths).toEqual([1]);
    expect(interruptedSnapshot?.activeStepsPath).toEqual({ [second.id]: [1] });

    await firstHost.stopWorkers();
    hosts.splice(hosts.indexOf(firstHost), 1);
    await makeHost(workflow, storage);

    const recoveredRun = await workflow.createRun({ runId });
    const result = await recoveredRun.restart();

    expect(result.status).toBe('success');
    expect(firstExecute).not.toHaveBeenCalled();
    expect(secondExecute).toHaveBeenCalledTimes(1);
    expect(secondExecute.mock.calls[0]![0].inputData).toEqual({ value: 'original-first' });
  });

  it('runs a later parallel entry after a pre-first-step restart', async () => {
    const storage = new MockStore();
    const firstExecute = vi.fn(async ({ inputData }: { inputData: { value: string } }) => ({
      value: `${inputData.value}-first`,
    }));
    const branchAExecute = vi.fn(async ({ inputData }: { inputData: { value: string } }) => ({
      branch: 'a',
      value: inputData.value,
    }));
    const branchBExecute = vi.fn(async ({ inputData }: { inputData: { value: string } }) => ({
      branch: 'b',
      value: inputData.value,
    }));
    const first = createStep({
      id: 'before-later-parallel',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      execute: firstExecute,
    });
    const branchA = createStep({
      id: 'later-parallel-a',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ branch: z.string(), value: z.string() }),
      execute: branchAExecute,
    });
    const branchB = createStep({
      id: 'later-parallel-b',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ branch: z.string(), value: z.string() }),
      execute: branchBExecute,
    });
    const workflow = createWorkflow({
      id: 'pre-first-step-then-parallel',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.any(),
      steps: [first, branchA, branchB],
    })
      .then(first)
      .parallel([branchA, branchB])
      .commit();

    await makeHost(workflow, storage);

    const runId = `pre-first-then-parallel-${Date.now()}`;
    await persistPreFirstStepSnapshot({ storage, workflow, runId, input: { value: 'original' } });

    const run = await workflow.createRun({ runId });
    const result = await Promise.race([
      run.restart(),
      new Promise<'timed-out'>(resolve => setTimeout(() => resolve('timed-out'), 500)),
    ]);

    expect(result).not.toBe('timed-out');
    expect((result as any).status).toBe('success');
    expect(firstExecute).toHaveBeenCalledTimes(1);
    expect(branchAExecute).toHaveBeenCalledTimes(1);
    expect(branchBExecute).toHaveBeenCalledTimes(1);
  });

  it('runs a later conditional entry after a pre-first-step restart', async () => {
    const storage = new MockStore();
    const firstExecute = vi.fn(async ({ inputData }: { inputData: { value: string } }) => ({
      value: `${inputData.value}-first`,
    }));
    const selectedExecute = vi.fn(async ({ inputData }: { inputData: { value: string } }) => ({
      value: `${inputData.value}-selected`,
    }));
    const skippedExecute = vi.fn();
    const first = createStep({
      id: 'before-later-conditional',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      execute: firstExecute,
    });
    const selected = createStep({
      id: 'later-conditional-selected',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      execute: selectedExecute,
    });
    const skipped = createStep({
      id: 'later-conditional-skipped',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      execute: skippedExecute,
    });
    const workflow = createWorkflow({
      id: 'pre-first-step-then-conditional',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.any(),
      steps: [first, selected, skipped],
    })
      .then(first)
      .branch([
        [async () => true, selected],
        [async () => false, skipped],
      ])
      .commit();

    await makeHost(workflow, storage);

    const runId = `pre-first-then-conditional-${Date.now()}`;
    await persistPreFirstStepSnapshot({ storage, workflow, runId, input: { value: 'original' } });

    const run = await workflow.createRun({ runId });
    const result = await run.restart();

    expect(result.status).toBe('success');
    expect(firstExecute).toHaveBeenCalledTimes(1);
    expect(selectedExecute).toHaveBeenCalledTimes(1);
    expect(selectedExecute.mock.calls[0]![0].inputData).toEqual({ value: 'original-first' });
    expect(skippedExecute).not.toHaveBeenCalled();
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
