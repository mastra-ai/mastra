import { DomainError } from '../domain/errors.js';
import type { IncidentKind } from '../schemas/incident.js';
import type { PreparedChunk } from '../mastra/knowledge/chunker.js';
import { RunbookError } from '../mastra/knowledge/errors.js';
import type { LoadedRunbook } from '../mastra/knowledge/loader.js';
import {
  CHUNKING_ALGORITHM_VERSION,
  EMBEDDING_DIMENSION,
  EMBEDDING_MODEL,
  EMBEDDING_PROVIDER,
  RUNBOOK_SCHEMA_VERSION,
} from '../mastra/knowledge/schemas.js';
import type { OperationalStore } from './operational-store.js';
import type { EligibleGeneration } from './runbook-generation-types.js';

export {
  activateRunbookGeneration,
  resolveRollbackGeneration,
  rollbackRunbookGenerationCas,
} from './runbook-activation-operations.js';
export {
  claimRunbookGenerationCleanup,
  completeRunbookGenerationCleanup,
  revalidateRunbookGenerationCleanup,
} from './runbook-cleanup-operations.js';
export type { CleanupGenerationInput, EligibleGeneration } from './runbook-generation-types.js';

export async function stageRunbookGeneration(
  store: OperationalStore,
  input: Readonly<{
    runbook: LoadedRunbook;
    generationId: string;
    indexName: string;
    aggregateHash: string;
    chunks: readonly PreparedChunk[];
    createdAt: string;
  }>,
): Promise<'created' | 'existing'> {
  const kind = input.runbook.metadata.incidentKinds[0];
  if (!kind) throw new DomainError('VALIDATION_FAILED');
  return store.transaction(async tx => {
    const version = await tx.execute({
      sql: `SELECT source_hash, parsed_hash, allowed_actions_json, mandatory_rules_json FROM runbook_versions
        WHERE runbook_id = ? AND version = ?`,
      args: [input.runbook.metadata.id, input.runbook.metadata.version],
    });
    const allowedActionsJson = JSON.stringify(input.runbook.allowedActions);
    const mandatoryRulesJson = JSON.stringify(input.runbook.metadata.mandatoryRules);
    if (version.rows[0]) {
      if (
        version.rows[0].source_hash !== input.runbook.sourceHash ||
        version.rows[0].parsed_hash !== input.runbook.parsedHash ||
        version.rows[0].allowed_actions_json !== allowedActionsJson ||
        version.rows[0].mandatory_rules_json !== mandatoryRulesJson
      )
        throw new DomainError('CONFLICT');
    } else {
      await tx.execute({
        sql: `INSERT INTO runbook_versions(
          runbook_id, version, owner, declared_status, source_path, source_hash,
          parsed_hash, schema_version, chunking_algorithm_version,
          embedding_provider, embedding_model, embedding_dimension,
          allowed_actions_json, mandatory_rules_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          input.runbook.metadata.id,
          input.runbook.metadata.version,
          input.runbook.metadata.owner,
          input.runbook.metadata.status,
          input.runbook.sourcePath,
          input.runbook.sourceHash,
          input.runbook.parsedHash,
          RUNBOOK_SCHEMA_VERSION,
          CHUNKING_ALGORITHM_VERSION,
          EMBEDDING_PROVIDER,
          EMBEDDING_MODEL,
          EMBEDDING_DIMENSION,
          allowedActionsJson,
          mandatoryRulesJson,
          input.createdAt,
        ],
      });
    }
    const existing = await tx.execute({
      sql: `SELECT runbook_id, version, incident_kind, index_name, state, chunk_count,
        aggregate_hash, error_code FROM runbook_generations WHERE generation_id = ?`,
      args: [input.generationId],
    });
    if (existing.rows[0]) {
      const row = existing.rows[0];
      if (
        row.runbook_id !== input.runbook.metadata.id ||
        row.version !== input.runbook.metadata.version ||
        row.incident_kind !== kind ||
        row.index_name !== input.indexName ||
        Number(row.chunk_count) !== input.chunks.length ||
        row.aggregate_hash !== input.aggregateHash ||
        !['staged', 'active', 'failed'].includes(String(row.state)) ||
        (row.state === 'failed' && row.error_code !== 'RUNBOOK_BACKEND_UNAVAILABLE')
      )
        throw new DomainError('CONFLICT');
      if (row.state === 'failed') {
        const cleanup = await tx.execute({
          sql: `SELECT 1 FROM runbook_generation_cleanup_claims
            WHERE generation_id = ?`,
          args: [input.generationId],
        });
        if (cleanup.rows[0]) throw new DomainError('CONFLICT');
        await tx.execute({
          sql: `UPDATE runbook_generations SET state = 'staged', error_code = NULL
            WHERE generation_id = ? AND state = 'failed'
              AND error_code = 'RUNBOOK_BACKEND_UNAVAILABLE'`,
          args: [input.generationId],
        });
      }
      return 'existing';
    }
    await tx.execute({
      sql: `INSERT INTO runbook_generations(
        generation_id, runbook_id, version, incident_kind, index_name, state,
        chunk_count, aggregate_hash, created_at
      ) VALUES (?, ?, ?, ?, ?, 'staged', ?, ?, ?)`,
      args: [
        input.generationId,
        input.runbook.metadata.id,
        input.runbook.metadata.version,
        kind,
        input.indexName,
        input.chunks.length,
        input.aggregateHash,
        input.createdAt,
      ],
    });
    for (const chunk of input.chunks) {
      await tx.execute({
        sql: `INSERT INTO runbook_chunks(
          generation_id, chunk_id, vector_id, runbook_id, version, incident_kind,
          section_key, section_ordinal, chunk_ordinal, text, content_hash,
          metadata_hash, metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          input.generationId,
          chunk.id,
          chunk.metadata.vectorId,
          input.runbook.metadata.id,
          input.runbook.metadata.version,
          kind,
          chunk.metadata.sectionKey,
          chunk.metadata.sectionOrdinal,
          chunk.metadata.chunkOrdinal,
          chunk.text,
          chunk.metadata.contentHash,
          chunk.metadata.metadataHash,
          JSON.stringify(chunk.metadata),
        ],
      });
    }
    return 'created';
  });
}

