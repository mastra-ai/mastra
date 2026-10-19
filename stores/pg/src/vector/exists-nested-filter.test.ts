import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { PgVector } from '.';

describe('PgVector $exists on nested metadata keys', () => {
  const connectionString = process.env.DB_URL || 'postgresql://postgres:postgres@localhost:5434/mastra';
  const indexName = `exists_nested_${Date.now()}`;
  let vectorDB: PgVector;

  beforeAll(async () => {
    vectorDB = new PgVector({ connectionString, id: 'pg-exists-nested-test' });
    await vectorDB.createIndex({ indexName, dimension: 3 });
  });

  afterAll(async () => {
    await vectorDB.deleteIndex({ indexName });
    await vectorDB.disconnect();
  });

  beforeEach(async () => {
    await vectorDB.truncateIndex({ indexName });
    await vectorDB.upsert({
      indexName,
      ids: ['with-lang-en', 'with-lang-null', 'without-lang'],
      vectors: [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ],
      metadata: [{ doc: { lang: 'en' } }, { doc: { lang: null } }, { doc: { title: 'x' } }],
    });
  });

  const queryIds = async (filter: Record<string, any>) => {
    const results = await vectorDB.query({ indexName, queryVector: [1, 1, 1], topK: 10, filter });
    return results.map(r => r.id).sort();
  };

  it('matches rows where the nested key exists (including JSON null)', async () => {
    expect(await queryIds({ 'doc.lang': { $exists: true } })).toEqual(['with-lang-en', 'with-lang-null']);
  });

  it('matches only rows where the nested key is missing', async () => {
    expect(await queryIds({ 'doc.lang': { $exists: false } })).toEqual(['without-lang']);
  });

  it('supports the nested-object filter spelling', async () => {
    expect(await queryIds({ doc: { lang: { $exists: false } } })).toEqual(['without-lang']);
  });

  it('deleteVectors with $exists: false only deletes rows missing the nested key', async () => {
    await vectorDB.deleteVectors({ indexName, filter: { 'doc.lang': { $exists: false } } });
    expect(await queryIds({})).toEqual(['with-lang-en', 'with-lang-null']);
  });
});
