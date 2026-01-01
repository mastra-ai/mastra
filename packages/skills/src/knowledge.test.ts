import { mkdir, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { TextArtifact, FileArtifact, ImageArtifact } from '@mastra/core/knowledge';
import { LibSQLVector } from '@mastra/libsql';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { Knowledge, STATIC_PREFIX } from './knowledge';
import { KnowledgeFilesystemStorage as FilesystemStorage } from './storage';

// Default namespace used in tests
const NS = 'default';

describe('Knowledge', () => {
  let testDir: string;
  let knowledge: Knowledge;

  beforeEach(async () => {
    testDir = join(tmpdir(), `knowledge-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    knowledge = new Knowledge({
      id: 'test-knowledge',
      storage: new FilesystemStorage({ basePath: testDir }),
    });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('add', () => {
    it('should add a text artifact', async () => {
      const artifact: TextArtifact = {
        type: 'text',
        key: 'hello.txt',
        content: 'Hello, World!',
      };

      await knowledge.add(NS, artifact);

      // Files are now stored in namespace subdirectory
      const content = await readFile(join(testDir, NS, 'hello.txt'), 'utf8');
      expect(content).toBe('Hello, World!');
    });

    it('should add a file artifact with string content', async () => {
      const artifact: FileArtifact = {
        type: 'file',
        key: 'data.json',
        content: JSON.stringify({ foo: 'bar' }),
      };

      await knowledge.add(NS, artifact);

      const content = await readFile(join(testDir, NS, 'data.json'), 'utf8');
      expect(JSON.parse(content)).toEqual({ foo: 'bar' });
    });

    it('should add a file artifact with buffer content', async () => {
      const artifact: FileArtifact = {
        type: 'file',
        key: 'binary.bin',
        content: Buffer.from([0x00, 0x01, 0x02, 0x03]),
      };

      await knowledge.add(NS, artifact);

      const content = await readFile(join(testDir, NS, 'binary.bin'));
      expect(content).toEqual(Buffer.from([0x00, 0x01, 0x02, 0x03]));
    });

    it('should add an image artifact', async () => {
      // Simple 1x1 PNG
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

      const artifact: ImageArtifact = {
        type: 'image',
        key: 'image.png',
        content: pngBuffer,
        mimeType: 'image/png',
      };

      await knowledge.add(NS, artifact);

      const content = await readFile(join(testDir, NS, 'image.png'));
      expect(content).toEqual(pngBuffer);
    });

    it('should create nested directories for artifact keys', async () => {
      const artifact: TextArtifact = {
        type: 'text',
        key: 'nested/path/to/file.txt',
        content: 'Nested content',
      };

      await knowledge.add(NS, artifact);

      const content = await readFile(join(testDir, NS, 'nested/path/to/file.txt'), 'utf8');
      expect(content).toBe('Nested content');
    });

    it('should overwrite existing artifact with same key', async () => {
      const artifact1: TextArtifact = {
        type: 'text',
        key: 'overwrite.txt',
        content: 'Original content',
      };

      const artifact2: TextArtifact = {
        type: 'text',
        key: 'overwrite.txt',
        content: 'Updated content',
      };

      await knowledge.add(NS, artifact1);
      await knowledge.add(NS, artifact2);

      const content = await readFile(join(testDir, NS, 'overwrite.txt'), 'utf8');
      expect(content).toBe('Updated content');
    });
  });

  describe('getStatic', () => {
    it('should return artifacts from static/ prefix', async () => {
      // Add static artifacts
      await knowledge.add(NS, {
        type: 'text',
        key: `${STATIC_PREFIX}/policy.txt`,
        content: 'Company policy here',
      });
      await knowledge.add(NS, {
        type: 'text',
        key: `${STATIC_PREFIX}/rules.txt`,
        content: 'Business rules here',
      });
      // Add non-static artifact
      await knowledge.add(NS, {
        type: 'text',
        key: 'docs/manual.txt',
        content: 'User manual',
      });

      const staticArtifacts = await knowledge.getStatic(NS);

      expect(staticArtifacts).toHaveLength(2);
      expect(staticArtifacts.map(a => a.key)).toContain(`${STATIC_PREFIX}/policy.txt`);
      expect(staticArtifacts.map(a => a.key)).toContain(`${STATIC_PREFIX}/rules.txt`);
      expect(staticArtifacts.find(a => a.key === `${STATIC_PREFIX}/policy.txt`)?.content).toBe('Company policy here');
    });

    it('should return empty array when no static artifacts exist', async () => {
      await knowledge.add(NS, {
        type: 'text',
        key: 'docs/manual.txt',
        content: 'User manual',
      });

      const staticArtifacts = await knowledge.getStatic(NS);

      expect(staticArtifacts).toHaveLength(0);
    });
  });

  describe('list with prefix', () => {
    it('should list artifacts with given prefix', async () => {
      await knowledge.add(NS, { type: 'text', key: 'docs/a.txt', content: 'A' });
      await knowledge.add(NS, { type: 'text', key: 'docs/b.txt', content: 'B' });
      await knowledge.add(NS, { type: 'text', key: 'other/c.txt', content: 'C' });

      const docsKeys = await knowledge.list(NS, 'docs');

      expect(docsKeys).toHaveLength(2);
      expect(docsKeys).toContain('docs/a.txt');
      expect(docsKeys).toContain('docs/b.txt');
    });

    it('should list all artifacts when no prefix given', async () => {
      await knowledge.add(NS, { type: 'text', key: 'docs/a.txt', content: 'A' });
      await knowledge.add(NS, { type: 'text', key: 'other/b.txt', content: 'B' });

      const allKeys = await knowledge.list(NS);

      expect(allKeys).toHaveLength(2);
    });
  });

  describe('namespace management', () => {
    it('should create namespace when adding artifacts', async () => {
      await knowledge.add('new-namespace', { type: 'text', key: 'file.txt', content: 'Content' });

      const exists = await knowledge.hasNamespace('new-namespace');
      expect(exists).toBe(true);
    });

    it('should list namespaces', async () => {
      await knowledge.createNamespace({ namespace: 'ns1' });
      await knowledge.createNamespace({ namespace: 'ns2', description: 'Second namespace' });

      const namespaces = await knowledge.listNamespaces();

      expect(namespaces.length).toBeGreaterThanOrEqual(2);
      expect(namespaces.find(ns => ns.namespace === 'ns1')).toBeDefined();
      expect(namespaces.find(ns => ns.namespace === 'ns2')?.description).toBe('Second namespace');
    });

    it('should delete namespace', async () => {
      await knowledge.createNamespace({ namespace: 'to-delete' });
      await knowledge.add('to-delete', { type: 'text', key: 'file.txt', content: 'Content' });

      await knowledge.deleteNamespace('to-delete');

      const exists = await knowledge.hasNamespace('to-delete');
      expect(exists).toBe(false);
    });
  });
});

describe('Knowledge with indexing', () => {
  let testDir: string;
  let dbPath: string;
  let vectorStore: LibSQLVector;
  let knowledge: Knowledge;
  const indexPrefix = 'knowledge_index';
  // The actual index name will be indexPrefix_NS (e.g., knowledge_index_default)
  const indexName = `${indexPrefix}_${NS}`;
  const dimension = 3;

  // Simple mock embedder that returns predictable vectors based on content
  const mockEmbedder = async (text: string): Promise<number[]> => {
    const lowerText = text.toLowerCase();
    // Create embeddings based on keyword presence for predictable similarity
    const hasPassword = lowerText.includes('password') ? 0.9 : 0.1;
    const hasReset = lowerText.includes('reset') ? 0.9 : 0.1;
    const hasBilling = lowerText.includes('billing') ? 0.9 : 0.1;
    return [hasPassword, hasReset, hasBilling];
  };

  beforeEach(async () => {
    testDir = join(tmpdir(), `knowledge-index-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });

    // Use a file-based SQLite database for each test
    dbPath = join(testDir, 'vectors.db');

    vectorStore = new LibSQLVector({
      connectionUrl: `file:${dbPath}`,
      id: 'knowledge-test',
    });

    // Create index with the namespaced name
    await vectorStore.createIndex({ indexName, dimension });

    knowledge = new Knowledge({
      id: 'test-knowledge',
      storage: new FilesystemStorage({ basePath: testDir }),
      index: {
        vectorStore,
        embedder: mockEmbedder,
        indexNamePrefix: indexPrefix,
      },
    });
  });

  afterEach(async () => {
    try {
      await vectorStore.deleteIndex({ indexName });
    } catch {
      // Ignore cleanup errors
    }
    await rm(testDir, { recursive: true, force: true });
  });

  describe('add with indexing', () => {
    it('should index artifact when added', async () => {
      const artifact: TextArtifact = {
        type: 'text',
        key: 'indexed-doc.txt',
        content: 'This is indexed content',
      };

      await knowledge.add(NS, artifact);

      // Query the vector store to verify indexing
      const queryVector = await mockEmbedder(artifact.content);
      const results = await vectorStore.query({
        indexName,
        queryVector,
        topK: 1,
      });

      expect(results).toHaveLength(1);
      expect(results[0]?.id).toBe('indexed-doc.txt');
      expect(results[0]?.metadata?.text).toBe('This is indexed content');
      expect(results[0]?.metadata?.type).toBe('text');
    });

    it('should NOT index static artifacts by default', async () => {
      const artifact: TextArtifact = {
        type: 'text',
        key: `${STATIC_PREFIX}/policy.txt`,
        content: 'Static policy content',
      };

      await knowledge.add(NS, artifact);

      // Query the vector store - should not find it
      const queryVector = await mockEmbedder(artifact.content);
      const results = await vectorStore.query({
        indexName,
        queryVector,
        topK: 10,
      });

      const found = results.find(r => r.id === `${STATIC_PREFIX}/policy.txt`);
      expect(found).toBeUndefined();
    });

    it('should skip indexing when skipIndex is true', async () => {
      const artifact: TextArtifact = {
        type: 'text',
        key: 'not-indexed.txt',
        content: 'This should not be indexed',
      };

      await knowledge.add(NS, artifact, { skipIndex: true });

      // File should exist
      const content = await readFile(join(testDir, NS, 'not-indexed.txt'), 'utf8');
      expect(content).toBe('This should not be indexed');

      // But should not be in vector store
      const queryVector = await mockEmbedder(artifact.content);
      const results = await vectorStore.query({
        indexName,
        queryVector,
        topK: 10,
      });

      const found = results.find(r => r.id === 'not-indexed.txt');
      expect(found).toBeUndefined();
    });
  });

  describe('delete with indexing', () => {
    it('should remove from both storage and index', async () => {
      const artifact: TextArtifact = {
        type: 'text',
        key: 'to-delete.txt',
        content: 'Content to delete',
      };

      await knowledge.add(NS, artifact);

      // Verify it exists
      const queryVector = await mockEmbedder(artifact.content);
      let results = await vectorStore.query({ indexName, queryVector, topK: 1 });
      expect(results.find(r => r.id === 'to-delete.txt')).toBeDefined();

      // Delete
      await knowledge.delete(NS, 'to-delete.txt');

      // Verify removed from storage
      await expect(knowledge.get(NS, 'to-delete.txt')).rejects.toThrow();

      // Verify removed from index
      results = await vectorStore.query({ indexName, queryVector, topK: 10 });
      expect(results.find(r => r.id === 'to-delete.txt')).toBeUndefined();
    });
  });

  describe('search', () => {
    it('should search for indexed artifacts by semantic similarity', async () => {
      // Add some documents - our mock embedder gives high scores to matching keywords
      await knowledge.add(NS, {
        type: 'text',
        key: 'docs/password-reset.txt',
        content: 'To reset your password, go to Settings and click Reset Password.',
      });
      await knowledge.add(NS, {
        type: 'text',
        key: 'docs/billing.txt',
        content: 'To update your billing information, go to Account Settings.',
      });

      // Search for password-related content
      const results = await knowledge.search(NS, 'password reset');

      expect(results.length).toBeGreaterThan(0);
      // The password-reset doc should be found (it contains "password" and "reset")
      const passwordDoc = results.find(r => r.key === 'docs/password-reset.txt');
      expect(passwordDoc).toBeDefined();
      expect(passwordDoc?.content).toContain('reset your password');
      expect(passwordDoc?.score).toBeGreaterThan(0);
    });

    it('should respect topK limit', async () => {
      // Add multiple documents
      await knowledge.add(NS, { type: 'text', key: 'doc1.txt', content: 'Document one content' });
      await knowledge.add(NS, { type: 'text', key: 'doc2.txt', content: 'Document two content' });
      await knowledge.add(NS, { type: 'text', key: 'doc3.txt', content: 'Document three content' });
      await knowledge.add(NS, { type: 'text', key: 'doc4.txt', content: 'Document four content' });
      await knowledge.add(NS, { type: 'text', key: 'doc5.txt', content: 'Document five content' });

      const results = await knowledge.search(NS, 'document content', { topK: 2 });

      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should filter results by minScore', async () => {
      await knowledge.add(NS, {
        type: 'text',
        key: 'relevant.txt',
        content: 'Very relevant matching content',
      });
      await knowledge.add(NS, {
        type: 'text',
        key: 'irrelevant.txt',
        content: 'Completely different unrelated text',
      });

      // With a high minScore threshold, should only get highly relevant results
      const results = await knowledge.search(NS, 'relevant matching', { minScore: 0.9 });

      // Results should only contain items above the threshold
      for (const result of results) {
        expect(result.score).toBeGreaterThanOrEqual(0.9);
      }
    });

    it('should throw error when no search is configured', async () => {
      const knowledgeWithoutIndex = new Knowledge({
        id: 'no-index',
        storage: new FilesystemStorage({ basePath: testDir }),
      });

      await expect(knowledgeWithoutIndex.search(NS, 'test query')).rejects.toThrow(
        'No search configuration available. Provide bm25 or vector config.',
      );
    });

    it('should return empty array when no results match', async () => {
      // Add some documents
      await knowledge.add(NS, {
        type: 'text',
        key: 'doc.txt',
        content: 'Some content about topic A',
      });

      // Search with very high minScore that won't match
      const results = await knowledge.search(NS, 'completely different topic', { minScore: 0.99 });

      // May return empty or low-score results filtered out
      expect(results.every(r => r.score >= 0.99)).toBe(true);
    });

    it('should include metadata in search results', async () => {
      await knowledge.add(
        NS,
        {
          type: 'text',
          key: 'docs/guide.txt',
          content: 'User guide content here',
        },
        {
          metadata: {
            category: 'documentation',
            version: '1.0',
          },
        },
      );

      const results = await knowledge.search(NS, 'user guide');

      expect(results.length).toBeGreaterThan(0);
      const result = results.find(r => r.key === 'docs/guide.txt');
      expect(result?.metadata?.category).toBe('documentation');
      expect(result?.metadata?.version).toBe('1.0');
    });

    it('should include lineRange in vector search results', async () => {
      const multilineContent = `Line 1: Introduction to the guide
Line 2: This section covers password reset procedures
Line 3: Follow these steps carefully
Line 4: Additional password tips here
Line 5: Conclusion of the guide`;

      await knowledge.add(NS, {
        type: 'text',
        key: 'docs/password-guide.txt',
        content: multilineContent,
      });

      const results = await knowledge.search(NS, 'password');

      expect(results.length).toBeGreaterThan(0);
      const result = results.find(r => r.key === 'docs/password-guide.txt');
      expect(result).toBeDefined();
      // lineRange should indicate where 'password' appears (lines 2 and 4)
      expect(result?.lineRange).toBeDefined();
      expect(result?.lineRange?.start).toBe(2);
      expect(result?.lineRange?.end).toBe(4);
    });
  });

  describe('canSearch', () => {
    it('should return true when index is configured', () => {
      expect(knowledge.canSearch).toBe(true);
    });

    it('should return false when index is not configured', () => {
      const knowledgeWithoutIndex = new Knowledge({
        id: 'no-index',
        storage: new FilesystemStorage({ basePath: testDir }),
      });
      expect(knowledgeWithoutIndex.canSearch).toBe(false);
    });
  });
});

