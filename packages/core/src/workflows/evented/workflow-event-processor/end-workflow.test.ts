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
    const pubsub = new EventEmitterPubSub();
    const mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      workflows: {} as any,
      pubsub,
    });
    const processor = new TestWorkflowEventProcessor({ mastra });
    const workflowEndEvents: Event[] = [];

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

    expect(workflowEndEvents).toHaveLength(1);
    expect(workflowEndEvents[0]?.data.prevResult).toMatchObject({
      status: 'canceled',
    });

    await mastra.shutdown();
  });
});
