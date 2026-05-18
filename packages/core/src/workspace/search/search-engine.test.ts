import { describe, it, expect, beforeEach, vi } from 'vitest';

import { SearchEngine, isBatchEmbedder, splitIntoChunks } from './search-engine';
import type { BatchEmbedder, Embedder } from './search-engine';

describe('SearchEngine', () => {
  describe('BM25-only mode', () => {
    let engine: SearchEngine;

    beforeEach(() => {
      engine = new SearchEngine({
        bm25: {},
      });
    });

    it('should create engine with BM25 enabled', () => {
      expect(engine.canBM25).toBe(true);
      expect(engine.canVector).toBe(false);
      expect(engine.canHybrid).toBe(false);
    });

    it('should index and search documents', async () => {
      await engine.index({ id: 'doc1', content: 'Hello world' });
      await engine.index({ id: 'doc2', content: 'Goodbye world' });

      const results = await engine.search('hello');
      expect(results.length).toBe(1);
      expect(results[0]?.id).toBe('doc1');
      expect(results[0]?.content).toBe('Hello world');
      expect(results[0]?.scoreDetails?.bm25).toBeDefined();
    });

    it('should index many documents at once', async () => {
      await engine.indexMany([
        { id: 'doc1', content: 'Machine learning' },
        { id: 'doc2', content: 'Deep learning' },
        { id: 'doc3', content: 'Neural networks' },
      ]);

      const results = await engine.search('learning');
      expect(results.length).toBe(2);
    });

    it('should remove documents from index', async () => {
      await engine.index({ id: 'doc1', content: 'Hello world' });
      await engine.index({ id: 'doc2', content: 'Hello again' });

      await engine.remove('doc1');

      const results = await engine.search('hello');
      expect(results.length).toBe(1);
      expect(results[0]?.id).toBe('doc2');
    });

    it('should clear all documents', async () => {
      await engine.index({ id: 'doc1', content: 'Hello world' });
      await engine.index({ id: 'doc2', content: 'Goodbye world' });

      engine.clear();

      const results = await engine.search('world');
      expect(results.length).toBe(0);
    });

    it('should respect topK parameter', async () => {
      await engine.indexMany([
        { id: 'doc1', content: 'machine learning' },
        { id: 'doc2', content: 'deep learning' },
        { id: 'doc3', content: 'learning algorithms' },
      ]);

      const results = await engine.search('learning', { topK: 2 });
      expect(results.length).toBe(2);
    });

    it('should respect minScore parameter', async () => {
      await engine.indexMany([
        { id: 'doc1', content: 'machine learning machine learning machine learning' },
        { id: 'doc2', content: 'learning' },
      ]);

      const results = await engine.search('machine learning', { minScore: 3 });
      // doc1 should have higher score due to term frequency
      expect(results.every(r => r.score >= 3)).toBe(true);
    });

    it('should include lineRange in results', async () => {
      const content = `Line 1
Line 2 has machine learning
Line 3`;

      await engine.index({ id: 'doc1', content });

      const results = await engine.search('machine');
      expect(results[0]?.lineRange).toEqual({ start: 2, end: 2 });
    });

    it('should store and return metadata', async () => {
      await engine.index({
        id: 'doc1',
        content: 'Hello world',
        metadata: { category: 'greeting', author: 'test' },
      });

      const results = await engine.search('hello');
      expect(results[0]?.metadata?.category).toBe('greeting');
      expect(results[0]?.metadata?.author).toBe('test');
    });

    it('should throw error when vector mode is requested without config', async () => {
      await engine.index({ id: 'doc1', content: 'Hello world' });

      await expect(engine.search('hello', { mode: 'vector' })).rejects.toThrow(
        'Vector search requires vector configuration.',
      );
    });

    it('should throw error when hybrid mode is requested without vector config', async () => {
      await engine.index({ id: 'doc1', content: 'Hello world' });

      await expect(engine.search('hello', { mode: 'hybrid' })).rejects.toThrow(
        'Hybrid search requires both vector and BM25 configuration.',
      );
    });
  });

  describe('Vector-only mode', () => {
    let engine: SearchEngine;
    let mockEmbedder: Embedder;
    let mockVectorStore: any;

    beforeEach(() => {
      // Simple mock embedder that creates predictable embeddings
      mockEmbedder = vi.fn(async (text: string) => {
        // Create a simple embedding based on text hash
        const hash = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return [hash % 100, (hash * 2) % 100, (hash * 3) % 100];
      });

      // Mock vector store
      mockVectorStore = {
        upsert: vi.fn(async () => {}),
        query: vi.fn(async () => []),
        deleteVector: vi.fn(async () => {}),
      };

      engine = new SearchEngine({
        vector: {
          vectorStore: mockVectorStore,
          embedder: mockEmbedder,
          indexName: 'test-index',
        },
      });
    });

    it('should create engine with vector enabled', () => {
      expect(engine.canBM25).toBe(false);
      expect(engine.canVector).toBe(true);
      expect(engine.canHybrid).toBe(false);
    });

    it('should index documents in vector store (eager by default)', async () => {
      await engine.index({ id: 'doc1', content: 'Hello world' });

      expect(mockEmbedder).toHaveBeenCalledWith('Hello world');
      expect(mockVectorStore.upsert).toHaveBeenCalledWith({
        indexName: 'test-index',
        vectors: [expect.any(Array)],
        metadata: [{ id: 'doc1', text: 'Hello world' }],
        ids: ['doc1'],
      });
    });

    it('should call createIndex once before the first upsert with the embedding dimension', async () => {
      const mockCreateIndex = vi.fn(async () => {});
      const store: any = {
        upsert: vi.fn(async () => {}),
        query: vi.fn(async () => []),
        deleteVector: vi.fn(async () => {}),
        createIndex: mockCreateIndex,
      };
      const localEngine = new SearchEngine({
        vector: { vectorStore: store, embedder: mockEmbedder, indexName: 'test-index' },
      });

      await localEngine.index({ id: 'doc1', content: 'Hello world' });
      await localEngine.index({ id: 'doc2', content: 'Another doc' });

      expect(mockCreateIndex).toHaveBeenCalledTimes(1);
      expect(mockCreateIndex).toHaveBeenCalledWith({ indexName: 'test-index', dimension: 3 });
      expect(store.upsert).toHaveBeenCalledTimes(2);
    });

    it('should still upsert when createIndex throws (index already exists)', async () => {
      const store: any = {
        upsert: vi.fn(async () => {}),
        query: vi.fn(async () => []),
        deleteVector: vi.fn(async () => {}),
        createIndex: vi.fn(async () => {
          throw new Error('index already exists');
        }),
      };
      const localEngine = new SearchEngine({
        vector: { vectorStore: store, embedder: mockEmbedder, indexName: 'test-index' },
      });

      await expect(localEngine.index({ id: 'doc1', content: 'Hello world' })).resolves.toBeUndefined();
      expect(store.upsert).toHaveBeenCalledTimes(1);
    });

    it('should retry createIndex on next write if previous createIndex/upsert path failed', async () => {
      let createAttempts = 0;
      let indexCreated = false;

      const store: any = {
        query: vi.fn(async () => []),
        deleteVector: vi.fn(async () => {}),
        createIndex: vi.fn(async () => {
          createAttempts += 1;
          if (createAttempts === 1) {
            throw new Error('temporary create failure');
          }
          indexCreated = true;
        }),
        upsert: vi.fn(async () => {
          if (!indexCreated) {
            throw new Error('no such table');
          }
        }),
      };

      const localEngine = new SearchEngine({
        vector: { vectorStore: store, embedder: mockEmbedder, indexName: 'test-index' },
      });

      await expect(localEngine.index({ id: 'doc1', content: 'Hello world' })).rejects.toThrow('no such table');
      await expect(localEngine.index({ id: 'doc2', content: 'Another doc' })).resolves.toBeUndefined();

      expect(store.createIndex).toHaveBeenCalledTimes(2);
      expect(store.upsert).toHaveBeenCalledTimes(2);
    });

    it('should search vector store', async () => {
      mockVectorStore.query.mockResolvedValue([
        { id: 'doc1', score: 0.95, metadata: { id: 'doc1', text: 'Hello world' } },
        { id: 'doc2', score: 0.85, metadata: { id: 'doc2', text: 'Hello there' } },
      ]);

      const results = await engine.search('hello');

      expect(mockEmbedder).toHaveBeenCalledWith('hello');
      expect(mockVectorStore.query).toHaveBeenCalledWith({
        indexName: 'test-index',
        queryVector: expect.any(Array),
        topK: 10,
        filter: undefined,
      });

      expect(results.length).toBe(2);
      expect(results[0]?.id).toBe('doc1');
      expect(results[0]?.score).toBe(0.95);
      expect(results[0]?.scoreDetails?.vector).toBe(0.95);
    });

    it('should apply filter in vector search', async () => {
      mockVectorStore.query.mockResolvedValue([]);

      await engine.search('hello', { filter: { category: 'greeting' } });

      expect(mockVectorStore.query).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: { category: 'greeting' },
        }),
      );
    });

    it('should remove documents from vector store', async () => {
      await engine.remove('doc1');

      expect(mockVectorStore.deleteVector).toHaveBeenCalledWith({
        indexName: 'test-index',
        id: 'doc1',
      });
    });

    it('should throw error when BM25 mode is requested without config', async () => {
      await expect(engine.search('hello', { mode: 'bm25' })).rejects.toThrow(
        'BM25 search requires BM25 configuration.',
      );
    });
  });

  describe('Lazy vector indexing', () => {
    let engine: SearchEngine;
    let mockEmbedder: Embedder;
    let mockVectorStore: any;

    beforeEach(() => {
      mockEmbedder = vi.fn(async (_text: string) => [1, 2, 3]);

      mockVectorStore = {
        upsert: vi.fn(async () => {}),
        query: vi.fn(async () => []),
        deleteVector: vi.fn(async () => {}),
      };

      engine = new SearchEngine({
        vector: {
          vectorStore: mockVectorStore,
          embedder: mockEmbedder,
          indexName: 'test-index',
        },
        lazyVectorIndex: true,
      });
    });

    it('should not index immediately when lazy mode is enabled', async () => {
      await engine.index({ id: 'doc1', content: 'Hello world' });

      expect(mockEmbedder).not.toHaveBeenCalled();
      expect(mockVectorStore.upsert).not.toHaveBeenCalled();
    });

    it('should index on first search when lazy mode is enabled', async () => {
      await engine.index({ id: 'doc1', content: 'Hello world' });
      await engine.index({ id: 'doc2', content: 'Goodbye world' });

      mockVectorStore.query.mockResolvedValue([]);

      await engine.search('hello');

      // Should have embedded both documents + the query
      expect(mockEmbedder).toHaveBeenCalledTimes(3);
      expect(mockVectorStore.upsert).toHaveBeenCalledTimes(2);
    });

    it('should not re-index on subsequent searches', async () => {
      await engine.index({ id: 'doc1', content: 'Hello world' });

      mockVectorStore.query.mockResolvedValue([]);

      await engine.search('hello');
      await engine.search('world');

      // First search: 1 doc embed + 1 query embed
      // Second search: just 1 query embed
      expect(mockEmbedder).toHaveBeenCalledTimes(3);
      expect(mockVectorStore.upsert).toHaveBeenCalledTimes(1);
    });

    it('should remove pending docs when removed before indexing', async () => {
      await engine.index({ id: 'doc1', content: 'Hello world' });
      await engine.remove('doc1');

      mockVectorStore.query.mockResolvedValue([]);

      await engine.search('hello');

      // Should not have indexed the removed document
      expect(mockVectorStore.upsert).not.toHaveBeenCalled();
    });

    it('should dedupe pending vector docs by id so last content wins', async () => {
      await engine.index({ id: 'doc1', content: 'first' });
      await engine.index({ id: 'doc1', content: 'second' });

      mockVectorStore.query.mockResolvedValue([]);

      await engine.search('hello');

      expect(mockVectorStore.upsert).toHaveBeenCalledTimes(1);
      expect(mockEmbedder).toHaveBeenCalledWith('second');
    });
  });

  describe('Hybrid mode', () => {
    let engine: SearchEngine;
    let mockEmbedder: Embedder;
    let mockVectorStore: any;

    beforeEach(() => {
      mockEmbedder = vi.fn(async (_text: string) => [1, 2, 3]);

      mockVectorStore = {
        upsert: vi.fn(async () => {}),
        query: vi.fn(async () => []),
        deleteVector: vi.fn(async () => {}),
      };

      engine = new SearchEngine({
        bm25: {},
        vector: {
          vectorStore: mockVectorStore,
          embedder: mockEmbedder,
          indexName: 'test-index',
        },
      });
    });

    it('should create engine with hybrid enabled', () => {
      expect(engine.canBM25).toBe(true);
      expect(engine.canVector).toBe(true);
      expect(engine.canHybrid).toBe(true);
    });

    it('should default to hybrid search when both are available', async () => {
      await engine.index({ id: 'doc1', content: 'Hello world' });

      mockVectorStore.query.mockResolvedValue([
        { id: 'doc1', score: 0.9, metadata: { id: 'doc1', text: 'Hello world' } },
      ]);

      const results = await engine.search('hello');

      // Should have called both BM25 and vector
      expect(mockVectorStore.query).toHaveBeenCalled();
      expect(results[0]?.scoreDetails?.vector).toBeDefined();
      expect(results[0]?.scoreDetails?.bm25).toBeDefined();
    });

    it('should combine scores with default 0.5 weight', async () => {
      await engine.index({ id: 'doc1', content: 'Hello world' });

      mockVectorStore.query.mockResolvedValue([
        { id: 'doc1', score: 0.8, metadata: { id: 'doc1', text: 'Hello world' } },
      ]);

      const results = await engine.search('hello');

      // Score should be weighted combination
      // BM25 normalized to 1.0 (only result), vector is 0.8
      // Combined: 0.5 * 0.8 + 0.5 * 1.0 = 0.9
      expect(results[0]?.score).toBeCloseTo(0.9, 1);
    });

    it('should respect custom vectorWeight', async () => {
      await engine.index({ id: 'doc1', content: 'Hello world' });

      mockVectorStore.query.mockResolvedValue([
        { id: 'doc1', score: 0.8, metadata: { id: 'doc1', text: 'Hello world' } },
      ]);

      const results = await engine.search('hello', { vectorWeight: 0.7 });

      // Combined: 0.7 * 0.8 + 0.3 * 1.0 = 0.86
      expect(results[0]?.score).toBeCloseTo(0.86, 1);
    });

    it('should merge results from both search methods', async () => {
      await engine.index({ id: 'doc1', content: 'Hello world' });
      await engine.index({ id: 'doc2', content: 'machine learning algorithms' });

      // Vector finds doc2, BM25 finds doc1
      mockVectorStore.query.mockResolvedValue([
        { id: 'doc2', score: 0.9, metadata: { id: 'doc2', text: 'machine learning algorithms' } },
      ]);

      const results = await engine.search('hello');

      // Both should be in results
      const ids = results.map(r => r.id);
      expect(ids).toContain('doc1');
      // doc2 may or may not be included depending on search behavior
    });

    it('should include lineRange in hybrid results', async () => {
      const content = `Line 1
Line 2 has hello
Line 3`;

      await engine.index({ id: 'doc1', content });

      mockVectorStore.query.mockResolvedValue([{ id: 'doc1', score: 0.9, metadata: { id: 'doc1', text: content } }]);

      const results = await engine.search('hello');

      expect(results[0]?.lineRange).toEqual({ start: 2, end: 2 });
    });

    it('should allow forcing bm25 mode', async () => {
      await engine.index({ id: 'doc1', content: 'Hello world' });

      const results = await engine.search('hello', { mode: 'bm25' });

      expect(mockVectorStore.query).not.toHaveBeenCalled();
      expect(results[0]?.scoreDetails?.bm25).toBeDefined();
      expect(results[0]?.scoreDetails?.vector).toBeUndefined();
    });

    it('should allow forcing vector mode', async () => {
      await engine.index({ id: 'doc1', content: 'Hello world' });

      mockVectorStore.query.mockResolvedValue([
        { id: 'doc1', score: 0.9, metadata: { id: 'doc1', text: 'Hello world' } },
      ]);

      const results = await engine.search('hello', { mode: 'vector' });

      expect(results[0]?.scoreDetails?.vector).toBeDefined();
      expect(results[0]?.scoreDetails?.bm25).toBeUndefined();
    });
  });

  describe('No configuration', () => {
    it('should throw error when searching without any configuration', async () => {
      const engine = new SearchEngine();

      await expect(engine.search('hello')).rejects.toThrow(
        'No search configuration available. Provide bm25 or vector config.',
      );
    });
  });

  describe('BM25 index access', () => {
    it('should expose BM25 index for serialization', async () => {
      const engine = new SearchEngine({ bm25: {} });

      await engine.index({ id: 'doc1', content: 'Hello world' });

      const bm25Index = engine.bm25Index;
      expect(bm25Index).toBeDefined();
      expect(bm25Index?.size).toBe(1);

      // Should be serializable
      const serialized = bm25Index?.serialize();
      expect(serialized).toBeDefined();
    });
  });

  describe('Chunk line offset tracking', () => {
    let engine: SearchEngine;

    beforeEach(() => {
      engine = new SearchEngine({ bm25: {} });
    });

    it('should adjust lineRange when startLineOffset is provided', async () => {
      // Simulating a chunk from lines 10-15 of original document
      const chunk = `This is chunk content
with machine learning
on multiple lines`;

      await engine.index({
        id: 'chunk1',
        content: chunk,
        startLineOffset: 10, // This chunk starts at line 10 in original doc
      });

      const results = await engine.search('machine');

      // 'machine' is on line 2 of the chunk
      // With offset 10, it should report line 11 (10 + 2 - 1)
      expect(results[0]?.lineRange).toEqual({ start: 11, end: 11 });
    });

    it('should not adjust lineRange when no offset is provided', async () => {
      const content = `Line 1
Line 2 has machine
Line 3`;

      await engine.index({ id: 'doc1', content });

      const results = await engine.search('machine');

      // Should report actual line 2, no adjustment
      expect(results[0]?.lineRange).toEqual({ start: 2, end: 2 });
    });

    it('should handle chunks spanning multiple lines with offset', async () => {
      // Chunk starting at line 20, containing matches on chunk lines 1 and 3
      const chunk = `First line has learning
Second line has nothing
Third line has learning too`;

      await engine.index({
        id: 'chunk1',
        content: chunk,
        startLineOffset: 20,
      });

      const results = await engine.search('learning');

      // 'learning' appears on chunk lines 1 and 3
      // With offset 20: start = 20 + 1 - 1 = 20, end = 20 + 3 - 1 = 22
      expect(results[0]?.lineRange).toEqual({ start: 20, end: 22 });
    });

    it('should not include _startLineOffset in returned metadata', async () => {
      await engine.index({
        id: 'chunk1',
        content: 'test content',
        metadata: { category: 'test' },
        startLineOffset: 10,
      });

      const results = await engine.search('test');

      // Should have category but not _startLineOffset
      expect(results[0]?.metadata?.category).toBe('test');
      expect(results[0]?.metadata?._startLineOffset).toBeUndefined();
    });

    it('should handle multiple chunks with different offsets', async () => {
      await engine.index({
        id: 'chunk1',
        content: 'First chunk with learning',
        startLineOffset: 1,
      });

      await engine.index({
        id: 'chunk2',
        content: 'Second chunk with learning',
        startLineOffset: 50,
      });

      const results = await engine.search('learning');

      // Both chunks should have their line ranges adjusted correctly
      const chunk1Result = results.find(r => r.id === 'chunk1');
      const chunk2Result = results.find(r => r.id === 'chunk2');

      expect(chunk1Result?.lineRange).toEqual({ start: 1, end: 1 });
      expect(chunk2Result?.lineRange).toEqual({ start: 50, end: 50 });
    });
  });

  describe('removeByPrefix', () => {
    it('should remove all BM25 documents matching a prefix', async () => {
      const engine = new SearchEngine({ bm25: {} });

      await engine.index({ id: 'file.txt#chunk-0', content: 'first chunk content' });
      await engine.index({ id: 'file.txt#chunk-1', content: 'second chunk content' });
      await engine.index({ id: 'other.txt', content: 'other content' });

      await engine.removeByPrefix('file.txt#');

      const results = await engine.search('content');
      expect(results).toHaveLength(1);
      expect(results[0]?.id).toBe('other.txt');
    });

    it('should not remove documents that do not match the prefix', async () => {
      const engine = new SearchEngine({ bm25: {} });

      await engine.index({ id: 'a.txt#chunk-0', content: 'alpha' });
      await engine.index({ id: 'b.txt#chunk-0', content: 'beta' });

      await engine.removeByPrefix('a.txt#');

      const results = await engine.search('alpha');
      expect(results).toHaveLength(0);

      const remaining = await engine.search('beta');
      expect(remaining).toHaveLength(1);
    });

    it('should delete matching vectors from the vector store', async () => {
      const mockDeleteVector = vi.fn(async () => {});
      const engine = new SearchEngine({
        vector: {
          vectorStore: {
            upsert: vi.fn(async () => {}),
            query: vi.fn(async () => []),
            deleteVector: mockDeleteVector,
            deleteVectors: vi.fn(async () => {}),
          } as any,
          embedder: vi.fn(async () => [1, 2, 3]),
          indexName: 'test-index',
        },
      });

      await engine.index({ id: 'file.txt#chunk-0', content: 'chunk zero' });
      await engine.index({ id: 'file.txt#chunk-1', content: 'chunk one' });
      await engine.index({ id: 'other.txt', content: 'other' });

      await engine.removeByPrefix('file.txt#');

      expect(mockDeleteVector).toHaveBeenCalledTimes(2);
      expect(mockDeleteVector).toHaveBeenCalledWith({ indexName: 'test-index', id: 'file.txt#chunk-0' });
      expect(mockDeleteVector).toHaveBeenCalledWith({ indexName: 'test-index', id: 'file.txt#chunk-1' });
    });
  });

  describe('removeSource', () => {
    it('should remove source doc, chunks, and sourceFile vectors', async () => {
      const mockDeleteVector = vi.fn(async () => {});
      const mockDeleteVectors = vi.fn(async () => {});
      const engine = new SearchEngine({
        vector: {
          vectorStore: {
            upsert: vi.fn(async () => {}),
            query: vi.fn(async () => []),
            deleteVector: mockDeleteVector,
            deleteVectors: mockDeleteVectors,
          } as any,
          embedder: vi.fn(async () => [1, 2, 3]),
          indexName: 'test-index',
        },
      });

      await engine.index({ id: 'file.txt', content: 'full file content' });
      await engine.index({ id: 'file.txt#chunk-0', content: 'chunk zero', metadata: { sourceFile: 'file.txt' } });
      await engine.index({ id: 'file.txt#chunk-1', content: 'chunk one', metadata: { sourceFile: 'file.txt' } });

      await engine.removeSource('file.txt');

      expect(mockDeleteVector).toHaveBeenCalledWith({ indexName: 'test-index', id: 'file.txt' });
      expect(mockDeleteVector).toHaveBeenCalledWith({ indexName: 'test-index', id: 'file.txt#chunk-0' });
      expect(mockDeleteVector).toHaveBeenCalledWith({ indexName: 'test-index', id: 'file.txt#chunk-1' });
      expect(mockDeleteVectors).toHaveBeenCalledWith({
        indexName: 'test-index',
        filter: { sourceFile: 'file.txt' },
      });
    });
  });

  describe('BatchEmbedder support', () => {
    function makeStore() {
      return {
        upsert: vi.fn(async () => {}),
        query: vi.fn(async () => []),
        deleteVector: vi.fn(async () => {}),
        deleteVectors: vi.fn(async () => {}),
        createIndex: vi.fn(async () => {}),
      } as any;
    }

    function makeBatchEmbedder(maxBatchSize?: number) {
      const fn = vi.fn(async (texts: string[]) =>
        texts.map(t => {
          const hash = t.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
          return [hash % 100, (hash * 2) % 100, (hash * 3) % 100];
        }),
      );
      const embedder: BatchEmbedder = Object.assign(fn, {
        batch: true as const,
        ...(maxBatchSize !== undefined ? { maxBatchSize } : {}),
      });
      return { embedder, fn };
    }

    it('isBatchEmbedder distinguishes batch and single embedders', () => {
      const single: Embedder = vi.fn(async () => [0]);
      const { embedder: batch } = makeBatchEmbedder();
      const fakeBranded = Object.assign(
        vi.fn(async () => [0]),
        { batch: false },
      ) as unknown as Embedder;

      expect(isBatchEmbedder(single)).toBe(false);
      expect(isBatchEmbedder(batch)).toBe(true);
      expect(isBatchEmbedder(fakeBranded)).toBe(false);
    });

    it('flushes the entire pending queue in a single embedder call when no maxBatchSize is set', async () => {
      const store = makeStore();
      const { embedder, fn } = makeBatchEmbedder();
      const engine = new SearchEngine({
        vector: { vectorStore: store, embedder, indexName: 'idx' },
        lazyVectorIndex: true,
      });

      await engine.indexMany([
        { id: 'a', content: 'alpha' },
        { id: 'b', content: 'beta' },
        { id: 'c', content: 'gamma' },
        { id: 'd', content: 'delta' },
        { id: 'e', content: 'epsilon' },
      ]);

      // Lazy: nothing called yet.
      expect(fn).not.toHaveBeenCalled();
      expect(store.upsert).not.toHaveBeenCalled();

      // Trigger flush via search.
      await engine.search('alpha', { mode: 'vector' });

      // One batched embedder call for the docs and one upsert.
      const docCalls = fn.mock.calls.filter(call => Array.isArray(call[0]) && call[0].length === 5);
      expect(docCalls).toHaveLength(1);
      expect(docCalls[0]?.[0]).toEqual(['alpha', 'beta', 'gamma', 'delta', 'epsilon']);
      expect(store.upsert).toHaveBeenCalledTimes(1);
      const upsertArgs = store.upsert.mock.calls[0]![0];
      expect(upsertArgs.ids).toEqual(['a', 'b', 'c', 'd', 'e']);
      expect(upsertArgs.vectors).toHaveLength(5);
    });

    it('chunks pending docs by maxBatchSize when configured', async () => {
      const store = makeStore();
      const { embedder, fn } = makeBatchEmbedder(2);
      const engine = new SearchEngine({
        vector: { vectorStore: store, embedder, indexName: 'idx' },
        lazyVectorIndex: true,
      });

      await engine.indexMany([
        { id: '1', content: 'one' },
        { id: '2', content: 'two' },
        { id: '3', content: 'three' },
        { id: '4', content: 'four' },
        { id: '5', content: 'five' },
      ]);

      // Lazy: nothing called yet; indexMany only enqueues.
      expect(fn).not.toHaveBeenCalled();

      await engine.search('one', { mode: 'vector' });

      // 5 docs / batch size 2 = 3 embedder calls (2, 2, 1). Plus one more for the search query.
      // The search query is sent as a one-element batch, so we'll see four total
      // calls and three of them flush docs.
      expect(fn).toHaveBeenCalledTimes(4);
      const docCallSizes = fn.mock.calls
        .slice(0, 3)
        .map(c => (c[0] as string[]).length)
        .sort();
      expect(docCallSizes).toEqual([1, 2, 2]);

      // Single upsert with all 5 vectors.
      expect(store.upsert).toHaveBeenCalledTimes(1);
      expect(store.upsert.mock.calls[0]![0].vectors).toHaveLength(5);
    });

    it('uses batched call for single search query', async () => {
      const store = makeStore();
      store.query.mockResolvedValue([{ id: 'a', score: 0.9, metadata: { id: 'a', text: 'alpha' } }]);
      const { embedder, fn } = makeBatchEmbedder();
      const engine = new SearchEngine({
        vector: { vectorStore: store, embedder, indexName: 'idx' },
      });

      await engine.search('hello', { mode: 'vector' });

      // Search query is sent as a one-element batch.
      expect(fn).toHaveBeenCalledWith(['hello']);
    });

    it('falls back to per-doc embedding for single-text embedders', async () => {
      const store = makeStore();
      const single: Embedder = vi.fn(async (text: string) => [text.length, 0, 0]);
      const engine = new SearchEngine({
        vector: { vectorStore: store, embedder: single, indexName: 'idx' },
        lazyVectorIndex: true,
      });

      await engine.indexMany([
        { id: 'a', content: 'alpha' },
        { id: 'b', content: 'beta' },
      ]);
      await engine.search('alpha', { mode: 'vector' });

      // Two doc embeddings + one query embedding = 3 calls.
      expect(single).toHaveBeenCalledTimes(3);
      // Two upserts (one per doc) — same shape as before this PR.
      expect(store.upsert).toHaveBeenCalledTimes(2);
    });

    it('re-queues batch on flush failure for batch embedders', async () => {
      const store = makeStore();
      let attempts = 0;
      const fn = vi.fn(async (texts: string[]) => {
        attempts++;
        if (attempts === 1) {
          throw new Error('transient embedder failure');
        }
        return texts.map(() => [1, 2, 3]);
      });
      const embedder: BatchEmbedder = Object.assign(fn, { batch: true as const });

      const engine = new SearchEngine({
        vector: { vectorStore: store, embedder, indexName: 'idx' },
        lazyVectorIndex: true,
      });

      await engine.indexMany([
        { id: 'a', content: 'alpha' },
        { id: 'b', content: 'beta' },
      ]);

      await expect(engine.search('alpha', { mode: 'vector' })).rejects.toThrow('transient embedder failure');

      // Second search succeeds because the batch was re-queued.
      await engine.search('alpha', { mode: 'vector' });
      expect(store.upsert).toHaveBeenCalledTimes(1);
      expect(store.upsert.mock.calls[0]![0].ids).toEqual(['a', 'b']);
    });

    it('throws when batch embedder returns wrong number of embeddings', async () => {
      const store = makeStore();
      const fn = vi.fn(async (_texts: string[]) => [[1, 2, 3]]);
      const embedder: BatchEmbedder = Object.assign(fn, { batch: true as const });

      const engine = new SearchEngine({
        vector: { vectorStore: store, embedder, indexName: 'idx' },
        lazyVectorIndex: true,
      });

      await engine.indexMany([
        { id: 'a', content: 'alpha' },
        { id: 'b', content: 'beta' },
      ]);

      await expect(engine.search('alpha', { mode: 'vector' })).rejects.toThrow(/returned 1 embeddings for 2 inputs/);
    });
  });
});

