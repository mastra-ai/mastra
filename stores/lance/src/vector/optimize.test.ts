import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Connection } from '@lancedb/lancedb';
import { MastraError } from '@mastra/core/error';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { LanceVectorStore } from './index';

const DIMENSION = 16;
const randomVector = () => Array.from({ length: DIMENSION }, () => Math.random());

describe('LanceVectorStore table maintenance', () => {
  let dir: string;
  let store: LanceVectorStore;

  const tablePrototype = async (tableName: string) => {
    const client = (store as unknown as { lanceClient: Connection }).lanceClient;
    return Object.getPrototypeOf(await client.openTable(tableName));
  };

  const createIndexedTable = async (indexName: string) => {
    await store.createIndex({ indexName, dimension: DIMENSION });
    await store.upsert({
      indexName,
      vectors: Array.from({ length: 300 }, randomVector),
      ids: Array.from({ length: 300 }, (_, i) => `base-${i}`),
    });
    await store.createIndex({ indexName, dimension: DIMENSION });
  };

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'lance-optimize-'));
    store = await LanceVectorStore.create(dir);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    store.close();
    await rm(dir, { recursive: true, force: true });
  });

  it('indexes rows written after the index was built without rebuilding it', async () => {
    const indexName = 'optimize_happy';
    await createIndexedTable(indexName);

    const [before] = await store.getIndexCoverage({ indexName });
    expect(before).toBeDefined();
    expect(before!.numUnindexedRows).toBe(0);

    const newVectors = Array.from({ length: 50 }, randomVector);
    const newIds = Array.from({ length: 50 }, (_, i) => `new-${i}`);
    await store.upsert({ indexName, vectors: newVectors, ids: newIds });

    const [pending] = await store.getIndexCoverage({ indexName });
    expect(pending!.numUnindexedRows).toBeGreaterThanOrEqual(50);

    await store.optimize({ indexName });

    const coverage = await store.getIndexCoverage({ indexName });
    expect(coverage).toHaveLength(1);
    expect(coverage[0]).toMatchObject({
      indexName: before!.indexName,
      indexType: before!.indexType,
      columns: ['vector'],
      numUnindexedRows: 0,
      numIndexedRows: 350,
    });

    const results = await store.query({ indexName, queryVector: newVectors[0]!, topK: 5 });
    expect(results.map(r => r.id)).toContain(newIds[0]);
  });

  it('resolves tableName and indexName to the same table', async () => {
    const indexName = 'optimize_resolution';
    await createIndexedTable(indexName);
    await store.upsert({ indexName, vectors: [randomVector()], ids: ['extra'] });

    await store.optimize({ tableName: indexName });
    const [coverage] = await store.getIndexCoverage({ tableName: indexName });
    expect(coverage!.numUnindexedRows).toBe(0);
  });

  it('rejects when the table is missing or not specified', async () => {
    await expect(store.optimize({ indexName: 'does_not_exist' })).rejects.toThrow(MastraError);
    await expect(store.optimize({})).rejects.toThrow(MastraError);
    await expect(store.getIndexCoverage({ indexName: 'does_not_exist' })).rejects.toThrow(MastraError);
  });

  it('coalesces concurrent calls for the same table into one LanceDB optimize', async () => {
    const indexName = 'optimize_concurrent';
    await createIndexedTable(indexName);
    const spy = vi.spyOn(await tablePrototype(indexName), 'optimize');

    const [a, b] = await Promise.all([store.optimize({ indexName }), store.optimize({ indexName })]);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);

    await store.optimize({ indexName });
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('keeps the recorded index identity so createIndex does not rebuild after optimizing updates', async () => {
    const indexName = 'optimize_uuid';
    await createIndexedTable(indexName);
    const uuidOf = async () => {
      const client = (store as unknown as { lanceClient: Connection }).lanceClient;
      return (await (await client.openTable(indexName)).listIndices())[0]!.indexUuid;
    };
    const original = await uuidOf();

    await store.upsert({
      indexName,
      vectors: Array.from({ length: 50 }, randomVector),
      ids: Array.from({ length: 50 }, (_, i) => `base-${i}`),
    });
    await store.optimize({ indexName });
    expect(await uuidOf()).not.toBe(original);

    const createSpy = vi.spyOn(await tablePrototype(indexName), 'createIndex');
    await store.createIndex({ indexName, dimension: DIMENSION });
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('coalesces a call that arrives while the first is still resolving the table', async () => {
    const indexName = 'optimize_slow_lookup';
    await createIndexedTable(indexName);
    const spy = vi.spyOn(await tablePrototype(indexName), 'optimize');
    const client = (store as unknown as { lanceClient: Connection }).lanceClient;
    const original = client.tableNames.bind(client);
    const lookup = vi.spyOn(client, 'tableNames').mockImplementationOnce(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      return original();
    });

    const [a, b] = await Promise.all([store.optimize({ indexName }), store.optimize({ indexName })]);
    expect(a).toBe(b);
    expect(spy).toHaveBeenCalledTimes(1);
    lookup.mockRestore();
  });

  it('wraps table lookup failures as third-party MastraErrors', async () => {
    const client = (store as unknown as { lanceClient: Connection }).lanceClient;
    const lookup = vi.spyOn(client, 'tableNames').mockRejectedValue(new Error('connection lost'));

    for (const call of [store.optimize({ indexName: 'any' }), store.getIndexCoverage({ indexName: 'any' })]) {
      const error = await call.catch(e => e);
      expect(error).toBeInstanceOf(MastraError);
      expect(error.category).toBe('THIRD_PARTY');
    }
    lookup.mockRestore();
  });

  it('passes safe defaults to LanceDB and forwards retention options', async () => {
    const indexName = 'optimize_options';
    await createIndexedTable(indexName);
    const spy = vi.spyOn(await tablePrototype(indexName), 'optimize');

    await store.optimize({ indexName });
    expect(spy).toHaveBeenLastCalledWith({ deleteUnverified: false });

    const cleanupOlderThan = new Date(Date.now() - 60_000);
    await store.optimize({ indexName, cleanupOlderThan });
    expect(spy).toHaveBeenLastCalledWith({ cleanupOlderThan, deleteUnverified: false });
  });

  it('wraps failures in MastraError and allows a retry', async () => {
    const indexName = 'optimize_failure';
    await createIndexedTable(indexName);
    const spy = vi.spyOn(await tablePrototype(indexName), 'optimize').mockRejectedValueOnce(new Error('boom'));

    const error = await store.optimize({ indexName }).catch(e => e);
    expect(error).toBeInstanceOf(MastraError);
    expect(error.details).toMatchObject({ tableName: indexName });

    await expect(store.optimize({ indexName })).resolves.toBeDefined();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('never optimizes implicitly on upsert', async () => {
    const indexName = 'optimize_implicit';
    await createIndexedTable(indexName);
    const spy = vi.spyOn(await tablePrototype(indexName), 'optimize');

    await store.upsert({ indexName, vectors: [randomVector()], ids: ['implicit'] });

    expect(spy).not.toHaveBeenCalled();
    const [coverage] = await store.getIndexCoverage({ indexName });
    expect(coverage!.numUnindexedRows).toBeGreaterThan(0);
  });
});
