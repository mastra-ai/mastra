import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { createStep, createWorkflow } from '..';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import type { Event } from '../../../events/types';
import { Mastra } from '../../../mastra';
import { MockStore } from '../../../storage/mock';
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

function makeMastra(pubsub: EventEmitterPubSub) {
  const wf = createWorkflow({ id: 'wf', inputSchema: z.object({}), outputSchema: z.object({}) });
  wf.then(
    createStep({
      id: 'slow',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      execute: async () => ({}),
    }) as any,
  ).commit();
  return new Mastra({ logger: false, storage: new MockStore(), workflows: { wf } as any, pubsub });
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

describe('WorkflowEventProcessor step.run fence (#24589)', () => {
  it('drops a redelivery of a still-running step instead of executing it concurrently', async () => {
    const pubsub = new EventEmitterPubSub();
    const mastra = makeMastra(pubsub);
    // Two processors model two workers sharing the same broker.
    const a = new SlowStepProcessor({ mastra });
    const b = new SlowStepProcessor({ mastra });

    const first = a.handle(stepRunEvent(1));
    await sleep(25); // broker redelivers after its 25ms deadline
    const second = await b.handle(stepRunEvent(2));

    expect(second).toEqual({ ok: true });
    expect(await first).toEqual({ ok: true });
    expect(a.executions + b.executions).toBe(1);

    // A late duplicate after completion is also dropped.
    expect(await b.handle(stepRunEvent(3))).toEqual({ ok: true });
    expect(a.executions + b.executions).toBe(1);
  });

  it('releases the fence on failure so the transport retry can run the step', async () => {
    const pubsub = new EventEmitterPubSub();
    const mastra = makeMastra(pubsub);
    const processor = new SlowStepProcessor({ mastra });
    processor.fail = true;

    expect(await processor.handle(stepRunEvent(1))).toEqual({ ok: false, retry: true });
    processor.fail = false;
    expect(await processor.handle(stepRunEvent(2))).toEqual({ ok: true });
    expect(processor.executions).toBe(2);
  });
});
