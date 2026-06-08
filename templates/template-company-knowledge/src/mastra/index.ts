import { Mastra } from '@mastra/core';
import { MastraEditor } from '@mastra/editor';
import { PinoLogger } from '@mastra/loggers';
import { PostgresStore, PgVector } from '@mastra/pg';
import { knowledgeAgent } from './agents/knowledge';
import { indexKnowledgeWorkflow } from './workflows/index-knowledge';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set. Point it at a Neon (or other Postgres) database with pgvector enabled.');
}

export const storage = new PostgresStore({ id: 'company-knowledge-storage', connectionString });
export const vector = new PgVector({ id: 'company-knowledge-vector', connectionString });

export const mastra = new Mastra({
  agents: { knowledgeAgent },
  workflows: { indexKnowledgeWorkflow },
  storage,
  vectors: { pgVector: vector },
  editor: new MastraEditor({ source: 'code' }),
  logger: new PinoLogger({ name: 'company-knowledge', level: 'info' }),
  bundler: {
    // Resolved dynamically via require.resolve in src/mastra/mcp.ts, so static
    // analysis can't see it. Listing it here makes sure the deploy install
    // includes the Notion MCP server binary.
    dynamicPackages: ['@notionhq/notion-mcp-server'],
  },
});
