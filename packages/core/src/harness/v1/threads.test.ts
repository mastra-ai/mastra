/**
 * Harness v1 — `harness.threads.*` API (§4.4 / §5.2).
 *
 * Covers:
 *   - CRUD: create / list / get / rename / clone / selectOrCreate / delete
 *   - resource scoping: cross-resource reads return null, cross-resource
 *     writes throw `HarnessThreadNotFoundError`, cross-resource deletes are
 *     silent no-ops
 *   - cascade-on-delete: deleting a thread that has a live session walks
 *     `loadSessionByThread` and closes the session before deleting the row
 *   - lifecycle events: `thread_created`, `thread_renamed`, `thread_cloned`,
 *     `thread_deleted` fire on the harness emitter with the right payload
 */

import { describe, expect, it } from 'vitest';

import { setupHarness } from './__test-utils__';
import { HarnessThreadNotFoundError } from './errors';
import type { HarnessEvent } from './events';

// Default `setupHarness()` builds a standalone Harness with a default
// `InMemoryStore`, which gives us both the harness storage domain and the
// memory storage domain (used by thread CRUD) backed by a single in-memory
// db. That's the exact wiring the thread API needs.

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

describe('harness.threads — CRUD', () => {
  it('creates a thread with a minted id and round-trips through get()', async () => {
    const { harness } = setupHarness();

    const thread = await harness.threads.create({
      resourceId: 'r1',
      title: 'first',
      metadata: { color: 'red' },
    });
    expect(thread.id).toMatch(/^thread-/);
    expect(thread.resourceId).toBe('r1');
    expect(thread.title).toBe('first');
    expect(thread.metadata).toEqual({ color: 'red' });

    const fetched = await harness.threads.get({ resourceId: 'r1', threadId: thread.id });
    expect(fetched).not.toBeNull();
    expect(fetched!.id).toBe(thread.id);
    expect(fetched!.title).toBe('first');
  });

  it('honors a caller-supplied threadId when creating', async () => {
    const { harness } = setupHarness();
    const thread = await harness.threads.create({
      resourceId: 'r1',
      threadId: 'thread-explicit-1',
      title: 'pinned',
    });
    expect(thread.id).toBe('thread-explicit-1');
  });

  it('lists threads for a resource', async () => {
    const { harness } = setupHarness();
    await harness.threads.create({ resourceId: 'r1', title: 'a' });
    await harness.threads.create({ resourceId: 'r1', title: 'b' });
    await harness.threads.create({ resourceId: 'other', title: 'foreign' });

    const out = await harness.threads.list({ resourceId: 'r1' });
    expect(out.threads).toHaveLength(2);
    expect(new Set(out.threads.map(t => t.title))).toEqual(new Set(['a', 'b']));
  });

  it('renames a thread, persists the new title, and returns the updated record', async () => {
    const { harness } = setupHarness();
    const created = await harness.threads.create({ resourceId: 'r1', title: 'old' });

    const renamed = await harness.threads.rename({
      resourceId: 'r1',
      threadId: created.id,
      title: 'new',
    });
    expect(renamed.title).toBe('new');

    const fetched = await harness.threads.get({ resourceId: 'r1', threadId: created.id });
    expect(fetched!.title).toBe('new');
  });

  it('rename merges metadata patches over existing metadata', async () => {
    const { harness } = setupHarness();
    const created = await harness.threads.create({
      resourceId: 'r1',
      title: 't',
      metadata: { keep: 1, override: 'old' },
    });
    const renamed = await harness.threads.rename({
      resourceId: 'r1',
      threadId: created.id,
      title: 't2',
      metadata: { override: 'new', extra: true },
    });
    expect(renamed.metadata).toMatchObject({ keep: 1, override: 'new', extra: true });
  });

  it('clones a thread into a new id under the same resource', async () => {
    const { harness } = setupHarness();
    const source = await harness.threads.create({ resourceId: 'r1', title: 'orig' });

    const clone = await harness.threads.clone({
      resourceId: 'r1',
      threadId: source.id,
      title: 'orig (clone)',
    });
    expect(clone.id).not.toBe(source.id);
    expect(clone.resourceId).toBe('r1');
    expect(clone.title).toBe('orig (clone)');

    // Both threads visible in list().
    const out = await harness.threads.list({ resourceId: 'r1' });
    expect(out.threads.map(t => t.id).sort()).toEqual([source.id, clone.id].sort());
  });

  it('selectOrCreate returns an existing thread when threadId is owned by the resource', async () => {
    const { harness } = setupHarness();
    const created = await harness.threads.create({ resourceId: 'r1', title: 'pinned' });

    const result = await harness.threads.selectOrCreate({
      resourceId: 'r1',
      threadId: created.id,
    });
    expect(result.id).toBe(created.id);
    expect(result.title).toBe('pinned');
  });

  it('selectOrCreate creates a fresh thread when no threadId is supplied', async () => {
    const { harness } = setupHarness();
    const result = await harness.threads.selectOrCreate({
      resourceId: 'r1',
      title: 'fresh',
    });
    expect(result.id).toMatch(/^thread-/);
    expect(result.title).toBe('fresh');
  });

  it('selectOrCreate creates a thread with the supplied id when not found', async () => {
    const { harness } = setupHarness();
    const result = await harness.threads.selectOrCreate({
      resourceId: 'r1',
      threadId: 'thread-pinned',
      title: 'lazy',
    });
    expect(result.id).toBe('thread-pinned');
  });

  it('deletes a thread and removes it from list()', async () => {
    const { harness } = setupHarness();
    const created = await harness.threads.create({ resourceId: 'r1', title: 't' });
    await harness.threads.delete({ resourceId: 'r1', threadId: created.id });

    const fetched = await harness.threads.get({ resourceId: 'r1', threadId: created.id });
    expect(fetched).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Resource scoping
// ---------------------------------------------------------------------------

describe('harness.threads — resource scoping', () => {
  it('get() returns null for a thread owned by a different resource', async () => {
    const { harness } = setupHarness();
    const created = await harness.threads.create({ resourceId: 'r1', title: 't' });
    const fetched = await harness.threads.get({ resourceId: 'r2', threadId: created.id });
    expect(fetched).toBeNull();
  });

  it('list() filters strictly by resourceId', async () => {
    const { harness } = setupHarness();
    await harness.threads.create({ resourceId: 'r1', title: 'mine' });
    await harness.threads.create({ resourceId: 'r2', title: 'theirs' });

    const out1 = await harness.threads.list({ resourceId: 'r1' });
    expect(out1.threads.map(t => t.title)).toEqual(['mine']);

    const out2 = await harness.threads.list({ resourceId: 'r2' });
    expect(out2.threads.map(t => t.title)).toEqual(['theirs']);
  });

  it('rename() throws HarnessThreadNotFoundError for cross-resource access', async () => {
    const { harness } = setupHarness();
    const created = await harness.threads.create({ resourceId: 'r1', title: 't' });
    await expect(harness.threads.rename({ resourceId: 'r2', threadId: created.id, title: 'x' })).rejects.toThrow(
      HarnessThreadNotFoundError,
    );
  });

  it('clone() throws HarnessThreadNotFoundError for cross-resource access', async () => {
    const { harness } = setupHarness();
    const created = await harness.threads.create({ resourceId: 'r1', title: 't' });
    await expect(harness.threads.clone({ resourceId: 'r2', threadId: created.id })).rejects.toThrow(
      HarnessThreadNotFoundError,
    );
  });

  it('delete() is a silent no-op for cross-resource access', async () => {
    const { harness } = setupHarness();
    const created = await harness.threads.create({ resourceId: 'r1', title: 't' });

    // Cross-tenant delete must not leak existence.
    await expect(harness.threads.delete({ resourceId: 'r2', threadId: created.id })).resolves.toBeUndefined();

    // Thread should still exist for its real owner.
    const fetched = await harness.threads.get({ resourceId: 'r1', threadId: created.id });
    expect(fetched).not.toBeNull();
  });

  it('rename/clone on a totally missing thread throws HarnessThreadNotFoundError', async () => {
    const { harness } = setupHarness();
    await expect(harness.threads.rename({ resourceId: 'r1', threadId: 'thread-missing', title: 'x' })).rejects.toThrow(
      HarnessThreadNotFoundError,
    );
    await expect(harness.threads.clone({ resourceId: 'r1', threadId: 'thread-missing' })).rejects.toThrow(
      HarnessThreadNotFoundError,
    );
  });
});

// ---------------------------------------------------------------------------
// Cascade on delete
// ---------------------------------------------------------------------------

describe('harness.threads — cascade-on-delete', () => {
  it('closes a live session bound to the thread before deleting', async () => {
    const { harness } = setupHarness();
    const thread = await harness.threads.create({ resourceId: 'r1', title: 't' });

    // Open a session that adopts this thread.
    const session = await harness.session({ threadId: thread.id, resourceId: 'r1' });
    expect(session.isClosed).toBe(false);

    await harness.threads.delete({ resourceId: 'r1', threadId: thread.id });

    // The live session must have been cascade-closed.
    expect(session.isClosed).toBe(true);

    // The thread must be gone.
    const fetched = await harness.threads.get({ resourceId: 'r1', threadId: thread.id });
    expect(fetched).toBeNull();
  });

  it('deletes cleanly when no live session exists', async () => {
    const { harness } = setupHarness();
    const thread = await harness.threads.create({ resourceId: 'r1', title: 't' });
    await expect(harness.threads.delete({ resourceId: 'r1', threadId: thread.id })).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Lifecycle events
// ---------------------------------------------------------------------------

describe('harness.threads — lifecycle events', () => {
  it('emits thread_created on create()', async () => {
    const { harness } = setupHarness();
    const seen: HarnessEvent[] = [];
    harness.subscribe(ev => seen.push(ev));

    const t = await harness.threads.create({ resourceId: 'r1', title: 'first' });
    const created = seen.find(e => e.type === 'thread_created');
    expect(created).toBeDefined();
    expect(created).toMatchObject({
      type: 'thread_created',
      threadId: t.id,
      resourceId: 'r1',
      title: 'first',
    });
  });

  it('emits thread_renamed with previousTitle on rename()', async () => {
    const { harness } = setupHarness();
    const t = await harness.threads.create({ resourceId: 'r1', title: 'old' });

    const seen: HarnessEvent[] = [];
    harness.subscribe(ev => seen.push(ev));

    await harness.threads.rename({ resourceId: 'r1', threadId: t.id, title: 'new' });

    const renamed = seen.find(e => e.type === 'thread_renamed');
    expect(renamed).toMatchObject({
      type: 'thread_renamed',
      threadId: t.id,
      resourceId: 'r1',
      title: 'new',
      previousTitle: 'old',
    });
  });

  it('emits thread_cloned with sourceThreadId on clone()', async () => {
    const { harness } = setupHarness();
    const src = await harness.threads.create({ resourceId: 'r1', title: 'orig' });

    const seen: HarnessEvent[] = [];
    harness.subscribe(ev => seen.push(ev));

    const clone = await harness.threads.clone({ resourceId: 'r1', threadId: src.id });

    const ev = seen.find(e => e.type === 'thread_cloned');
    expect(ev).toMatchObject({
      type: 'thread_cloned',
      threadId: clone.id,
      resourceId: 'r1',
      sourceThreadId: src.id,
    });
  });

  it('emits thread_deleted with cascadedSessionClose=false when no session existed', async () => {
    const { harness } = setupHarness();
    const t = await harness.threads.create({ resourceId: 'r1', title: 't' });

    const seen: HarnessEvent[] = [];
    harness.subscribe(ev => seen.push(ev));

    await harness.threads.delete({ resourceId: 'r1', threadId: t.id });

    const ev = seen.find(e => e.type === 'thread_deleted');
    expect(ev).toMatchObject({
      type: 'thread_deleted',
      threadId: t.id,
      resourceId: 'r1',
      cascadedSessionClose: false,
    });
  });

  it('emits thread_deleted with cascadedSessionClose=true when a live session was closed', async () => {
    const { harness } = setupHarness();
    const t = await harness.threads.create({ resourceId: 'r1', title: 't' });
    await harness.session({ threadId: t.id, resourceId: 'r1' });

    const seen: HarnessEvent[] = [];
    harness.subscribe(ev => seen.push(ev));

    await harness.threads.delete({ resourceId: 'r1', threadId: t.id });

    const ev = seen.find(e => e.type === 'thread_deleted');
    expect(ev).toMatchObject({
      type: 'thread_deleted',
      threadId: t.id,
      resourceId: 'r1',
      cascadedSessionClose: true,
    });
  });

  it('does not emit thread_deleted on a silent cross-resource no-op', async () => {
    const { harness } = setupHarness();
    const t = await harness.threads.create({ resourceId: 'r1', title: 't' });

    const seen: HarnessEvent[] = [];
    harness.subscribe(ev => seen.push(ev));

    await harness.threads.delete({ resourceId: 'r2', threadId: t.id });

    expect(seen.find(e => e.type === 'thread_deleted')).toBeUndefined();
  });
});
