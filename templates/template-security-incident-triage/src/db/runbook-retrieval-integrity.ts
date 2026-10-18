import { DomainError } from '../domain/errors.js';
import type { RunbookErrorCode } from '../mastra/knowledge/errors.js';
import { canonicalJson, sha256 } from '../mastra/knowledge/hashes.js';
import type { RunbookChunkMetadata } from '../mastra/knowledge/schemas.js';
import type { EligibleGeneration } from './runbook-operations.js';
import type { StoreTransaction } from './operational-store.js';
import type { PersistedSelection, RetrievalScope } from './runbook-retrieval-types.js';

const POLICY_VERSION = 1;
const RETRIEVAL_LEASE_MS = 60_000;

export const selectionQuery = `SELECT r.*, g.index_name AS current_index_name,
  g.chunk_count AS current_chunk_count, g.aggregate_hash AS current_aggregate_hash,
  g.incident_kind AS current_incident_kind, v.source_hash AS current_source_hash,
  v.allowed_actions_json AS current_allowed_actions_json,
  v.mandatory_rules_json AS current_mandatory_rules_json
  FROM runbook_retrievals r
  LEFT JOIN runbook_generations g ON g.generation_id = r.generation_id
    AND g.runbook_id = r.runbook_id AND g.version = r.version
    AND g.incident_kind = r.incident_kind
  LEFT JOIN runbook_versions v ON v.runbook_id = r.runbook_id AND v.version = r.version`;

export function validateSelectionRow(row: Record<string, unknown>, input: RetrievalScope): PersistedSelection {
  if (
    typeof row.retrieval_id !== 'string' ||
    typeof row.runbook_id !== 'string' ||
    typeof row.version !== 'string' ||
    typeof row.generation_id !== 'string' ||
    typeof row.index_name !== 'string' ||
    typeof row.source_hash !== 'string' ||
    typeof row.generation_aggregate_hash !== 'string' ||
    typeof row.allowed_actions_json !== 'string' ||
    typeof row.mandatory_rules_json !== 'string' ||
    typeof row.citation !== 'string' ||
    typeof row.selected_at !== 'string' ||
    typeof row.selection_integrity_hash !== 'string' ||
    row.tenant_id !== input.tenantId ||
    row.incident_id !== input.incidentId ||
    row.workflow_run_id !== input.workflowRunId ||
    row.correlation_id !== input.correlationId ||
    row.incident_kind !== input.incidentKind ||
    row.query_hash !== input.queryHash ||
    row.threshold !== input.threshold.toString() ||
    Number(row.top_k) !== input.topK ||
    Number(row.policy_version) !== POLICY_VERSION ||
    row.index_name !== row.current_index_name ||
    row.source_hash !== row.current_source_hash ||
    row.generation_aggregate_hash !== row.current_aggregate_hash ||
    row.allowed_actions_json !== row.current_allowed_actions_json ||
    row.mandatory_rules_json !== row.current_mandatory_rules_json ||
    row.incident_kind !== row.current_incident_kind ||
    row.citation !== canonicalCitation(row.runbook_id, row.version)
  ) {
    throw new DomainError('VALIDATION_FAILED');
  }
  const generation: EligibleGeneration = {
    incidentKind: row.incident_kind as EligibleGeneration['incidentKind'],
    runbookId: row.runbook_id,
    version: row.version,
    generationId: row.generation_id,
    indexName: row.index_name,
    revision: Number(row.activation_revision),
    chunkCount: Number(row.current_chunk_count),
    aggregateHash: row.generation_aggregate_hash,
    allowedActionsJson: row.allowed_actions_json,
    mandatoryRulesJson: row.mandatory_rules_json,
    sourceHash: row.source_hash,
  };
  const expectedHash = selectionIntegrityHash(row.retrieval_id, generation, row.citation, input, row.selected_at);
  if (expectedHash !== row.selection_integrity_hash) throw new DomainError('VALIDATION_FAILED');
  const attempt = Number(row.attempt);
  if (!Number.isInteger(attempt) || attempt < 1) throw new DomainError('VALIDATION_FAILED');
  if (row.status === 'in_progress') {
    if (
      typeof row.lease_token !== 'string' ||
      typeof row.lease_expires_at !== 'string' ||
      row.lease_token !== retrievalLeaseToken(row.retrieval_id, attempt, retrievalLeaseStart(row.lease_expires_at))
    ) {
      throw new DomainError('VALIDATION_FAILED');
    }
  } else if (row.lease_token !== null || row.lease_expires_at !== null) {
    throw new DomainError('VALIDATION_FAILED');
  }
  return {
    retrievalId: row.retrieval_id,
    generation,
    citation: row.citation,
    selectedAt: row.selected_at,
    selectionIntegrityHash: row.selection_integrity_hash,
    attempt,
    ...(typeof row.lease_token === 'string' ? { leaseToken: row.lease_token } : {}),
    ...(typeof row.lease_expires_at === 'string' ? { leaseExpiresAt: row.lease_expires_at } : {}),
  };
}

