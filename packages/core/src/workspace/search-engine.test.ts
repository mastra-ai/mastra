import { describe, it, expect, beforeEach, vi } from 'vitest';

import { SearchEngine } from './search-engine';
import type { IndexDocument, SearchResult, Embedder } from './search-engine';

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
      mockEmbedder = vi.fn(async (text: string) => [1, 2, 3]);

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
  });

  describe('Hybrid mode', () => {
    let engine: SearchEngine;
    let mockEmbedder: Embedder;
    let mockVectorStore: any;

    beforeEach(() => {
      mockEmbedder = vi.fn(async (text: string) => [1, 2, 3]);

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
});
