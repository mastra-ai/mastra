'use strict';
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, 'default', { enumerable: true, value: v });
      }
    : function (o, v) {
        o['default'] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  (function () {
    var ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          var ar = [];
          for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        };
      return ownKeys(o);
    };
    return function (mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== 'default') __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();
Object.defineProperty(exports, '__esModule', { value: true });
const worker_threads_1 = require('worker_threads');
const memory_1 = require('@mastra/memory');
const mock_embedder_js_1 = require('./mock-embedder.js');
if (!worker_threads_1.parentPort) {
  throw new Error('This script must be run as a worker thread.');
}
const { messages, storageType, storageConfig, memoryOptions } = worker_threads_1.workerData;
async function initializeAndRun() {
  let store;
  let vector;
  try {
    switch (storageType) {
      case 'libsql':
        const { LibSQLStore, LibSQLVector } = await Promise.resolve().then(() =>
          __importStar(require('@mastra/libsql')),
        );
        store = new LibSQLStore(storageConfig);
        vector = new LibSQLVector({ connectionUrl: storageConfig.url });
        break;
      case 'upstash':
        const { UpstashStore } = await Promise.resolve().then(() => __importStar(require('@mastra/upstash')));
        const { LibSQLVector: UpstashLibSQLVector } = await Promise.resolve().then(() =>
          __importStar(require('@mastra/libsql')),
        );
        store = new UpstashStore(storageConfig);
        vector = new UpstashLibSQLVector({ connectionUrl: 'file:upstash-test-vector.db' });
        break;
      case 'pg':
        const { PostgresStore, PgVector } = await Promise.resolve().then(() => __importStar(require('@mastra/pg')));
        store = new PostgresStore(storageConfig);
        vector = new PgVector({ connectionString: storageConfig.connectionString });
        break;
      default:
        throw new Error(`Unsupported storageType in worker: ${storageType}`);
    }
    const memoryInstance = new memory_1.Memory({
      storage: store,
      vector,
      embedder: mock_embedder_js_1.mockEmbedder,
      options: memoryOptions || { threads: { generateTitle: false } },
    });
    for (const msgData of messages) {
      await memoryInstance.saveMessages({ messages: [msgData.originalMessage] });
    }
    worker_threads_1.parentPort.postMessage({ success: true });
  } catch (error) {
    const serializableError = {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
    worker_threads_1.parentPort.postMessage({ success: false, error: serializableError });
  }
}
initializeAndRun();
