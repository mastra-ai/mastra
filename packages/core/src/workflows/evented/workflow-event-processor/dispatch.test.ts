import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { createStep, createWorkflow } from '..';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import type { Event } from '../../../events/types';
import { Mastra } from '../../../mastra';
import { MockStore } from '../../../storage/mock';

function makeStartEvent(workflowId: string, runId: string): Event {
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
    },
  } as Event;
}

describe('WorkflowEventProcessor #dispatch', () => {
  it('resolves the workflow by its `id` even when registered under a different key (issue #16471)', async () => {
    // Workflow has id "daily-report" but is registered as { dailyReport }.
    // The scheduler emits `workflow.start` with workflowId="daily-report",
    // and that lookup must succeed.
    const wf = createWorkflow({
      id: 'daily-report',
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

    const pubsub = new EventEmitterPubSub();
    const mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      // Note: registration key `dailyReport` !== workflow.id `daily-report`.
      workflows: { dailyReport: wf } as any,
      pubsub,
    });

    const result = await mastra.handleWorkflowEvent(makeStartEvent('daily-report', 'run-1'));

    expect(result).toEqual({ ok: true });

    await mastra.shutdown();
  });

  it('does not retry indefinitely when the workflow is no longer registered', async () => {
    // Simulates a scheduled workflow whose definition was deleted from code.
    // Scheduler publishes `workflow.start` for the missing workflow; the
    // processor must terminate it instead of returning retry:true forever.
    const pubsub = new EventEmitterPubSub();
    const mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      workflows: {} as any,
      pubsub,
    });

    const failEvents: Event[] = [];
    await pubsub.subscribe('workflows', async event => {
      if (event.type === 'workflow.fail') failEvents.push(event);
    });

    const result = await mastra.handleWorkflowEvent(makeStartEvent('ghost-workflow', 'run-1'));

    // Must NOT be a retryable failure — otherwise the transport redelivers
    // the event infinitely.
    expect(result).toEqual({ ok: true });
    // errorWorkflow() should have published a single workflow.fail event so
    // any downstream listeners (storage, watchers) can finalize the run.
    expect(failEvents.length).toBeGreaterThanOrEqual(1);

    // A follow-up workflow.fail event for the same missing workflow must
    // also terminate (it would otherwise loop back through #dispatch and
    // re-trigger errorWorkflow forever).
    const followUp = await mastra.handleWorkflowEvent({
      type: 'workflow.fail',
      runId: 'run-1',
      data: {
        workflowId: 'ghost-workflow',
        runId: 'run-1',
        executionPath: [],
        stepResults: {},
        prevResult: { status: 'failed', error: { message: 'gone' } as any },
        activeSteps: {},
        requestContext: {},
      },
    } as Event);
    expect(followUp).toEqual({ ok: true });

    await mastra.shutdown();
  });
});
