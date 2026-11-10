import { isDeepStrictEqual } from 'node:util';
import { expect, vi } from 'vitest';
import { WorkflowEventProcessor } from '../workflow-event-processor';
import type { RedeliveryDriver, RedeliveryMatch } from './redelivery-driver';

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
