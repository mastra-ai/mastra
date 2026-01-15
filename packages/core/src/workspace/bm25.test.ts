import { describe, it, expect, beforeEach } from 'vitest';

import {
  BM25Index,
  tokenize,
  findLineRange,
  extractLines,
  charIndexToLineNumber,
  charRangeToLineRange,
  DEFAULT_STOPWORDS,
} from './bm25';

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

describe('findLineRange', () => {
  const multilineContent = `This is the first line
Second line has machine learning
Third line is empty
Fourth line has deep learning
Fifth line has neural networks
Sixth line ends the document`;

  it('should find line range for single term', () => {
    const range = findLineRange(multilineContent, ['machine']);
    expect(range).toEqual({ start: 2, end: 2 });
  });

  it('should find line range spanning multiple lines', () => {
    const range = findLineRange(multilineContent, ['learning']);
    // 'learning' appears on lines 2 and 4
    expect(range).toEqual({ start: 2, end: 4 });
  });

  it('should find line range for multiple query terms', () => {
    const range = findLineRange(multilineContent, ['machine', 'neural']);
    // 'machine' on line 2, 'neural' on line 5
    expect(range).toEqual({ start: 2, end: 5 });
  });

  it('should return undefined for empty query terms', () => {
    const range = findLineRange(multilineContent, []);
    expect(range).toBeUndefined();
  });

  it('should return undefined for no matches', () => {
    const range = findLineRange(multilineContent, ['quantum', 'computing']);
    expect(range).toBeUndefined();
  });

  it('should handle single line content', () => {
    const range = findLineRange('just one line with test content', ['test']);
    expect(range).toEqual({ start: 1, end: 1 });
  });

  it('should respect tokenization options', () => {
    const content = 'Line with TEST word\nAnother line with test';
    // With lowercase: true (default), both lines match
    const rangeDefault = findLineRange(content, ['test']);
    expect(rangeDefault).toEqual({ start: 1, end: 2 });

    // With lowercase: false, only exact case matches
    const rangeNoLower = findLineRange(content, ['test'], { lowercase: false });
    expect(rangeNoLower).toEqual({ start: 2, end: 2 });
  });

  it('should handle empty content', () => {
    const range = findLineRange('', ['test']);
    expect(range).toBeUndefined();
  });
});

describe('extractLines', () => {
  const content = `Line 1
Line 2
Line 3
Line 4
Line 5`;

  it('should extract all lines when no range specified', () => {
    const result = extractLines(content);
    expect(result.content).toBe(content);
    expect(result.lines).toEqual({ start: 1, end: 5 });
    expect(result.totalLines).toBe(5);
  });

  it('should extract specific line range', () => {
    const result = extractLines(content, 2, 4);
    expect(result.content).toBe('Line 2\nLine 3\nLine 4');
    expect(result.lines).toEqual({ start: 2, end: 4 });
    expect(result.totalLines).toBe(5);
  });

  it('should extract from start line to end', () => {
    const result = extractLines(content, 3);
    expect(result.content).toBe('Line 3\nLine 4\nLine 5');
    expect(result.lines).toEqual({ start: 3, end: 5 });
    expect(result.totalLines).toBe(5);
  });

  it('should extract from beginning to end line', () => {
    const result = extractLines(content, undefined, 2);
    expect(result.content).toBe('Line 1\nLine 2');
    expect(result.lines).toEqual({ start: 1, end: 2 });
    expect(result.totalLines).toBe(5);
  });

  it('should handle single line extraction', () => {
    const result = extractLines(content, 3, 3);
    expect(result.content).toBe('Line 3');
    expect(result.lines).toEqual({ start: 3, end: 3 });
  });

  it('should clamp start line to 1', () => {
    const result = extractLines(content, -5, 2);
    expect(result.lines.start).toBe(1);
    expect(result.content).toBe('Line 1\nLine 2');
  });

  it('should clamp end line to total lines', () => {
    const result = extractLines(content, 4, 100);
    expect(result.lines.end).toBe(5);
    expect(result.content).toBe('Line 4\nLine 5');
  });

  it('should handle single line content', () => {
    const result = extractLines('Single line');
    expect(result.content).toBe('Single line');
    expect(result.lines).toEqual({ start: 1, end: 1 });
    expect(result.totalLines).toBe(1);
  });

  it('should handle empty content', () => {
    const result = extractLines('');
    expect(result.content).toBe('');
    expect(result.totalLines).toBe(1); // Empty string splits to ['']
  });
});

