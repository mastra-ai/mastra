import { DeleteVectorsCommand } from '@aws-sdk/client-s3vectors';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { S3Vectors } from './';

describe('S3Vectors.deleteVectors', () => {
  let store: S3Vectors;
  let send: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    store = new S3Vectors({ id: 'test', vectorBucketName: 'test-bucket', clientConfig: { region: 'us-east-1' } });
    send = vi.fn().mockResolvedValue({});
    (store as any).client.send = send;
  });

  it('deletes vectors by ids in a single request', async () => {
    await store.deleteVectors({ indexName: 'my_index', ids: ['a', 'b'] });

    expect(send).toHaveBeenCalledTimes(1);
    const command = send.mock.calls[0]![0];
    expect(command).toBeInstanceOf(DeleteVectorsCommand);
    expect(command.input).toEqual({ vectorBucketName: 'test-bucket', indexName: 'my-index', keys: ['a', 'b'] });
  });

  it('batches large id lists into requests of at most 500 keys', async () => {
    const ids = Array.from({ length: 1001 }, (_, i) => `id-${i}`);
    await store.deleteVectors({ indexName: 'idx', ids });

    expect(send.mock.calls.map(([cmd]) => cmd.input.keys.length)).toEqual([500, 500, 1]);
    expect(send.mock.calls.flatMap(([cmd]) => cmd.input.keys)).toEqual(ids);
  });

  it.each([
    ['MUTUALLY_EXCLUSIVE', { ids: ['a'], filter: { k: 'v' } }],
    ['UNSUPPORTED_FILTER', { filter: { k: 'v' } }],
    ['NO_TARGET', {}],
    ['EMPTY_IDS', { ids: [] }],
  ])('throws %s without calling AWS', async (code, params) => {
    await expect(store.deleteVectors({ indexName: 'idx', ...params } as any)).rejects.toMatchObject({
      id: expect.stringContaining(code),
    });
    expect(send).not.toHaveBeenCalled();
  });

  it('wraps AWS failures', async () => {
    send.mockRejectedValue(new Error('boom'));
    await expect(store.deleteVectors({ indexName: 'idx', ids: ['a'] })).rejects.toMatchObject({
      id: expect.stringContaining('FAILED'),
    });
  });
});
