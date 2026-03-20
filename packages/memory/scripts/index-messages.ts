#!/usr/bin/env npx tsx
/**
 * Index existing thread messages into the vector store for semantic search.
 *
 * This script backfills the vector index so that `recall` mode="search" can
 * find messages from threads that were created before search was enabled.
 *
 * Supports separate storage and vector databases (e.g., MastraCode uses
 * a LibSQL file for messages and a separate LibSQL file for vectors).
 *
 * Usage:
 *   npx tsx packages/memory/scripts/index-messages.ts \
 *     --resource-id <resourceId> \
 *     --storage-url <storage-db-url> \
 *     [--vector-url <vector-db-url>] \
 *     [--pg-url <postgres-url>] \
 *     [--batch-size <number>]
 *
 * When --vector-url is omitted, vectors are written to the same DB as storage.
 *
 * Example — MastraCode (separate LibSQL files):
 *   npx tsx packages/memory/scripts/index-messages.ts \
 *     --resource-id user-123 \
 *     --storage-url "file:$HOME/Library/Application Support/mastracode/mastra.db" \
 *     --vector-url "file:$HOME/Library/Application Support/mastracode/mastra-vectors.db"
 *
 * Example — Postgres (same connection for both):
 *   npx tsx packages/memory/scripts/index-messages.ts \
 *     --resource-id user-123 \
 *     --pg-url postgresql://localhost:5432/mastra
 */

import { parseArgs } from 'node:util';

async function main() {
  const { values } = parseArgs({
    options: {
      'resource-id': { type: 'string' },
      'storage-url': { type: 'string' },
      'vector-url': { type: 'string' },
      'pg-url': { type: 'string' },
      'batch-size': { type: 'string', default: '50' },
    },
  });

  const resourceId = values['resource-id'];
  if (!resourceId) {
    console.error('Error: --resource-id is required');
    process.exit(1);
  }

  const storageUrl = values['storage-url'];
  const vectorUrl = values['vector-url'];
  const pgUrl = values['pg-url'];
  if (!storageUrl && !pgUrl) {
    console.error('Error: either --storage-url (LibSQL) or --pg-url (Postgres) is required');
    process.exit(1);
  }

  const batchSize = parseInt(values['batch-size']!, 10);

  let storage: any;
  let vectorStore: any;

  if (pgUrl) {
    const { PostgresStore, PgVector } = await import('@mastra/pg');
    storage = new PostgresStore({ id: 'migration-storage', connectionString: pgUrl });
    vectorStore = new PgVector({ id: 'migration-vectors', connectionString: pgUrl });
  } else {
    const { LibSQLStore, LibSQLVector } = await import('@mastra/libsql');
    storage = new LibSQLStore({ id: 'migration-storage', url: storageUrl! });
    vectorStore = new LibSQLVector({
      id: 'migration-vectors',
      url: vectorUrl || storageUrl!,
    });
  }

  const { fastembed } = await import('@mastra/fastembed');
  const { Memory } = await import('../src/index');

  const memory = new Memory({
    storage,
    vector: vectorStore,
    embedder: fastembed.small,
  });

  // List all threads for the resource
  console.log(`Listing threads for resource: ${resourceId}`);
  const { threads } = await memory.listThreads({
    filter: { resourceId },
    perPage: false,
  });

  console.log(`Found ${threads.length} threads`);

  let totalIndexed = 0;
  for (const thread of threads) {
    const title = thread.title || '(untitled)';
    process.stdout.write(`  Indexing "${title}" (${thread.id})... `);

    const { indexed } = await memory.indexMessages({
      threadId: thread.id,
      resourceId,
      batchSize,
    });

    totalIndexed += indexed;
    console.log(`${indexed} messages indexed`);
  }

  console.log(`\nDone! Indexed ${totalIndexed} messages across ${threads.length} threads.`);
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
