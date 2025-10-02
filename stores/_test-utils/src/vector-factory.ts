import { describe, beforeAll, afterAll } from 'vitest';
import type { MastraVector } from '@mastra/core/vector';
import { createMetadataFilteringTest } from './domains/vector/metadata-filtering';

export interface VectorTestConfig {
  vector: MastraVector<any>;
  createIndex: (indexName: string) => Promise<void>;
  deleteIndex: (indexName: string) => Promise<void>;
  waitForIndexing?: () => Promise<void>;
  connect?: () => Promise<void>;
  disconnect?: () => Promise<void>;
}

export function createVectorTestSuite(config: VectorTestConfig) {
  const { vector, connect, disconnect } = config;

  describe(vector.constructor.name, () => {
    beforeAll(async () => {
      if (connect) {
        const start = Date.now();
        console.log('Connecting to vector store...');
        await connect();
        const end = Date.now();
        console.log(`Vector store connected in ${end - start}ms`);
      }
    });

    afterAll(async () => {
      if (disconnect) {
        await disconnect();
      }
    });

    createMetadataFilteringTest(config);
  });
}
