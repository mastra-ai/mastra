import { resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createIncidentFromAlert } from '../../src/db/incident-operations.js';
import { migrateOperationalStore } from '../../src/db/migrate.js';
import type { OperationalStore, StoreTransaction } from '../../src/db/operational-store.js';
import { claimRetrievalSelection } from '../../src/db/runbook-retrieval-operations.js';
import { resolveEligibleGeneration } from '../../src/db/runbook-operations.js';
import { fixedClock } from '../../src/domain/clock.js';
import { sequenceIdGenerator } from '../../src/domain/id-generator.js';
import { DeterministicRunbookEmbedder } from '../../src/mastra/knowledge/embeddings.js';
import {
  cleanupRunbookGeneration,
  indexRunbook,
  rollbackRunbookGeneration,
} from '../../src/mastra/knowledge/indexer.js';
import { loadRunbooks, type LoadedRunbook } from '../../src/mastra/knowledge/loader.js';
import { retrieveRunbook } from '../../src/mastra/knowledge/retrieve.js';
import { sha256 } from '../../src/mastra/knowledge/hashes.js';
import {
  LibSqlRunbookVectorStore,
  type RunbookVectorStore,
  type VectorMatch,
} from '../../src/mastra/knowledge/vector-store.js';
import type { IncidentKind } from '../../src/schemas/incident.js';
import { makeAlert } from '../fixtures/domain.js';
import { createTempDatabase, type TempDatabase } from '../helpers/temp-libsql.js';

const databases: TempDatabase[] = [];
const runbookRoot = resolve(process.cwd(), 'runbooks');

afterEach(async () => {
  await Promise.all(databases.splice(0).map(database => database.cleanup()));
});

