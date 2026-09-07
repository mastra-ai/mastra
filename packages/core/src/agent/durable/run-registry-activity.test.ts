/**
 * Tests for the activity keep-alive in packages/core/src/agent/durable/run-registry.ts
 *
 * `globalRunRegistry` holds a durable run's non-serializable state behind a
 * sliding TTL that only refreshes on read. A run awaiting a long tool or
 * sub-agent call reads nothing, so without an explicit keep-alive the entry is
 * disposed mid-run — which force-closes the stream and drops the live model.
 * These tests pin both halves: the TTL still evicts abandoned entries, and an
 * actively-held entry survives indefinitely.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __resetRunRegistryActivityForTests,
  globalRunRegistry,
  markRunActive,
  RUN_REGISTRY_TTL_MS,
} from './run-registry';

function seedEntry(runId: string, cleanup: () => void) {
  const entry = { tools: {}, model: { modelId: 'gpt-4o' }, cleanup } as any;
  globalRunRegistry.set(runId, entry);
  return entry;
}

describe('globalRunRegistry activity keep-alive', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance'] });
  });

  afterEach(() => {
    __resetRunRegistryActivityForTests();
    globalRunRegistry.clear();
    vi.useRealTimers();
  });

  it('uses a two-hour TTL as the abandoned-entry safety net', () => {
    expect(RUN_REGISTRY_TTL_MS).toBe(2 * 60 * 60 * 1000);
    expect(globalRunRegistry.ttl).toBe(RUN_REGISTRY_TTL_MS);
  });

  it('keeps an active run alive well past the TTL without disposing it', () => {
    const cleanup = vi.fn();
    const entry = seedEntry('run-active', cleanup);

    const release = markRunActive('run-active');
    vi.advanceTimersByTime(RUN_REGISTRY_TTL_MS * 2);

    // Same object, not a rebuilt one — the live model must survive intact.
    expect(globalRunRegistry.get('run-active')).toBe(entry);
    expect(entry.model).toEqual({ modelId: 'gpt-4o' });
    expect(cleanup).not.toHaveBeenCalled();

    release();
  });

  it('refcounts concurrent claims on the same run', () => {
    seedEntry('run-concurrent', vi.fn());

    const before = vi.getTimerCount();
    const releaseA = markRunActive('run-concurrent');
    const releaseB = markRunActive('run-concurrent');
    expect(vi.getTimerCount()).toBeGreaterThan(before);

    releaseA();
    expect(vi.getTimerCount()).toBeGreaterThan(before);

    releaseB();
    expect(vi.getTimerCount()).toBe(before);
  });

  it('treats a repeated release as a no-op rather than a second decrement', () => {
    const cleanup = vi.fn();
    seedEntry('run-double-release', cleanup);

    const releaseA = markRunActive('run-double-release');
    const releaseB = markRunActive('run-double-release');

    releaseA();
    releaseA();

    // releaseB's claim is still outstanding, so the entry must survive.
    vi.advanceTimersByTime(RUN_REGISTRY_TTL_MS * 2);
    expect(cleanup).not.toHaveBeenCalled();

    releaseB();
  });

  it('stops the heartbeat once the last run releases', () => {
    seedEntry('run-timer', vi.fn());

    const before = vi.getTimerCount();
    const release = markRunActive('run-timer');
    expect(vi.getTimerCount()).toBeGreaterThan(before);

    release();
    expect(vi.getTimerCount()).toBe(before);
  });
});