export async function markRunbookChunksIndexed(
  store: OperationalStore,
  generationId: string,
  indexedAt: string,
): Promise<void> {
  await store.transaction(async tx => {
    await tx.execute({
      sql: `UPDATE runbook_chunks SET indexed_at = COALESCE(indexed_at, ?)
        WHERE generation_id = ?`,
      args: [indexedAt, generationId],
    });
  });
}

export async function markRunbookGenerationFailed(
  store: OperationalStore,
  generationId: string,
  errorCode: 'RUNBOOK_BACKEND_UNAVAILABLE' | 'RUNBOOK_INELIGIBLE' | 'RUNBOOK_INTEGRITY_FAILED',
): Promise<void> {
  await store.transaction(async tx => {
    await tx.execute({
      sql: `UPDATE runbook_generations SET state = 'failed', error_code = ?
        WHERE generation_id = ? AND state = 'staged'`,
      args: [errorCode, generationId],
    });
  });
}

export async function getActivationRevision(store: OperationalStore, kind: IncidentKind): Promise<number> {
  const result = await store.execute({
    sql: 'SELECT revision FROM runbook_activations WHERE incident_kind = ?',
    args: [kind],
  });
  return result.rows[0] ? Number(result.rows[0].revision) : 0;
}

export async function resolveEligibleGeneration(
  store: OperationalStore,
  kind: IncidentKind,
): Promise<EligibleGeneration | undefined> {
  const result = await store.execute({
    sql: `SELECT a.incident_kind, a.runbook_id, a.version, a.generation_id,
      a.revision, g.index_name, g.chunk_count, g.aggregate_hash,
      g.state, v.declared_status, v.allowed_actions_json, v.mandatory_rules_json, v.source_hash
      FROM runbook_activations a
      JOIN runbook_generations g ON g.generation_id = a.generation_id
        AND g.runbook_id = a.runbook_id AND g.version = a.version
        AND g.incident_kind = a.incident_kind
      JOIN runbook_versions v ON v.runbook_id = a.runbook_id AND v.version = a.version
      WHERE a.incident_kind = ?`,
    args: [kind],
  });
  if (result.rows.length === 0) return undefined;
  if (result.rows.length !== 1) throw new RunbookError('RUNBOOK_AMBIGUOUS');
  const row = result.rows[0];
  if (row?.state !== 'active' || row.declared_status !== 'active') throw new DomainError('CONFLICT');
  return {
    incidentKind: row.incident_kind as IncidentKind,
    runbookId: String(row.runbook_id),
    version: String(row.version),
    generationId: String(row.generation_id),
    indexName: String(row.index_name),
    revision: Number(row.revision),
    chunkCount: Number(row.chunk_count),
    aggregateHash: String(row.aggregate_hash),
    allowedActionsJson: String(row.allowed_actions_json),
    mandatoryRulesJson: String(row.mandatory_rules_json),
    sourceHash: String(row.source_hash),
  };
}