describe('runbook indexing and retrieval', () => {
  it('fails closed with an explicit ambiguity error if storage violates the unique-pointer invariant', async () => {
    const corruptStore: OperationalStore = {
      execute: async () => ({ rows: [{ generation_id: 'a' }, { generation_id: 'b' }] }) as never,
      transaction: async () => {
        throw new Error('not used');
      },
      close: () => {},
    };
    await expect(resolveEligibleGeneration(corruptStore, 'unknown_device_login')).rejects.toMatchObject({
      code: 'RUNBOOK_AMBIGUOUS',
    });
  });

  it('indexes idempotently and retrieves each kind only from its preselected physical index', async () => {
    const { store, vector, runbooks } = await setupCatalog();
    try {
      const firstRevisions = new Map<string, number>();
      for (const runbook of runbooks) {
        const kind = runbook.metadata.incidentKinds[0] as IncidentKind;
        const result = await indexRunbook(store, vector, new DeterministicRunbookEmbedder(), runbook, {
          generationId: `generation-${kind}`,
          now: '2026-08-27T12:00:00.000Z',
        });
        firstRevisions.set(kind, result.revision);
        const repeated = await indexRunbook(store, vector, new DeterministicRunbookEmbedder(), runbook, {
          generationId: `generation-${kind}`,
          now: '2026-08-27T12:00:00.000Z',
        });
        expect(repeated.revision).toBe(result.revision);
        await expect(
          indexRunbook(
            store,
            vector,
            new DeterministicRunbookEmbedder(),
            { ...runbook, sourceHash: 'f'.repeat(64) },
            {
              generationId: `generation-tampered-${kind}`,
              now: '2026-08-27T12:00:00.000Z',
            },
          ),
        ).rejects.toMatchObject({ code: 'CONFLICT' });
      }
      vector.queries.splice(0);

      for (const [ordinal, runbook] of runbooks.entries()) {
        const kind = runbook.metadata.incidentKinds[0] as IncidentKind;
        await seedIncident(store, kind, ordinal + 1);
        const result = await retrieveRunbook(
          store,
          vector,
          new DeterministicRunbookEmbedder(),
          retrievalInput(kind, ordinal + 1),
          {
            threshold: 0.5,
            topK: 3,
            clock: fixedClock('2026-08-27T12:01:00.000Z'),
            ids: sequenceIdGenerator([`retrieval-${ordinal}`, `timeline-rag-${ordinal}`]),
          },
        );
        expect(result.runbookId).toBe(runbook.metadata.id);
        expect(result.version).toBe(runbook.metadata.version);
        expect(result.citation).toBe(`[runbook:${runbook.metadata.id}@${runbook.metadata.version}]`);
        expect(result.chunkIds).toHaveLength(3);
        const queriedIndex = vector.queries.at(-1);
        expect(queriedIndex).toContain(kind);

        const retry = await retrieveRunbook(
          store,
          vector,
          new DeterministicRunbookEmbedder(),
          retrievalInput(kind, ordinal + 1),
          { threshold: 0.5, topK: 3 },
        );
        expect(retry).toMatchObject({
          retrievalId: result.retrievalId,
          duplicate: true,
        });
        expect(retry.chunkIds).toEqual(result.chunkIds);
      }

      expect(vector.queries).toHaveLength(3);
      expect(new Set(vector.queries).size).toBe(3);
      const counts = await store.execute({
        sql: `SELECT
          (SELECT count(*) FROM runbook_versions) AS versions,
          (SELECT count(*) FROM runbook_generations) AS generations,
          (SELECT count(*) FROM runbook_chunks) AS chunks,
          (SELECT count(*) FROM runbook_activations) AS activations,
          (SELECT count(*) FROM runbook_retrievals) AS retrievals,
          (SELECT count(*) FROM runbook_retrieval_chunks) AS retrieval_chunks`,
      });
      expect(counts.rows[0]).toEqual({
        versions: 3,
        generations: 3,
        chunks: 27,
        activations: 3,
        retrievals: 3,
        retrieval_chunks: 9,
      });
      expect([...firstRevisions.values()]).toEqual([1, 1, 1]);
    } finally {
      store.close();
    }
  });

  it('fails closed before embedding for missing, inactive and empty-query cases', async () => {
    const { store, vector, runbooks } = await setupCatalog();
    const embedder = new CountingEmbedder();
    try {
      const kind = 'unauthorized_privilege_change' as const;
      await seedIncident(store, kind, 1);
      await expect(retrieveRunbook(store, vector, embedder, retrievalInput(kind, 1))).rejects.toMatchObject({
        code: 'RUNBOOK_MISSING',
      });
      expect(embedder.queryCalls).toBe(0);

      const runbook = runbooks.find(item => item.metadata.incidentKinds[0] === kind) as LoadedRunbook;
      await indexRunbook(store, vector, embedder, runbook, {
        generationId: 'generation-inactive',
        now: '2026-08-27T12:00:00.000Z',
      });
      await store.execute({
        sql: "UPDATE runbook_versions SET declared_status = 'inactive' WHERE runbook_id = ?",
        args: [runbook.metadata.id],
      });
      await seedIncident(store, kind, 2);
      await expect(retrieveRunbook(store, vector, embedder, retrievalInput(kind, 2))).rejects.toMatchObject({
        code: 'RUNBOOK_INELIGIBLE',
      });
      await seedIncident(store, kind, 3);
      await expect(
        retrieveRunbook(store, vector, embedder, {
          ...retrievalInput(kind, 3),
          queryText: '   ',
        }),
      ).rejects.toMatchObject({ code: 'RUNBOOK_QUERY_EMPTY' });
      expect(embedder.queryCalls).toBe(0);
      const failures = await store.execute({
        sql: 'SELECT error_code FROM runbook_retrievals ORDER BY retrieval_id',
      });
      expect(failures.rows.map(row => row.error_code).sort()).toEqual([
        'RUNBOOK_INELIGIBLE',
        'RUNBOOK_MISSING',
        'RUNBOOK_QUERY_EMPTY',
      ]);
    } finally {
      store.close();
    }
  });

  it('rejects tampered vector metadata and a persisted action outside the code allowlist', async () => {
    const { store, vector, runbooks } = await setupCatalog();
    const embedder = new DeterministicRunbookEmbedder();
    const kind = 'unknown_device_login' as const;
    const runbook = runbooks.find(item => item.metadata.incidentKinds[0] === kind) as LoadedRunbook;
    try {
      await indexRunbook(store, vector, embedder, runbook, {
        generationId: 'generation-device',
        now: '2026-08-27T12:00:00.000Z',
      });
      await seedIncident(store, kind, 1);
      vector.tamperMetadata = true;
      await expect(retrieveRunbook(store, vector, embedder, retrievalInput(kind, 1))).rejects.toMatchObject({
        code: 'RUNBOOK_INTEGRITY_FAILED',
      });

      vector.tamperMetadata = false;
      const queryCountBeforeAllowlistFailure = vector.queries.length;
      await store.execute({
        sql: 'UPDATE runbook_versions SET allowed_actions_json = ? WHERE runbook_id = ?',
        args: ['["revoke_session","delete_account"]', runbook.metadata.id],
      });
      await seedIncident(store, kind, 2);
      await expect(retrieveRunbook(store, vector, embedder, retrievalInput(kind, 2))).rejects.toMatchObject({
        code: 'RUNBOOK_ACTION_NOT_ALLOWLISTED',
      });
      expect(vector.queries).toHaveLength(queryCountBeforeAllowlistFailure);
    } finally {
      store.close();
    }
  });

  it('uses the real LibSQLVector adapter hermetically with one physical index per eligible generation', async () => {
    const database = await createTempDatabase();
    databases.push(database);
    const store = database.createStore();
    const vector = new LibSqlRunbookVectorStore({ url: database.url });
    const embedder = new DeterministicRunbookEmbedder();
    try {
      await migrateOperationalStore(store, {
        appliedAt: '2026-08-27T12:00:00.000Z',
      });
      const runbook = (await loadRunbooks(runbookRoot)).find(
        item => item.metadata.incidentKinds[0] === 'disallowed_country_login',
      ) as LoadedRunbook;
      const indexed = await indexRunbook(store, vector, embedder, runbook, {
        generationId: 'generation-real-libsql',
        now: '2026-08-27T12:00:00.000Z',
      });
      expect(indexed.indexName).toContain('disallowed_country_login');
      expect(await vector.describe(indexed.indexName)).toEqual({
        dimension: 384,
        count: 9,
      });
      await seedIncident(store, 'disallowed_country_login', 1);
      const result = await retrieveRunbook(store, vector, embedder, retrievalInput('disallowed_country_login', 1), {
        threshold: -1,
        topK: 3,
        clock: fixedClock('2026-08-27T12:01:00.000Z'),
        ids: sequenceIdGenerator(['retrieval-real', 'timeline-real']),
      });
      expect(result.runbookId).toBe('RB-IDENTITY-002');
      expect(result.chunkIds).toHaveLength(3);
    } finally {
      store.close();
      await vector.close();
    }
  });

  it('keeps one activation winner under concurrent reindex and never exposes the losing generation', async () => {
    const { store, vector, runbooks } = await setupCatalog();
    const embedder = new DeterministicRunbookEmbedder();
    const kind = 'unauthorized_privilege_change' as const;
    const runbook = runbooks.find(item => item.metadata.incidentKinds[0] === kind) as LoadedRunbook;
    try {
      await indexRunbook(store, vector, embedder, runbook, {
        generationId: 'generation-original',
        now: '2026-08-27T12:00:00.000Z',
      });
      const raceEmbedder = new BarrierEmbedder();
      const results = await Promise.allSettled([
        indexRunbook(store, vector, raceEmbedder, runbook, {
          generationId: 'generation-race-a',
          now: '2026-08-27T12:01:00.000Z',
        }),
        indexRunbook(store, vector, raceEmbedder, runbook, {
          generationId: 'generation-race-b',
          now: '2026-08-27T12:01:00.000Z',
        }),
      ]);
      const outcomes = results.map(result =>
        result.status === 'fulfilled'
          ? 'fulfilled'
          : `${String((result.reason as { code?: unknown }).code)}:${String(result.reason)}`,
      );
      expect(outcomes).toEqual(expect.arrayContaining(['fulfilled']));
      expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
      const state = await store.execute({
        sql: `SELECT generation_id, state, index_name, chunk_count FROM runbook_generations
          WHERE incident_kind = ? ORDER BY generation_id`,
        args: [kind],
      });
      expect(state.rows.filter(row => row.state === 'active')).toHaveLength(1);
      expect(state.rows.filter(row => row.state === 'failed')).toHaveLength(1);
      expect(state.rows.filter(row => row.state === 'retired')).toHaveLength(1);
      const activation = await store.execute({
        sql: 'SELECT generation_id, revision FROM runbook_activations WHERE incident_kind = ?',
        args: [kind],
      });
      expect(activation.rows[0]?.revision).toBe(2);
      expect(vector.indexes.size).toBe(2);
      const retired = state.rows.find(row => row.state === 'retired');
      expect(
        await cleanupRunbookGeneration(store, vector, {
          generationId: String(retired?.generation_id),
          indexName: String(retired?.index_name),
          expectedChunkCount: Number(retired?.chunk_count),
          dryRun: true,
        }),
      ).toEqual({ eligible: true, deleted: false });
      await expect(
        cleanupRunbookGeneration(store, vector, {
          generationId: String(activation.rows[0]?.generation_id),
          indexName: 'rb_wrong_target',
          expectedChunkCount: 9,
          dryRun: false,
        }),
      ).rejects.toMatchObject({ code: 'RUNBOOK_INELIGIBLE' });
    } finally {
      store.close();
    }
  });

  it('audits backend failure and insufficient score without fallback or selected chunks', async () => {
    const { store, vector, runbooks } = await setupCatalog();
    const embedder = new DeterministicRunbookEmbedder();
    const kind = 'disallowed_country_login' as const;
    const runbook = runbooks.find(item => item.metadata.incidentKinds[0] === kind) as LoadedRunbook;
    try {
      await indexRunbook(store, vector, embedder, runbook, {
        generationId: 'generation-failures',
        now: '2026-08-27T12:00:00.000Z',
      });
      await seedIncident(store, kind, 1);
      vector.failQuery = true;
      await expect(retrieveRunbook(store, vector, embedder, retrievalInput(kind, 1))).rejects.toMatchObject({
        code: 'RUNBOOK_BACKEND_UNAVAILABLE',
        retryable: true,
      });
      vector.failQuery = false;
      const recovered = await retrieveRunbook(store, vector, embedder, retrievalInput(kind, 1));
      expect(recovered.runbookId).toBe('RB-IDENTITY-002');
      vector.score = 0.01;
      await seedIncident(store, kind, 2);
      await expect(retrieveRunbook(store, vector, embedder, retrievalInput(kind, 2))).rejects.toMatchObject({
        code: 'RUNBOOK_SCORE_INSUFFICIENT',
      });
      const rows = await store.execute({
        sql: `SELECT status, error_code,
          (SELECT count(*) FROM runbook_retrieval_chunks c
            WHERE c.retrieval_id = r.retrieval_id) AS chunks
          FROM runbook_retrievals r ORDER BY incident_id`,
      });
      expect(rows.rows).toEqual([
        { status: 'succeeded', error_code: null, chunks: 3 },
        {
          status: 'manual_review',
          error_code: 'RUNBOOK_SCORE_INSUFFICIENT',
          chunks: 0,
        },
      ]);
      const failureTimeline = await store.execute({
        sql: `SELECT count(*) AS count FROM timeline_events
          WHERE incident_id = 'incident-rag-1'
            AND type = 'runbook.retrieval_failed'`,
      });
      expect(Number(failureTimeline.rows[0]?.count)).toBe(1);
    } finally {
      store.close();
    }
  });

  it('retries the same exact generation after a transient indexing backend failure', async () => {
    const { store, vector, runbooks } = await setupCatalog();
    const runbook = runbooks.find(item => item.metadata.incidentKinds[0] === 'unknown_device_login') as LoadedRunbook;
    const input = {
      generationId: 'generation-retryable-index',
      now: '2026-08-27T12:00:00.000Z',
    };
    try {
      vector.failUpsert = true;
      await expect(
        indexRunbook(store, vector, new DeterministicRunbookEmbedder(), runbook, input),
      ).rejects.toMatchObject({
        code: 'RUNBOOK_BACKEND_UNAVAILABLE',
        retryable: true,
      });
      vector.failUpsert = false;
      const recovered = await indexRunbook(store, vector, new DeterministicRunbookEmbedder(), runbook, input);
      expect(recovered.revision).toBe(1);
      const state = await store.execute({
        sql: 'SELECT state, error_code FROM runbook_generations WHERE generation_id = ?',
        args: [input.generationId],
      });
      expect(state.rows[0]).toEqual({ state: 'active', error_code: null });
    } finally {
      store.close();
    }
  });

  it('pins the selected generation and policy across a backend failure and activation switch', async () => {
    const { store, vector, runbooks } = await setupCatalog();
    const embedder = new DeterministicRunbookEmbedder();
    const kind = 'unknown_device_login' as const;
    const runbook = runbooks.find(item => item.metadata.incidentKinds[0] === kind) as LoadedRunbook;
    try {
      await indexRunbook(store, vector, embedder, runbook, {
        generationId: 'generation-pinned-a',
        now: '2026-08-27T12:00:00.000Z',
      });
      await seedIncident(store, kind, 20);
      vector.failQuery = true;
      await expect(
        retrieveRunbook(store, vector, embedder, retrievalInput(kind, 20), {
          threshold: 0.5,
          topK: 2,
        }),
      ).rejects.toMatchObject({ code: 'RUNBOOK_BACKEND_UNAVAILABLE' });
      const failed = await store.execute({
        sql: `SELECT generation_id, threshold, top_k, status
          FROM runbook_retrievals WHERE workflow_run_id = 'run-rag-20'`,
      });
      expect(failed.rows[0]).toEqual({
        generation_id: 'generation-pinned-a',
        threshold: '0.5',
        top_k: 2,
        status: 'failed',
      });
      const failureIntegrity = await store.execute({
        sql: `SELECT aggregate_integrity_hash FROM runbook_retrievals
          WHERE workflow_run_id = 'run-rag-20'`,
      });
      const originalFailureHash = String(failureIntegrity.rows[0]?.aggregate_integrity_hash);
      await store.execute({
        sql: `UPDATE runbook_retrievals SET aggregate_integrity_hash = ?
          WHERE workflow_run_id = 'run-rag-20'`,
        args: ['f'.repeat(64)],
      });
      await expect(
        retrieveRunbook(store, vector, embedder, retrievalInput(kind, 20), {
          threshold: 0.5,
          topK: 2,
        }),
      ).rejects.toMatchObject({ code: 'RUNBOOK_INTEGRITY_FAILED' });
      await store.execute({
        sql: `UPDATE runbook_retrievals SET aggregate_integrity_hash = ?
          WHERE workflow_run_id = 'run-rag-20'`,
        args: [originalFailureHash],
      });

      vector.failQuery = false;
      await indexRunbook(store, vector, embedder, runbook, {
        generationId: 'generation-pinned-b',
        now: '2026-08-27T12:01:00.000Z',
      });
      const retry = await retrieveRunbook(store, vector, embedder, retrievalInput(kind, 20), {
        threshold: 0.5,
        topK: 2,
      });
      expect(retry.generationId).toBe('generation-pinned-a');
      await expect(
        retrieveRunbook(store, vector, embedder, retrievalInput(kind, 20), {
          threshold: 0.4,
          topK: 2,
        }),
      ).rejects.toMatchObject({ code: 'RUNBOOK_INTEGRITY_FAILED' });
    } finally {
      store.close();
    }
  });

  it('keeps duplicate concurrent activation idempotent and rejects a stale older operation', async () => {
    const { store, vector, runbooks } = await setupCatalog();
    const runbook = runbooks.find(
      item => item.metadata.incidentKinds[0] === 'unauthorized_privilege_change',
    ) as LoadedRunbook;
    try {
      const duplicateBarrier = new BarrierEmbedder();
      const duplicate = await Promise.all([
        indexRunbook(store, vector, duplicateBarrier, runbook, {
          generationId: 'generation-duplicate',
          now: '2026-08-27T12:00:00.000Z',
        }),
        indexRunbook(store, vector, duplicateBarrier, runbook, {
          generationId: 'generation-duplicate',
          now: '2026-08-27T12:00:00.000Z',
        }),
      ]);
      expect(duplicate.map(result => result.revision)).toEqual([1, 1]);

      const staleEmbedder = new ControlledEmbedder();
      const stale = indexRunbook(store, vector, staleEmbedder, runbook, {
        generationId: 'generation-stale',
        now: '2026-08-27T12:01:00.000Z',
      });
      await staleEmbedder.entered;
      const newer = await indexRunbook(store, vector, new DeterministicRunbookEmbedder(), runbook, {
        generationId: 'generation-newer',
        now: '2026-08-27T12:02:00.000Z',
      });
      expect(newer.revision).toBe(2);
      staleEmbedder.release();
      await expect(stale).rejects.toMatchObject({ code: 'RUNBOOK_INELIGIBLE' });
      const activation = await store.execute({
        sql: `SELECT generation_id, revision FROM runbook_activations
          WHERE incident_kind = 'unauthorized_privilege_change'`,
      });
      expect(activation.rows[0]).toEqual({
        generation_id: 'generation-newer',
        revision: 2,
      });
    } finally {
      store.close();
    }
  });

  it('rejects tampering of the citation and every persisted selection field', async () => {
    const selectionFields = [
      ['citation', '[runbook:RB-IDENTITY-003@9.9.9]'],
      ['threshold', '0.123'],
      ['top_k', 4],
      ['activation_revision', 99],
      ['index_name', 'rb_tampered'],
      ['source_hash', 'f'.repeat(64)],
      ['generation_aggregate_hash', 'e'.repeat(64)],
      ['allowed_actions_json', '["revoke_session"]'],
      ['attempt', 99],
    ] as const;
    for (const [field, value] of selectionFields) {
      const { store, vector, runbooks } = await setupCatalog();
      const embedder = new DeterministicRunbookEmbedder();
      const kind = 'unknown_device_login' as const;
      const runbook = runbooks.find(item => item.metadata.incidentKinds[0] === kind) as LoadedRunbook;
      try {
        await indexRunbook(store, vector, embedder, runbook, {
          generationId: `generation-integrity-${field}`,
          now: '2026-08-27T12:00:00.000Z',
        });
        await seedIncident(store, kind, 30);
        await retrieveRunbook(store, vector, embedder, retrievalInput(kind, 30));
        await store.execute({
          sql: `UPDATE runbook_retrievals SET ${field} = ? WHERE workflow_run_id = 'run-rag-30'`,
          args: [value],
        });
        await expect(retrieveRunbook(store, vector, embedder, retrievalInput(kind, 30))).rejects.toMatchObject({
          code: 'RUNBOOK_INTEGRITY_FAILED',
        });
      } finally {
        store.close();
      }
    }
  });

  it('rolls back by CAS with vector readback and an append-only activation ledger', async () => {
    const { store, vector, runbooks } = await setupCatalog();
    const embedder = new DeterministicRunbookEmbedder();
    const kind = 'disallowed_country_login' as const;
    const runbook = runbooks.find(item => item.metadata.incidentKinds[0] === kind) as LoadedRunbook;
    try {
      await indexRunbook(store, vector, embedder, runbook, {
        generationId: 'generation-rollback-a',
        now: '2026-08-27T12:00:00.000Z',
      });
      await indexRunbook(store, vector, embedder, runbook, {
        generationId: 'generation-rollback-b',
        now: '2026-08-27T12:01:00.000Z',
      });
      await expect(
        rollbackRunbookGeneration(store, vector, embedder, {
          generationId: 'generation-rollback-b',
          expectedRevision: 2,
          now: '2026-08-27T12:02:00.000Z',
        }),
      ).rejects.toMatchObject({ code: 'RUNBOOK_INELIGIBLE' });
      const rolledBack = await rollbackRunbookGeneration(store, vector, embedder, {
        generationId: 'generation-rollback-a',
        expectedRevision: 2,
        now: '2026-08-27T12:02:00.000Z',
      });
      expect(rolledBack.revision).toBe(3);
      await expect(
        rollbackRunbookGeneration(store, vector, embedder, {
          generationId: 'generation-rollback-b',
          expectedRevision: 2,
          now: '2026-08-27T12:03:00.000Z',
        }),
      ).rejects.toMatchObject({ code: 'RUNBOOK_INELIGIBLE' });
      const ledger = await store.execute({
        sql: `SELECT operation, from_generation_id, to_generation_id, resulting_revision
          FROM runbook_activation_events WHERE incident_kind = ? ORDER BY resulting_revision`,
        args: [kind],
      });
      expect(ledger.rows).toEqual([
        {
          operation: 'activate',
          from_generation_id: null,
          to_generation_id: 'generation-rollback-a',
          resulting_revision: 1,
        },
        {
          operation: 'activate',
          from_generation_id: 'generation-rollback-a',
          to_generation_id: 'generation-rollback-b',
          resulting_revision: 2,
        },
        {
          operation: 'rollback',
          from_generation_id: 'generation-rollback-b',
          to_generation_id: 'generation-rollback-a',
          resulting_revision: 3,
        },
      ]);

      await indexRunbook(store, vector, embedder, runbook, {
        generationId: 'generation-rollback-c',
        now: '2026-08-27T12:04:00.000Z',
      });
      vector.tamperMetadata = true;
      await expect(
        rollbackRunbookGeneration(store, vector, embedder, {
          generationId: 'generation-rollback-a',
          expectedRevision: 4,
          now: '2026-08-27T12:05:00.000Z',
        }),
      ).rejects.toMatchObject({ code: 'RUNBOOK_INTEGRITY_FAILED' });
      vector.tamperMetadata = false;
      const firstIndex = await store.execute({
        sql: `SELECT index_name FROM runbook_generations
          WHERE generation_id = 'generation-rollback-a'`,
      });
      await vector.deleteIndex(String(firstIndex.rows[0]?.index_name));
      await expect(
        rollbackRunbookGeneration(store, vector, embedder, {
          generationId: 'generation-rollback-a',
          expectedRevision: 4,
          now: '2026-08-27T12:05:00.000Z',
        }),
      ).rejects.toMatchObject({
        code: 'RUNBOOK_BACKEND_UNAVAILABLE',
        retryable: true,
      });
    } finally {
      store.close();
    }
  });

  it('blocks cleanup while a selected retrieval is in flight and revalidates before deletion', async () => {
    const { store, vector, runbooks } = await setupCatalog();
    const embedder = new DeterministicRunbookEmbedder();
    const kind = 'unknown_device_login' as const;
    const runbook = runbooks.find(item => item.metadata.incidentKinds[0] === kind) as LoadedRunbook;
    try {
      const first = await indexRunbook(store, vector, embedder, runbook, {
        generationId: 'generation-cleanup-a',
        now: '2026-08-27T12:00:00.000Z',
      });
      await seedIncident(store, kind, 40);
      vector.pauseNextQuery();
      const inFlight = retrieveRunbook(store, vector, embedder, retrievalInput(kind, 40), {
        clock: fixedClock('2026-08-27T12:00:00.000Z'),
      });
      await vector.queryEntered;
      await expect(
        retrieveRunbook(store, vector, embedder, retrievalInput(kind, 40), {
          clock: fixedClock('2026-08-27T12:00:30.000Z'),
        }),
      ).rejects.toMatchObject({ code: 'RUNBOOK_INTEGRITY_FAILED' });
      await indexRunbook(store, vector, embedder, runbook, {
        generationId: 'generation-cleanup-b',
        now: '2026-08-27T12:01:00.000Z',
      });
      await expect(
        cleanupRunbookGeneration(store, vector, {
          generationId: first.generationId,
          indexName: first.indexName,
          expectedChunkCount: first.chunkCount,
          dryRun: false,
          now: '2026-08-27T12:00:30.000Z',
        }),
      ).rejects.toMatchObject({ code: 'RUNBOOK_INELIGIBLE' });
      vector.releaseQuery();
      await expect(inFlight).resolves.toMatchObject({
        generationId: 'generation-cleanup-a',
      });
      await expect(
        cleanupRunbookGeneration(store, vector, {
          generationId: first.generationId,
          indexName: first.indexName,
          expectedChunkCount: first.chunkCount,
          dryRun: false,
          now: '2026-08-27T12:00:30.000Z',
        }),
      ).resolves.toEqual({ eligible: true, deleted: true });
    } finally {
      store.close();
    }
  });

  it.each([
    ['runbookId', () => 'RB-IDENTITY-001'],
    ['runbookVersion', () => '9.9.9'],
    ['incidentKind', () => 'disallowed_country_login'],
    ['text', (value: unknown) => `${String(value)} tampered`],
    ['sourceHash', () => 'f'.repeat(64)],
    ['contentHash', () => 'e'.repeat(64)],
    ['metadataHash', () => 'd'.repeat(64)],
    ['sourcePath', () => 'runbooks/tampered.md'],
    ['sectionKey', () => 'tampered-section'],
    ['sectionOrdinal', () => 2],
    ['chunkOrdinal', () => 99],
    ['generationId', () => 'generation-tampered'],
    ['indexName', () => 'rb_tampered'],
    ['status', () => 'inactive'],
  ] as const)(
    'refuses to activate when vector readback tampers %s with a schema-valid value',
    async (field, mutate) => {
      const { store, vector, runbooks } = await setupCatalog();
      const runbook = runbooks.find(item => item.metadata.incidentKinds[0] === 'unknown_device_login') as LoadedRunbook;
      vector.metadataMutation = metadata => ({
        ...metadata,
        [field]: mutate(metadata[field]),
      });
      try {
        await expect(
          indexRunbook(store, vector, new DeterministicRunbookEmbedder(), runbook, {
            generationId: `generation-readback-${field}`,
            now: '2026-08-27T12:00:00.000Z',
          }),
        ).rejects.toMatchObject({ code: 'RUNBOOK_INTEGRITY_FAILED' });
        const state = await store.execute({
          sql: `SELECT state FROM runbook_generations WHERE generation_id = ?`,
          args: [`generation-readback-${field}`],
        });
        expect(state.rows[0]).toEqual({ state: 'failed' });
        const activation = await store.execute({
          sql: `SELECT count(*) AS count FROM runbook_activations
            WHERE incident_kind = 'unknown_device_login'`,
        });
        expect(Number(activation.rows[0]?.count)).toBe(0);
      } finally {
        store.close();
      }
    },
  );

  it('recovers an expired fenced claim without changing its selected generation or policy', async () => {
    const { store, vector, runbooks } = await setupCatalog();
    const embedder = new DeterministicRunbookEmbedder();
    const kind = 'unknown_device_login' as const;
    const runbook = runbooks.find(item => item.metadata.incidentKinds[0] === kind) as LoadedRunbook;
    try {
      await indexRunbook(store, vector, embedder, runbook, {
        generationId: 'generation-lease-a',
        now: '2026-08-27T12:00:00.000Z',
      });
      await seedIncident(store, kind, 50);
      const input = retrievalInput(kind, 50);
      const generation = await resolveEligibleGeneration(store, kind);
      expect(generation).toBeDefined();
      await claimRetrievalSelection(
        store,
        {
          ...input,
          queryHash: sha256(input.queryText),
          threshold: 0.5,
          topK: 2,
        },
        generation,
        {
          clock: fixedClock('2026-08-27T12:01:00.000Z'),
          ids: sequenceIdGenerator(['retrieval-crashed']),
        },
      );
      await expect(
        retrieveRunbook(store, vector, embedder, input, {
          threshold: 0.5,
          topK: 2,
          clock: fixedClock('2026-08-27T12:01:30.000Z'),
        }),
      ).rejects.toMatchObject({ code: 'RUNBOOK_INTEGRITY_FAILED' });

      await indexRunbook(store, vector, embedder, runbook, {
        generationId: 'generation-lease-b',
        now: '2026-08-27T12:01:45.000Z',
      });
      const recovered = await retrieveRunbook(store, vector, embedder, input, {
        threshold: 0.5,
        topK: 2,
        clock: fixedClock('2026-08-27T12:02:01.000Z'),
        ids: sequenceIdGenerator(['timeline-recovered']),
      });
      expect(recovered).toMatchObject({
        retrievalId: 'retrieval-crashed',
        generationId: 'generation-lease-a',
      });
      const row = await store.execute({
        sql: `SELECT status, generation_id, threshold, top_k, attempt,
          lease_token, lease_expires_at FROM runbook_retrievals
          WHERE retrieval_id = 'retrieval-crashed'`,
      });
      expect(row.rows[0]).toMatchObject({
        status: 'succeeded',
        generation_id: 'generation-lease-a',
        threshold: '0.5',
        top_k: 2,
        attempt: 2,
        lease_token: null,
        lease_expires_at: null,
      });
    } finally {
      store.close();
    }
  });

  it('recovers after the success transaction fails and fences the abandoned owner', async () => {
    const { store, vector, runbooks } = await setupCatalog();
    const embedder = new DeterministicRunbookEmbedder();
    const kind = 'disallowed_country_login' as const;
    const runbook = runbooks.find(item => item.metadata.incidentKinds[0] === kind) as LoadedRunbook;
    try {
      await indexRunbook(store, vector, embedder, runbook, {
        generationId: 'generation-fenced-success',
        now: '2026-08-27T12:00:00.000Z',
      });
      await seedIncident(store, kind, 60);
      const failingStore = failNextSuccessfulRetrievalCommit(store);
      await expect(
        retrieveRunbook(failingStore, vector, embedder, retrievalInput(kind, 60), {
          clock: fixedClock('2026-08-27T12:01:00.000Z'),
          ids: sequenceIdGenerator(['retrieval-fenced', 'timeline-fenced']),
        }),
      ).rejects.toBeDefined();
      const abandoned = await store.execute({
        sql: `SELECT status, attempt FROM runbook_retrievals
          WHERE retrieval_id = 'retrieval-fenced'`,
      });
      expect(abandoned.rows[0]).toEqual({ status: 'in_progress', attempt: 1 });

      const recovered = await retrieveRunbook(store, vector, embedder, retrievalInput(kind, 60), {
        clock: fixedClock('2026-08-27T12:02:01.000Z'),
        ids: sequenceIdGenerator(['timeline-fenced-recovered']),
      });
      expect(recovered).toMatchObject({
        retrievalId: 'retrieval-fenced',
        generationId: 'generation-fenced-success',
      });
    } finally {
      store.close();
    }
  });

  it('allows only the renewed fence to finalize when the original owner resumes', async () => {
    const { store, vector, runbooks } = await setupCatalog();
    const embedder = new DeterministicRunbookEmbedder();
    const kind = 'unauthorized_privilege_change' as const;
    const runbook = runbooks.find(item => item.metadata.incidentKinds[0] === kind) as LoadedRunbook;
    try {
      await indexRunbook(store, vector, embedder, runbook, {
        generationId: 'generation-fence-owner',
        now: '2026-08-27T12:00:00.000Z',
      });
      await seedIncident(store, kind, 70);
      vector.pauseNextQuery();
      const original = retrieveRunbook(store, vector, embedder, retrievalInput(kind, 70), {
        clock: fixedClock('2026-08-27T12:01:00.000Z'),
        ids: sequenceIdGenerator(['retrieval-fence-owner', 'timeline-stale-owner']),
      });
      await vector.queryEntered;
      const renewed = await retrieveRunbook(store, vector, embedder, retrievalInput(kind, 70), {
        clock: fixedClock('2026-08-27T12:02:01.000Z'),
        ids: sequenceIdGenerator(['timeline-current-owner']),
      });
      expect(renewed.retrievalId).toBe('retrieval-fence-owner');
      vector.releaseQuery();
      await expect(original).rejects.toMatchObject({ code: 'CONFLICT' });
      const final = await store.execute({
        sql: `SELECT status, attempt FROM runbook_retrievals
          WHERE retrieval_id = 'retrieval-fence-owner'`,
      });
      expect(final.rows[0]).toEqual({ status: 'succeeded', attempt: 2 });
    } finally {
      store.close();
    }
  });

  it('applies the deterministic tie-break across every eligible chunk before top-K', async () => {
    const { store, vector, runbooks } = await setupCatalog();
    const embedder = new DeterministicRunbookEmbedder();
    const kind = 'unknown_device_login' as const;
    const runbook = runbooks.find(item => item.metadata.incidentKinds[0] === kind) as LoadedRunbook;
    try {
      const indexed = await indexRunbook(store, vector, embedder, runbook, {
        generationId: 'generation-global-tie-break',
        now: '2026-08-27T12:00:00.000Z',
      });
      const authoritative = await store.execute({
        sql: `SELECT chunk_id FROM runbook_chunks WHERE generation_id = ?
          ORDER BY section_ordinal, chunk_ordinal, chunk_id`,
        args: [indexed.generationId],
      });
      await seedIncident(store, kind, 80);
      vector.reverseQueryOrder = true;
      vector.equalScores = true;
      const result = await retrieveRunbook(store, vector, embedder, retrievalInput(kind, 80), {
        threshold: 0.5,
        topK: 3,
        clock: fixedClock('2026-08-27T12:01:00.000Z'),
        ids: sequenceIdGenerator(['retrieval-tie', 'timeline-tie']),
      });
      expect(result.chunkIds).toEqual(authoritative.rows.slice(0, 3).map(row => row.chunk_id));
      expect(vector.queryTopKs.at(-1)).toBe(indexed.chunkCount);
    } finally {
      store.close();
    }
  });

  it('fails closed when an active vector index loses a non-top-K chunk', async () => {
    const { store, vector, runbooks } = await setupCatalog();
    const embedder = new DeterministicRunbookEmbedder();
    const kind = 'disallowed_country_login' as const;
    const runbook = runbooks.find(item => item.metadata.incidentKinds[0] === kind) as LoadedRunbook;
    try {
      const indexed = await indexRunbook(store, vector, embedder, runbook, {
        generationId: 'generation-partial-index',
        now: '2026-08-27T12:00:00.000Z',
      });
      const index = vector.indexes.get(indexed.indexName);
      const removedId = [...(index?.rows.keys() ?? [])].at(-1);
      expect(removedId).toBeDefined();
      index?.rows.delete(String(removedId));
      await seedIncident(store, kind, 90);
      await expect(
        retrieveRunbook(store, vector, embedder, retrievalInput(kind, 90), {
          threshold: 0.5,
          topK: 3,
          clock: fixedClock('2026-08-27T12:01:00.000Z'),
          ids: sequenceIdGenerator(['retrieval-partial', 'timeline-partial']),
        }),
      ).rejects.toMatchObject({ code: 'RUNBOOK_INTEGRITY_FAILED' });
      const persisted = await store.execute({
        sql: `SELECT status, error_code,
          (SELECT count(*) FROM runbook_retrieval_chunks c
            WHERE c.retrieval_id = r.retrieval_id) AS chunks
          FROM runbook_retrievals r WHERE retrieval_id = 'retrieval-partial'`,
      });
      expect(persisted.rows[0]).toEqual({
        status: 'failed',
        error_code: 'RUNBOOK_INTEGRITY_FAILED',
        chunks: 0,
      });
    } finally {
      store.close();
    }
  });
});

