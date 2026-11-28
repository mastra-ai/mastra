import { isDeepStrictEqual } from 'node:util';
import { expect, vi } from 'vitest';
import type { Event } from '../../../events/types';
import { WorkflowEventProcessor } from '../workflow-event-processor';
import type { RedeliveryDriver, RedeliveryMatch } from './redelivery-driver';

/** The `handle()` calls a live {@link RedeliveryDriver} recorded, with the work each returned. */
function handledCalls() {
  const handle = vi.mocked(WorkflowEventProcessor.prototype.handle);
  return handle.mock.calls.map(([event], index) => ({ event, result: handle.mock.results[index]?.value }));
}

function withinDeadline<T>(work: Promise<T>, deadline: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} did not settle`)), Math.max(0, deadline - performance.now()));
  });
  return Promise.race([work, expired]).finally(() => clearTimeout(timer));
}

/**
 * Waits until every processor that received one of `events` finished handling it. Needs a live
 * {@link RedeliveryDriver}, whose spy records the calls.
 */
export async function settleDeliveries(events: Event[], timeoutMs = 10_000): Promise<void> {
  const ids = new Set(events.map(event => event.id));
  const work = handledCalls()
    .filter(call => ids.has(call.event.id))
    .map(call => call.result);
  await withinDeadline(Promise.allSettled(work), performance.now() + timeoutMs, 'Handling the deliveries');
}

/**
 * Waits until the processors have no delivery left to handle, including deliveries that handling
 * published. Call it once nothing is held inside a step. Needs a live {@link RedeliveryDriver}.
 */
export async function drainHandlers(timeoutMs = 10_000): Promise<void> {
  const deadline = performance.now() + timeoutMs;
  for (;;) {
    const calls = handledCalls();
    await withinDeadline(
      Promise.allSettled(calls.map(call => call.result)),
      deadline,
      `Processor work (${calls.length} deliveries)`,
    );
    // Handling that just settled may hand events to a subscriber on a later tick.
    await new Promise(resolve => setTimeout(resolve, 0));
    if (handledCalls().length === calls.length) return;
    // Settled work wins the race against an expired timer, so deliveries that keep arriving would
    // otherwise keep this loop going past the deadline.
    if (performance.now() >= deadline) {
      throw new Error(`Processor work did not settle: deliveries kept arriving (${handledCalls().length} so far)`);
    }
  }
}

export const REDELIVERY_MODES = ['publish', 'same-id', 'expired'] as const;

/**
 * COR-1429's EngineDifference compares only agent stream output and model requests;
 * it cannot express tool, step, or workflow execution counts, so those observations
 * use this scenario-local equivalent. It follows the same rules: a reason is
 * required, expect rewrites the correct value, and the check fails once a declared
 * difference converges.
 */
interface RedeliveryDifference<T> {
  reason: string;
  expect: (correct: T) => T;
}

/** Compare the correct outcome, allowing only declared, still-reproducing differences. */
export function expectRedeliveryParity<T extends Record<string, unknown>>(
  actual: T,
  correct: T,
  difference?: RedeliveryDifference<T>,
): void {
  if (!difference) {
    expect(actual).toStrictEqual(correct);
    return;
  }
  expect(difference.reason.trim(), 'A known difference must cite its cause').not.toBe('');
  const expected = difference.expect(structuredClone(correct));
  const keys = new Set([...Object.keys(correct), ...Object.keys(expected)]);
  const entry = (value: T, key: string) => (Object.hasOwn(value, key) ? { [key]: value[key] } : {});
  const changed = [...keys].filter(key => !isDeepStrictEqual(entry(expected, key), entry(correct, key)));
  expect(changed.length, `${difference.reason}: empty difference; remove it`).toBeGreaterThan(0);
  for (const key of changed) {
    expect(
      entry(actual, key),
      `${difference.reason}: '${key}' no longer differs; remove its declaration`,
    ).not.toStrictEqual(entry(correct, key));
  }
  expect(actual, difference.reason).toStrictEqual(expected);
}

/** Wait for processor work, not a side-effect count that only the current bug produces. */
export async function redeliverAndDrain(
  driver: RedeliveryDriver,
  match: RedeliveryMatch,
  mode: (typeof REDELIVERY_MODES)[number],
) {
  const original = driver
    .stepRuns(match)
    .filter(event => event.deliveryAttempt === 1)
    .at(-1)!;
  const deliveriesBefore = driver.deliveryCount(match);
  const handle = vi.mocked(WorkflowEventProcessor.prototype.handle);
  let cursor = handle.mock.results.length;
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setImmediate', 'clearImmediate'] });
  // The lease provider reads Date.now(). Keep the Date constructor intact so
  // captured payload dates retain their identity and cloning semantics.
  const now = Date.now();
  const leaseKey = `workflow-step-run:${original.runId}:${original.id}`;
  let restoreClock: (() => void) | undefined;
  try {
    if (mode !== 'publish') {
      expect(
        await driver.pubsub.getLeaseOwner(leaseKey),
        'The completed delivery must still hold its lease',
      ).toBeDefined();
    }
    if (mode === 'expired') {
      const clock = vi.spyOn(Date, 'now').mockReturnValue(now + WorkflowEventProcessor.STEP_FENCE_TTL_MS + 1);
      restoreClock = () => clock.mockRestore();
      expect(await driver.pubsub.getLeaseOwner(leaseKey), 'The replay must arrive after lease expiry').toBeUndefined();
    }
    // Drain descendants, background dispatch and sleep continuations without
    // waiting for any bug-specific side-effect count.
    let pendingHandlers = 0;
    const failures: unknown[] = [];
    const observe = (value: unknown) => {
      pendingHandlers++;
      void Promise.resolve(value).then(
        () => {
          pendingHandlers--;
        },
        error => {
          pendingHandlers--;
          failures.push(error);
        },
      );
    };
    const pending = driver.redeliver(match, mode === 'publish' ? { viaPublish: true } : { deliveryAttempt: 2 });
    observe(pending);
    const started = performance.now();
    while (cursor < handle.mock.results.length || vi.getTimerCount() > 0 || pendingHandlers > 0) {
      const results = handle.mock.results.slice(cursor);
      cursor += results.length;
      for (const result of results) {
        if (result.type === 'throw') throw result.value;
        observe(result.value);
      }
      // Keep pumping while handlers are pending: they may schedule timers after
      // an asynchronous storage call, so awaiting them first can deadlock.
      await vi.runAllTimersAsync();
      if (failures.length) throw failures[0];
      expect(performance.now() - started, `Replay did not settle (${pendingHandlers} handlers pending)`).toBeLessThan(
        5_000,
      );
    }
    const outcome = await pending;
    expect(outcome.handled).toHaveLength(1);
    // Processor arguments are mutable. Use the transport ingress snapshot,
    // captured by the driver before subscribers see the delivery.
    const event = driver.stepRuns(match)[deliveriesBefore]!;
    if (mode === 'publish') expect(event.id).not.toBe(original.id);
    else expect(event.id).toBe(original.id);
    expect(event.deliveryAttempt).toBe(mode === 'publish' ? 1 : 2);
    expect(event.data).toStrictEqual(original.data);
    expect(outcome.handled[0]?.result.ok).toBe(true);
    expect(driver.deliveryCount(match)).toBe(deliveriesBefore + 1);
    return { ...outcome, event };
  } finally {
    restoreClock?.();
    vi.useRealTimers();
  }
}
