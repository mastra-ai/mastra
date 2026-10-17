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

  callFinish(args: any, status: 'success' | 'suspended' | 'failed') {
    if (status === 'suspended') return this.processWorkflowSuspend(args);
    if (status === 'failed') return this.processWorkflowFail(args);
    return this.processWorkflowEnd(args);
  }
}

describe('WorkflowEventProcessor #endWorkflow', () => {
  it.each(['success', 'suspended', 'failed'] as const)(
    'omits ancestor run state from %s finish events while preserving consumer data',
    async status => {
      const pubsub = new EventEmitterPubSub();
      const mastra = new Mastra({ logger: false, pubsub });
      const processor = new TestWorkflowEventProcessor({ mastra });
      const finishes: Event[] = [];
      await pubsub.subscribe('workflows-finish', async event => {
        finishes.push(event);
      });
      const stepResults = { step: { status, output: { text: 'done' } } };
      const prevResult = { status, output: { text: 'done' }, error: 'failed' };
      const state = { count: 3 };
      const requestContext = { execution: 'claim-1' };
      const parentWorkflow = {
        workflowId: 'parent',
        runId: 'parent-run',
        stepId: 'child',
        executionPath: [0],
        stepGraph: [{ type: 'step' }],
        stepResults: { large: 'x'.repeat(1024 * 1024) },
        parentWorkflow: { workflowId: 'root', runId: 'root-run', stepResults: { large: 'y'.repeat(1024 * 1024) } },
      };
      try {
        await processor.callFinish(
          {
            workflowId: 'wf',
            runId: 'run-1',
            executionPath: [],
            resumeSteps: [],
            activeStepsPath: {},
            stepResults: {
              ...stepResults,
              step: { ...stepResults.step, __state: state },
              __state: state,
              untaken: { status: 'skipped', output: 'z'.repeat(1024 * 1024) },
            },
            prevResult,
            state,
            requestContext,
            parentWorkflow,
            parentContext: parentWorkflow,
          },
          status,
        );
        expect(finishes).toHaveLength(1);
        const data = finishes[0]!.data;
        expect(data).toMatchObject({
          workflowId: 'wf',
          runId: 'run-1',
          stepResults,
          prevResult,
          state,
          requestContext,
        });
        expect(data.parentWorkflow).toEqual({
          workflowId: 'parent',
          runId: 'parent-run',
          parentWorkflow: { workflowId: 'root', runId: 'root-run' },
        });
        expect(data.stepResults).toEqual(stepResults);
        expect(data).not.toHaveProperty('parentContext');
        expect(Buffer.byteLength(JSON.stringify(finishes[0]))).toBeLessThan(2048);
        expect(parentWorkflow.stepResults.large).toHaveLength(1024 * 1024);
      } finally {
        await mastra.shutdown();
      }
    },
  );

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
});