describe('splitIntoChunks', () => {
  it('should return a single chunk for short text', () => {
    const chunks = splitIntoChunks('hello world');
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.content).toBe('hello world');
    expect(chunks[0]?.startLine).toBe(1);
  });

  it('should split text that exceeds maxChunkChars', () => {
    const line = 'a'.repeat(50);
    const lines = Array.from({ length: 20 }, () => line);
    const text = lines.join('\n');

    const chunks = splitIntoChunks(text, { maxChunkChars: 200, overlapLines: 0 });

    expect(chunks.length).toBeGreaterThan(1);

    const reassembled = chunks.map(c => c.content).join('\n');
    expect(reassembled).toBe(text);
  });

  it('should produce overlapping chunks when overlapLines > 0', () => {
    const lines = Array.from({ length: 20 }, (_, i) => `line-${i + 1}`);
    const text = lines.join('\n');

    const chunks = splitIntoChunks(text, { maxChunkChars: 60, overlapLines: 2 });

    expect(chunks.length).toBeGreaterThan(1);

    for (let i = 1; i < chunks.length; i++) {
      const prevLines = chunks[i - 1]!.content.split('\n');
      const currLines = chunks[i]!.content.split('\n');
      const prevTail = prevLines.slice(-2);
      const currHead = currLines.slice(0, 2);
      expect(currHead).toEqual(prevTail);
    }
  });

  it('should set correct startLine for each chunk', () => {
    const lines = Array.from({ length: 10 }, (_, i) => `line-${i + 1}`);
    const text = lines.join('\n');

    const chunks = splitIntoChunks(text, { maxChunkChars: 40, overlapLines: 0 });

    expect(chunks[0]?.startLine).toBe(1);

    for (const chunk of chunks) {
      const expectedLine = text.split('\n').indexOf(chunk.content.split('\n')[0]!) + 1;
      expect(chunk.startLine).toBe(expectedLine);
    }
  });

  it('should split a single very long line by character boundaries', () => {
    const text = 'x'.repeat(10000);
    const chunks = splitIntoChunks(text, { maxChunkChars: 4000 });

    expect(chunks).toHaveLength(3);
    expect(chunks[0]?.content).toBe('x'.repeat(4000));
    expect(chunks[1]?.content).toBe('x'.repeat(4000));
    expect(chunks[2]?.content).toBe('x'.repeat(2000));
    expect(chunks.every(c => c.startLine === 1)).toBe(true);
  });

  it('should handle empty text', () => {
    const chunks = splitIntoChunks('');
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.content).toBe('');
  });

  it('should not produce empty chunks', () => {
    const lines = Array.from({ length: 50 }, (_, i) => `line ${i}`);
    const text = lines.join('\n');

    const chunks = splitIntoChunks(text, { maxChunkChars: 100, overlapLines: 2 });

    for (const chunk of chunks) {
      expect(chunk.content.length).toBeGreaterThan(0);
    }
  });
});
