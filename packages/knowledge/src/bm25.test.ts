import { describe, it, expect, beforeEach } from 'vitest';

import { BM25Index, tokenize, DEFAULT_STOPWORDS } from './bm25';

describe('tokenize', () => {
  it('should tokenize text into words', () => {
    const tokens = tokenize('Hello World');
    expect(tokens).toEqual(['hello', 'world']);
  });

  it('should convert to lowercase by default', () => {
    const tokens = tokenize('HELLO WORLD');
    expect(tokens).toEqual(['hello', 'world']);
  });

  it('should remove punctuation by default', () => {
    const tokens = tokenize('Hello, World! How are you?');
    // 'are' is a stopword, so it gets filtered out
    expect(tokens).toEqual(['hello', 'world', 'how', 'you']);
  });

  it('should filter out stopwords by default', () => {
    const tokens = tokenize('The quick brown fox jumps over the lazy dog');
    expect(tokens).not.toContain('the');
    // 'over' is NOT in the default stopwords, so it should be included
    expect(tokens).toContain('over');
    expect(tokens).toContain('quick');
    expect(tokens).toContain('brown');
  });

  it('should filter by minimum length', () => {
    const tokens = tokenize('I am a test', { minLength: 3 });
    expect(tokens).not.toContain('am');
    expect(tokens).toContain('test');
  });

  it('should allow disabling lowercase', () => {
    const tokens = tokenize('Hello World', { lowercase: false });
    expect(tokens).toContain('Hello');
    expect(tokens).toContain('World');
  });

  it('should allow custom stopwords', () => {
    const tokens = tokenize('hello world test', {
      stopwords: new Set(['hello']),
    });
    expect(tokens).not.toContain('hello');
    expect(tokens).toContain('world');
    expect(tokens).toContain('test');
  });

  it('should handle empty string', () => {
    const tokens = tokenize('');
    expect(tokens).toEqual([]);
  });

  it('should handle string with only stopwords', () => {
    const tokens = tokenize('the a an');
    expect(tokens).toEqual([]);
  });
});

