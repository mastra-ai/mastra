import { resolve } from 'node:path';

import { createLibSqlOperationalStore } from '../src/db/libsql-operational-store.js';
import { migrateOperationalStore } from '../src/db/migrate.js';
import { chunkRunbook } from '../src/mastra/knowledge/chunker.js';
import { FastEmbedRunbookEmbedder } from '../src/mastra/knowledge/embeddings.js';
import { sha256 } from '../src/mastra/knowledge/hashes.js';
import { cleanupRunbookGeneration, indexRunbook, rollbackRunbookGeneration } from '../src/mastra/knowledge/indexer.js';
import { loadRunbooks } from '../src/mastra/knowledge/loader.js';
import { LibSqlRunbookVectorStore } from '../src/mastra/knowledge/vector-store.js';

const root = resolve(process.cwd(), 'runbooks');
const command = process.argv[2] ?? 'validate';
const runbooks = await loadRunbooks(root);

if (command === 'validate') {
  for (const runbook of runbooks) {
    const generationId = `gen_${sha256(`${runbook.metadata.id}\0${runbook.metadata.version}\0${runbook.sourceHash}`).slice(0, 32)}`;
    const chunks = await chunkRunbook(runbook, {
      generationId,
      indexName: `rb_dry_${sha256(generationId).slice(0, 16)}`,
    });
    process.stdout.write(`${runbook.metadata.id}@${runbook.metadata.version}: ${chunks.length} chunks valid\n`);
  }
} else if (command === 'index') {
  const store = createLibSqlOperationalStore();
  let vector: LibSqlRunbookVectorStore | undefined;
  try {
    vector = new LibSqlRunbookVectorStore();
    await migrateOperationalStore(store);
    for (const runbook of runbooks.filter(candidate => candidate.metadata.status === 'active')) {
      const generationId = `gen_${sha256(`${runbook.metadata.id}\0${runbook.metadata.version}\0${runbook.sourceHash}`).slice(0, 32)}`;
      const result = await indexRunbook(store, vector, new FastEmbedRunbookEmbedder(), runbook, {
        generationId,
        now: new Date().toISOString(),
      });
      process.stdout.write(`${runbook.metadata.id}: ${result.chunkCount} chunks in ${result.indexName}\n`);
    }
  } finally {
    store.close();
    await vector?.close();
  }
} else if (command === 'inspect') {
  const store = createLibSqlOperationalStore();
  try {
    await migrateOperationalStore(store);
    const activations = await store.execute({
      sql: `SELECT incident_kind, runbook_id, version, generation_id, revision,
        activated_at FROM runbook_activations ORDER BY incident_kind`,
    });
    const events = await store.execute({
      sql: `SELECT incident_kind, resulting_revision, operation,
        from_generation_id, to_generation_id, expected_revision, occurred_at
        FROM runbook_activation_events
        ORDER BY incident_kind, resulting_revision`,
    });
    process.stdout.write(`${JSON.stringify({ activations: activations.rows, events: events.rows }, null, 2)}\n`);
  } finally {
    store.close();
  }
} else if (command === 'rollback') {
  const generationId = process.argv[3];
  const expectedRevision = Number(process.argv[4]);
  if (!generationId || !Number.isInteger(expectedRevision) || expectedRevision < 1) {
    throw new Error('Usage: runbooks.mts rollback <generation-id> <expected-revision>');
  }
  const store = createLibSqlOperationalStore();
  const vector = new LibSqlRunbookVectorStore();
  try {
    await migrateOperationalStore(store);
    const result = await rollbackRunbookGeneration(store, vector, new FastEmbedRunbookEmbedder(), {
      generationId,
      expectedRevision,
      now: new Date().toISOString(),
    });
    process.stdout.write(`rolled back to ${result.generationId} at revision ${result.revision}\n`);
  } finally {
    store.close();
    await vector.close();
  }
} else if (command === 'cleanup') {
  const generationId = process.argv[3];
  const indexName = process.argv[4];
  const expectedChunkCount = Number(process.argv[5]);
  const mode = process.argv[6] ?? '--dry-run';
  if (
    !generationId ||
    !indexName ||
    !Number.isInteger(expectedChunkCount) ||
    expectedChunkCount < 0 ||
    !['--dry-run', '--execute'].includes(mode)
  ) {
    throw new Error('Usage: runbooks.mts cleanup <generation-id> <index-name> <chunk-count> [--dry-run|--execute]');
  }
  const store = createLibSqlOperationalStore();
  const vector = new LibSqlRunbookVectorStore();
  try {
    await migrateOperationalStore(store);
    const result = await cleanupRunbookGeneration(store, vector, {
      generationId,
      indexName,
      expectedChunkCount,
      dryRun: mode === '--dry-run',
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    store.close();
    await vector.close();
  }
} else {
  throw new Error('Usage: runbooks.mts validate|index|inspect|rollback|cleanup');
}
