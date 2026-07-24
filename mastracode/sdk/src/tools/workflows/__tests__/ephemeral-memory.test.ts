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

  it('stamps the reserved thread/resource keys with the ephemeral ids inside fn', async () => {
    const rc = new RequestContext();
    rc.set('MastraMemory', { thread: { id: 'parent-thread' }, resourceId: 'parent-resource' });
    rc.set(MASTRA_THREAD_ID_KEY, 'parent-thread');
    rc.set(MASTRA_RESOURCE_ID_KEY, 'parent-resource');

    await withEphemeralMemory(
      rc,
      async () => {
        // MASTRA_THREAD_ID_KEY must equal the ephemeral thread id so inner
        // agent invocations resolve to it (resolveThreadIdFromArgs reads this
        // key, not MastraMemory). Downstream storage writes rely on message
        // rows having this threadId stamped.
        expect(rc.get(MASTRA_THREAD_ID_KEY)).toBe('ephemeral-uuid');
        expect(rc.get(MASTRA_RESOURCE_ID_KEY)).toBe('parent-resource');
        expect((rc.get('MastraMemory') as any)?.thread?.id).toBe('ephemeral-uuid');
      },
      { threadId: 'ephemeral-uuid' },
    );

    expect((rc.get('MastraMemory') as any)?.thread?.id).toBe('parent-thread');
    expect(rc.get(MASTRA_THREAD_ID_KEY)).toBe('parent-thread');
    expect(rc.get(MASTRA_RESOURCE_ID_KEY)).toBe('parent-resource');
  });

  it('deletes reserved thread/resource keys on restore when the caller never set them', async () => {
    const rc = new RequestContext();
    // No MastraMemory, no reserved keys.
    await withEphemeralMemory(
      rc,
      async () => {
        expect(rc.get(MASTRA_THREAD_ID_KEY)).toBe('ephemeral-uuid');
      },
      { threadId: 'ephemeral-uuid' },
    );

    expect(rc.get('MastraMemory')).toBeUndefined();
    expect(rc.get(MASTRA_THREAD_ID_KEY)).toBeUndefined();
    expect(rc.get(MASTRA_RESOURCE_ID_KEY)).toBeUndefined();
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
