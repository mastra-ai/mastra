/**
 * Harness v1 — `harness.threads.setSettings/getSettings/getSetting`.
 *
 * Settings are a shallow-merge view over `thread.metadata`. The API is
 * intentionally patch-shaped (mirrors `Session.setState()`) so callers don't
 * have to learn a second write model. These tests pin the diff / event /
 * scope behavior:
 *
 *   - patch merges, `undefined` removes
 *   - no-op writes don't bump `updatedAt` or emit an event
 *   - `thread_settings_changed` carries only real diffs + actual removals
 *   - cross-resource access throws `HarnessThreadNotFoundError`
 *   - `getSetting()` is a thin sugar over `getSettings()`
 *   - `getSettings()` snapshot is frozen and decoupled from later writes
 */

import { describe, expect, it } from 'vitest';

import { setupHarness } from './__test-utils__';
import { HarnessThreadNotFoundError } from './errors';
import type { HarnessEvent, ThreadSettingsChangedEvent } from './events';

function captureEvents(harness: ReturnType<typeof setupHarness>['harness']): HarnessEvent[] {
  const events: HarnessEvent[] = [];
  harness.subscribe(e => {
    events.push(e);
  });
  return events;
}

describe('harness.threads.setSettings()', () => {
  it('merges a patch into thread metadata and emits thread_settings_changed', async () => {
    const { harness } = setupHarness();
    const thread = await harness.threads.create({
      resourceId: 'r1',
      title: 't',
      metadata: { existing: 'keep-me' },
    });
    const events = captureEvents(harness);

    await harness.threads.setSettings({
      resourceId: 'r1',
      threadId: thread.id,
      patch: { observationThreshold: 5, color: 'red' },
    });

    const settings = await harness.threads.getSettings({ resourceId: 'r1', threadId: thread.id });
    expect(settings).toEqual({
      existing: 'keep-me',
      observationThreshold: 5,
      color: 'red',
    });

    const change = events.find(e => e.type === 'thread_settings_changed') as ThreadSettingsChangedEvent;
    expect(change).toBeDefined();
    expect(change.threadId).toBe(thread.id);
    expect(change.resourceId).toBe('r1');
    expect(change.patch).toEqual({ observationThreshold: 5, color: 'red' });
    expect(change.removedKeys).toEqual([]);
  });

  it('removes keys whose patch value is undefined', async () => {
    const { harness } = setupHarness();
    const thread = await harness.threads.create({
      resourceId: 'r1',
      title: 't',
      metadata: { stale: 'gone-soon', kept: 1 },
    });
    const events = captureEvents(harness);

    await harness.threads.setSettings({
      resourceId: 'r1',
      threadId: thread.id,
      patch: { stale: undefined },
    });

    const settings = await harness.threads.getSettings({ resourceId: 'r1', threadId: thread.id });
    expect(settings).toEqual({ kept: 1 });

    const change = events.find(e => e.type === 'thread_settings_changed') as ThreadSettingsChangedEvent;
    expect(change.removedKeys).toEqual(['stale']);
    expect(change.patch).toEqual({});
  });

  it('omits keys that did not actually change from the emitted patch', async () => {
    const { harness } = setupHarness();
    const thread = await harness.threads.create({
      resourceId: 'r1',
      title: 't',
      metadata: { same: 'value', other: 'a' },
    });
    const events = captureEvents(harness);

    await harness.threads.setSettings({
      resourceId: 'r1',
      threadId: thread.id,
      patch: { same: 'value', other: 'b' },
    });

    const change = events.find(e => e.type === 'thread_settings_changed') as ThreadSettingsChangedEvent;
    // `same: 'value'` was already there — must not appear in the effective
    // patch even though the caller included it.
    expect(change.patch).toEqual({ other: 'b' });
    expect(change.removedKeys).toEqual([]);
  });

  it('is a silent no-op when the patch makes no real change', async () => {
    const { harness } = setupHarness();
    const thread = await harness.threads.create({
      resourceId: 'r1',
      title: 't',
      metadata: { a: 1 },
    });
    const events = captureEvents(harness);

    await harness.threads.setSettings({
      resourceId: 'r1',
      threadId: thread.id,
      patch: { a: 1, missing: undefined },
    });

    expect(events.find(e => e.type === 'thread_settings_changed')).toBeUndefined();
    const settings = await harness.threads.getSettings({ resourceId: 'r1', threadId: thread.id });
    expect(settings).toEqual({ a: 1 });
  });

  it('preserves keys not mentioned in the patch', async () => {
    const { harness } = setupHarness();
    const thread = await harness.threads.create({
      resourceId: 'r1',
      title: 't',
      metadata: { keepA: 'A', keepB: 'B' },
    });

    await harness.threads.setSettings({
      resourceId: 'r1',
      threadId: thread.id,
      patch: { keepA: 'A-prime' },
    });

    const settings = await harness.threads.getSettings({ resourceId: 'r1', threadId: thread.id });
    expect(settings).toEqual({ keepA: 'A-prime', keepB: 'B' });
  });

  it('throws HarnessThreadNotFoundError on a missing thread', async () => {
    const { harness } = setupHarness();
    await expect(
      harness.threads.setSettings({
        resourceId: 'r1',
        threadId: 'thread-does-not-exist',
        patch: { x: 1 },
      }),
    ).rejects.toBeInstanceOf(HarnessThreadNotFoundError);
  });

  it('throws HarnessThreadNotFoundError when the thread belongs to another resource', async () => {
    const { harness } = setupHarness();
    const foreign = await harness.threads.create({ resourceId: 'other', title: 't' });
    await expect(
      harness.threads.setSettings({
        resourceId: 'r1',
        threadId: foreign.id,
        patch: { x: 1 },
      }),
    ).rejects.toBeInstanceOf(HarnessThreadNotFoundError);
  });
});

