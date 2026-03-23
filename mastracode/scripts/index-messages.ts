#!/usr/bin/env npx tsx
/**
 * One-time migration script to index MastraCode's existing messages
 * into the vector store for semantic search via recall mode="search".
 *
 * Skips threads that already have vectors indexed.
 *
 * Usage:
 *   npx tsx scripts/index-mastracode-messages.ts [resource-id]
 */

import { LibSQLStore, LibSQLVector } from '../stores/libsql/dist/index.js';
import { fastembed } from '../packages/fastembed/dist/index.js';
import { Memory } from '../packages/memory/dist/index.js';
import { execSync } from 'child_process';
import os from 'os';
import path from 'path';

function getAppDataDir(): string {
  const platform = os.platform();
  if (platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'mastracode');
  } else if (platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'mastracode');
  }
  return path.join(os.homedir(), '.local', 'share', 'mastracode');
}

const RESOURCE_ID = process.argv[2] || 'mastra-96f658f9';
const appDataDir = getAppDataDir();
const storageDbPath = `file:${path.join(appDataDir, 'mastra.db')}`;
const vectorDbPath = `file:${path.join(appDataDir, 'mastra-vectors.db')}`;

function getIndexedThreadIds(): Set<string> {
  // Query the vector DB directly via sqlite3 CLI for distinct thread_ids
  const dbPath = vectorDbPath.replace('file:', '');
  try {
    const output = execSync(
      `sqlite3 "${dbPath}" "SELECT DISTINCT json_extract(metadata, '$.thread_id') FROM memory_messages_384 WHERE json_extract(metadata, '$.thread_id') IS NOT NULL;"`,
      { encoding: 'utf-8', timeout: 10000 },
    );
    const ids = new Set<string>();
    for (const line of output.trim().split('\n')) {
      if (line.trim()) ids.add(line.trim());
    }
    return ids;
  } catch {
    // Table might not exist yet, or sqlite3 not available
    return new Set();
  }
}

async function main() {
  console.log(`Storage DB: ${storageDbPath}`);
  console.log(`Vector DB:  ${vectorDbPath}`);
  console.log(`Resource:   ${RESOURCE_ID}`);
  console.log();

  const storage = new LibSQLStore({ id: 'migration-storage', url: storageDbPath });
  const vectorStore = new LibSQLVector({ id: 'migration-vectors', url: vectorDbPath });

  const memory = new Memory({
    storage,
    vector: vectorStore,
    embedder: fastembed.small,
  });

  // Find already-indexed threads
  console.log('Checking for already-indexed threads...');
  const indexedThreadIds = getIndexedThreadIds();
  console.log(`Found ${indexedThreadIds.size} already-indexed threads\n`);

  // List all threads for the resource
  console.log(`Listing threads for resource: ${RESOURCE_ID}`);
  const { threads } = await memory.listThreads({
    filter: { resourceId: RESOURCE_ID },
    perPage: false,
  });

  const toIndex = threads.filter(t => !indexedThreadIds.has(t.id));
  console.log(`Found ${threads.length} threads total, ${toIndex.length} need indexing\n`);

  let totalIndexed = 0;
  for (let i = 0; i < toIndex.length; i++) {
    const thread = toIndex[i]!;
    const title = thread.title || '(untitled)';
    process.stdout.write(`  [${i + 1}/${toIndex.length}] "${title}" (${thread.id})... `);

    try {
      const { indexed } = await memory.indexMessages({
        threadId: thread.id,
        resourceId: RESOURCE_ID,
        batchSize: 50,
      });
      totalIndexed += indexed;
      console.log(`${indexed} messages`);
    } catch (err: any) {
      console.log(`ERROR: ${err.message}`);
    }
  }

  console.log(
    `\nDone! Indexed ${totalIndexed} messages across ${toIndex.length} threads (${indexedThreadIds.size} skipped).`,
  );
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