export function selectionIntegrityHash(
  retrievalId: string,
  generation: EligibleGeneration,
  citation: string,
  input: RetrievalScope,
  selectedAt: string,
): string {
  return sha256(
    canonicalJson({
      retrievalId,
      tenantId: input.tenantId,
      incidentId: input.incidentId,
      workflowRunId: input.workflowRunId,
      correlationId: input.correlationId,
      incidentKind: generation.incidentKind,
      runbookId: generation.runbookId,
      version: generation.version,
      generationId: generation.generationId,
      indexName: generation.indexName,
      activationRevision: generation.revision,
      sourceHash: generation.sourceHash,
      generationAggregateHash: generation.aggregateHash,
      allowedActionsJson: generation.allowedActionsJson,
      mandatoryRulesJson: generation.mandatoryRulesJson,
      citation,
      queryHash: input.queryHash,
      threshold: input.threshold.toString(),
      topK: input.topK,
      policyVersion: POLICY_VERSION,
      selectedAt,
    }),
  );
}

export function successfulIntegrityHash(
  selection: PersistedSelection,
  input: RetrievalScope,
  chunks: readonly Record<string, unknown>[],
): string {
  return sha256(
    canonicalJson({
      selection: selectionIntegrityHash(
        selection.retrievalId,
        selection.generation,
        selection.citation,
        input,
        selection.selectedAt,
      ),
      runbookId: selection.generation.runbookId,
      version: selection.generation.version,
      generationId: selection.generation.generationId,
      citation: selection.citation,
      attempt: selection.attempt,
      chunks,
    }),
  );
}

export function failedIntegrityHash(
  retrievalId: string,
  selectionIntegrityHashValue: string | null,
  errorCode: RunbookErrorCode,
  queryHash: string,
  finishedAt: string,
  status: 'failed' | 'manual_review',
  attempt: number,
): string {
  return sha256(
    canonicalJson({
      retrievalId,
      selection: selectionIntegrityHashValue,
      errorCode,
      queryHash,
      finishedAt,
      status,
      attempt,
    }),
  );
}

export function canonicalCitation(runbookId: string, version: string): string {
  return `[runbook:${runbookId}@${version}]`;
}

export function retrievalLeaseToken(retrievalId: string, attempt: number, leasedAt: string): string {
  return sha256(`runbook-retrieval-lease-v1\0${retrievalId}\0${attempt}\0${leasedAt}`);
}

export function retrievalLeaseExpiry(leasedAt: string): string {
  const timestamp = Date.parse(leasedAt);
  if (!Number.isFinite(timestamp)) throw new DomainError('VALIDATION_FAILED');
  return new Date(timestamp + RETRIEVAL_LEASE_MS).toISOString();
}

function retrievalLeaseStart(leaseExpiresAt: string): string {
  const timestamp = Date.parse(leaseExpiresAt);
  if (!Number.isFinite(timestamp)) throw new DomainError('VALIDATION_FAILED');
  return new Date(timestamp - RETRIEVAL_LEASE_MS).toISOString();
}

export async function assertCurrentSelection(tx: StoreTransaction, generation: EligibleGeneration): Promise<void> {
  const current = await tx.execute({
    sql: `SELECT a.generation_id, a.revision, g.index_name, g.chunk_count,
      g.aggregate_hash, g.state, v.source_hash, v.allowed_actions_json, v.mandatory_rules_json,
      v.declared_status FROM runbook_activations a
      JOIN runbook_generations g ON g.generation_id = a.generation_id
      JOIN runbook_versions v ON v.runbook_id = g.runbook_id AND v.version = g.version
      WHERE a.incident_kind = ?`,
    args: [generation.incidentKind],
  });
  const row = current.rows[0];
  if (
    !row ||
    row.generation_id !== generation.generationId ||
    Number(row.revision) !== generation.revision ||
    row.index_name !== generation.indexName ||
    Number(row.chunk_count) !== generation.chunkCount ||
    row.aggregate_hash !== generation.aggregateHash ||
    row.source_hash !== generation.sourceHash ||
    row.allowed_actions_json !== generation.allowedActionsJson ||
    row.mandatory_rules_json !== generation.mandatoryRulesJson ||
    row.state !== 'active' ||
    row.declared_status !== 'active'
  ) {
    throw new DomainError('CONFLICT');
  }
}

export async function assertCleanupNotClaimed(tx: StoreTransaction, generationId: string): Promise<void> {
  const cleanup = await tx.execute({
    sql: `SELECT status FROM runbook_generation_cleanup_claims
      WHERE generation_id = ?`,
    args: [generationId],
  });
  if (cleanup.rows[0]) throw new DomainError('CONFLICT');
}

export function recomputeMetadataHash(metadata: RunbookChunkMetadata): string {
  const unsigned: Partial<RunbookChunkMetadata> = { ...metadata };
  delete unsigned.metadataHash;
  return sha256(canonicalJson(unsigned));
}
