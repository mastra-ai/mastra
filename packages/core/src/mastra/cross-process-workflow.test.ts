/**
 * Tests for the cross-process workflow event guard in the push-subscription
 * callback inside `startWorkers()`.
 *
 * When two Mastra instances share a push-only pubsub (mimicking Unix socket
 * IPC between mc processes), events for internal workflows (execution-workflow,
 * agentic-loop) registered on one instance must NOT be processed by the other.
 * Without the guard the WEP would call errorWorkflow() → publish workflow.fail
 * → processWorkflowFail → workflows-finish, erroneously terminating the
 * correct instance's run.
 */
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';

import { EventEmitterPubSub } from '../events/event-emitter';
import type { PubSubDeliveryMode } from '../events/pubsub';
import type { Event } from '../events/types';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createStep, createWorkflow } from '../workflows/evented';

/** Push-only wrapper — mimics mc's SignalsPubSub delivery semantics. */
class PushOnlyPubSub extends EventEmitterPubSub {
  override get supportedModes(): ReadonlyArray<PubSubDeliveryMode> {
    return ['push'];
  }
}

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

function makeNoopWorkflow(id: string) {
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

describe('cross-process workflow event guard', () => {
  it('skips events for internal workflows not owned by this instance', async () => {
    const sharedPubSub = new PushOnlyPubSub();

    // Instance A: owns the internal workflow
    const mastraA = new Mastra({
      logger: false,
      storage: new MockStore(),
      workflows: {} as any,
      pubsub: sharedPubSub,
    });

    // Instance B: does NOT own the workflow — simulates a different process
    const mastraB = new Mastra({
      logger: false,
      storage: new MockStore(),
      workflows: {} as any,
      pubsub: sharedPubSub,
    });

    mastraA.__registerInternalWorkflow(makeNoopWorkflow('execution-workflow') as any, 'run-1');

    await mastraA.startWorkers();
    await mastraB.startWorkers();

    const spyA = vi.spyOn(mastraA, 'handleWorkflowEvent');
    const spyB = vi.spyOn(mastraB, 'handleWorkflowEvent');

    await sharedPubSub.publish('workflows', makeStartEvent('execution-workflow', 'run-1'));
    await vi.waitFor(() => expect(spyA).toHaveBeenCalled(), { timeout: 1000, interval: 10 });
    // Instance B should NOT process any events (guard skips all of them)
    expect(spyB).not.toHaveBeenCalled();

    await mastraA.shutdown();
    await mastraB.shutdown();
  });

  it('still processes events for public workflows on all instances', async () => {
    const sharedPubSub = new PushOnlyPubSub();

    const publicWf = makeNoopWorkflow('my-public-workflow');

    // Both instances register the same public workflow
    const mastraA = new Mastra({
      logger: false,
      storage: new MockStore(),
      workflows: { myWorkflow: publicWf } as any,
      pubsub: sharedPubSub,
    });
    const mastraB = new Mastra({
      logger: false,
      storage: new MockStore(),
      workflows: { myWorkflow: publicWf } as any,
      pubsub: sharedPubSub,
    });

    await mastraA.startWorkers();
    await mastraB.startWorkers();

    const spyA = vi.spyOn(mastraA, 'handleWorkflowEvent');
    const spyB = vi.spyOn(mastraB, 'handleWorkflowEvent');

    await sharedPubSub.publish('workflows', makeStartEvent('my-public-workflow', 'run-pub'));
    await vi.waitFor(
      () => {
        expect(spyA).toHaveBeenCalled();
        expect(spyB).toHaveBeenCalled();
      },
      { timeout: 1000, interval: 10 },
    );

    await mastraA.shutdown();
    await mastraB.shutdown();
  });

  it('does not produce workflow.fail when only one instance owns the internal workflow', async () => {
    const sharedPubSub = new PushOnlyPubSub();

    const mastraOwner = new Mastra({
      logger: false,
      storage: new MockStore(),
      workflows: {} as any,
      pubsub: sharedPubSub,
    });
    const mastraOther = new Mastra({
      logger: false,
      storage: new MockStore(),
      workflows: {} as any,
      pubsub: sharedPubSub,
    });

    mastraOwner.__registerInternalWorkflow(makeNoopWorkflow('execution-workflow') as any, 'run-2');

    await mastraOwner.startWorkers();
    await mastraOther.startWorkers();

    // Collect all workflow.fail events on the shared pubsub
    const failEvents: Event[] = [];
    await sharedPubSub.subscribe('workflows', async event => {
      if (event.type === 'workflow.fail') failEvents.push(event);
    });

    await sharedPubSub.publish('workflows', makeStartEvent('execution-workflow', 'run-2'));
    // Allow async event processing to settle
    await new Promise(r => setTimeout(r, 50));
    // The non-owning instance should NOT have caused a workflow.fail
    expect(failEvents).toHaveLength(0);

    await mastraOwner.shutdown();
    await mastraOther.shutdown();
  });

  it('skips nested workflow events whose root parent belongs to a different instance', async () => {
    const sharedPubSub = new PushOnlyPubSub();

    const mastraOwner = new Mastra({
      logger: false,
      storage: new MockStore(),
      workflows: {} as any,
      pubsub: sharedPubSub,
    });
    const mastraOther = new Mastra({
      logger: false,
      storage: new MockStore(),
      workflows: {} as any,
      pubsub: sharedPubSub,
    });

    mastraOwner.__registerInternalWorkflow(makeNoopWorkflow('execution-workflow') as any, 'run-owner');

    await mastraOwner.startWorkers();
    await mastraOther.startWorkers();

    const spyOwner = vi.spyOn(mastraOwner, 'handleWorkflowEvent');
    const spyOther = vi.spyOn(mastraOther, 'handleWorkflowEvent');

    // Simulate a nested workflow event (agentic-loop inside execution-workflow)
    // whose root parentWorkflow points to owner's execution-workflow run.
    const nestedEvent: Event = {
      type: 'workflow.step.run',
      runId: 'nested-run-1',
      data: {
        workflowId: 'agentic-loop',
        runId: 'nested-run-1',
        executionPath: [0],
        stepResults: {},
        prevResult: { status: 'success', output: {} },
        activeSteps: {},
        requestContext: {},
        parentWorkflow: {
          workflowId: 'execution-workflow',
          runId: 'run-owner',
          executionPath: [0],
          stepResults: {},
          resume: false,
          stepId: 'stream',
          stepGraph: [],
        },
      },
    } as Event;

    await sharedPubSub.publish('workflows', nestedEvent);
    await vi.waitFor(() => expect(spyOwner).toHaveBeenCalled(), { timeout: 1000, interval: 10 });
    // The non-owning instance must NOT process nested events
    expect(spyOther).not.toHaveBeenCalled();

    await mastraOwner.shutdown();
    await mastraOther.shutdown();
  });

  it('skips events where runId does not match any registered internal workflow', async () => {
    const sharedPubSub = new PushOnlyPubSub();

    const mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      workflows: {} as any,
      pubsub: sharedPubSub,
    });

    mastra.__registerInternalWorkflow(makeNoopWorkflow('execution-workflow') as any, 'run-A');

    await mastra.startWorkers();

    const spy = vi.spyOn(mastra, 'handleWorkflowEvent');

    // Event for run-A: should be processed (owned). Wait for the terminal
    // workflow.end event so all cascading events have been delivered before
    // we clear the spy for the second assertion.
    await sharedPubSub.publish('workflows', makeStartEvent('execution-workflow', 'run-A'));
    await vi.waitFor(
      () => {
        const calls = spy.mock.calls.flat();
        expect(calls.some((c: any) => c?.type === 'workflow.end' && c?.data?.runId === 'run-A')).toBe(true);
      },
      { timeout: 2000, interval: 10 },
    );

    spy.mockClear();

    // Event for run-B: should be skipped (not owned — different runId)
    await sharedPubSub.publish('workflows', makeStartEvent('execution-workflow', 'run-B'));
    // Allow async event processing to settle
    await new Promise(r => setTimeout(r, 100));
    expect(spy).not.toHaveBeenCalled();

    await mastra.shutdown();
  });
});