class MemoryVectorStore implements RunbookVectorStore {
  readonly indexes = new Map<
    string,
    {
      dimension: number;
      rows: Map<string, { vector: number[]; metadata: Record<string, unknown> }>;
    }
  >();
  readonly queries: string[] = [];
  readonly queryTopKs: number[] = [];
  tamperMetadata = false;
  failQuery = false;
  failUpsert = false;
  score = 0.95;
  equalScores = false;
  reverseQueryOrder = false;
  metadataMutation?: (metadata: Record<string, unknown>) => Record<string, unknown>;
  private pausedQuery = false;
  private queryRelease = () => {};
  queryEntered: Promise<void> = Promise.resolve();
  private markQueryEntered = () => {};

  pauseNextQuery(): void {
    this.pausedQuery = true;
    this.queryEntered = new Promise<void>(resolve => {
      this.markQueryEntered = resolve;
    });
  }

  releaseQuery(): void {
    this.queryRelease();
  }

  async ensureIndex(indexName: string, dimension: number): Promise<void> {
    const current = this.indexes.get(indexName);
    if (current && current.dimension !== dimension) throw new Error('dimension');
    this.indexes.set(indexName, current ?? { dimension, rows: new Map() });
  }
  async upsert(
    indexName: string,
    ids: readonly string[],
    vectors: readonly (readonly number[])[],
    metadata: readonly Record<string, unknown>[],
  ): Promise<void> {
    if (this.failUpsert) throw new Error('upsert unavailable');
    const index = this.indexes.get(indexName);
    if (!index) throw new Error('missing index');
    ids.forEach((id, offset) => {
      index.rows.set(id, {
        vector: [...(vectors[offset] ?? [])],
        metadata: { ...(metadata[offset] ?? {}) },
      });
    });
  }
  async query(indexName: string, _vector: readonly number[], topK: number): Promise<readonly VectorMatch[]> {
    this.queries.push(indexName);
    this.queryTopKs.push(topK);
    if (this.pausedQuery) {
      this.pausedQuery = false;
      this.markQueryEntered();
      await new Promise<void>(resolve => {
        this.queryRelease = resolve;
      });
    }
    if (this.failQuery) throw new Error('backend unavailable');
    const index = this.indexes.get(indexName);
    if (!index) throw new Error('missing index');
    const rows = [...index.rows.entries()];
    if (this.reverseQueryOrder) rows.reverse();
    return rows.slice(0, topK).map(([id, row], offset) => ({
      id,
      score: this.equalScores ? this.score : this.score - offset * 0.01,
      metadata: this.metadataMutation
        ? this.metadataMutation({ ...row.metadata })
        : this.tamperMetadata
          ? { ...row.metadata, sourceHash: 'f'.repeat(64) }
          : { ...row.metadata },
    }));
  }
  async describe(indexName: string) {
    const index = this.indexes.get(indexName);
    if (!index) throw new Error('missing index');
    return { dimension: index.dimension, count: index.rows.size };
  }
  async deleteIndex(indexName: string): Promise<void> {
    this.indexes.delete(indexName);
  }
  async close(): Promise<void> {}
}

