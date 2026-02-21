/**
 * Integration tests for Issue #10453: Full-text and hybrid search support
 *
 * Tests full-text search (keyword-based) and hybrid (vector + keyword) search
 * modes in PgVector using PostgreSQL tsvector/tsquery.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { PgVector } from '.';

describe('PgVector Full-Text Search (Issue #10453)', () => {
  const connectionString = process.env.DB_URL || 'postgresql://postgres:postgres@localhost:5434/mastra';
  let vectorDB: PgVector;
  const ftsIndex = 'test_fts_search';

  beforeAll(async () => {
    vectorDB = new PgVector({ connectionString, id: 'pg-fts-test' });

    // Create index with full-text search enabled
    await vectorDB.createIndex({
      indexName: ftsIndex,
      dimension: 3,
      metric: 'cosine',
      fullTextSearch: { language: 'english' },
    });

    // Upsert vectors with associated documents for full-text indexing
    await vectorDB.upsert({
      indexName: ftsIndex,
      vectors: [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
        [0.5, 0.5, 0],
      ],
      metadata: [
        { source: 'doc1', category: 'database' },
        { source: 'doc2', category: 'cache' },
        { source: 'doc3', category: 'database' },
        { source: 'doc4', category: 'search' },
      ],
      documents: [
        'PostgreSQL is a powerful open source relational database management system',
        'Redis is an in-memory data structure store used as a cache and message broker',
        'MongoDB is a document-oriented NoSQL database for high volume data storage',
        'Elasticsearch is a distributed search and analytics engine built on Apache Lucene',
      ],
    });
  });

  afterAll(async () => {
    try {
      await vectorDB.deleteIndex({ indexName: ftsIndex });
    } catch {
      // ignore
    }
    await vectorDB.disconnect();
  });

  describe('Full-Text Search Mode', () => {
    it('should find documents matching keyword query', async () => {
      // Search for "PostgreSQL" — should find doc1 which mentions PostgreSQL
      const results = await vectorDB.query({
        indexName: ftsIndex,
        queryVector: [0, 0, 0], // irrelevant for fulltext mode
        searchMode: 'fulltext',
        queryText: 'PostgreSQL',
        topK: 5,
      });

      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0]!.metadata?.source).toBe('doc1');
    });

    it('should find multiple documents matching a shared keyword', async () => {
      // Search for "database" — should find doc1 (PostgreSQL) and doc3 (MongoDB)
      const results = await vectorDB.query({
        indexName: ftsIndex,
        queryVector: [0, 0, 0],
        searchMode: 'fulltext',
        queryText: 'database',
        topK: 5,
      });

      expect(results.length).toBeGreaterThanOrEqual(2);
      const sources = results.map(r => r.metadata?.source);
      expect(sources).toContain('doc1');
      expect(sources).toContain('doc3');
    });

    it('should return empty results for non-matching keywords', async () => {
      const results = await vectorDB.query({
        indexName: ftsIndex,
        queryVector: [0, 0, 0],
        searchMode: 'fulltext',
        queryText: 'kubernetes container orchestration',
        topK: 5,
      });

      expect(results).toHaveLength(0);
    });

    it('should rank results by text relevance', async () => {
      // "relational database management" should rank doc1 higher than doc3
      // because doc1 contains "relational database management system" (more matching terms)
      const results = await vectorDB.query({
        indexName: ftsIndex,
        queryVector: [0, 0, 0],
        searchMode: 'fulltext',
        queryText: 'relational database management system',
        topK: 5,
      });

      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0]!.metadata?.source).toBe('doc1');
    });

    it('should respect topK limit in fulltext mode', async () => {
      const results = await vectorDB.query({
        indexName: ftsIndex,
        queryVector: [0, 0, 0],
        searchMode: 'fulltext',
        queryText: 'database',
        topK: 1,
      });

      expect(results).toHaveLength(1);
    });

    it('should combine fulltext search with metadata filter', async () => {
      // Search for "database" but only in category "database"
      // Should find both doc1 and doc3 (both have category: database)
      const results = await vectorDB.query({
        indexName: ftsIndex,
        queryVector: [0, 0, 0],
        filter: { category: { $eq: 'database' } },
        searchMode: 'fulltext',
        queryText: 'database',
        topK: 5,
      });

      expect(results.length).toBeGreaterThanOrEqual(1);
      results.forEach(r => {
        expect(r.metadata?.category).toBe('database');
      });
    });

    it('should return document text in results when available', async () => {
      const results = await vectorDB.query({
        indexName: ftsIndex,
        queryVector: [0, 0, 0],
        searchMode: 'fulltext',
        queryText: 'PostgreSQL',
        topK: 1,
      });

      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0]!.document).toBeDefined();
      expect(results[0]!.document).toContain('PostgreSQL');
    });
  });

  describe('Hybrid Search Mode', () => {
    it('should combine vector similarity and keyword relevance', async () => {
      // Vector [1,0,0] is closest to doc1, and "PostgreSQL" matches doc1 text
      // Both signals should agree, putting doc1 at top
      const results = await vectorDB.query({
        indexName: ftsIndex,
        queryVector: [1, 0, 0],
        searchMode: 'hybrid',
        queryText: 'PostgreSQL',
        topK: 5,
      });

      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0]!.metadata?.source).toBe('doc1');
    });

    it('should boost keyword-matching results even with low vector similarity', async () => {
      // Vector [0,1,0] is closest to doc2 (Redis), but "database" matches doc1 and doc3
      // Hybrid should still surface doc1/doc3 due to keyword match, even though
      // vector similarity favors doc2
      const results = await vectorDB.query({
        indexName: ftsIndex,
        queryVector: [0, 1, 0], // closest to doc2 (Redis)
        searchMode: 'hybrid',
        queryText: 'database',
        topK: 4,
      });

      const sources = results.map(r => r.metadata?.source);
      // doc1 and doc3 should appear in results despite not being the closest vectors
      expect(sources).toContain('doc1');
      expect(sources).toContain('doc3');
    });

    it('should respect custom semantic/keyword weights', async () => {
      // With high keyword weight, keyword matches should dominate
      const keywordHeavy = await vectorDB.query({
        indexName: ftsIndex,
        queryVector: [0, 1, 0], // closest to doc2 (Redis)
        searchMode: 'hybrid',
        queryText: 'PostgreSQL relational database',
        hybridConfig: { semanticWeight: 0.1, keywordWeight: 0.9 },
        topK: 4,
      });

      // With heavy keyword weight and "PostgreSQL" query, doc1 should be #1
      expect(keywordHeavy[0]!.metadata?.source).toBe('doc1');

      // With high vector weight, vector proximity should dominate
      const vectorHeavy = await vectorDB.query({
        indexName: ftsIndex,
        queryVector: [0, 1, 0], // closest to doc2 (Redis)
        searchMode: 'hybrid',
        queryText: 'PostgreSQL relational database',
        hybridConfig: { semanticWeight: 0.9, keywordWeight: 0.1 },
        topK: 4,
      });

      // With heavy vector weight and vector closest to doc2, doc2 should be #1
      expect(vectorHeavy[0]!.metadata?.source).toBe('doc2');
    });

    it('should respect topK limit in hybrid mode', async () => {
      const results = await vectorDB.query({
        indexName: ftsIndex,
        queryVector: [1, 0, 0],
        searchMode: 'hybrid',
        queryText: 'database',
        topK: 2,
      });

      expect(results).toHaveLength(2);
    });

    it('should combine hybrid search with metadata filter', async () => {
      const results = await vectorDB.query({
        indexName: ftsIndex,
        queryVector: [1, 0, 0],
        filter: { category: { $eq: 'cache' } },
        searchMode: 'hybrid',
        queryText: 'memory',
        topK: 5,
      });

      // Only doc2 (Redis) has category 'cache' and mentions "in-memory"
      results.forEach(r => {
        expect(r.metadata?.category).toBe('cache');
      });
    });

    it('should default to equal weights when hybridConfig is not specified', async () => {
      // Without explicit weights, semantic and keyword should be weighted equally
      const results = await vectorDB.query({
        indexName: ftsIndex,
        queryVector: [1, 0, 0],
        searchMode: 'hybrid',
        queryText: 'database',
        topK: 4,
      });

      // Should return results (the exact ranking depends on the fusion algorithm)
      expect(results.length).toBeGreaterThan(0);
      // Every result should have a score
      results.forEach(r => {
        expect(typeof r.score).toBe('number');
        expect(r.score).toBeGreaterThan(0);
      });
    });
  });

  describe('describeIndex language detection', () => {
    it('should detect hasFullTextSearch on FTS-enabled index', async () => {
      const stats = await vectorDB.describeIndex({ indexName: ftsIndex });
      expect(stats.hasFullTextSearch).toBe(true);
    });

    it('should parse FTS language from GIN index definition on fresh instance', async () => {
      // Simulate a fresh PgVector instance that has no in-memory cache
      const freshDB = new PgVector({ connectionString, id: 'pg-fts-fresh' });
      let freshDB2: PgVector | undefined;
      const spanishIndex = 'test_fts_spanish';

      try {
        await freshDB.createIndex({
          indexName: spanishIndex,
          dimension: 3,
          fullTextSearch: { language: 'spanish' },
        });

        // Create a second fresh instance to force describeIndex to parse from DB
        freshDB2 = new PgVector({ connectionString, id: 'pg-fts-fresh2' });

        // describeIndex should detect FTS and parse 'spanish' from the GIN index
        const stats = await freshDB2.describeIndex({ indexName: spanishIndex });
        expect(stats.hasFullTextSearch).toBe(true);

        // Now query with fulltext to verify the correct language is used
        await freshDB2.upsert({
          indexName: spanishIndex,
          vectors: [[1, 0, 0]],
          metadata: [{ source: 'es1' }],
          documents: ['La base de datos relacional es muy importante'],
        });

        const results = await freshDB2.query({
          indexName: spanishIndex,
          queryVector: [0, 0, 0],
          searchMode: 'fulltext',
          queryText: 'base datos',
          topK: 5,
        });

        expect(results.length).toBeGreaterThanOrEqual(1);
      } finally {
        try {
          await freshDB2?.disconnect();
        } catch {
          // ignore
        }
        try {
          await freshDB.deleteIndex({ indexName: spanishIndex });
        } catch {
          // ignore
        }
        await freshDB.disconnect();
      }
    });
  });

  describe('Default vector search mode (backward compatibility)', () => {
    it('should default to vector-only search when searchMode is not specified', async () => {
      // Existing behavior: pure vector similarity search
      const results = await vectorDB.query({
        indexName: ftsIndex,
        queryVector: [1, 0, 0],
        topK: 3,
      });

      expect(results.length).toBeGreaterThan(0);
      // Doc1 has vector [1,0,0], should be closest
      expect(results[0]!.metadata?.source).toBe('doc1');
    });
  });
});
