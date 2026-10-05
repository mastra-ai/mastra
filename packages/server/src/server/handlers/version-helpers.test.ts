import { describe, expect, it, vi } from 'vitest';

import { enforceRetentionLimit } from './version-helpers';

describe('enforceRetentionLimit', () => {
  it('skips active and custom-labeled versions while continuing to eligible versions', async () => {
    const versions = Array.from({ length: 6 }, (_, index) => ({
      id: `v${index + 1}`,
      versionNumber: index + 1,
    }));
    const deleted: string[] = [];
    const store = {
      listVersions: vi.fn(async (input: Record<string, unknown>) => ({
        versions: input['perPage'] === 1 ? versions.slice(0, 1) : versions,
        total: versions.length,
        page: 0,
        perPage: input['perPage'] as number | false,
        hasMore: false,
      })),
      deleteVersion: vi.fn(async (id: string) => {
        if (id === 'v1' || id === 'v3') throw { id: 'VERSION_IN_USE_BY_LABEL' };
        deleted.push(id);
      }),
    };

    const result = await enforceRetentionLimit(store, 'agent-1', 'agentId', 'v2', 3);

    expect(result).toEqual({ deletedCount: 3 });
    expect(deleted).toEqual(['v4', 'v5', 'v6']);
    expect(store.listVersions).toHaveBeenLastCalledWith({
      agentId: 'agent-1',
      perPage: false,
      orderBy: { field: 'versionNumber', direction: 'ASC' },
    });
  });

  it('does not hide unrelated deletion failures', async () => {
    const failure = new Error('database unavailable');
    const store = {
      listVersions: vi.fn(async (input: Record<string, unknown>) => ({
        versions: input['perPage'] === 1 ? [{ id: 'v1', versionNumber: 1 }] : [{ id: 'v1', versionNumber: 1 }],
        total: 2,
        page: 0,
        perPage: input['perPage'] as number | false,
        hasMore: false,
      })),
      deleteVersion: vi.fn(async () => {
        throw failure;
      }),
    };

    await expect(enforceRetentionLimit(store, 'agent-1', 'agentId', undefined, 1)).rejects.toBe(failure);
  });
});
