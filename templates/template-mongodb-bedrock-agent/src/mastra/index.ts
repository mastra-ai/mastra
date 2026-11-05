import { Mastra } from '@mastra/core/mastra';
import { MastraEditor } from '@mastra/editor';
import { PinoLogger } from '@mastra/loggers';
import { MongoDBStore, MongoDBVector } from '@mastra/mongodb';
import {
  MastraPlatformExporter,
  MastraStorageExporter,
  Observability,
  SensitiveDataFilter,
} from '@mastra/observability';
import { docsAgent } from './agents/docs-agent.js';
import { MONGODB_DATABASE, MONGODB_URI, VECTOR_STORE_NAME } from './mongo.js';

const logger = new PinoLogger({ name: 'Mastra', level: 'info' });

/**
 * MongoDB Atlas serves triple duty here:
 *   - `storage`        → Mastra system storage (threads, messages) + observability traces
 *   - `vectors`        → Atlas Vector Search for RAG retrieval
 *   - agent `Memory`   → conversation history / recall (see docs-agent.ts)
 * All on ONE cluster.
 *
 * Note: we deliberately do NOT use the default file-based LibSQLStore. AgentCore's
 * runtime container filesystem is read-only, so file storage would fail there.
 * MongoDB (network storage) is both the fix and the point of the demo.
 */
export const mastra = new Mastra({
  agents: { docsAgent },
  storage: new MongoDBStore({
    id: 'mongodb-storage',
    uri: MONGODB_URI,
    dbName: MONGODB_DATABASE,
  }),
  vectors: {
    [VECTOR_STORE_NAME]: new MongoDBVector({
      id: 'mongodb-vector',
      uri: MONGODB_URI,
      dbName: MONGODB_DATABASE,
    }),
  },
  logger,
  // Tracing/scoring. MastraStorageExporter persists spans to Mastra storage (MongoDB);
  // MastraPlatformExporter forwards to Mastra Platform when MASTRA_PLATFORM_ACCESS_TOKEN is set.
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'mastra-docs-agent',
        exporters: [new MastraStorageExporter(), new MastraPlatformExporter()],
        spanOutputProcessors: [new SensitiveDataFilter()],
      },
    },
  }),
  // Editor: agent/prompt/scorer management + instantiation surface for Mastra Studio.
  editor: new MastraEditor({ logger }),
});