describe('Knowledge with BM25', () => {
  let testDir: string;
  let knowledge: Knowledge;

  beforeEach(async () => {
    testDir = join(tmpdir(), `knowledge-bm25-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });

    knowledge = new Knowledge({
      id: 'test-knowledge',
      storage: new FilesystemStorage({ basePath: testDir }),
      bm25: true, // Enable BM25 with default config
    });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('BM25 search', () => {
    it('should find documents by keyword matching', async () => {
      await knowledge.add(NS, {
        type: 'text',
        key: 'docs/password-reset.txt',
        content: 'To reset your password, go to Settings and click Reset Password button.',
      });
      await knowledge.add(NS, {
        type: 'text',
        key: 'docs/billing.txt',
        content: 'To update your billing information, go to Account Settings.',
      });
      await knowledge.add(NS, {
        type: 'text',
        key: 'docs/account.txt',
        content: 'Your account settings can be managed from the dashboard.',
      });

      const results = await knowledge.search(NS, 'password reset', { mode: 'bm25' });

      expect(results.length).toBeGreaterThan(0);
      // Password reset doc should be first (contains both terms)
      expect(results[0]?.key).toBe('docs/password-reset.txt');
      expect(results[0]?.scoreDetails?.bm25).toBeDefined();
    });

    it('should respect topK limit', async () => {
      await knowledge.add(NS, { type: 'text', key: 'doc1.txt', content: 'Search term appears here' });
      await knowledge.add(NS, { type: 'text', key: 'doc2.txt', content: 'Search term also here' });
      await knowledge.add(NS, { type: 'text', key: 'doc3.txt', content: 'Another search term document' });
      await knowledge.add(NS, { type: 'text', key: 'doc4.txt', content: 'More search term content' });

      const results = await knowledge.search(NS, 'search term', { mode: 'bm25', topK: 2 });

      expect(results.length).toBe(2);
    });

    it('should handle queries with no matches', async () => {
      await knowledge.add(NS, {
        type: 'text',
        key: 'doc.txt',
        content: 'This document talks about apples and oranges.',
      });

      const results = await knowledge.search(NS, 'javascript programming', { mode: 'bm25' });

      expect(results.length).toBe(0);
    });

    it('should rank documents by relevance', async () => {
      await knowledge.add(NS, {
        type: 'text',
        key: 'highly-relevant.txt',
        content: 'Machine learning machine learning machine learning is great',
      });
      await knowledge.add(NS, {
        type: 'text',
        key: 'somewhat-relevant.txt',
        content: 'Machine learning is a topic in computer science',
      });
      await knowledge.add(NS, {
        type: 'text',
        key: 'barely-relevant.txt',
        content: 'Learning about machines can be interesting',
      });

      const results = await knowledge.search(NS, 'machine learning', { mode: 'bm25' });

      expect(results.length).toBeGreaterThanOrEqual(2);
      // Higher term frequency should score higher
      expect(results[0]?.key).toBe('highly-relevant.txt');
    });

    it('should NOT index static artifacts', async () => {
      await knowledge.add(NS, {
        type: 'text',
        key: 'static/policy.txt',
        content: 'This is a static policy document about passwords',
      });
      await knowledge.add(NS, {
        type: 'text',
        key: 'docs/password.txt',
        content: 'Password documentation',
      });

      const results = await knowledge.search(NS, 'password', { mode: 'bm25' });

      // Should only find the non-static document
      expect(results.find(r => r.key === 'static/policy.txt')).toBeUndefined();
      expect(results.find(r => r.key === 'docs/password.txt')).toBeDefined();
    });

    it('should remove documents from BM25 index when deleted', async () => {
      await knowledge.add(NS, {
        type: 'text',
        key: 'to-delete.txt',
        content: 'Unique searchable content here',
      });

      // Verify it's searchable
      let results = await knowledge.search(NS, 'unique searchable', { mode: 'bm25' });
      expect(results.find(r => r.key === 'to-delete.txt')).toBeDefined();

      // Delete
      await knowledge.delete(NS, 'to-delete.txt');

      // Verify it's no longer searchable
      results = await knowledge.search(NS, 'unique searchable', { mode: 'bm25' });
      expect(results.find(r => r.key === 'to-delete.txt')).toBeUndefined();
    });

    it('should include lineRange in search results', async () => {
      const multilineContent = `Line 1: Introduction
Line 2: This document is about password reset
Line 3: Some other content here
Line 4: More password information
Line 5: Conclusion`;

      await knowledge.add(NS, {
        type: 'text',
        key: 'docs/multiline.txt',
        content: multilineContent,
      });

      const results = await knowledge.search(NS, 'password', { mode: 'bm25' });

      expect(results.length).toBe(1);
      expect(results[0]?.lineRange).toBeDefined();
      // 'password' appears on lines 2 and 4
      expect(results[0]?.lineRange?.start).toBe(2);
      expect(results[0]?.lineRange?.end).toBe(4);
    });

    it('should return lineRange spanning all matched lines', async () => {
      const content = `First line
Second line has machine learning
Third line is empty
Fourth line has deep learning
Fifth line has neural networks
Sixth line ends`;

      await knowledge.add(NS, {
        type: 'text',
        key: 'docs/ml.txt',
        content,
      });

      const results = await knowledge.search(NS, 'machine neural', { mode: 'bm25' });

      expect(results.length).toBe(1);
      expect(results[0]?.lineRange).toBeDefined();
      // 'machine' on line 2, 'neural' on line 5
      expect(results[0]?.lineRange?.start).toBe(2);
      expect(results[0]?.lineRange?.end).toBe(5);
    });

    it('should handle single line match in lineRange', async () => {
      await knowledge.add(NS, {
        type: 'text',
        key: 'docs/single.txt',
        content: 'Line 1\nLine 2 with unique keyword\nLine 3',
      });

      const results = await knowledge.search(NS, 'unique keyword', { mode: 'bm25' });

      expect(results.length).toBe(1);
      expect(results[0]?.lineRange).toEqual({ start: 2, end: 2 });
    });
  });

  describe('canBM25Search', () => {
    it('should return true when BM25 is configured', () => {
      expect(knowledge.canBM25Search).toBe(true);
    });

    it('should return false when BM25 is not configured', () => {
      const knowledgeWithoutBM25 = new Knowledge({
        id: 'no-bm25',
        storage: new FilesystemStorage({ basePath: testDir }),
      });
      expect(knowledgeWithoutBM25.canBM25Search).toBe(false);
    });
  });

  describe('BM25 configuration', () => {
    it('should accept custom BM25 parameters', async () => {
      const customKnowledge = new Knowledge({
        id: 'custom-bm25',
        storage: new FilesystemStorage({ basePath: testDir }),
        bm25: {
          bm25: { k1: 2.0, b: 0.5 },
        },
      });

      await customKnowledge.add(NS, {
        type: 'text',
        key: 'doc.txt',
        content: 'Test document content',
      });

      const results = await customKnowledge.search(NS, 'test document', { mode: 'bm25' });
      expect(results.length).toBeGreaterThan(0);
    });

    it('should accept custom tokenization options', async () => {
      const customKnowledge = new Knowledge({
        id: 'custom-tokenize',
        storage: new FilesystemStorage({ basePath: testDir }),
        bm25: {
          tokenize: {
            lowercase: true,
            minLength: 3,
            stopwords: new Set(['the', 'a', 'an']),
          },
        },
      });

      await customKnowledge.add(NS, {
        type: 'text',
        key: 'doc.txt',
        content: 'The quick brown fox jumps over the lazy dog',
      });

      const results = await customKnowledge.search(NS, 'quick fox', { mode: 'bm25' });
      expect(results.length).toBeGreaterThan(0);
    });
  });
});

describe('Knowledge with hybrid search', () => {
  let testDir: string;
  let dbPath: string;
  let vectorStore: LibSQLVector;
  let knowledge: Knowledge;
  const indexPrefix = 'hybrid_index';
  // The actual index name will be indexPrefix_NS
  const indexName = `${indexPrefix}_${NS}`;
  const dimension = 3;

  // Simple mock embedder that returns predictable vectors based on content
  const mockEmbedder = async (text: string): Promise<number[]> => {
    const lowerText = text.toLowerCase();
    // Create embeddings based on keyword presence for predictable similarity
    const hasPassword = lowerText.includes('password') ? 0.9 : 0.1;
    const hasReset = lowerText.includes('reset') ? 0.9 : 0.1;
    const hasBilling = lowerText.includes('billing') ? 0.9 : 0.1;
    return [hasPassword, hasReset, hasBilling];
  };

  beforeEach(async () => {
    testDir = join(tmpdir(), `knowledge-hybrid-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });

    dbPath = join(testDir, 'vectors.db');

    vectorStore = new LibSQLVector({
      connectionUrl: `file:${dbPath}`,
      id: 'hybrid-test',
    });

    // Create index with the namespaced name
    await vectorStore.createIndex({ indexName, dimension });

    knowledge = new Knowledge({
      id: 'test-knowledge',
      storage: new FilesystemStorage({ basePath: testDir }),
      index: {
        vectorStore,
        embedder: mockEmbedder,
        indexNamePrefix: indexPrefix,
      },
      bm25: true,
    });
  });

  afterEach(async () => {
    try {
      await vectorStore.deleteIndex({ indexName });
    } catch {
      // Ignore cleanup errors
    }
    await rm(testDir, { recursive: true, force: true });
  });

  describe('hybrid search', () => {
    it('should combine vector and BM25 scores', async () => {
      await knowledge.add(NS, {
        type: 'text',
        key: 'docs/password-reset.txt',
        content: 'To reset your password, go to Settings and click Reset Password button.',
      });
      await knowledge.add(NS, {
        type: 'text',
        key: 'docs/billing.txt',
        content: 'To update your billing information, go to Account Settings.',
      });

      const results = await knowledge.search(NS, 'password reset', { mode: 'hybrid' });

      expect(results.length).toBeGreaterThan(0);
      // Should have both vector and BM25 scores
      expect(results[0]?.scoreDetails?.vector).toBeDefined();
      expect(results[0]?.scoreDetails?.bm25).toBeDefined();
    });

    it('should use default hybrid mode when both are configured', async () => {
      await knowledge.add(NS, {
        type: 'text',
        key: 'doc.txt',
        content: 'Test document with password information',
      });

      // No mode specified - should default to hybrid
      const results = await knowledge.search(NS, 'password');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.scoreDetails?.vector).toBeDefined();
    });

    it('should allow configuring vector weight', async () => {
      await knowledge.add(NS, {
        type: 'text',
        key: 'doc.txt',
        content: 'Password reset documentation',
      });

      const vectorHeavy = await knowledge.search(NS, 'password reset', {
        mode: 'hybrid',
        hybrid: { vectorWeight: 0.9 },
      });

      const bm25Heavy = await knowledge.search(NS, 'password reset', {
        mode: 'hybrid',
        hybrid: { vectorWeight: 0.1 },
      });

      // Both should return results
      expect(vectorHeavy.length).toBeGreaterThan(0);
      expect(bm25Heavy.length).toBeGreaterThan(0);
    });

    it('should allow explicit vector-only search', async () => {
      await knowledge.add(NS, {
        type: 'text',
        key: 'doc.txt',
        content: 'Password documentation here',
      });

      const results = await knowledge.search(NS, 'password', { mode: 'vector' });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.scoreDetails?.vector).toBeDefined();
      expect(results[0]?.scoreDetails?.bm25).toBeUndefined();
    });

    it('should allow explicit BM25-only search', async () => {
      await knowledge.add(NS, {
        type: 'text',
        key: 'doc.txt',
        content: 'Password documentation here',
      });

      const results = await knowledge.search(NS, 'password documentation', { mode: 'bm25' });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.scoreDetails?.bm25).toBeDefined();
      expect(results[0]?.scoreDetails?.vector).toBeUndefined();
    });

    it('should include lineRange in hybrid search results', async () => {
      const multilineContent = `Line 1: Introduction
Line 2: Password reset instructions
Line 3: Some intermediate content
Line 4: More password details here
Line 5: Conclusion`;

      await knowledge.add(NS, {
        type: 'text',
        key: 'docs/hybrid-test.txt',
        content: multilineContent,
      });

      const results = await knowledge.search(NS, 'password', { mode: 'hybrid' });

      expect(results.length).toBeGreaterThan(0);
      const result = results.find(r => r.key === 'docs/hybrid-test.txt');
      expect(result).toBeDefined();
      expect(result?.lineRange).toBeDefined();
      // 'password' appears on lines 2 and 4
      expect(result?.lineRange?.start).toBe(2);
      expect(result?.lineRange?.end).toBe(4);
      // Should also have both score types
      expect(result?.scoreDetails?.vector).toBeDefined();
      expect(result?.scoreDetails?.bm25).toBeDefined();
    });
  });

  describe('canHybridSearch', () => {
    it('should return true when both index and BM25 are configured', () => {
      expect(knowledge.canHybridSearch).toBe(true);
    });

    it('should return false when only index is configured', async () => {
      const vectorOnlyKnowledge = new Knowledge({
        id: 'vector-only',
        storage: new FilesystemStorage({ basePath: testDir }),
        index: {
          vectorStore,
          embedder: mockEmbedder,
          indexNamePrefix: indexName,
        },
      });
      expect(vectorOnlyKnowledge.canHybridSearch).toBe(false);
    });

    it('should return false when only BM25 is configured', () => {
      const bm25OnlyKnowledge = new Knowledge({
        id: 'bm25-only',
        storage: new FilesystemStorage({ basePath: testDir }),
        bm25: true,
      });
      expect(bm25OnlyKnowledge.canHybridSearch).toBe(false);
    });
  });
});

