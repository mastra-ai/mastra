import { describe, expect, it, vi } from 'vitest';

import { CloudflareVector } from './index';

function createVectorStore() {
  return new CloudflareVector({ id: 'test', accountId: 'account', apiToken: 'token' });
}

describe('CloudflareVector lifecycle contracts', () => {
  it('preserves the caller-provided id when updating a vector', async () => {
    const vector = createVectorStore();
    const upsert = vi.spyOn(vector, 'upsert').mockResolvedValue(['vector-1']);

    await vector.updateVector({
      indexName: 'index',
      id: 'vector-1',
      update: { vector: [0.1, 0.2], metadata: { version: 2 } },
    });

    expect(upsert).toHaveBeenCalledWith({
      indexName: 'index',
      vectors: [[0.1, 0.2]],
      metadata: [{ version: 2 }],
      ids: ['vector-1'],
    });
  });

  it('deletes multiple vectors by id through the Cloudflare API', async () => {
    const vector = createVectorStore();
    const deleteByIds = vi.spyOn(vector.client.vectorize.indexes, 'deleteByIds').mockResolvedValue({
      mutationId: 'mutation-1',
    });

    await vector.deleteVectors({ indexName: 'index', ids: ['vector-1', 'vector-2'] });

    expect(deleteByIds).toHaveBeenCalledWith('index', {
      account_id: 'account',
      ids: ['vector-1', 'vector-2'],
    });
  });

  it('treats an empty id list as a successful no-op', async () => {
    const vector = createVectorStore();
    const deleteByIds = vi.spyOn(vector.client.vectorize.indexes, 'deleteByIds');

    await expect(vector.deleteVectors({ indexName: 'index', ids: [] })).resolves.toBeUndefined();
    expect(deleteByIds).not.toHaveBeenCalled();
  });

  it('fails closed when a metadata-filter deletion is requested', async () => {
    const vector = createVectorStore();

    await expect(vector.deleteVectors({ indexName: 'index', filter: { tenantId: 'tenant-a' } })).rejects.toThrow(
      'Deleting Vectorize vectors by metadata filter is not supported',
    );
  });

  it('rejects requests that provide both ids and a metadata filter', async () => {
    const vector = createVectorStore();

    await expect(
      vector.deleteVectors({
        indexName: 'index',
        ids: ['vector-1'],
        filter: { tenantId: 'tenant-a' },
      }),
    ).rejects.toThrow('ids and filter are mutually exclusive for Vectorize deleteVectors');
  });

  it('rejects requests without ids or a metadata filter', async () => {
    const vector = createVectorStore();

    await expect(vector.deleteVectors({ indexName: 'index' })).rejects.toThrow(
      'ids are required for Vectorize deleteVectors',
    );
  });
});
