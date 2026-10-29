import { createKnowledgePageStoreTests } from '@internal/storage-test-utils';
import { vi } from 'vitest';

import { KnowledgeMongoDB } from '.';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

createKnowledgePageStoreTests(
  () =>
    new KnowledgeMongoDB({
      uri: process.env.MONGODB_URL || 'mongodb://localhost:27055/?directConnection=true',
      dbName: 'knowledge_contract_test',
    }),
);
