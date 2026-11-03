import { createVectorTestSuite } from '@internal/storage-test-utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { testConfig } from '../storage/test-utils';
import { SurrealFilterTranslator } from './filter';
import { SurrealVector } from './index';

const vector = new SurrealVector({ ...testConfig('vector_suite'), id: 'surrealdb-vector-test' });

createVectorTestSuite({
  vector,
  createIndex: async (indexName, options) => {
    await vector.createIndex({ indexName, dimension: 1536, metric: options?.metric ?? 'cosine' });
  },
  deleteIndex: async (indexName: string) => {
    await vector.deleteIndex({ indexName });
  },
  waitForIndexing: async () => {},
  disconnect: async () => {
    await vector.disconnect();
  },
});

describe('SurrealVector', () => {
  const store = new SurrealVector({ ...testConfig('vector_specific'), id: 'surrealdb-vector-specific' });
  const indexName = `surreal_specific_${Date.now()}`;

  beforeAll(async () => {
    await store.createIndex({ indexName, dimension: 3, metric: 'cosine' });
  });

  afterAll(async () => {
    await store.deleteIndex({ indexName });
    await store.disconnect();
  });

  it('applies metadata filters during the HNSW search, not after it', async () => {
    await store.upsert({
      indexName,
      ids: ['near', 'far'],
      vectors: [
        [1, 0, 0],
        [0, 1, 0],
      ],
      metadata: [{ kind: 'a' }, { kind: 'b' }],
    });

    // The only match is not among the unfiltered nearest neighbours.
    const results = await store.query({ indexName, queryVector: [1, 0, 0], topK: 1, filter: { kind: 'b' } });
    expect(results.map(r => r.id)).toEqual(['far']);
  });

  it('ranks dot product indexes exactly', async () => {
    const dotIndex = `${indexName}_dot`;
    await store.createIndex({ indexName: dotIndex, dimension: 2, metric: 'dotproduct' });
    try {
      await store.upsert({
        indexName: dotIndex,
        ids: ['small', 'large'],
        vectors: [
          [1, 0],
          [3, 0],
        ],
      });
      const results = await store.query({ indexName: dotIndex, queryVector: [1, 0], topK: 2 });
      expect(results.map(r => [r.id, r.score])).toEqual([
        ['large', 3],
        ['small', 1],
      ]);
      expect((await store.describeIndex({ indexName: dotIndex })).metric).toBe('dotproduct');
    } finally {
      await store.deleteIndex({ indexName: dotIndex });
    }
  });

  it('rejects index names that are not plain identifiers', async () => {
    await expect(store.createIndex({ indexName: 'bad-name; REMOVE TABLE x', dimension: 3 })).rejects.toThrow(
      /Invalid index name/,
    );
  });
});

describe('SurrealFilterTranslator', () => {
  const translate = (filter: any) => {
    const bindings: Record<string, unknown> = {};
    return { condition: new SurrealFilterTranslator().translate(filter, bindings), bindings };
  };

  it('binds field names and values instead of inlining them', () => {
    const { condition, bindings } = translate({ "name'; DELETE x; --": { $eq: 'v' } });
    expect(condition).not.toContain('DELETE');
    expect(Object.values(bindings)).toContain("name'; DELETE x; --");
  });

  it('returns no condition for empty filters', () => {
    expect(translate({}).condition).toBeUndefined();
    expect(translate(undefined).condition).toBeUndefined();
  });

  it('splits dotted paths into nested field access', () => {
    const { condition, bindings } = translate({ 'a.b': 1 });
    expect(condition).toContain('metadata[$vf0][$vf1]');
    expect(bindings.vf0).toBe('a');
    expect(bindings.vf1).toBe('b');
  });

  it('rejects unsupported operators', () => {
    expect(() => translate({ field: { $unknown: 1 } })).toThrow();
  });
});
