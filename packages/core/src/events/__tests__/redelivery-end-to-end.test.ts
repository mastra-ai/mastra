/**
 * End-to-end transport ↔ consumer redelivery test.
 *
 * Two layers cooperate on retries:
 * - `WorkflowEventProcessor.handle()` returns `{ ok, retry }` with a per-event
 *   attempt counter that eventually trips to `retry: false` (terminal) and
 *   publishes `workflow.fail`.
 * - `UnixSocketPubSub` exposes a `nack()` on push callbacks and redelivers up
 *   to `MAX_LOCAL_REDELIVERIES` times.
 *
 * Each layer has its own unit tests. This suite proves the composition:
 * a real callback that wraps `handle()` over a real Unix socket pubsub does
 * the right thing across both
 *   1. K-1 transient failures then success (terminal: workflow.fail NOT
 *      published, event acked, no further redeliveries), and
 *   2. K+1 transient failures (terminal: workflow.fail published exactly
 *      once, event acked, no further redeliveries).
 *
 * The callback mirrors `Mastra`'s real push-subscription wiring in
 * `mastra/index.ts`: ack on `ok: true`, nack on `retry: true`, ack on
 * terminal failure so the transport drops the poisoned event.
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { createStep, createWorkflow } from '../../workflows/evented';
import { WorkflowEventProcessor } from '../../workflows/evented/workflow-event-processor';
import type { Event, EventCallback } from '../types';
import { UnixSocketPubSub } from '../unix-socket-pubsub';

function makeStartEvent(workflowId: string, runId: string, id: string): Event {
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

/**
 * Forces handle() to throw a transient-looking error for the first
 * `failuresLeft` calls that match the targeted runId AND the
 * workflow.start type, then fall through to the real handle().
 *
 * Gating on (runId, type=workflow.start) keeps the cascading
 * `workflow.fail` events that `errorWorkflow` publishes out of the
 * failure stream — otherwise the cascade would re-enter handle() under
 * the same runId, trip a second errorWorkflow run, and pollute the
 * "exactly once" assertion. The error originates from handle() itself
 * (before dispatch) so the WEP's per-event attempt counter increments
 * exactly the same way as on a real `SQLITE_BUSY` from `loadData`.
 */
class FlakyProcessor extends WorkflowEventProcessor {
  public dispatchCalls = 0;
  constructor(
    args: ConstructorParameters<typeof WorkflowEventProcessor>[0],
    private failuresLeft: number,
    private failOnRunId: string,
    private failOnType: string,
  ) {
    super(args);
  }
  override async handle(event: Event): Promise<{ ok: true } | { ok: false; retry: boolean }> {
    this.dispatchCalls++;
    if (event.type === this.failOnType && event.runId === this.failOnRunId && this.failuresLeft > 0) {
      this.failuresLeft--;
      return this.runOnceWithFailure(event);
    }
    return super.handle(event);
  }
  private async runOnceWithFailure(event: Event): Promise<{ ok: true } | { ok: false; retry: boolean }> {
    const original = (this as unknown as { loadData: (args: unknown) => unknown }).loadData;
    (this as unknown as { loadData: (args: unknown) => unknown }).loadData = async () => {
      throw Object.assign(new Error('SQLITE_BUSY: database is locked (test)'), { code: 'SQLITE_BUSY' });
    };
    try {
      return await super.handle(event);
    } finally {
      (this as unknown as { loadData: (args: unknown) => unknown }).loadData = original;
    }
  }
}

/** Builds the same push-subscription wiring Mastra uses internally. */
function makeHandleCallback(processor: WorkflowEventProcessor): EventCallback {
  return (event, ack, nack) => {
    void processor
      .handle(event)
      .then(result => {
        if (result.ok) return ack?.();
        if (result.retry) return nack?.();
        // Terminal failure: ack so the transport drops the poisoned event.
        return ack?.();
      })
      .catch(() => ack?.());
  };
}

