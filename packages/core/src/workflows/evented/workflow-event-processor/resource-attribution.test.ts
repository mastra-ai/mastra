import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { createStep, createWorkflow } from '..';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import type { Event } from '../../../events/types';
import { Mastra } from '../../../mastra';
import { MockStore } from '../../../storage/mock';

function makeStartEvent(workflowId: string, runId: string, resourceId?: string): Event {
  return {
    type: 'workflow.start',
    runId,
    data: {
      workflowId,
      runId,
      executionPath: [0],
      stepResults: {},
      prevResult: { status: 'success', output: {} },
      activeSteps: {},
      requestContext: {},
      ...(resourceId !== undefined ? { resourceId } : {}),
    },
  } as Event;
}

function makeWorkflow(id: string) {
  const wf = createWorkflow({
    id,
    inputSchema: z.object({}),
    outputSchema: z.object({}),
  });
  wf.then(
    createStep({
      id: 'noop',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      execute: async () => ({}),
    }) as any,
  ).commit();
  return wf;
}

describe('WorkflowEventProcessor resourceId attribution', () => {
  it('persists the event resourceId on the snapshot for a fresh run', async () => {
    const wf = makeWorkflow('attributed');
    const storage = new MockStore();
    const mastra = new Mastra({
      logger: false,
      storage,
      workflows: { attributed: wf } as any,
      pubsub: new EventEmitterPubSub(),
    });

    await mastra.handleWorkflowEvent(makeStartEvent('attributed', 'run-1', 'tenant-1'));

    const workflowsStore = (await storage.getStore('workflows'))!;
    const run = await workflowsStore.getWorkflowRunById({ runId: 'run-1', workflowName: 'attributed' });
    expect(run?.resourceId).toBe('tenant-1');

    await mastra.shutdown();
  });

  it('preserves an existing snapshot resourceId over the event value', async () => {
    const wf = makeWorkflow('attributed');
    const storage = new MockStore();
    const mastra = new Mastra({
      logger: false,
      storage,
      workflows: { attributed: wf } as any,
      pubsub: new EventEmitterPubSub(),
    });

    const workflowsStore = (await storage.getStore('workflows'))!;
    // Seed an existing snapshot with an original attribution (resume/timeTravel case).
    await workflowsStore.persistWorkflowSnapshot({
      workflowName: 'attributed',
      runId: 'run-2',
      resourceId: 'original-tenant',
      snapshot: {
        activePaths: [],
        suspendedPaths: {},
        resumeLabels: {},
        waitingPaths: {},
        activeStepsPath: {},
        serializedStepGraph: wf.serializedStepGraph,
        timestamp: Date.now(),
        runId: 'run-2',
        context: {} as any,
        status: 'suspended',
        value: {},
      } as any,
    });

    // A start event carrying a different resourceId must not override the existing one.
    await mastra.handleWorkflowEvent(makeStartEvent('attributed', 'run-2', 'different-tenant'));

    const run = await workflowsStore.getWorkflowRunById({ runId: 'run-2', workflowName: 'attributed' });
    expect(run?.resourceId).toBe('original-tenant');

    await mastra.shutdown();
  });
});
