// @ts-nocheck

import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { createWorkflow } from '@mastra/core/workflows';
import { createScorer } from '@mastra/core/evals';
import { MCPServer } from '@mastra/mcp';
import { z } from 'zod';

import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { PostgresStore } from '@mastra/pg';
import { D1Store } from '@mastra/cloudflare-d1';
import { MongoDBStore } from '@mastra/mongodb';
import { DynamoDBStore } from '@mastra/dynamodb';

import { PgVector } from '@mastra/pg';
import { ChromaVector } from '@mastra/chroma';
import { PineconeVector } from '@mastra/pinecone';
import { QdrantVector } from '@mastra/qdrant';
import { LanceVector } from '@mastra/lance';

/* FIXME(mastra): Add a unique `id` parameter. See: https://mastra.ai/guides/v1/migrations/upgrade-to-v1/mastra#required-id-parameter-for-all-mastra-primitives */
const libsqlStorage = new LibSQLStore({
  url: ':memory:',
});

/* FIXME(mastra): Add a unique `id` parameter. See: https://mastra.ai/guides/v1/migrations/upgrade-to-v1/mastra#required-id-parameter-for-all-mastra-primitives */
const libsqlVector = new LibSQLVector({
  connectionUrl: "file:../../mastra.db",
});

/* FIXME(mastra): Add a unique `id` parameter. See: https://mastra.ai/guides/v1/migrations/upgrade-to-v1/mastra#required-id-parameter-for-all-mastra-primitives */
const postgresStorage = new PostgresStore({
  connectionString: process.env.DATABASE_URL!,
});

/* FIXME(mastra): Add a unique `id` parameter. See: https://mastra.ai/guides/v1/migrations/upgrade-to-v1/mastra#required-id-parameter-for-all-mastra-primitives */
const d1Storage = new D1Store({
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
  apiToken: process.env.CLOUDFLARE_API_TOKEN!,
  databaseId: process.env.D1_DATABASE_ID!,
});

/* FIXME(mastra): Add a unique `id` parameter. See: https://mastra.ai/guides/v1/migrations/upgrade-to-v1/mastra#required-id-parameter-for-all-mastra-primitives */
const mongodbStorage = new MongoDBStore({
  url: process.env.MONGODB_URI!,
  dbName: 'mastra',
});

/* FIXME(mastra): Add a unique `id` parameter. See: https://mastra.ai/guides/v1/migrations/upgrade-to-v1/mastra#required-id-parameter-for-all-mastra-primitives */
const dynamodbStorage = new DynamoDBStore({
  name: 'DynamoDBStore',
  config: {
    region: 'us-east-1',
    tableName: 'mastra-table',
  },
});

/* FIXME(mastra): Add a unique `id` parameter. See: https://mastra.ai/guides/v1/migrations/upgrade-to-v1/mastra#required-id-parameter-for-all-mastra-primitives */
const pgVector = new PgVector({
  connectionString: process.env.DATABASE_URL!,
});

/* FIXME(mastra): Add a unique `id` parameter. See: https://mastra.ai/guides/v1/migrations/upgrade-to-v1/mastra#required-id-parameter-for-all-mastra-primitives */
const chromaVector = new ChromaVector({
  url: 'http://localhost:8000',
});

/* FIXME(mastra): Add a unique `id` parameter. See: https://mastra.ai/guides/v1/migrations/upgrade-to-v1/mastra#required-id-parameter-for-all-mastra-primitives */
const pineconeVector = new PineconeVector({
  apiKey: process.env.PINECONE_API_KEY!,
});

/* FIXME(mastra): Add a unique `id` parameter. See: https://mastra.ai/guides/v1/migrations/upgrade-to-v1/mastra#required-id-parameter-for-all-mastra-primitives */
const qdrantVector = new QdrantVector({
  url: process.env.QDRANT_URL!,
});

/* FIXME(mastra): Add a unique `id` parameter. See: https://mastra.ai/guides/v1/migrations/upgrade-to-v1/mastra#required-id-parameter-for-all-mastra-primitives */
const lanceVector = new LanceVector({
  uri: './lancedb',
});

/* FIXME(mastra): Add a unique `id` parameter. See: https://mastra.ai/guides/v1/migrations/upgrade-to-v1/mastra#required-id-parameter-for-all-mastra-primitives */
const agent = new Agent({
  name: 'Support Agent',
  instructions: 'Help users',
  model: 'openai/gpt-4',
});

/* FIXME(mastra): Add a unique `id` parameter. See: https://mastra.ai/guides/v1/migrations/upgrade-to-v1/mastra#required-id-parameter-for-all-mastra-primitives */
export const agent2 = new Agent({
  name: 'Support Agent',
  instructions: 'Help users',
  model: 'openai/gpt-4',
});

/* FIXME(mastra): Add a unique `id` parameter. See: https://mastra.ai/guides/v1/migrations/upgrade-to-v1/mastra#required-id-parameter-for-all-mastra-primitives */
const workflow = createWorkflow({
  execute: async ({ step }) => {
    return await step.run('process', async () => {
      return { done: true };
    });
  },
});

/* FIXME(mastra): Add a unique `id` parameter. See: https://mastra.ai/guides/v1/migrations/upgrade-to-v1/mastra#required-id-parameter-for-all-mastra-primitives */
const tool = createTool({
  description: 'Get weather',
  inputSchema: z.object({
    city: z.string(),
  }),
  execute: async ({ context }) => {
    return { temp: 72 };
  },
});

/* FIXME(mastra): Add a unique `id` parameter. See: https://mastra.ai/guides/v1/migrations/upgrade-to-v1/mastra#required-id-parameter-for-all-mastra-primitives */
const scorer = createScorer({
  name: 'Quality Scorer',
  description: 'Score quality',
  executor: async ({ input }) => {
    return { score: 0.95 };
  },
});

/* FIXME(mastra): Add a unique `id` parameter. See: https://mastra.ai/guides/v1/migrations/upgrade-to-v1/mastra#required-id-parameter-for-all-mastra-primitives */
const mcpServer = new MCPServer({
  name: 'Weather MCP Server',
  version: '1.0.0',
  description: 'Provides weather tools',
  tools: {
    weather: tool,
  },
});

function getAgent() {
  /* FIXME(mastra): Add a unique `id` parameter. See: https://mastra.ai/guides/v1/migrations/upgrade-to-v1/mastra#required-id-parameter-for-all-mastra-primitives */
  return new Agent({
    name: 'Function Agent',
    instructions: 'Help users',
    model: 'openai/gpt-4',
  });
}

/* FIXME(mastra): Add a unique `id` parameter. See: https://mastra.ai/guides/v1/migrations/upgrade-to-v1/mastra#required-id-parameter-for-all-mastra-primitives */
export default new Agent({
  name: 'Default Agent',
  instructions: 'Default agent',
  model: 'openai/gpt-4',
});

/* FIXME(mastra): Add a unique `id` parameter. See: https://mastra.ai/guides/v1/migrations/upgrade-to-v1/mastra#required-id-parameter-for-all-mastra-primitives */
export default createTool({
  description: 'Default tool',
  inputSchema: z.object({}),
  execute: async () => ({}),
});
