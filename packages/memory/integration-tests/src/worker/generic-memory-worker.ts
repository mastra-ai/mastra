import { parentPort, workerData } from 'node:worker_threads';
import type { MastraDBMessage } from '@mastra/core/agent';
import type { SharedMemoryConfig } from '@mastra/core/memory';
import type { LibSQLConfig, LibSQLStore, LibSQLVector, LibSQLVectorConfig } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import type { PgVector, PostgresStore, PostgresStoreConfig } from '@mastra/pg';
import type { UpstashConfig, UpstashStore, UpstashVector } from '@mastra/upstash';
import { mockEmbedder } from './mock-embedder.js';

if (!parentPort) {
  throw new Error('This script must be run as a worker thread.');
}

// This file is being used as a worker, had to just copy the enum and interface from reusable-tests.ts otherwise it ran into compilation errors
enum StorageType {
  LibSQL = 'libsql',
  Postgres = 'pg',
  Upstash = 'upstash',
}
interface WorkerTestConfig {
  storageTypeForWorker: StorageType;
  storageConfigForWorker: LibSQLConfig | PostgresStoreConfig | UpstashConfig;
  vectorConfigForWorker?: LibSQLVectorConfig;
  memoryOptionsForWorker?: SharedMemoryConfig['options'];
}

interface MessageToProcess {
  originalMessage: MastraDBMessage;
}

interface WorkerData {
  messages: MessageToProcess[];
  storageType: WorkerTestConfig['storageTypeForWorker'];
  storageConfig: WorkerTestConfig['storageConfigForWorker'];
  vectorConfig?: WorkerTestConfig['vectorConfigForWorker'];
  memoryOptions?: WorkerTestConfig['memoryOptionsForWorker'];
}

const { messages, storageType, storageConfig, vectorConfig, memoryOptions } = workerData as WorkerData;

async function initializeAndRun() {
  let store: LibSQLStore | UpstashStore | PostgresStore;
  let vector: LibSQLVector | UpstashVector | PgVector;
  let teardown = () => Promise.resolve();
  try {
    switch (storageType) {
      case 'libsql':
        const { LibSQLStore, LibSQLVector } = await import('@mastra/libsql');
        store = new LibSQLStore({ ...(storageConfig as LibSQLConfig), id: 'libsql-storage' });
        vector = new LibSQLVector({ ...(vectorConfig as LibSQLVectorConfig), id: 'libsql-vector' });
        break;
      case 'upstash':
        const { UpstashStore } = await import('@mastra/upstash');
        const { LibSQLVector: UpstashLibSQLVector } = await import('@mastra/libsql');
        store = new UpstashStore({ ...(storageConfig as UpstashConfig), id: 'upstash-storage' });
        vector = new UpstashLibSQLVector({ url: 'file:upstash-test-vector.db', id: 'upstash-vector' });
        break;
      case 'pg':
        const { PostgresStore, PgVector } = await import('@mastra/pg');
        store = new PostgresStore({ ...(storageConfig as PostgresStoreConfig), id: 'pg-storage' });
        vector = new PgVector({
          connectionString: (storageConfig as { connectionString: string }).connectionString,
          id: 'pg-vector',
        });
        teardown = async () => {
          await (store as PostgresStore).close();
          await (vector as PgVector).disconnect();
        };
        break;
      default:
        throw new Error(`Unsupported storageType in worker: ${storageType}`);
    }

    const memoryInstance = new Memory({
      storage: store,
      vector,
      embedder: mockEmbedder,
      options: memoryOptions || { generateTitle: false },
    });

    for (const msgData of messages) {
      await memoryInstance.saveMessages({ messages: [msgData.originalMessage] });
    }
    await teardown();
    parentPort!.postMessage({ success: true });
  } catch (error: any) {
    const serializableError = {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
    await teardown();
    parentPort!.postMessage({ success: false, error: serializableError });
  }
}

initializeAndRun();