describe('harness.threads.getSettings() / getSetting()', () => {
  it('returns an empty object when the thread has no metadata', async () => {
    const { harness } = setupHarness();
    const thread = await harness.threads.create({ resourceId: 'r1', title: 't' });
    const settings = await harness.threads.getSettings({ resourceId: 'r1', threadId: thread.id });
    expect(settings).toEqual({});
  });

  it('returns a frozen snapshot decoupled from later writes', async () => {
    const { harness } = setupHarness();
    const thread = await harness.threads.create({
      resourceId: 'r1',
      title: 't',
      metadata: { a: 1 },
    });

    const snapshot = await harness.threads.getSettings({ resourceId: 'r1', threadId: thread.id });
    expect(snapshot).toEqual({ a: 1 });
    expect(Object.isFrozen(snapshot)).toBe(true);

    await harness.threads.setSettings({
      resourceId: 'r1',
      threadId: thread.id,
      patch: { a: 2 },
    });

    // Snapshot is decoupled — still shows the old value.
    expect(snapshot).toEqual({ a: 1 });
  });

  it('getSetting returns the value for a known key, undefined otherwise', async () => {
    const { harness } = setupHarness();
    const thread = await harness.threads.create({
      resourceId: 'r1',
      title: 't',
      metadata: { knownKey: 'hello' },
    });

    await expect(harness.threads.getSetting({ resourceId: 'r1', threadId: thread.id, key: 'knownKey' })).resolves.toBe(
      'hello',
    );
    await expect(
      harness.threads.getSetting({ resourceId: 'r1', threadId: thread.id, key: 'missing' }),
    ).resolves.toBeUndefined();
  });

  it('throws HarnessThreadNotFoundError on a missing thread', async () => {
    const { harness } = setupHarness();
    await expect(harness.threads.getSettings({ resourceId: 'r1', threadId: 'no-such-thread' })).rejects.toBeInstanceOf(
      HarnessThreadNotFoundError,
    );
    await expect(
      harness.threads.getSetting({ resourceId: 'r1', threadId: 'no-such-thread', key: 'x' }),
    ).rejects.toBeInstanceOf(HarnessThreadNotFoundError);
  });
});
