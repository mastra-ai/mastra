import { MastraError } from '@mastra/core/error';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { CloudflareVector } from './';

function createVector() {
  return new CloudflareVector({ id: 'vectorize', accountId: 'account', apiToken: 'token' });
}

async function expectMastraError(promise: Promise<unknown>, idSuffix: string) {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(MastraError);
  expect((error as MastraError).id).toBe(`MASTRA_VECTOR_VECTORIZE_${idSuffix.replace('/', '_')}`);
  return error as MastraError;
}

describe('CloudflareVector updateVector', () => {
  let vector: CloudflareVector;
  let upsert: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vector = createVector();
    upsert = vi.spyOn(vector, 'upsert').mockResolvedValue(['vec-1']);
  });

  it('preserves the caller-provided id when delegating to upsert', async () => {
    await vector.updateVector({ indexName: 'docs', id: 'vec-1', update: { vector: [0.1, 0.2] } });

    expect(upsert).toHaveBeenCalledWith({
      indexName: 'docs',
      ids: ['vec-1'],
      vectors: [[0.1, 0.2]],
    });
  });

  it('forwards metadata alongside the id', async () => {
    await vector.updateVector({
      indexName: 'docs',
      id: 'vec-1',
      update: { vector: [0.1, 0.2], metadata: { title: 'doc' } },
    });

    expect(upsert).toHaveBeenCalledWith({
      indexName: 'docs',
      ids: ['vec-1'],
      vectors: [[0.1, 0.2]],
      metadata: [{ title: 'doc' }],
    });
  });

  it('rejects metadata-only updates instead of upserting without values', async () => {
    await expectMastraError(
      vector.updateVector({ indexName: 'docs', id: 'vec-1', update: { metadata: { title: 'doc' } } }),
      'UPDATE_VECTOR/MISSING_VECTOR',
    );

    expect(upsert).not.toHaveBeenCalled();
  });

  it('rejects a missing id', async () => {
    await expectMastraError(
      vector.updateVector({ indexName: 'docs', id: '', update: { vector: [0.1] } }),
      'UPDATE_VECTOR/INVALID_ARGS',
    );

    expect(upsert).not.toHaveBeenCalled();
  });

  it('rejects an empty update payload', async () => {
    await expectMastraError(
      vector.updateVector({ indexName: 'docs', id: 'vec-1', update: {} }),
      'UPDATE_VECTOR/NO_PAYLOAD',
    );

    expect(upsert).not.toHaveBeenCalled();
  });

  it('wraps upsert failures', async () => {
    upsert.mockRejectedValueOnce(new Error('boom'));

    await expectMastraError(
      vector.updateVector({ indexName: 'docs', id: 'vec-1', update: { vector: [0.1] } }),
      'UPDATE_VECTOR/FAILED',
    );
  });
});

describe('CloudflareVector deleteVectors', () => {
  let vector: CloudflareVector;
  let deleteByIds: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vector = createVector();
    deleteByIds = vi.fn().mockResolvedValue({});
    vector.client.vectorize.indexes.deleteByIds = deleteByIds as any;
  });

  it('deletes the provided ids through the Cloudflare endpoint', async () => {
    await vector.deleteVectors({ indexName: 'docs', ids: ['vec-1', 'vec-2'] });

    expect(deleteByIds).toHaveBeenCalledWith('docs', {
      ids: ['vec-1', 'vec-2'],
      account_id: 'account',
    });
  });

  it('rejects ids and filter together', async () => {
    await expectMastraError(
      vector.deleteVectors({ indexName: 'docs', ids: ['vec-1'], filter: { title: 'doc' } }),
      'DELETE_VECTORS/MUTUALLY_EXCLUSIVE',
    );

    expect(deleteByIds).not.toHaveBeenCalled();
  });

  it('rejects filter-only deletion as unsupported', async () => {
    await expectMastraError(
      vector.deleteVectors({ indexName: 'docs', filter: { title: 'doc' } }),
      'DELETE_VECTORS/UNSUPPORTED_FILTER',
    );

    expect(deleteByIds).not.toHaveBeenCalled();
  });

  it('rejects a request with no target', async () => {
    await expectMastraError(vector.deleteVectors({ indexName: 'docs' }), 'DELETE_VECTORS/NO_TARGET');

    expect(deleteByIds).not.toHaveBeenCalled();
  });

  it('rejects an empty ids array', async () => {
    await expectMastraError(vector.deleteVectors({ indexName: 'docs', ids: [] }), 'DELETE_VECTORS/EMPTY_IDS');

    expect(deleteByIds).not.toHaveBeenCalled();
  });

  it('wraps Cloudflare failures', async () => {
    deleteByIds.mockRejectedValueOnce(new Error('boom'));

    await expectMastraError(vector.deleteVectors({ indexName: 'docs', ids: ['vec-1'] }), 'DELETE_VECTORS/FAILED');
  });
});
