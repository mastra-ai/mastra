import { describe, expect, it } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import type { Event } from '../../../events/types';
import { Mastra } from '../../../mastra';
import { MockStore } from '../../../storage/mock';
import { WorkflowEventProcessor } from './index';

class TestWorkflowEventProcessor extends WorkflowEventProcessor {
  callEndWorkflow(args: any, status?: 'success' | 'failed' | 'canceled' | 'paused') {
    return this.endWorkflow(args, status);
  }
}

describe('WorkflowEventProcessor #endWorkflow', () => {
  it('normalizes a missing prevResult for canceled terminal events', async () => {
    const storage = new MockStore();
    const workflows = (await storage.getStore('workflows'))!;
    const pubsub = new EventEmitterPubSub();
    const mastra = new Mastra({
      logger: false,
      storage,
      workflows: {} as any,
      pubsub,
    });
    const processor = new TestWorkflowEventProcessor({ mastra });
    const workflowEndEvents: Event[] = [];

    await workflows.persistWorkflowSnapshot({
      workflowName: 'wf',
      runId: 'run-1',
      snapshot: {
        runId: 'run-1',
        status: 'running',
        value: {},
        context: {},
        activePaths: [],
        activeStepsPath: {},
        suspendedPaths: {},
        resumeLabels: {},
        serializedStepGraph: [],
        waitingPaths: {},
        timestamp: Date.now(),
      } as any,
    });

    await pubsub.subscribe('workflows', async event => {
      if (event.type === 'workflow.end') {
        workflowEndEvents.push(event);
      }
    });

    await processor.callEndWorkflow(
      {
        workflowId: 'wf',
        runId: 'run-1',
        executionPath: [],
        resumeSteps: [],
        stepResults: {},
        activeStepsPath: {},
        requestContext: {},
        prevResult: undefined,
      },
      'canceled',
    );

    const run = await workflows.getWorkflowRunById({ runId: 'run-1', workflowName: 'wf' });
    expect(workflowEndEvents).toHaveLength(1);
    expect(workflowEndEvents[0]?.data.prevResult).toMatchObject({
      status: 'canceled',
    });
    expect(run).not.toBeNull();
    expect((run?.snapshot as any).result).toMatchObject({
      status: 'canceled',
    });

    await mastra.shutdown();
  });

  it('deletes the snapshot of a terminal top-level run marked deleteSnapshotOnFinish', async () => {
    const storage = new MockStore();
    const workflows = (await storage.getStore('workflows'))!;
    const pubsub = new EventEmitterPubSub();
    const mastra = new Mastra({
      logger: false,
      storage,
      workflows: {} as any,
      pubsub,
    });
    const processor = new TestWorkflowEventProcessor({ mastra });

    // `Run.start()` writes this row unconditionally, even when the workflow
    // opts out of snapshot persistence.
    await workflows.persistWorkflowSnapshot({
      workflowName: 'transient-wf',
      runId: 'run-2',
      snapshot: {
        runId: 'run-2',
        status: 'running',
        value: {},
        context: {},
        activePaths: [],
        activeStepsPath: {},
        suspendedPaths: {},
        resumeLabels: {},
        serializedStepGraph: [],
        waitingPaths: {},
        timestamp: Date.now(),
      } as any,
    });

    await processor.callEndWorkflow(
      {
        workflowId: 'transient-wf',
        runId: 'run-2',
        executionPath: [],
        resumeSteps: [],
        stepResults: {},
        activeStepsPath: {},
        requestContext: {},
        prevResult: undefined,
        workflow: {
          id: 'transient-wf',
          options: { shouldPersistSnapshot: () => false, deleteSnapshotOnFinish: true },
        },
      },
      'success',
    );

    expect(await workflows.getWorkflowRunById({ runId: 'run-2', workflowName: 'transient-wf' })).toBeNull();

    await mastra.shutdown();
  });
});