describe('BM25Index', () => {
  let index: BM25Index;

  beforeEach(() => {
    index = new BM25Index();
  });

  describe('add', () => {
    it('should add documents to the index', () => {
      index.add('doc1', 'Hello world');
      expect(index.size).toBe(1);
      expect(index.has('doc1')).toBe(true);
    });

    it('should update document if ID already exists', () => {
      index.add('doc1', 'Hello world');
      index.add('doc1', 'Goodbye world');
      expect(index.size).toBe(1);
      const doc = index.get('doc1');
      expect(doc?.content).toBe('Goodbye world');
    });

    it('should store metadata with document', () => {
      index.add('doc1', 'Hello world', { category: 'greeting' });
      const doc = index.get('doc1');
      expect(doc?.metadata?.category).toBe('greeting');
    });
  });

  describe('remove', () => {
    it('should remove document from index', () => {
      index.add('doc1', 'Hello world');
      const removed = index.remove('doc1');
      expect(removed).toBe(true);
      expect(index.size).toBe(0);
      expect(index.has('doc1')).toBe(false);
    });

    it('should return false for non-existent document', () => {
      const removed = index.remove('nonexistent');
      expect(removed).toBe(false);
    });

    it('should update search results after removal', () => {
      index.add('doc1', 'machine learning');
      index.add('doc2', 'deep learning');

      // Both should be found
      let results = index.search('learning');
      expect(results.length).toBe(2);

      // Remove one
      index.remove('doc1');

      // Only doc2 should be found
      results = index.search('learning');
      expect(results.length).toBe(1);
      expect(results[0]?.id).toBe('doc2');
    });
  });

  describe('clear', () => {
    it('should remove all documents', () => {
      index.add('doc1', 'Hello world');
      index.add('doc2', 'Goodbye world');
      index.clear();
      expect(index.size).toBe(0);
    });
  });

  describe('search', () => {
    beforeEach(() => {
      // Add sample documents
      index.add('doc1', 'Machine learning is a subset of artificial intelligence');
      index.add('doc2', 'Deep learning uses neural networks');
      index.add('doc3', 'Natural language processing is used for text analysis');
      index.add('doc4', 'Computer vision is another AI application');
      index.add('doc5', 'Machine learning machine learning machine learning');
    });

    it('should find documents containing query terms', () => {
      const results = index.search('machine learning');
      expect(results.length).toBeGreaterThan(0);
      const ids = results.map(r => r.id);
      expect(ids).toContain('doc1');
      expect(ids).toContain('doc5');
    });

    it('should rank documents by relevance', () => {
      const results = index.search('machine learning');
      // doc5 has higher term frequency, should rank higher
      expect(results[0]?.id).toBe('doc5');
    });

    it('should respect topK parameter', () => {
      const results = index.search('learning', 2);
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should respect minScore parameter', () => {
      const results = index.search('machine learning', 10, 5);
      // All results should have score >= 5
      for (const result of results) {
        expect(result.score).toBeGreaterThanOrEqual(5);
      }
    });

    it('should return empty array for no matches', () => {
      const results = index.search('quantum computing');
      expect(results.length).toBe(0);
    });

    it('should return empty array for empty query', () => {
      const results = index.search('');
      expect(results.length).toBe(0);
    });

    it('should return empty array for query with only stopwords', () => {
      const results = index.search('the a an');
      expect(results.length).toBe(0);
    });

    it('should include content in results', () => {
      const results = index.search('neural networks');
      const doc2 = results.find(r => r.id === 'doc2');
      expect(doc2?.content).toBe('Deep learning uses neural networks');
    });

    it('should include metadata in results', () => {
      index.add('doc_meta', 'test document', { category: 'test' });
      const results = index.search('test document');
      const doc = results.find(r => r.id === 'doc_meta');
      expect(doc?.metadata?.category).toBe('test');
    });

    it('should handle multi-word queries', () => {
      const results = index.search('artificial intelligence machine learning');
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('BM25 parameters', () => {
    it('should use custom k1 parameter', () => {
      const customIndex = new BM25Index({ k1: 2.0 });
      customIndex.add('doc1', 'test document');
      const results = customIndex.search('test');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should use custom b parameter', () => {
      const customIndex = new BM25Index({ b: 0.5 });
      customIndex.add('doc1', 'test document');
      const results = customIndex.search('test');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should produce different scores with different parameters', () => {
      const index1 = new BM25Index({ k1: 1.2, b: 0.75 });
      const index2 = new BM25Index({ k1: 2.0, b: 0.5 });

      const content = 'machine learning is great for machine learning tasks';
      index1.add('doc1', content);
      index2.add('doc1', content);

      const results1 = index1.search('machine learning');
      const results2 = index2.search('machine learning');

      // Scores should be different with different parameters
      expect(results1[0]?.score).not.toBe(results2[0]?.score);
    });
  });

  describe('serialization', () => {
    it('should serialize and deserialize index', () => {
      index.add('doc1', 'Hello world', { category: 'greeting' });
      index.add('doc2', 'Machine learning');

      const serialized = index.serialize();
      const restored = BM25Index.deserialize(serialized);

      expect(restored.size).toBe(2);
      expect(restored.has('doc1')).toBe(true);
      expect(restored.has('doc2')).toBe(true);

      // Search should work
      const results = restored.search('hello');
      expect(results.find(r => r.id === 'doc1')).toBeDefined();

      // Metadata should be preserved
      const doc1 = restored.get('doc1');
      expect(doc1?.metadata?.category).toBe('greeting');
    });

    it('should preserve BM25 parameters', () => {
      const customIndex = new BM25Index({ k1: 2.0, b: 0.5 });
      customIndex.add('doc1', 'test');

      const serialized = customIndex.serialize();
      const restored = BM25Index.deserialize(serialized);

      expect(restored.k1).toBe(2.0);
      expect(restored.b).toBe(0.5);
    });
  });

  describe('documentIds', () => {
    it('should return all document IDs', () => {
      index.add('doc1', 'Hello');
      index.add('doc2', 'World');
      index.add('doc3', 'Test');

      const ids = index.documentIds;
      expect(ids).toHaveLength(3);
      expect(ids).toContain('doc1');
      expect(ids).toContain('doc2');
      expect(ids).toContain('doc3');
    });
  });
});

describe('DEFAULT_STOPWORDS', () => {
  it('should contain common English stopwords', () => {
    expect(DEFAULT_STOPWORDS.has('the')).toBe(true);
    expect(DEFAULT_STOPWORDS.has('a')).toBe(true);
    expect(DEFAULT_STOPWORDS.has('is')).toBe(true);
    expect(DEFAULT_STOPWORDS.has('and')).toBe(true);
  });

  it('should not contain content words', () => {
    expect(DEFAULT_STOPWORDS.has('machine')).toBe(false);
    expect(DEFAULT_STOPWORDS.has('learning')).toBe(false);
  });
});
