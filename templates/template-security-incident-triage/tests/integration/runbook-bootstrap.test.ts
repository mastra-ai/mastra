import { resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { migrateOperationalStore } from '../../src/db/migrate.js';
import { bootstrapRunbookKnowledge } from '../../src/mastra/knowledge/bootstrap.js';
import { DeterministicRunbookEmbedder } from '../../src/mastra/knowledge/embeddings.js';
import { LibSqlRunbookVectorStore } from '../../src/mastra/knowledge/vector-store.js';
import { createTempDatabase, type TempDatabase } from '../helpers/temp-libsql.js';

const databases: TempDatabase[] = [];

afterEach(async () => {
  await Promise.all(databases.splice(0).map(database => database.cleanup()));
});

describe('runbook knowledge bootstrap', () => {
  it('enforces canonical source paths and preserves catalog relationships', async () => {
    const database = await createTempDatabase();
    databases.push(database);
    const store = database.createStore();
    const timestamp = '2026-09-01T12:00:00.000Z';

    try {
      await migrateOperationalStore(store);
      await store.execute({
        sql: `INSERT INTO runbook_versions(
          runbook_id, version, owner, declared_status, source_path, source_hash,
          parsed_hash, schema_version, chunking_algorithm_version,
          embedding_provider, embedding_model, embedding_dimension,
          allowed_actions_json, mandatory_rules_json, created_at
        ) VALUES ('RB-IDENTITY-001', '1.0.0', 'security', 'active',
          'runbooks/unauthorized-privilege-change.md', ?, ?, 1, 1,
          'fastembed', 'bge-small-en-v1.5', 384, '[]', '[]', ?)`,
        args: ['a'.repeat(64), 'b'.repeat(64), timestamp],
      });
      await store.execute({
        sql: `INSERT INTO runbook_generations(
          generation_id, runbook_id, version, incident_kind, index_name, state,
          chunk_count, aggregate_hash, created_at, activated_at
        ) VALUES ('generation-existing', 'RB-IDENTITY-001', '1.0.0',
          'unauthorized_privilege_change', 'rb_existing', 'active', 0, ?, ?, ?)`,
        args: ['c'.repeat(64), timestamp, timestamp],
      });
      await store.execute({
        sql: `INSERT INTO runbook_activations(
          incident_kind, runbook_id, version, generation_id, revision, activated_at
        ) VALUES ('unauthorized_privilege_change', 'RB-IDENTITY-001', '1.0.0',
          'generation-existing', 1, ?)`,
        args: [timestamp],
      });

      await expect(
        store.execute({
          sql: "SELECT source_path FROM runbook_versions WHERE runbook_id = 'RB-IDENTITY-001'",
        }),
      ).resolves.toMatchObject({
        rows: [{ source_path: 'runbooks/unauthorized-privilege-change.md' }],
      });
      await expect(store.execute({ sql: 'PRAGMA foreign_key_check' })).resolves.toMatchObject({ rows: [] });
    } finally {
      store.close();
    }
  });

  it('indexes every active incident kind once and is idempotent', async () => {
    const database = await createTempDatabase();
    databases.push(database);
    const store = database.createStore();
    const options = {
      root: resolve(process.cwd(), 'runbooks'),
      createEmbedder: () => new DeterministicRunbookEmbedder(),
      createVectorStore: () => new LibSqlRunbookVectorStore({ url: database.url }),
      now: () => new Date('2026-09-01T12:00:00.000Z'),
    } as const;

    try {
      await migrateOperationalStore(store);
      await store.execute({
        sql: `INSERT INTO runbook_versions(
          runbook_id, version, owner, declared_status, source_path, source_hash,
          parsed_hash, schema_version, chunking_algorithm_version,
          embedding_provider, embedding_model, embedding_dimension,
          allowed_actions_json, mandatory_rules_json, created_at
        ) VALUES (?, '2.1.0', ?, 'inactive', ?, ?, ?, 1, 1,
          'fastembed', 'bge-small-en-v1.5', 384, '[]', '[]', ?)`,
        args: [
          'RB-CUSTOM-ROLE-CHANGE',
          'identity-platform',
          'runbooks/custom-role-change.md',
          'a'.repeat(64),
          'b'.repeat(64),
          '2026-09-01T12:00:00.000Z',
        ],
      });
      await expect(bootstrapRunbookKnowledge(store, options)).resolves.toEqual({
        indexed: 3,
        unchanged: 0,
      });
      await expect(bootstrapRunbookKnowledge(store, options)).resolves.toEqual({
        indexed: 0,
        unchanged: 3,
      });

      const activations = await store.execute({
        sql: 'SELECT incident_kind, revision FROM runbook_activations ORDER BY incident_kind',
      });
      expect(activations.rows).toHaveLength(3);
      expect(activations.rows.every(row => row.revision === 1)).toBe(true);
    } finally {
      store.close();
    }
  });
});
