/**
 * Test setup for DuckDB Vector Store tests
 */

import { beforeAll, afterAll, beforeEach, afterEach, expect } from 'vitest';
import * as duckdb from 'duckdb';
import { rimraf } from 'rimraf';
import path from 'path';
import fs from 'fs/promises';

// Test database paths
export const TEST_DB_DIR = path.join(process.cwd(), '.test-dbs');
export const TEST_DB_PATH = path.join(TEST_DB_DIR, 'test.duckdb');

// Test vectors
export const generateRandomVector = (dimension: number): number[] => {
  const vector = new Array(dimension);
  for (let i = 0; i < dimension; i++) {
    vector[i] = Math.random() * 2 - 1; // Random values between -1 and 1
  }
  return vector;
};

export const generateTestVectors = (count: number, dimension: number) => {
  const vectors = [];
  for (let i = 0; i < count; i++) {
    vectors.push({
      id: `vec_${i}`,
      values: generateRandomVector(dimension),
      metadata: {
        index: i,
        category: i % 3 === 0 ? 'A' : i % 3 === 1 ? 'B' : 'C',
        score: Math.random() * 100,
        content: `Test content for vector ${i}`,
        space_id: `space_${i % 5}`,
        tags: [`tag_${i % 10}`, `tag_${i % 7}`],
      },
    });
  }
  return vectors;
};

// Global test setup
beforeAll(async () => {
  // Ensure test directory exists
  await fs.mkdir(TEST_DB_DIR, { recursive: true });
});

// Global test teardown
afterAll(async () => {
  // Clean up test databases
  await rimraf(TEST_DB_DIR);
});

// Per-test setup
beforeEach(async () => {
  // Clean database before each test
  try {
    await fs.unlink(TEST_DB_PATH);
  } catch (error) {
    // File doesn't exist, that's fine
  }
});

// Per-test teardown
afterEach(async () => {
  // Additional cleanup if needed
});

// Test utilities
export const createTestDatabase = async (): Promise<duckdb.Database> => {
  const db = new duckdb.Database(':memory:');
  const conn = db.connect();

  // Install VSS extension
  await new Promise<void>((resolve, reject) => {
    conn.exec('INSTALL vss', err => {
      if (err) reject(err);
      else resolve();
    });
  });

  await new Promise<void>((resolve, reject) => {
    conn.exec('LOAD vss', err => {
      if (err) reject(err);
      else resolve();
    });
  });

  conn.close();
  return db;
};

// Mock data generators
export const mockMetadata = {
  simple: {
    title: 'Test Document',
    author: 'Test Author',
    created: new Date().toISOString(),
  },
  complex: {
    title: 'Complex Document',
    author: 'Multiple Authors',
    tags: ['ai', 'ml', 'nlp'],
    stats: {
      views: 1000,
      likes: 50,
      shares: 10,
    },
    metadata: {
      version: '1.0.0',
      language: 'en',
      category: 'technology',
    },
  },
  deposium: {
    space_id: 'deposium_space_1',
    document_id: 'doc_123',
    chunk_index: 0,
    content_type: 'markdown',
    source: 's3://deposium/data/docs.parquet',
    embedding_model: 'ollama:llama2',
    dimension: 512,
  },
};

// Performance testing utilities
export const measureTime = async <T>(fn: () => Promise<T>, label?: string): Promise<{ result: T; time: number }> => {
  const start = performance.now();
  const result = await fn();
  const time = performance.now() - start;

  if (label) {
    console.log(`[${label}] Time: ${time.toFixed(2)}ms`);
  }

  return { result, time };
};

export const measureMemory = (): { used: number; rss: number } => {
  if (global.gc) {
    global.gc();
  }
  const mem = process.memoryUsage();
  return {
    used: mem.heapUsed / 1024 / 1024, // MB
    rss: mem.rss / 1024 / 1024, // MB
  };
};

// Wait utility for async tests
export const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Assertion helpers
export const expectVectorSimilarity = (actual: number[], expected: number[], tolerance = 0.001) => {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < actual.length; i++) {
    expect(Math.abs(actual[i]! - expected[i]!)).toBeLessThan(tolerance);
  }
};

export const expectScoreOrder = (results: any[], descending = true) => {
  for (let i = 1; i < results.length; i++) {
    if (descending) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    } else {
      expect(results[i - 1].score).toBeLessThanOrEqual(results[i].score);
    }
  }
};
