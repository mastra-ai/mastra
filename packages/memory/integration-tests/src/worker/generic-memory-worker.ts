import { parentPort, workerData } from 'worker_threads';
import type { MastraDBMessage, SharedMemoryConfig } from '@mastra/core/memory';
import type { LibSQLConfig, LibSQLVectorConfig } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import type { PostgresStoreConfig } from '@mastra/pg';
import type { UpstashConfig } from '@mastra/upstash';
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
  let store;
  let vector;
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
        vector = new UpstashLibSQLVector({ connectionUrl: 'file:upstash-test-vector.db', id: 'upstash-vector' });
        break;
      case 'pg':
        const { PostgresStore, PgVector } = await import('@mastra/pg');
        store = new PostgresStore({ ...(storageConfig as PostgresStoreConfig), id: 'pg-storage' });
        vector = new PgVector({
          connectionString: (storageConfig as { connectionString: string }).connectionString,
          id: 'pg-vector',
        });
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
    parentPort!.postMessage({ success: true });
  } catch (error: any) {
    const serializableError = {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
    parentPort!.postMessage({ success: false, error: serializableError });
  }
}

initializeAndRun();
