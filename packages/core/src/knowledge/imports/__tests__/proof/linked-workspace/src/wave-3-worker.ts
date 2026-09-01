import { Knowledge } from '@mastra/core/knowledge';
import { LibSQLStore } from '@mastra/libsql';
import { PostgresStore } from '@mastra/pg';

type WorkerConfig = {
  adapter: 'libsql' | 'pg';
  dbPath: string;
  schemaName: string;
  nodeId: string;
  principalScopeId: string;
};

const config = JSON.parse(process.argv[2]!) as WorkerConfig;
const storage =
  config.adapter === 'pg'
    ? new PostgresStore({
        id: 'wave-3-proof-worker',
        host: process.env.POSTGRES_HOST || 'localhost',
        port: Number(process.env.POSTGRES_PORT) || 5434,
        database: process.env.POSTGRES_DB || 'postgres',
        user: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD || 'postgres',
        schemaName: config.schemaName,
      })
    : new LibSQLStore({ id: 'wave-3-proof-worker', url: `file:${config.dbPath}` });
const knowledge = new Knowledge({ id: 'wave-3-proof-worker', storage });

process.on('message', async message => {
  if (message !== 'read') return;
  try {
    const node = await knowledge.getNode({ id: config.nodeId, scopeIds: [config.principalScopeId] });
    process.send?.({ type: 'result', visible: node !== null });
  } catch (error) {
    process.send?.({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
});

process.send?.({ type: 'ready' });
