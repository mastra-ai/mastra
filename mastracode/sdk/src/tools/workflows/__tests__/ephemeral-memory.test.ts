import { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY, RequestContext } from '@mastra/core/request-context';
import { describe, it, expect } from 'vitest';

import { withEphemeralMemory } from '../ephemeral-memory';

describe('withEphemeralMemory', () => {
  it('is a no-op when no requestContext is provided', async () => {
    const result = await withEphemeralMemory(undefined, async () => 42);
    expect(result).toBe(42);
  });

  it('swaps in a fresh MastraMemory that inherits the caller resourceId', async () => {
    const rc = new RequestContext();
    rc.set('MastraMemory', {
      thread: { id: 'parent-thread' },
      resourceId: 'parent-resource',
      memoryConfig: { any: 'thing' },
    });

    let seenInside: any;
    await withEphemeralMemory(rc, async () => {
      seenInside = rc.get('MastraMemory');
    });

    expect(seenInside?.thread?.id).toBeDefined();
    expect(seenInside?.thread?.id).not.toBe('parent-thread');
    expect(seenInside?.resourceId).toBe('parent-resource');
    // Ephemeral scope must not carry the parent's memoryConfig — the fresh
    // thread has no observation history to look up.
    expect(seenInside?.memoryConfig).toBeUndefined();
  });

  it('honors an explicit threadId override (deterministic for tests)', async () => {
    const rc = new RequestContext();
    let seenInside: any;
    await withEphemeralMemory(
      rc,
      async () => {
        seenInside = rc.get('MastraMemory');
      },
      { threadId: 'fixed-uuid' },
    );
    expect(seenInside?.thread?.id).toBe('fixed-uuid');
  });

  it('restores the caller MastraMemory + reserved keys after fn resolves', async () => {
    const rc = new RequestContext();
    rc.set('MastraMemory', { thread: { id: 'parent-thread' }, resourceId: 'parent-resource' });
    rc.set(MASTRA_THREAD_ID_KEY, 'parent-thread');
    rc.set(MASTRA_RESOURCE_ID_KEY, 'parent-resource');

    await withEphemeralMemory(rc, async () => {
      expect(rc.get(MASTRA_THREAD_ID_KEY)).toBeUndefined();
      expect(rc.get(MASTRA_RESOURCE_ID_KEY)).toBe('parent-resource');
    });

    expect((rc.get('MastraMemory') as any)?.thread?.id).toBe('parent-thread');
    expect(rc.get(MASTRA_THREAD_ID_KEY)).toBe('parent-thread');
    expect(rc.get(MASTRA_RESOURCE_ID_KEY)).toBe('parent-resource');
  });

  it('restores the caller memory scope even when fn throws', async () => {
    const rc = new RequestContext();
    rc.set('MastraMemory', { thread: { id: 'parent-thread' }, resourceId: 'parent-resource' });

    await expect(
      withEphemeralMemory(rc, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect((rc.get('MastraMemory') as any)?.thread?.id).toBe('parent-thread');
  });

  it('clears MastraMemory if the caller never set it', async () => {
    const rc = new RequestContext();
    await withEphemeralMemory(rc, async () => {
      expect((rc.get('MastraMemory') as any)?.thread?.id).toBeDefined();
    });
    expect(rc.get('MastraMemory')).toBeUndefined();
  });
});
