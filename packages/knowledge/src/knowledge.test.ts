import { mkdir, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { TextArtifact, FileArtifact, ImageArtifact } from '@mastra/core/knowledge';
import { LibSQLVector } from '@mastra/libsql';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { Knowledge, STATIC_PREFIX } from './knowledge';
import { FilesystemStorage } from './storage';

describe('Knowledge', () => {
  let testDir: string;
  let knowledge: Knowledge;

  beforeEach(async () => {
    testDir = join(tmpdir(), `knowledge-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    knowledge = new Knowledge({
      storage: new FilesystemStorage({ namespace: testDir }),
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

      await knowledge.add(artifact);

      const content = await readFile(join(testDir, 'hello.txt'), 'utf8');
      expect(content).toBe('Hello, World!');
    });

    it('should add a file artifact with string content', async () => {
      const artifact: FileArtifact = {
        type: 'file',
        key: 'data.json',
        content: JSON.stringify({ foo: 'bar' }),
      };

      await knowledge.add(artifact);

      const content = await readFile(join(testDir, 'data.json'), 'utf8');
      expect(JSON.parse(content)).toEqual({ foo: 'bar' });
    });

    it('should add a file artifact with buffer content', async () => {
      const artifact: FileArtifact = {
        type: 'file',
        key: 'binary.bin',
        content: Buffer.from([0x00, 0x01, 0x02, 0x03]),
      };

      await knowledge.add(artifact);

      const content = await readFile(join(testDir, 'binary.bin'));
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

      await knowledge.add(artifact);

      const content = await readFile(join(testDir, 'image.png'));
      expect(content).toEqual(pngBuffer);
    });

    it('should create nested directories for artifact keys', async () => {
      const artifact: TextArtifact = {
        type: 'text',
        key: 'nested/path/to/file.txt',
        content: 'Nested content',
      };

      await knowledge.add(artifact);

      const content = await readFile(join(testDir, 'nested/path/to/file.txt'), 'utf8');
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

      await knowledge.add(artifact1);
      await knowledge.add(artifact2);

      const content = await readFile(join(testDir, 'overwrite.txt'), 'utf8');
      expect(content).toBe('Updated content');
    });
  });

  describe('getStatic', () => {
    it('should return artifacts from static/ prefix', async () => {
      // Add static artifacts
      await knowledge.add({
        type: 'text',
        key: `${STATIC_PREFIX}/policy.txt`,
        content: 'Company policy here',
      });
      await knowledge.add({
        type: 'text',
        key: `${STATIC_PREFIX}/rules.txt`,
        content: 'Business rules here',
      });
      // Add non-static artifact
      await knowledge.add({
        type: 'text',
        key: 'docs/manual.txt',
        content: 'User manual',
      });

      const staticArtifacts = await knowledge.getStatic();

      expect(staticArtifacts).toHaveLength(2);
      expect(staticArtifacts.map(a => a.key)).toContain(`${STATIC_PREFIX}/policy.txt`);
      expect(staticArtifacts.map(a => a.key)).toContain(`${STATIC_PREFIX}/rules.txt`);
      expect(staticArtifacts.find(a => a.key === `${STATIC_PREFIX}/policy.txt`)?.content).toBe('Company policy here');
    });

    it('should return empty array when no static artifacts exist', async () => {
      await knowledge.add({
        type: 'text',
        key: 'docs/manual.txt',
        content: 'User manual',
      });

      const staticArtifacts = await knowledge.getStatic();

      expect(staticArtifacts).toHaveLength(0);
    });
  });

  describe('list with prefix', () => {
    it('should list artifacts with given prefix', async () => {
      await knowledge.add({ type: 'text', key: 'docs/a.txt', content: 'A' });
      await knowledge.add({ type: 'text', key: 'docs/b.txt', content: 'B' });
      await knowledge.add({ type: 'text', key: 'other/c.txt', content: 'C' });

      const docsKeys = await knowledge.list('docs');

      expect(docsKeys).toHaveLength(2);
      expect(docsKeys).toContain('docs/a.txt');
      expect(docsKeys).toContain('docs/b.txt');
    });

    it('should list all artifacts when no prefix given', async () => {
      await knowledge.add({ type: 'text', key: 'docs/a.txt', content: 'A' });
      await knowledge.add({ type: 'text', key: 'other/b.txt', content: 'B' });

      const allKeys = await knowledge.list();

      expect(allKeys).toHaveLength(2);
    });
  });
});

describe('Knowledge with indexing', () => {
  let testDir: string;
  let dbPath: string;
  let vectorStore: LibSQLVector;
  let knowledge: Knowledge;
  const indexName = 'knowledge_index';
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

    await vectorStore.createIndex({ indexName, dimension });

    knowledge = new Knowledge({
      storage: new FilesystemStorage({ namespace: testDir }),
      index: {
        vectorStore,
        embedder: mockEmbedder,
        indexName,
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

      await knowledge.add(artifact);

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

      await knowledge.add(artifact);

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

      await knowledge.add(artifact, { skipIndex: true });

      // File should exist
      const content = await readFile(join(testDir, 'not-indexed.txt'), 'utf8');
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

      await knowledge.add(artifact);

      // Verify it exists
      const queryVector = await mockEmbedder(artifact.content);
      let results = await vectorStore.query({ indexName, queryVector, topK: 1 });
      expect(results.find(r => r.id === 'to-delete.txt')).toBeDefined();

      // Delete
      await knowledge.delete('to-delete.txt');

      // Verify removed from storage
      await expect(knowledge.get('to-delete.txt')).rejects.toThrow();

      // Verify removed from index
      results = await vectorStore.query({ indexName, queryVector, topK: 10 });
      expect(results.find(r => r.id === 'to-delete.txt')).toBeUndefined();
    });
  });

  describe('search', () => {
    it('should search for indexed artifacts by semantic similarity', async () => {
      // Add some documents - our mock embedder gives high scores to matching keywords
      await knowledge.add({
        type: 'text',
        key: 'docs/password-reset.txt',
        content: 'To reset your password, go to Settings and click Reset Password.',
      });
      await knowledge.add({
        type: 'text',
        key: 'docs/billing.txt',
        content: 'To update your billing information, go to Account Settings.',
      });

      // Search for password-related content
      const results = await knowledge.search('password reset');

      expect(results.length).toBeGreaterThan(0);
      // The password-reset doc should be found (it contains "password" and "reset")
      const passwordDoc = results.find(r => r.key === 'docs/password-reset.txt');
      expect(passwordDoc).toBeDefined();
      expect(passwordDoc?.content).toContain('reset your password');
      expect(passwordDoc?.score).toBeGreaterThan(0);
    });

    it('should respect topK limit', async () => {
      // Add multiple documents
      await knowledge.add({ type: 'text', key: 'doc1.txt', content: 'Document one content' });
      await knowledge.add({ type: 'text', key: 'doc2.txt', content: 'Document two content' });
      await knowledge.add({ type: 'text', key: 'doc3.txt', content: 'Document three content' });
      await knowledge.add({ type: 'text', key: 'doc4.txt', content: 'Document four content' });
      await knowledge.add({ type: 'text', key: 'doc5.txt', content: 'Document five content' });

      const results = await knowledge.search('document content', { topK: 2 });

      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should filter results by minScore', async () => {
      await knowledge.add({
        type: 'text',
        key: 'relevant.txt',
        content: 'Very relevant matching content',
      });
      await knowledge.add({
        type: 'text',
        key: 'irrelevant.txt',
        content: 'Completely different unrelated text',
      });

      // With a high minScore threshold, should only get highly relevant results
      const results = await knowledge.search('relevant matching', { minScore: 0.9 });

      // Results should only contain items above the threshold
      for (const result of results) {
        expect(result.score).toBeGreaterThanOrEqual(0.9);
      }
    });

    it('should throw error when index is not configured', async () => {
      const knowledgeWithoutIndex = new Knowledge({
        storage: new FilesystemStorage({ namespace: testDir }),
      });

      await expect(knowledgeWithoutIndex.search('test query')).rejects.toThrow(
        'Knowledge search requires index configuration',
      );
    });

    it('should return empty array when no results match', async () => {
      // Add some documents
      await knowledge.add({
        type: 'text',
        key: 'doc.txt',
        content: 'Some content about topic A',
      });

      // Search with very high minScore that won't match
      const results = await knowledge.search('completely different topic', { minScore: 0.99 });

      // May return empty or low-score results filtered out
      expect(results.every(r => r.score >= 0.99)).toBe(true);
    });

    it('should include metadata in search results', async () => {
      await knowledge.add(
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

      const results = await knowledge.search('user guide');

      expect(results.length).toBeGreaterThan(0);
      const result = results.find(r => r.key === 'docs/guide.txt');
      expect(result?.metadata?.category).toBe('documentation');
      expect(result?.metadata?.version).toBe('1.0');
    });
  });

  describe('canSearch', () => {
    it('should return true when index is configured', () => {
      expect(knowledge.canSearch).toBe(true);
    });

    it('should return false when index is not configured', () => {
      const knowledgeWithoutIndex = new Knowledge({
        storage: new FilesystemStorage({ namespace: testDir }),
      });
      expect(knowledgeWithoutIndex.canSearch).toBe(false);
    });
  });
});

describe('FilesystemStorage', () => {
  let testDir: string;
  let storage: FilesystemStorage;

  beforeEach(async () => {
    testDir = join(tmpdir(), `fs-storage-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    storage = new FilesystemStorage({ namespace: testDir });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('get', () => {
    it('should retrieve stored artifact content', async () => {
      const artifact: TextArtifact = {
        type: 'text',
        key: 'retrieve.txt',
        content: 'Content to retrieve',
      };

      await storage.add(artifact);
      const content = await storage.get('retrieve.txt');

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

      await storage.add(artifact);
      await storage.delete('delete-me.txt');

      await expect(storage.get('delete-me.txt')).rejects.toThrow();
    });
  });

  describe('list', () => {
    it('should list all artifact keys recursively', async () => {
      await storage.add({ type: 'text', key: 'file1.txt', content: 'Content 1' });
      await storage.add({ type: 'text', key: 'nested/file2.txt', content: 'Content 2' });

      const keys = await storage.list();

      expect(keys).toContain('file1.txt');
      expect(keys).toContain('nested/file2.txt');
    });

    it('should list artifacts with prefix', async () => {
      await storage.add({ type: 'text', key: 'static/a.txt', content: 'A' });
      await storage.add({ type: 'text', key: 'static/b.txt', content: 'B' });
      await storage.add({ type: 'text', key: 'docs/c.txt', content: 'C' });

      const staticKeys = await storage.list('static');

      expect(staticKeys).toHaveLength(2);
      expect(staticKeys).toContain('static/a.txt');
      expect(staticKeys).toContain('static/b.txt');
    });
  });

  describe('clear', () => {
    it('should clear all artifacts', async () => {
      await storage.add({ type: 'text', key: 'file1.txt', content: 'Content 1' });
      await storage.add({ type: 'text', key: 'nested/file2.txt', content: 'Content 2' });

      await storage.clear();

      const keys = await storage.list();
      expect(keys).toHaveLength(0);
    });
  });
});