describe('redelivery end-to-end (UnixSocketPubSub + WorkflowEventProcessor)', () => {
  let tempDir: string;
  const pubsubs: UnixSocketPubSub[] = [];

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'mastra-redelivery-e2e-'));
  });

  afterEach(async () => {
    for (const ps of pubsubs.splice(0)) {
      try {
        await ps.close();
      } catch {}
    }
    await rm(tempDir, { recursive: true, force: true });
  });

  async function socketPath(name = 'events.sock') {
    return join(tempDir, name);
  }

  async function waitFor(predicate: () => boolean | Promise<boolean>, timeoutMs = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (await predicate()) return;
      await new Promise(r => setTimeout(r, 20));
    }
    if (!(await predicate())) throw new Error(`waitFor timed out after ${timeoutMs}ms`);
  }

  it('K-1 transient failures then success: pubsub redelivers, WEP eventually acks, no workflow.fail', async () => {
    const path = await socketPath('flaky-recovers.sock');
    const pubsub = new UnixSocketPubSub(path);
    pubsubs.push(pubsub);

    const mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      workflows: { wf: makeWorkflow('wf') } as any,
      pubsub,
    });

    // Capture workflow.fail events to assert none are published on the
    // success path. workflow.finish also rides this topic but the noop
    // workflow above completes silently, so workflow.fail is the only
    // observable we need to disprove.
    const failEvents: Event[] = [];
    await pubsub.subscribe('workflows', async event => {
      if (event.type === 'workflow.fail') failEvents.push(event);
    });

    // Fail twice (consumer attempts 1 and 2 throw), succeed on attempt 3 —
    // strictly under MAX_DELIVERY_ATTEMPTS = 3 so the WEP must report `ok`
    // on attempt 3 instead of going terminal.
    const flaky = new FlakyProcessor({ mastra }, 2, 'run-flaky-recovers', 'workflow.start');
    await pubsub.subscribe('workflows', makeHandleCallback(flaky));

    await pubsub.publish('workflows', makeStartEvent('wf', 'run-flaky-recovers', 'event-recovers-1'));

    // Wait until the WEP has been dispatched 3 times: 2 transient failures
    // driven by pubsub nack-redelivery, plus the successful third call. The
    // transport redelivers with a small backoff (REDELIVERY_DELAY_MS *
    // (attempt + 1)) so this resolves quickly but is not synchronous.
    await waitFor(() => flaky.dispatchCalls >= 3);

    // The successful third attempt must not have published workflow.fail.
    // Sample twice to catch a late publish from a stray redelivery.
    await new Promise(r => setTimeout(r, 250));
    expect(failEvents).toEqual([]);

    // And no further redeliveries happen after the success.
    const settled = flaky.dispatchCalls;
    await new Promise(r => setTimeout(r, 500));
    expect(flaky.dispatchCalls).toBe(settled);

    await mastra.shutdown();
  });

  it('K+1 transient failures: WEP trips MAX_DELIVERY_ATTEMPTS, publishes workflow.fail exactly once, pubsub stops', async () => {
    const path = await socketPath('flaky-poisoned.sock');
    const pubsub = new UnixSocketPubSub(path);
    pubsubs.push(pubsub);

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

    // Always-throws on the poisoned (runId, workflow.start) tuple:
    // failuresLeft is far larger than the transport's redelivery cap so
    // we exercise the terminal branch even if every redelivery lands.
    // Gating on (runId, type) lets the cascading workflow.fail event
    // process normally instead of looping the failure.
    const flaky = new FlakyProcessor({ mastra }, 1000, 'run-flaky-poisoned', 'workflow.start');
    await pubsub.subscribe('workflows', makeHandleCallback(flaky));

    await pubsub.publish('workflows', makeStartEvent('wf', 'run-flaky-poisoned', 'event-poisoned-1'));

    // workflow.fail must be published exactly once after the WEP
    // exhausts its per-event budget. The exact dispatchCalls count
    // depends on internal transport scheduling, so we pin the
    // user-visible contract: a single terminal workflow.fail.
    await waitFor(() => failEvents.length >= 1);

    // At least the consumer budget worth of dispatches happened. The
    // cross-layer transport-vs-consumer budget ordering is pinned by
    // unix-socket-pubsub-redelivery-budget.test.ts; here we just prove
    // the consumer side actually trips.
    const consumerBudget = (WorkflowEventProcessor as unknown as { MAX_DELIVERY_ATTEMPTS: number })
      .MAX_DELIVERY_ATTEMPTS;
    expect(flaky.dispatchCalls).toBeGreaterThanOrEqual(consumerBudget);

    // workflow.fail must be published exactly once even though the
    // terminal event itself re-enters the consumer (errorWorkflow
    // publishes workflow.fail to the same `workflows` topic, which
    // every subscriber — including the flaky processor — receives).
    // The TERMINAL_SENTINEL guard in handle() prevents republication
    // on those re-entries.
    await new Promise(r => setTimeout(r, 500));
    expect(failEvents).toHaveLength(1);

    // And the system settles: dispatchCalls eventually stops growing
    // because the consumer acks the terminal failure (no nack) and the
    // sentinel path short-circuits any duplicate redelivery.
    const settled = flaky.dispatchCalls;
    await new Promise(r => setTimeout(r, 500));
    expect(flaky.dispatchCalls).toBe(settled);

    await mastra.shutdown();
  });
});
