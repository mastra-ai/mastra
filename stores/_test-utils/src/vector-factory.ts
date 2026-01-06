import { describe, beforeAll, afterAll } from 'vitest';
import type { MastraVector } from '@mastra/core/vector';
import { createMetadataFilteringTest } from './domains/vector/metadata-filtering';
import { createAdvancedOperationsTest } from './domains/vector/advanced-operations';

export interface VectorTestConfig {
  vector: MastraVector<any>;
  createIndex: (indexName: string) => Promise<void>;
  deleteIndex: (indexName: string) => Promise<void>;
  waitForIndexing?: (indexName: string) => Promise<void>;
  connect?: () => Promise<void>;
  disconnect?: () => Promise<void>;
}

export function createVectorTestSuite(config: VectorTestConfig) {
  const { connect, disconnect } = config;

  // Get the vector store name, handling cases where vector might be a getter or null initially
  let vectorName = 'VectorStore';
  try {
    const vector = config.vector;
    if (vector && vector.constructor) {
      vectorName = vector.constructor.name;
    }
  } catch (e) {
    // If accessing vector throws (e.g., it's undefined), use default name
  }

  describe(vectorName, () => {
    beforeAll(
      async () => {
        if (connect) {
          const start = Date.now();
          console.log('Connecting to vector store...');
          await connect();
          const end = Date.now();
          console.log(`Vector store connected in ${end - start}ms`);
        }
      },
      5 * 60 * 1000,
    ); // 5 minutes timeout for Docker setup

    afterAll(async () => {
      if (disconnect) {
        await disconnect();
      }
    }, 60 * 1000); // 1 minute timeout for cleanup

    createMetadataFilteringTest(config);
    createAdvancedOperationsTest(config);
  });
}
