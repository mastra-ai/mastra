import type { StorageResourceType } from '@mastra/core/storage';
import type { Connection } from 'oracledb';
import { describe, expect, it, vi } from 'vitest';

import { updateResource } from './resources';
import type { MemoryContext } from './utils';

// CR-15: updateResource used to read (getResourceById) and write (saveResource)
// across two unlocked round trips, so a concurrent updateResource on the same
// resourceId could interleave and lose one side's write. It now locks the row
// with SELECT ... FOR UPDATE inside a transaction before merging, mirroring
// the lock-then-merge pattern already used by updateObservationalMemoryConfig.

const STALE_EXISTING: StorageResourceType = {
  id: 'resource-1',
  workingMemory: 'stale working memory',
  metadata: { stale: true, shared: 'stale-shared' },
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
  updatedAt: new Date('2025-06-01T00:00:00.000Z'),
};

// Simulates a writer that committed between the initial (unlocked)
// getResourceById read and this call's FOR UPDATE lock.
const LOCKED_ROW = {
  id: 'resource-1',
  workingMemory: 'fresh working memory from a concurrent writer',
  metadata: JSON.stringify({ fresh: true, shared: 'fresh-shared' }),
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

function createFakeCtx(): {
  ctx: MemoryContext;
  mergeCalls: Array<{ sql: string; binds?: Record<string, any> }>;
} {
  const mergeCalls: Array<{ sql: string; binds?: Record<string, any> }> = [];
  const execute = vi.fn(async (sql: string, binds?: Record<string, unknown>) => {
    if (sql.includes('FOR UPDATE')) {
      return { rows: [LOCKED_ROW] };
    }
    mergeCalls.push({ sql, binds });
    return { rowsAffected: 1 };
  });
  const connection = { execute } as unknown as Connection;
  const db = {
    tx: vi.fn(async (callback: (client: unknown, connection: Connection) => Promise<unknown>) => callback({}, connection)),
  };
  const ctx = {
    db,
    schemaName: undefined,
    getResourceById: vi.fn(async () => STALE_EXISTING),
  } as unknown as MemoryContext;
  return { ctx, mergeCalls };
}

describe('updateResource lock-then-merge (CR-15)', () => {
  it('merges onto the row it locked with FOR UPDATE, not the earlier unlocked read', async () => {
    const { ctx, mergeCalls } = createFakeCtx();

    const result = await updateResource(ctx, {
      resourceId: 'resource-1',
      metadata: { patched: true },
    });

    // workingMemory wasn't part of this update, so the result carries over
    // from the LOCKED row (fresh), not the stale snapshot read before the lock.
    expect(result.workingMemory).toBe(LOCKED_ROW.workingMemory);
    // metadata merges the patch onto the locked row's metadata, keeping the
    // fresh shared key instead of resurrecting the stale one.
    expect(result.metadata).toEqual({ fresh: true, shared: 'fresh-shared', patched: true });

    expect(mergeCalls).toHaveLength(1);
    expect(mergeCalls[0]!.sql).toContain('MERGE INTO');
    const mergedMetadata = JSON.parse(String(mergeCalls[0]!.binds!.metadata.val));
    expect(mergedMetadata).toEqual({ fresh: true, shared: 'fresh-shared', patched: true });
  });

  it('overwrites workingMemory when explicitly provided, based on the locked row', async () => {
    const { ctx, mergeCalls } = createFakeCtx();

    const result = await updateResource(ctx, {
      resourceId: 'resource-1',
      workingMemory: 'new working memory',
    });

    expect(result.workingMemory).toBe('new working memory');
    expect(result.metadata).toEqual({ fresh: true, shared: 'fresh-shared' });
    expect(mergeCalls).toHaveLength(1);
  });

  it('keeps the creation path unchanged for a resource that does not exist yet', async () => {
    const saveResource = vi.fn(async ({ resource }: { resource: StorageResourceType }) => resource);
    const tx = vi.fn();
    const ctx = {
      db: { tx },
      schemaName: undefined,
      getResourceById: vi.fn(async () => null),
      saveResource,
    } as unknown as MemoryContext;

    const result = await updateResource(ctx, {
      resourceId: 'resource-new',
      workingMemory: 'brand new',
      metadata: { a: 1 },
    });

    expect(saveResource).toHaveBeenCalledTimes(1);
    expect(tx).not.toHaveBeenCalled();
    expect(result.id).toBe('resource-new');
    expect(result.workingMemory).toBe('brand new');
  });
});