describe('FilesystemStorage', () => {
  let testDir: string;
  let storage: FilesystemStorage;
  const NS = 'test-ns';

  beforeEach(async () => {
    testDir = join(tmpdir(), `fs-storage-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    storage = new FilesystemStorage({ basePath: testDir });
    // Create the namespace
    await storage.createNamespace({ namespace: NS });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('namespace management', () => {
    it('should create and list namespaces', async () => {
      await storage.createNamespace({ namespace: 'ns1', description: 'First' });
      await storage.createNamespace({ namespace: 'ns2', description: 'Second' });

      const namespaces = await storage.listNamespaces();

      expect(namespaces.length).toBeGreaterThanOrEqual(2);
      expect(namespaces.find(n => n.namespace === 'ns1')?.description).toBe('First');
    });

    it('should check if namespace exists', async () => {
      await storage.createNamespace({ namespace: 'exists' });

      expect(await storage.hasNamespace('exists')).toBe(true);
      expect(await storage.hasNamespace('not-exists')).toBe(false);
    });

    it('should delete namespace', async () => {
      await storage.createNamespace({ namespace: 'to-delete' });
      await storage.add('to-delete', { type: 'text', key: 'file.txt', content: 'Content' });

      await storage.deleteNamespace('to-delete');

      expect(await storage.hasNamespace('to-delete')).toBe(false);
    });
  });

  describe('get', () => {
    it('should retrieve stored artifact content', async () => {
      const artifact: TextArtifact = {
        type: 'text',
        key: 'retrieve.txt',
        content: 'Content to retrieve',
      };

      await storage.add(NS, artifact);
      const content = await storage.get(NS, 'retrieve.txt');

      expect(content).toBe('Content to retrieve');
    });
  });

  describe('delete', () => {
    it('should delete an artifact', async () => {
      const artifact: TextArtifact = {
        type: 'text',
        key: 'delete-me.txt',
        content: 'Content to delete',
      };

      await storage.add(NS, artifact);
      await storage.delete(NS, 'delete-me.txt');

      await expect(storage.get(NS, 'delete-me.txt')).rejects.toThrow();
    });
  });

  describe('list', () => {
    it('should list all artifact keys recursively', async () => {
      await storage.add(NS, { type: 'text', key: 'file1.txt', content: 'Content 1' });
      await storage.add(NS, { type: 'text', key: 'nested/file2.txt', content: 'Content 2' });

      const keys = await storage.list(NS);

      expect(keys).toContain('file1.txt');
      expect(keys).toContain('nested/file2.txt');
    });

    it('should list artifacts with prefix', async () => {
      await storage.add(NS, { type: 'text', key: 'static/a.txt', content: 'A' });
      await storage.add(NS, { type: 'text', key: 'static/b.txt', content: 'B' });
      await storage.add(NS, { type: 'text', key: 'docs/c.txt', content: 'C' });

      const staticKeys = await storage.list(NS, 'static');

      expect(staticKeys).toHaveLength(2);
      expect(staticKeys).toContain('static/a.txt');
      expect(staticKeys).toContain('static/b.txt');
    });
  });

  describe('clear', () => {
    it('should clear all artifacts', async () => {
      await storage.add(NS, { type: 'text', key: 'file1.txt', content: 'Content 1' });
      await storage.add(NS, { type: 'text', key: 'nested/file2.txt', content: 'Content 2' });

      await storage.clear(NS);

      const keys = await storage.list(NS);
      expect(keys).toHaveLength(0);
    });
  });
});
