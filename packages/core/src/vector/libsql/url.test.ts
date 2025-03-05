import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { LibSQLVector } from './index';

describe('LibSQLVector URL rewriting', () => {
  let tmpDir: string;
  let originalCwd: string;
  let parentDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), 'mastra-test-libsql-vector-url');
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
    mkdirSync(tmpDir);
    originalCwd = process.cwd();
    process.chdir(tmpDir);
    parentDir = join(tmpDir, '..');
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should create db file in project root when cwd is project root', async () => {
    const vector = new LibSQLVector({
      connectionUrl: 'file:test.db',
    });

    // Create an index to ensure the database file is created
    await vector.createIndex({
      indexName: 'test_index',
      dimension: 3,
    });

    // Check that the database file is created in the project root
    expect(existsSync(join(tmpDir, 'test.db'))).toBe(true);
    expect(existsSync(join(tmpDir, '.mastra', 'test.db'))).toBe(false);
    expect(existsSync(join(tmpDir, '.mastra', 'output', 'test.db'))).toBe(false);
    expect(existsSync(join(parentDir, 'test.db'))).toBe(false);
  });

  it('should create db file in .mastra directory when cwd is .mastra', async () => {
    const mastraDir = join(tmpDir, '.mastra');
    mkdirSync(mastraDir);
    process.chdir(mastraDir);

    const vector = new LibSQLVector({
      connectionUrl: 'file:test.db',
    });

    // Create an index to ensure the database file is created
    await vector.createIndex({
      indexName: 'test_index',
      dimension: 3,
    });

    // Check that the database file is created in the .mastra directory
    expect(existsSync(join(tmpDir, 'test.db'))).toBe(false);
    expect(existsSync(join(mastraDir, 'test.db'))).toBe(true);
    expect(existsSync(join(mastraDir, 'output', 'test.db'))).toBe(false);
    expect(existsSync(join(parentDir, 'test.db'))).toBe(false);
  });

  it('should create db file in project root when cwd is .mastra/output', async () => {
    const outputDir = join(tmpDir, '.mastra', 'output');
    mkdirSync(outputDir, { recursive: true });
    process.chdir(outputDir);

    const vector = new LibSQLVector({
      connectionUrl: 'file:test.db',
    });

    // Create an index to ensure the database file is created
    await vector.createIndex({
      indexName: 'test_index',
      dimension: 3,
    });

    // Check that the database file is created in the project root
    expect(existsSync(join(tmpDir, 'test.db'))).toBe(true);
    expect(existsSync(join(tmpDir, '.mastra', 'test.db'))).toBe(false);
    expect(existsSync(join(outputDir, 'test.db'))).toBe(false);
    expect(existsSync(join(parentDir, 'test.db'))).toBe(false);
  });

  it('should maintain a single database file and data consistency when switching working directories', async () => {
    // Create a test vector
    const testVector = [1, 2, 3];
    const testMetadata = { key: 'value' };

    // First, create the vector store in project root
    const vector1 = new LibSQLVector({
      connectionUrl: 'file:test.db',
    });

    // Create an index and insert a vector
    await vector1.createIndex({
      indexName: 'test_index',
      dimension: 3,
    });

    await vector1.upsert({
      indexName: 'test_index',
      vectors: [testVector],
      metadata: [testMetadata],
      ids: ['1'],
    });

    // Change to .mastra/output directory
    const outputDir = join(tmpDir, '.mastra', 'output');
    mkdirSync(outputDir, { recursive: true });
    process.chdir(outputDir);

    // Create another instance and verify data consistency
    const vector2 = new LibSQLVector({
      connectionUrl: 'file:test.db',
    });

    // Query the vector store
    const results = await vector2.query({
      indexName: 'test_index',
      queryVector: testVector,
      topK: 1,
    });

    // Verify that we can retrieve the same data
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('1');
    expect(results[0].metadata).toEqual(testMetadata);

    // Verify database file location
    expect(existsSync(join(tmpDir, 'test.db'))).toBe(true);
    expect(existsSync(join(tmpDir, '.mastra', 'test.db'))).toBe(false);
    expect(existsSync(join(outputDir, 'test.db'))).toBe(false);
    expect(existsSync(join(parentDir, 'test.db'))).toBe(false);
  });
}); 