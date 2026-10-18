import type { RetentionConfig } from '@mastra/core/storage';
import type { LibSQLStore } from '@mastra/libsql';

export const kycRetentionConfig = {
  observability: { spans: { maxAge: '14d', batchSize: 200 } },
  experiments: { experiments: { maxAge: '90d', batchSize: 200 } },
} satisfies RetentionConfig;

export const runBoundedRetentionPrune = (storage: LibSQLStore) => storage.prune({ maxBatches: 1, maxRows: 200 });
