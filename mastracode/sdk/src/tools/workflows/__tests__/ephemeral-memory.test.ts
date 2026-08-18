import { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY, RequestContext } from '@mastra/core/request-context';
import { describe, it, expect } from 'vitest';

import { withEphemeralMemory } from '../ephemeral-memory';

describe('withEphemeralMemory', () => {
  it('passes undefined through when no requestContext is provided', async () => {
    const result = await withEphemeralMemory(undefined, async requestContext => requestContext ?? 42);
    expect(result).toBe(42);
  });

  it('creates an isolated child context that inherits caller values and resourceId', async () => {
    const rc = new RequestContext();
    rc.set('controller', { session: { modelId: 'mock-model' } });
    rc.set('MastraMemory', {
      thread: { id: 'parent-thread' },
      resourceId: 'parent-resource',
      memoryConfig: { any: 'thing' },
    });

    await withEphemeralMemory(rc, async childRequestContext => {
      expect(childRequestContext).not.toBe(rc);
      expect(childRequestContext?.get('controller')).toEqual({ session: { modelId: 'mock-model' } });
      expect((childRequestContext?.get('MastraMemory') as any)?.thread?.id).toBeDefined();
      expect((childRequestContext?.get('MastraMemory') as any)?.thread?.id).not.toBe('parent-thread');
      expect((childRequestContext?.get('MastraMemory') as any)?.resourceId).toBe('parent-resource');
      expect((childRequestContext?.get('MastraMemory') as any)?.memoryConfig).toBeUndefined();
    });

    expect((rc.get('MastraMemory') as any)?.thread?.id).toBe('parent-thread');
  });

  it('honors an explicit threadId override', async () => {
    const rc = new RequestContext();

    await withEphemeralMemory(
      rc,
      async childRequestContext => {
        expect((childRequestContext?.get('MastraMemory') as any)?.thread?.id).toBe('fixed-uuid');
      },
      { threadId: 'fixed-uuid' },
    );
  });

  it('stamps the child reserved thread/resource keys with the ephemeral ids', async () => {
    const rc = new RequestContext();
    rc.set('MastraMemory', { thread: { id: 'parent-thread' }, resourceId: 'parent-resource' });
    rc.set(MASTRA_THREAD_ID_KEY, 'parent-thread');
    rc.set(MASTRA_RESOURCE_ID_KEY, 'parent-resource');

    await withEphemeralMemory(
      rc,
      async childRequestContext => {
        expect(childRequestContext?.get(MASTRA_THREAD_ID_KEY)).toBe('ephemeral-uuid');
        expect(childRequestContext?.get(MASTRA_RESOURCE_ID_KEY)).toBe('parent-resource');
        expect((childRequestContext?.get('MastraMemory') as any)?.thread?.id).toBe('ephemeral-uuid');
      },
      { threadId: 'ephemeral-uuid' },
    );

    expect(rc.get(MASTRA_THREAD_ID_KEY)).toBe('parent-thread');
    expect(rc.get(MASTRA_RESOURCE_ID_KEY)).toBe('parent-resource');
  });

  it('does not add reserved keys to the parent when the caller never set them', async () => {
    const rc = new RequestContext();

    await withEphemeralMemory(
      rc,
      async childRequestContext => {
        expect(childRequestContext?.get(MASTRA_THREAD_ID_KEY)).toBe('ephemeral-uuid');
        expect(childRequestContext?.get(MASTRA_RESOURCE_ID_KEY)).toBeUndefined();
      },
      { threadId: 'ephemeral-uuid' },
    );

    expect(rc.get('MastraMemory')).toBeUndefined();
    expect(rc.get(MASTRA_THREAD_ID_KEY)).toBeUndefined();
    expect(rc.get(MASTRA_RESOURCE_ID_KEY)).toBeUndefined();
  });

  it('inherits MastraMemory.resourceId without adding the reserved resource key to the parent', async () => {
    const rc = new RequestContext();
    rc.set('MastraMemory', { thread: { id: 'parent-thread' }, resourceId: 'memory-resource' });

    await withEphemeralMemory(rc, async childRequestContext => {
      expect(childRequestContext?.get(MASTRA_RESOURCE_ID_KEY)).toBe('memory-resource');
    });

    expect(rc.get(MASTRA_RESOURCE_ID_KEY)).toBeUndefined();
  });

  it('leaves the parent unchanged when fn throws', async () => {
    const rc = new RequestContext();
    const parentMemory = { thread: { id: 'parent-thread' }, resourceId: 'parent-resource' };
    rc.set('MastraMemory', parentMemory);

    await expect(
      withEphemeralMemory(rc, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(rc.get('MastraMemory')).toBe(parentMemory);
  });

  it('isolates concurrent child contexts from each other and the parent', async () => {
    const rc = new RequestContext();
    rc.set(MASTRA_THREAD_ID_KEY, 'parent-thread');

    const seen = await Promise.all([
      withEphemeralMemory(
        rc,
        async childRequestContext => {
          await Promise.resolve();
          return childRequestContext?.get(MASTRA_THREAD_ID_KEY);
        },
        { threadId: 'child-one' },
      ),
      withEphemeralMemory(rc, async childRequestContext => childRequestContext?.get(MASTRA_THREAD_ID_KEY), {
        threadId: 'child-two',
      }),
    ]);

    expect(seen).toEqual(['child-one', 'child-two']);
    expect(rc.get(MASTRA_THREAD_ID_KEY)).toBe('parent-thread');
  });
});
