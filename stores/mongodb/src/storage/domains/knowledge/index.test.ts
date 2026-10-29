import { createKnowledgePageStoreTests } from '@internal/storage-test-utils';
import { vi } from 'vitest';

import { KnowledgeMongoDB } from '.';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

createKnowledgePageStoreTests(
  () =>
    new KnowledgeMongoDB({
      uri:
        process.env.MONGODB_URL ||
        process.env.MONGODB_RS_URL ||
        'mongodb://mongodb:mongodb@localhost:27018/?authSource=admin&directConnection=true&serverSelectionTimeoutMS=2000',
      dbName: 'knowledge_contract_test',
    }),
);
