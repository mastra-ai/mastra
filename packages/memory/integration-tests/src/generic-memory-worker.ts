import { parentPort, workerData } from 'worker_threads';
import { Memory } from '@mastra/memory';
import { mockEmbedder } from './mock-embedder.js';
import { LibSQLConfig } from '@mastra/libsql';
import { PostgresConfig } from '@mastra/pg';
import { UpstashConfig } from '@mastra/upstash';
import { MessageType } from '@mastra/core';
import { WorkerTestConfig } from './reusable-tests.js';

if (!parentPort) {
  throw new Error('This script must be run as a worker thread.');
}

interface MessageToProcess {
  originalMessage: MessageType;
}

interface WorkerData {
  messages: MessageToProcess[];
  storageType: WorkerTestConfig['storageTypeForWorker'];
  storageConfig: WorkerTestConfig['storageConfigForWorker'];
  memoryOptions?: WorkerTestConfig['memoryOptionsForWorker'];
}

const { messages, storageType, storageConfig, memoryOptions } = workerData as WorkerData;

async function initializeAndRun() {
  let store;
  let vector;
  try {
    switch (storageType) {
      case 'libsql':
        const { LibSQLStore, LibSQLVector } = await import('@mastra/libsql');
        store = new LibSQLStore(storageConfig as LibSQLConfig);
        vector = new LibSQLVector({ connectionUrl: (storageConfig as LibSQLConfig).url });
        break;
      case 'upstash':
        const { UpstashStore } = await import('@mastra/upstash');
        const { LibSQLVector: UpstashLibSQLVector } = await import('@mastra/libsql');
        store = new UpstashStore(storageConfig as UpstashConfig);
        vector = new UpstashLibSQLVector({ connectionUrl: 'file:upstash-test-vector.db' });
        break;
      case 'pg':
        const { PostgresStore, PgVector } = await import('@mastra/pg');
        store = new PostgresStore(storageConfig as PostgresConfig);
        vector = new PgVector({ connectionString: (storageConfig as { connectionString: string }).connectionString });
        break;
      default:
        throw new Error(`Unsupported storageType in worker: ${storageType}`);
    }

    const memoryInstance = new Memory({
      storage: store,
      vector,
      embedder: mockEmbedder,
      options: memoryOptions || { threads: { generateTitle: false } },
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
