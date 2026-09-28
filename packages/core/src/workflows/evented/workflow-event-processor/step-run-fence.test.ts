import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { createStep, createWorkflow } from '..';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import type { Event } from '../../../events/types';
import { Mastra } from '../../../mastra';
import { MockStore } from '../../../storage/mock';
import { createEmptyWorkflowSnapshot } from '../../../storage/workflow-snapshot';
import { WorkflowEventProcessor } from '.';
import type { ProcessorArgs } from '.';

/** Replaces the step body with a slow, counted execution. */
class SlowStepProcessor extends WorkflowEventProcessor {
  executions = 0;
  fail = false;

  protected override async processWorkflowStepRun(_args: ProcessorArgs) {
    this.executions++;
    await new Promise(r => setTimeout(r, 100));
    if (this.fail) throw new Error('transient');
  }
}

function makeWorkflow(execute = async () => ({})) {
  const step = createStep({
    id: 'slow',
    inputSchema: z.object({}),
    outputSchema: z.object({}),
    execute,
  });
  const workflow = createWorkflow({ id: 'wf', inputSchema: z.object({}), outputSchema: z.object({}), steps: [step] })
    .then(step)
    .commit();
  return workflow;
}

function makeMastra(pubsub: EventEmitterPubSub, storage = new MockStore(), workflow = makeWorkflow()) {
  return {
    mastra: new Mastra({ logger: false, storage, workflows: { wf: workflow } as any, pubsub }),
    storage,
  };
}

function stepRunEvent(deliveryAttempt: number): Event {
  return {
    id: 'step-run-event-1',
    type: 'workflow.step.run',
    runId: 'run-1',
    createdAt: new Date(),
    deliveryAttempt,
    data: {
      workflowId: 'wf',
      runId: 'run-1',
      executionPath: [0],
      stepResults: {},
      prevResult: { status: 'success', output: {} },
      activeStepsPath: {},
      resumeSteps: [],
      requestContext: {},
    },
  } as Event;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

describe('WorkflowEventProcessor step.run fence', () => {
  it('drops a redelivery of a still-running step instead of executing it concurrently', async () => {
    const pubsub = new EventEmitterPubSub();
    const { mastra } = makeMastra(pubsub);
    const a = new SlowStepProcessor({ mastra });
    const b = new SlowStepProcessor({ mastra });

    const first = a.handle(stepRunEvent(1));
    await sleep(25);
    const second = await b.handle(stepRunEvent(2));

    expect(second).toEqual({ ok: true });
    expect(await first).toEqual({ ok: true });
    expect(a.executions + b.executions).toBe(1);

    expect(await b.handle(stepRunEvent(3))).toEqual({ ok: true });
    expect(a.executions + b.executions).toBe(1);
  });

  it('releases the fence on failure so the transport retry can run the step', async () => {
    const pubsub = new EventEmitterPubSub();
    const { mastra } = makeMastra(pubsub);
    const processor = new SlowStepProcessor({ mastra });
    processor.fail = true;

    expect(await processor.handle(stepRunEvent(1))).toEqual({ ok: false, retry: true });
    processor.fail = false;
    expect(await processor.handle(stepRunEvent(2))).toEqual({ ok: true });
    expect(processor.executions).toBe(2);
  });

  it('recovers a persisted running claim after the previous worker crashes', async () => {
    const pubsub = new EventEmitterPubSub();
    const storage = new MockStore();
    const execute = vi.fn(async () => ({}));
    const workflow = makeWorkflow(execute);
    const { mastra } = makeMastra(pubsub, storage, workflow);
    const workflowsStore = (await storage.getStore('workflows'))!;
    const snapshot = createEmptyWorkflowSnapshot('run-1');
    snapshot.status = 'running';
    snapshot.activePaths = [0];
    snapshot.activeStepsPath = { slow: [0] };
    snapshot.context = {
      input: { status: 'success', output: {} },
      slow: { status: 'running', payload: {}, startedAt: Date.now() },
    } as any;
    snapshot.eventedExecutionClaims = ['step-run-event-1'];
    await workflowsStore.persistWorkflowSnapshot({ workflowName: 'wf', runId: 'run-1', snapshot });

    const processor = new WorkflowEventProcessor({ mastra });
    expect(await processor.handle(stepRunEvent(2))).toEqual({ ok: true });
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