/**
 * Tests for the `mastra.pubsub` proxy's `localOnly` tagging logic. The proxy
 * decides which publishes can short-circuit the broker round-trip because
 * only the publishing process consumes them. Getting this wrong causes
 * cumulative `workflow.step.end` payloads (often 9 MB+) to be serialised
 * across the unix socket on every event — manifesting as ECANCELED,
 * `condition is not a function`, or missing `getFullOutput`.
 */
describe('mastra.pubsub proxy localOnly tagging', () => {
  /**
   * Wraps an EventEmitterPubSub so we can assert which calls received
   * `localOnly: true` in their options.
   */
  class RecordingPushOnlyPubSub extends PushOnlyPubSub {
    calls: Array<{ topic: string; event: Event; localOnly: boolean }> = [];
    override async publish(
      topic: string,
      event: Omit<Event, 'id' | 'createdAt'>,
      options?: { localOnly?: boolean },
    ): Promise<void> {
      this.calls.push({ topic, event: event as Event, localOnly: Boolean(options?.localOnly) });
      await super.publish(topic, event, options);
    }
  }

  function makeStepRunEvent(
    workflowId: string,
    runId: string,
    parentWorkflow?: { workflowId: string; runId: string; parentWorkflow?: unknown },
  ): Omit<Event, 'id' | 'createdAt'> {
    return {
      type: 'workflow.step.run',
      runId,
      data: {
        workflowId,
        runId,
        executionPath: [0],
        stepResults: {},
        prevResult: { status: 'success', output: {} },
        activeSteps: {},
        requestContext: {},
        ...(parentWorkflow ? { parentWorkflow } : {}),
      },
    } as Event;
  }

  it('tags internal workflow publishes as localOnly', async () => {
    const pubsub = new RecordingPushOnlyPubSub();
    const mastra = new Mastra({ logger: false, storage: new MockStore(), workflows: {} as any, pubsub });
    mastra.__registerInternalWorkflow(makeNoopWorkflow('execution-workflow') as any, 'run-1');

    await mastra.pubsub.publish('workflows', makeStartEvent('execution-workflow', 'run-1'));

    expect(pubsub.calls).toHaveLength(1);
    expect(pubsub.calls[0]).toMatchObject({ topic: 'workflows', localOnly: true });
    await mastra.shutdown();
  });

  it('does NOT tag publishes for workflows owned by no one as localOnly', async () => {
    const pubsub = new RecordingPushOnlyPubSub();
    const mastra = new Mastra({ logger: false, storage: new MockStore(), workflows: {} as any, pubsub });

    await mastra.pubsub.publish('workflows', makeStartEvent('foreign-workflow', 'run-foreign'));

    expect(pubsub.calls).toHaveLength(1);
    expect(pubsub.calls[0]!.localOnly).toBe(false);
    await mastra.shutdown();
  });

  it('walks parentWorkflow chain so nested workflow events inherit the root owner', async () => {
    const pubsub = new RecordingPushOnlyPubSub();
    const mastra = new Mastra({ logger: false, storage: new MockStore(), workflows: {} as any, pubsub });
    // Owner registers the root agentic-loop run.
    mastra.__registerInternalWorkflow(makeNoopWorkflow('agentic-loop') as any, 'root-run');

    // The nested `executionWorkflow` step is NOT registered itself, but its
    // parent chain points to the registered agentic-loop.
    const nestedEvent = makeStepRunEvent('executionWorkflow', 'nested-run', {
      workflowId: 'agentic-loop',
      runId: 'root-run',
    });
    await mastra.pubsub.publish('workflows', nestedEvent);

    expect(pubsub.calls).toHaveLength(1);
    expect(pubsub.calls[0]!.localOnly).toBe(true);
    await mastra.shutdown();
  });

  it('walks parentWorkflow chain across multiple levels of nesting', async () => {
    const pubsub = new RecordingPushOnlyPubSub();
    const mastra = new Mastra({ logger: false, storage: new MockStore(), workflows: {} as any, pubsub });
    mastra.__registerInternalWorkflow(makeNoopWorkflow('execution-workflow') as any, 'root-run');

    const deeplyNested = makeStepRunEvent('innerWorkflow', 'inner-run', {
      workflowId: 'agentic-loop',
      runId: 'middle-run',
      parentWorkflow: {
        workflowId: 'execution-workflow',
        runId: 'root-run',
      },
    });
    await mastra.pubsub.publish('workflows', deeplyNested);

    expect(pubsub.calls[0]!.localOnly).toBe(true);
    await mastra.shutdown();
  });

  it('tags scheduler-spawned background workflow events as localOnly', async () => {
    const pubsub = new RecordingPushOnlyPubSub();
    const mastra = new Mastra({ logger: false, storage: new MockStore(), workflows: {} as any, pubsub });

    const schedRunId = 'sched_wf___mastra_notification_dispatcher__dispatch_1781099940000';
    await mastra.pubsub.publish('workflows', makeStartEvent('__mastra_notification_dispatcher', schedRunId));

    expect(pubsub.calls[0]!.localOnly).toBe(true);
    await mastra.shutdown();
  });

  it('tags workflow.events.v2.* per-run stream events as localOnly', async () => {
    const pubsub = new RecordingPushOnlyPubSub();
    const mastra = new Mastra({ logger: false, storage: new MockStore(), workflows: {} as any, pubsub });

    await mastra.pubsub.publish('workflow.events.v2.run-xyz', {
      type: 'watch',
      runId: 'run-xyz',
      data: { chunk: 'whatever' },
    } as unknown as Event);

    expect(pubsub.calls[0]!.localOnly).toBe(true);
    await mastra.shutdown();
  });

  it('tags workflows-finish events for owned runs as localOnly', async () => {
    const pubsub = new RecordingPushOnlyPubSub();
    const mastra = new Mastra({ logger: false, storage: new MockStore(), workflows: {} as any, pubsub });
    mastra.__registerInternalWorkflow(makeNoopWorkflow('execution-workflow') as any, 'run-finish');

    await mastra.pubsub.publish('workflows-finish', {
      type: 'workflow.end',
      runId: 'run-finish',
      data: { workflowId: 'execution-workflow', runId: 'run-finish' },
    } as Event);

    expect(pubsub.calls[0]!.localOnly).toBe(true);
    await mastra.shutdown();
  });

  it('does NOT touch unrelated topics', async () => {
    const pubsub = new RecordingPushOnlyPubSub();
    const mastra = new Mastra({ logger: false, storage: new MockStore(), workflows: {} as any, pubsub });

    await mastra.pubsub.publish('some-other-topic', { type: 'whatever', runId: 'x', data: {} } as Event);

    expect(pubsub.calls[0]!.localOnly).toBe(false);
    await mastra.shutdown();
  });
});
