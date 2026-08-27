import { afterEach, describe, expect, it, vi } from 'vitest';

import type { RemindLane, RemindRequestFailureStatus } from '../subconscious/remind-request-state';
import { LANE_TURN_DEADLINE_MS, RemindRequestRegistry } from '../subconscious/remind-request-state';

const lane: RemindLane = { remindThreadId: 'subconscious:alpha:remind', resourceId: 'user-42' };
const otherLane: RemindLane = { remindThreadId: 'subconscious:beta:remind', resourceId: 'user-99' };

function register(registry: RemindRequestRegistry, correlationId: string, laneOverride: RemindLane = lane) {
  return registry.create({
    correlationId,
    question: 'what did I say about the migration?',
    lane: laneOverride,
    parentThreadId: 'alpha',
  });
}

const registries: RemindRequestRegistry[] = [];
function makeRegistry(options?: { retentionMs?: number }) {
  const registry = new RemindRequestRegistry(options);
  registries.push(registry);
  return registry;
}

afterEach(() => {
  while (registries.length) registries.pop()!.dispose();
  vi.useRealTimers();
});

describe('RemindRequestRegistry', () => {
  it('registers a request as pending under the caller-supplied correlation id', () => {
    const registry = makeRegistry();
    const record = register(registry, 'remind-ask-1');

    expect(record.correlationId).toBe('remind-ask-1');
    expect(record.status).toBe('pending');
    expect(record.lane).toEqual(lane);
    expect(record.parentThreadId).toBe('alpha');
    expect(record.deadlineAt - record.createdAt).toBe(LANE_TURN_DEADLINE_MS);
    expect(registry.get('remind-ask-1')?.status).toBe('pending');
  });

  it('rejects a second registration of the same correlation id', () => {
    const registry = makeRegistry();
    register(registry, 'remind-ask-dup');
    expect(() => register(registry, 'remind-ask-dup')).toThrow(/already exists/);
  });

  it('resolves the blocking waiter with a correlated answer when the reply wins', async () => {
    const registry = makeRegistry();
    const record = register(registry, 'remind-ask-2');

    const completion = registry.complete(
      'remind-ask-2',
      { ok: true, correlationId: 'remind-ask-2', status: 'replied', answer: 'you said friday' },
      lane,
    );

    expect(completion.outcome).toBe('settled');
    await expect(record.settled).resolves.toEqual({
      ok: true,
      correlationId: 'remind-ask-2',
      status: 'replied',
      answer: 'you said friday',
    });
    expect(registry.get('remind-ask-2')?.status).toBe('replied');
  });

  const failureStatuses: RemindRequestFailureStatus[] = [
    'timed_out',
    'model_failed',
    'tool_failed',
    'aborted',
    'delivery_failed',
  ];

  it.each(failureStatuses)('resolves the blocking waiter with a correlated %s failure', async status => {
    const registry = makeRegistry();
    const record = register(registry, `remind-ask-${status}`);

    registry.complete(`remind-ask-${status}`, {
      ok: false,
      correlationId: `remind-ask-${status}`,
      status,
      error: `boom: ${status}`,
    });

    await expect(record.settled).resolves.toEqual({
      ok: false,
      correlationId: `remind-ask-${status}`,
      status,
      error: `boom: ${status}`,
    });
    expect(registry.get(`remind-ask-${status}`)?.status).toBe(status);
  });

  it('keeps the first terminal result when a later failure races the reply', async () => {
    const registry = makeRegistry();
    const record = register(registry, 'remind-ask-3');

    registry.complete('remind-ask-3', {
      ok: true,
      correlationId: 'remind-ask-3',
      status: 'replied',
      answer: 'first wins',
    });
    const late = registry.complete('remind-ask-3', {
      ok: false,
      correlationId: 'remind-ask-3',
      status: 'model_failed',
      error: 'run blew up afterwards',
    });

    expect(late).toEqual({
      outcome: 'rejected',
      reason: 'conflict',
      result: { ok: true, correlationId: 'remind-ask-3', status: 'replied', answer: 'first wins' },
    });
    await expect(record.settled).resolves.toMatchObject({ status: 'replied', answer: 'first wins' });
    expect(registry.get('remind-ask-3')?.status).toBe('replied');
  });

  it('returns the stored result for an exact retry instead of settling twice', async () => {
    const registry = makeRegistry();
    const record = register(registry, 'remind-ask-4');
    const result = {
      ok: true as const,
      correlationId: 'remind-ask-4',
      status: 'replied' as const,
      answer: 'idempotent',
    };

    expect(registry.complete('remind-ask-4', result).outcome).toBe('settled');
    const retry = registry.complete('remind-ask-4', { ...result });

    expect(retry).toEqual({ outcome: 'duplicate', result });
    await expect(record.settled).resolves.toEqual(result);
  });

  it('rejects a completion that disagrees with the recorded terminal result', () => {
    const registry = makeRegistry();
    register(registry, 'remind-ask-5');
    registry.complete('remind-ask-5', {
      ok: true,
      correlationId: 'remind-ask-5',
      status: 'replied',
      answer: 'original',
    });

    const conflicting = registry.complete('remind-ask-5', {
      ok: true,
      correlationId: 'remind-ask-5',
      status: 'replied',
      answer: 'a different answer',
    });

    expect(conflicting).toMatchObject({ outcome: 'rejected', reason: 'conflict' });
  });

  it('rejects an unknown correlation id without creating a record', () => {
    const registry = makeRegistry();

    const completion = registry.complete('remind-ask-never-seen', {
      ok: true,
      correlationId: 'remind-ask-never-seen',
      status: 'replied',
      answer: 'nope',
    });

    expect(completion).toEqual({ outcome: 'rejected', reason: 'unknown' });
    expect(registry.size).toBe(0);
  });

  it('rejects a completion presented under the wrong lane', async () => {
    const registry = makeRegistry();
    const record = register(registry, 'remind-ask-6');

    const completion = registry.complete(
      'remind-ask-6',
      { ok: true, correlationId: 'remind-ask-6', status: 'replied', answer: 'wrong lane' },
      otherLane,
    );

    expect(completion).toEqual({ outcome: 'rejected', reason: 'wrong_lane' });
    expect(registry.get('remind-ask-6')?.status).toBe('pending');
    await expect(Promise.race([record.settled, Promise.resolve('still-pending')])).resolves.toBe('still-pending');
  });

  it('associates a request with the run that accepted it and fails only that run', () => {
    const registry = makeRegistry();
    register(registry, 'remind-ask-run-a1');
    register(registry, 'remind-ask-run-a2');
    register(registry, 'remind-ask-run-b1', otherLane);

    registry.associateRun('remind-ask-run-a1', 'run-a');
    registry.associateRun('remind-ask-run-a2', 'run-a');
    registry.associateRun('remind-ask-run-b1', 'run-b');

    expect(registry.pendingForRun('run-a').sort()).toEqual(['remind-ask-run-a1', 'remind-ask-run-a2']);
    expect(registry.pendingForRun('run-b')).toEqual(['remind-ask-run-b1']);

    registry.complete('remind-ask-run-a1', {
      ok: true,
      correlationId: 'remind-ask-run-a1',
      status: 'replied',
      answer: 'done',
    });
    expect(registry.pendingForRun('run-a')).toEqual(['remind-ask-run-a2']);
  });

  it('times out once and refuses a later reply for the same request', async () => {
    vi.useFakeTimers();
    const registry = makeRegistry();
    const record = registry.create({
      correlationId: 'remind-ask-7',
      question: 'q',
      lane,
      parentThreadId: 'alpha',
      deadlineMs: 50,
    });

    await vi.advanceTimersByTimeAsync(50);
    await expect(record.settled).resolves.toMatchObject({ ok: false, status: 'timed_out' });

    const late = registry.complete('remind-ask-7', {
      ok: true,
      correlationId: 'remind-ask-7',
      status: 'replied',
      answer: 'too late',
    });
    expect(late).toMatchObject({ outcome: 'rejected', reason: 'conflict' });
    expect(registry.get('remind-ask-7')?.status).toBe('timed_out');
  });

  it('prunes a settled record only after the retention window, and never prunes pending work', async () => {
    vi.useFakeTimers();
    const registry = makeRegistry({ retentionMs: 1_000 });
    register(registry, 'remind-ask-settled');
    register(registry, 'remind-ask-pending');

    registry.complete('remind-ask-settled', {
      ok: true,
      correlationId: 'remind-ask-settled',
      status: 'replied',
      answer: 'kept for a while',
    });

    await vi.advanceTimersByTimeAsync(999);
    expect(registry.get('remind-ask-settled')).toMatchObject({ status: 'replied' });

    await vi.advanceTimersByTimeAsync(2);
    expect(registry.get('remind-ask-settled')).toBeUndefined();
    expect(registry.get('remind-ask-pending')?.status).toBe('pending');
    expect(registry.size).toBe(1);

    const afterExpiry = registry.complete('remind-ask-settled', {
      ok: true,
      correlationId: 'remind-ask-settled',
      status: 'replied',
      answer: 'kept for a while',
    });
    expect(afterExpiry).toEqual({ outcome: 'rejected', reason: 'unknown' });
  });

  it('prunes on demand without touching another lane\u2019s pending request', () => {
    const registry = makeRegistry({ retentionMs: 0 });
    register(registry, 'remind-ask-lane-a');
    register(registry, 'remind-ask-lane-b', otherLane);

    registry.complete('remind-ask-lane-a', {
      ok: false,
      correlationId: 'remind-ask-lane-a',
      status: 'delivery_failed',
      error: 'lane refused delivery',
    });
    registry.prune(Date.now() + 1);

    expect(registry.get('remind-ask-lane-a')).toBeUndefined();
    expect(registry.get('remind-ask-lane-b')?.status).toBe('pending');
  });

  it('settles pending waiters as aborted when the registry is disposed', async () => {
    const registry = new RemindRequestRegistry();
    const record = registry.create({
      correlationId: 'remind-ask-disposed',
      question: 'q',
      lane,
      parentThreadId: 'alpha',
    });

    registry.dispose();

    await expect(record.settled).resolves.toMatchObject({ ok: false, status: 'aborted' });
    expect(registry.size).toBe(0);
  });
});
