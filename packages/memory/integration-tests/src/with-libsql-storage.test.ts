import { randomUUID } from 'crypto';
import fs from 'fs';
import { fastembed } from '@mastra/fastembed';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import dotenv from 'dotenv';
import { describe } from 'vitest';
import { getResuableTests, StorageType } from './reusable-tests';

dotenv.config({ path: '.env.test' });

const files = ['libsql-test.db', 'libsql-test.db-shm', 'libsql-test.db-wal'];

describe('Memory with LibSQL Integration', () => {
  for (const file of files) {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  }

  const memoryOptions = {
    lastMessages: 10,
    semanticRecall: {
      topK: 3,
      messageRange: 2,
    },
    generateTitle: false,
  };
  const memory = new Memory({
    storage: new LibSQLStore({
      url: 'file:libsql-test.db',
      id: randomUUID(),
    }),
    vector: new LibSQLVector({
      connectionUrl: 'file:libsql-test.db',
      id: randomUUID(),
    }),
    embedder: fastembed,
    options: memoryOptions,
  });

  getResuableTests(memory, {
    storageTypeForWorker: StorageType.LibSQL,
    storageConfigForWorker: { url: 'file:libsql-test.db', id: randomUUID() },
    memoryOptionsForWorker: memoryOptions,
    vectorConfigForWorker: {
      connectionUrl: 'file:libsql-test.db',
      id: randomUUID(),
    },
  });
});
