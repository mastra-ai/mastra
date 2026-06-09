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