describe('charIndexToLineNumber', () => {
  const content = `Line 1
Line 2
Line 3
Line 4`;

  it('should return line 1 for character index 0', () => {
    expect(charIndexToLineNumber(content, 0)).toBe(1);
  });

  it('should return correct line for character in first line', () => {
    // 'L' at position 0 -> line 1
    expect(charIndexToLineNumber(content, 0)).toBe(1);
    // 'i' at position 1 -> line 1
    expect(charIndexToLineNumber(content, 1)).toBe(1);
    // ' ' at position 4 -> line 1
    expect(charIndexToLineNumber(content, 4)).toBe(1);
    // '1' at position 5 -> line 1
    expect(charIndexToLineNumber(content, 5)).toBe(1);
  });

  it('should return line 2 for character after first newline', () => {
    // First line is "Line 1\n" (7 chars including newline)
    // Index 7 is first char of line 2
    expect(charIndexToLineNumber(content, 7)).toBe(2);
  });

  it('should return line 3 for character in third line', () => {
    // "Line 1\n" = 7 chars, "Line 2\n" = 7 chars
    // Index 14 is first char of line 3
    expect(charIndexToLineNumber(content, 14)).toBe(3);
  });

  it('should return last line for character at end', () => {
    // Total content length
    expect(charIndexToLineNumber(content, content.length)).toBe(4);
  });

  it('should return undefined for negative index', () => {
    expect(charIndexToLineNumber(content, -1)).toBeUndefined();
  });

  it('should return undefined for index beyond content length', () => {
    expect(charIndexToLineNumber(content, content.length + 1)).toBeUndefined();
  });

  it('should handle single line content', () => {
    expect(charIndexToLineNumber('single line', 5)).toBe(1);
  });

  it('should handle empty content', () => {
    expect(charIndexToLineNumber('', 0)).toBe(1);
  });
});

describe('charRangeToLineRange', () => {
  const content = `Line 1
Line 2
Line 3
Line 4`;

  it('should convert character range within single line', () => {
    // "Line" (0-3) on first line
    const range = charRangeToLineRange(content, 0, 4);
    expect(range).toEqual({ start: 1, end: 1 });
  });

  it('should convert character range spanning multiple lines', () => {
    // From start of line 1 to end of line 3
    // "Line 1\n" = 7, "Line 2\n" = 7, "Line 3" = 6 (total 20, but we want index 20)
    const range = charRangeToLineRange(content, 0, 21);
    expect(range).toEqual({ start: 1, end: 3 });
  });

  it('should convert character range starting mid-document', () => {
    // Start at line 2 (index 7), end at line 3
    const range = charRangeToLineRange(content, 7, 21);
    expect(range).toEqual({ start: 2, end: 3 });
  });

  it('should return undefined for invalid start index', () => {
    expect(charRangeToLineRange(content, -1, 10)).toBeUndefined();
  });

  it('should return undefined for invalid end index', () => {
    expect(charRangeToLineRange(content, 0, content.length + 10)).toBeUndefined();
  });

  it('should handle single character range', () => {
    const range = charRangeToLineRange(content, 0, 1);
    expect(range).toEqual({ start: 1, end: 1 });
  });

  it('should handle range ending at newline', () => {
    // "Line 1\n" ends at index 6 (the newline)
    // endCharIdx is exclusive, so charRangeToLineRange(content, 0, 7) includes the newline
    // But we look at index 6 (7-1) which is the newline, still on line 1
    const range = charRangeToLineRange(content, 0, 7);
    expect(range).toEqual({ start: 1, end: 1 });
  });
});