class CountingEmbedder extends DeterministicRunbookEmbedder {
  queryCalls = 0;
  override async embedQuery(value: string): Promise<readonly number[]> {
    this.queryCalls += 1;
    return super.embedQuery(value);
  }
}

class BarrierEmbedder extends DeterministicRunbookEmbedder {
  private arrivals = 0;
  private release = () => {};
  private readonly barrier = new Promise<void>(resolve => {
    this.release = resolve;
  });

  override async embedDocuments(values: readonly string[]): Promise<readonly number[][]> {
    this.arrivals += 1;
    if (this.arrivals === 2) this.release();
    await this.barrier;
    return super.embedDocuments(values);
  }
}

class ControlledEmbedder extends DeterministicRunbookEmbedder {
  private enteredResolve = () => {};
  readonly entered = new Promise<void>(resolve => {
    this.enteredResolve = resolve;
  });
  private releaseResolve = () => {};
  private readonly released = new Promise<void>(resolve => {
    this.releaseResolve = resolve;
  });

  release(): void {
    this.releaseResolve();
  }

  override async embedDocuments(values: readonly string[]): Promise<readonly number[][]> {
    this.enteredResolve();
    await this.released;
    return super.embedDocuments(values);
  }
}

async function setupCatalog() {
  const database = await createTempDatabase();
  databases.push(database);
  const store = database.createStore();
  await migrateOperationalStore(store, {
    appliedAt: '2026-08-27T12:00:00.000Z',
  });
  return {
    store,
    vector: new MemoryVectorStore(),
    runbooks: await loadRunbooks(runbookRoot),
  };
}

