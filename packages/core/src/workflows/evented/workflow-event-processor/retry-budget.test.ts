import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { createStep, createWorkflow } from '..';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import type { Event } from '../../../events/types';
import { Mastra } from '../../../mastra';
import { MockStore } from '../../../storage/mock';
import { WorkflowEventProcessor } from '.';

function makeStartEvent(workflowId: string, runId: string, id?: string): Event {
  return {
    id,
    type: 'workflow.start',
    runId,
    createdAt: new Date(),
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

// Forces #dispatch to throw a transient-looking error every time.
class AlwaysThrowsProcessor extends WorkflowEventProcessor {
  public dispatchCalls = 0;
  override async loadData(): Promise<undefined> {
    this.dispatchCalls++;
    throw Object.assign(new Error('SQLITE_BUSY: database is locked (test)'), { code: 'SQLITE_BUSY' });
  }
}

describe('WorkflowEventProcessor retry budget (Sig D)', () => {
  it('caps retries at MAX_DELIVERY_ATTEMPTS and publishes workflow.fail (event with id)', async () => {
    const pubsub = new EventEmitterPubSub();
    const mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      workflows: { wf: makeWorkflow('wf') } as any,
      pubsub,
    });

    const failEvents: Event[] = [];
    await pubsub.subscribe('workflows', async event => {
      if (event.type === 'workflow.fail') failEvents.push(event);
    });

    const processor = new AlwaysThrowsProcessor({ mastra });
    const event = makeStartEvent('wf', 'run-id-cap', 'event-id-1');

    // First 2 attempts must report retryable; 3rd must be terminal.
    const r1 = await processor.handle(event);
    expect(r1).toEqual({ ok: false, retry: true });
    const r2 = await processor.handle(event);
    expect(r2).toEqual({ ok: false, retry: true });
    const r3 = await processor.handle(event);
    expect(r3).toEqual({ ok: false, retry: false });

    // Further attempts (e.g. a duplicate redelivery) must also stay terminal,
    // not silently flip back to retry: true.
    const r4 = await processor.handle(event);
    expect(r4).toEqual({ ok: false, retry: false });

    // errorWorkflow runs once on the terminal attempt; subsequent terminal
    // results from the sentinel must not re-publish (idempotent).
    expect(failEvents.length).toBe(1);
    expect(processor.dispatchCalls).toBeGreaterThanOrEqual(3);

    await mastra.shutdown();
  });

  it('uses a stable composite key when event.id is missing so the counter still trips', async () => {
    const pubsub = new EventEmitterPubSub();
    const mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      workflows: { wf: makeWorkflow('wf') } as any,
      pubsub,
    });

    const failEvents: Event[] = [];
    await pubsub.subscribe('workflows', async event => {
      if (event.type === 'workflow.fail') failEvents.push(event);
    });

    const processor = new AlwaysThrowsProcessor({ mastra });

    // Re-create the event each time to simulate the transport synthesizing a
    // fresh delivery (no id). A Date.now()-based key would reset every call;
    // the composite key must persist across these calls.
    for (let i = 0; i < 3; i++) {
      const event = makeStartEvent('wf', 'run-id-noid');
      const result = await processor.handle(event);
      if (i < 2) {
        expect(result).toEqual({ ok: false, retry: true });
      } else {
        expect(result).toEqual({ ok: false, retry: false });
      }
    }

    expect(failEvents.length).toBe(1);

    await mastra.shutdown();
  });

  it('caps deliveryAttempts map size so a long-lived processor cannot leak memory', async () => {
    const pubsub = new EventEmitterPubSub();
    const mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      workflows: { wf: makeWorkflow('wf') } as any,
      pubsub,
    });

    const processor = new AlwaysThrowsProcessor({ mastra });
    // Touch the static cap via the class so the test stays in sync with the
    // implementation even if the value is tuned later.
    const cap = (WorkflowEventProcessor as unknown as { DELIVERY_ATTEMPTS_MAX_ENTRIES: number })
      .DELIVERY_ATTEMPTS_MAX_ENTRIES;
    expect(typeof cap).toBe('number');
    expect(cap).toBeGreaterThan(0);

    // Drive 2x the cap of distinct event ids through handle(). Each one fails
    // exactly once, so each leaves a counter behind. After this loop the map
    // size must still be <= cap.
    for (let i = 0; i < cap * 2; i++) {
      await processor.handle(makeStartEvent('wf', `run-${i}`, `event-id-${i}`));
    }

    const map = (processor as unknown as { deliveryAttempts: Map<string, number> }).deliveryAttempts;
    expect(map.size).toBeLessThanOrEqual(cap);
    // The newest entries (the back half of the loop) must still be present;
    // the oldest entries should have been evicted.
    expect(map.has(`event-id-${cap * 2 - 1}`)).toBe(true);
    expect(map.has(`event-id-0`)).toBe(false);

    await mastra.shutdown();
  });

  it('does not republish workflow.fail when a workflow.fail event itself exhausts its budget', async () => {
    const pubsub = new EventEmitterPubSub();
    const mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      workflows: { wf: makeWorkflow('wf') } as any,
      pubsub,
    });

    const failEvents: Event[] = [];
    await pubsub.subscribe('workflows', async event => {
      if (event.type === 'workflow.fail') failEvents.push(event);
    });

    const processor = new AlwaysThrowsProcessor({ mastra });
    // Simulate a workflow.fail event arriving while storage is persistently
    // broken (e.g. workflows table missing). Exhausting its budget must NOT
    // publish another workflow.fail — each publish gets a fresh event id, so
    // republishing here would loop forever.
    const failEvent: Event = {
      id: 'fail-event-id-1',
      type: 'workflow.fail',
      runId: 'run-fail-loop',
      createdAt: new Date(),
      data: {
        workflowId: 'wf',
        runId: 'run-fail-loop',
        executionPath: [],
        stepResults: {},
        prevResult: { status: 'failed', error: 'boom' },
        activeStepsPath: {},
        requestContext: {},
      },
    } as Event;

    expect(await processor.handle(failEvent)).toEqual({ ok: false, retry: true });
    expect(await processor.handle(failEvent)).toEqual({ ok: false, retry: true });
    expect(await processor.handle(failEvent)).toEqual({ ok: false, retry: false });

    expect(failEvents.length).toBe(0);

    await mastra.shutdown();
  });

  it('clears the counter on success so a later transient failure gets a fresh budget', async () => {
    const pubsub = new EventEmitterPubSub();
    const mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      workflows: { wf: makeWorkflow('wf') } as any,
      pubsub,
    });

    let shouldThrow = true;
    class FlakyProcessor extends WorkflowEventProcessor {
      override async loadData(): Promise<undefined> {
        if (shouldThrow) {
          throw Object.assign(new Error('SQLITE_BUSY: database is locked (test)'), { code: 'SQLITE_BUSY' });
        }
        return undefined;
      }
    }

    const processor = new FlakyProcessor({ mastra });
    const event = makeStartEvent('wf', 'run-flaky', 'event-id-flaky');

    expect(await processor.handle(event)).toEqual({ ok: false, retry: true });
    expect(await processor.handle(event)).toEqual({ ok: false, retry: true });

    shouldThrow = false;
    // A success must wipe the per-event counter.
    expect(await processor.handle(event)).toEqual({ ok: true });

    shouldThrow = true;
    // Counter should be 1 again, NOT 3 — i.e. retry:true, not terminal.
    expect(await processor.handle(event)).toEqual({ ok: false, retry: true });

    await mastra.shutdown();
  });
});