async function seedIncident(store: OperationalStore, kind: IncidentKind, ordinal: number) {
  await createIncidentFromAlert(
    store,
    makeAlert({
      alertId: `alert-rag-${ordinal}`,
      sourceEventId: `source-rag-${ordinal}`,
      idempotencyKey: `key-rag-${ordinal}`,
      kind,
    }),
    {
      clock: fixedClock('2026-08-27T12:00:00.000Z'),
      ids: sequenceIdGenerator([`incident-rag-${ordinal}`, `timeline-${ordinal}`, `outbox-${ordinal}`]),
    },
  );
  await store.execute({
    sql: `INSERT INTO workflow_runs(
      id, incident_id, tenant_id, run_id, workflow_id, status, started_at
    ) VALUES (?, ?, 'tenant-1', ?, 'security-incident-workflow', 'running',
      '2026-08-27T12:00:00.000Z')`,
    args: [`workflow-marker-rag-${ordinal}`, `incident-rag-${ordinal}`, `run-rag-${ordinal}`],
  });
}

function retrievalInput(kind: IncidentKind, ordinal: number) {
  return {
    incidentId: `incident-rag-${ordinal}`,
    tenantId: 'tenant-1',
    workflowRunId: `run-rag-${ordinal}`,
    correlationId: `correlation-rag-${ordinal}`,
    incidentKind: kind,
    queryText: `identity security incident ${kind.replaceAll('_', ' ')}`,
  };
}

function failNextSuccessfulRetrievalCommit(store: OperationalStore): OperationalStore {
  let shouldFail = true;
  return {
    execute: statement => store.execute(statement),
    transaction: <T>(fn: (tx: StoreTransaction) => Promise<T>) =>
      store.transaction(tx =>
        fn({
          execute: async statement => {
            if (shouldFail && statement.sql.includes("SET status = 'succeeded'")) {
              shouldFail = false;
              throw new Error('simulated success commit failure');
            }
            return tx.execute(statement);
          },
          batch: statements => tx.batch(statements),
        }),
      ),
    close: () => {},
  };
}
