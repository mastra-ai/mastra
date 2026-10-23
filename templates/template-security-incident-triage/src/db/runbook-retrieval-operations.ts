import type { Clock } from '../domain/clock.js';
import { systemClock } from '../domain/clock.js';
import { DomainError } from '../domain/errors.js';
import type { IdGenerator } from '../domain/id-generator.js';
import { uuidGenerator } from '../domain/id-generator.js';
import type { RunbookErrorCode } from '../mastra/knowledge/errors.js';
import type { OperationalStore } from './operational-store.js';
import {
  assertCleanupNotClaimed,
  failedIntegrityHash,
  selectionQuery,
  successfulIntegrityHash,
  validateSelectionRow,
} from './runbook-retrieval-integrity.js';
import { appendRetrievalTimeline } from './runbook-retrieval-timeline.js';
import type { PersistedRetrievalChunk, PersistedSelection, RetrievalScope } from './runbook-retrieval-types.js';

export { claimRetrievalSelection } from './runbook-retrieval-claim.js';
export { findSuccessfulRetrieval, listAuthoritativeChunks } from './runbook-retrieval-read.js';
export type {
  AuthoritativeChunk,
  PersistedRetrievalChunk,
  PersistedSelection,
  RetrievalScope,
} from './runbook-retrieval-types.js';

export async function persistSuccessfulRetrieval(
  store: OperationalStore,
  input: RetrievalScope &
    Readonly<{
      selection: PersistedSelection;
      chunks: readonly PersistedRetrievalChunk[];
    }>,
  dependencies: Readonly<{ clock?: Clock; ids?: IdGenerator }> = {},
): Promise<string> {
  const timelineId = (dependencies.ids ?? uuidGenerator).next();
  const now = (dependencies.clock ?? systemClock).now();
  const integrityChunks = input.chunks.map(chunk => ({
    id: chunk.metadata.chunkId,
    vectorId: chunk.metadata.vectorId,
    rank: chunk.rank,
    score: chunk.score.toString(),
    contentHash: chunk.contentHash,
    metadataHash: chunk.metadataHash,
    sectionOrdinal: chunk.metadata.sectionOrdinal,
    chunkOrdinal: chunk.metadata.chunkOrdinal,
  }));
  const aggregate = successfulIntegrityHash(input.selection, input, integrityChunks);
  return store.transaction(async tx => {
    if (!input.selection.leaseToken || !input.selection.leaseExpiresAt) {
      throw new DomainError('CONFLICT');
    }
    await assertCleanupNotClaimed(tx, input.selection.generation.generationId);
    const current = await tx.execute({
      sql: `${selectionQuery} WHERE r.retrieval_id = ?`,
      args: [input.selection.retrievalId],
    });
    if (
      !current.rows[0] ||
      current.rows[0].status !== 'in_progress' ||
      current.rows[0].lease_token !== input.selection.leaseToken ||
      Number(current.rows[0].attempt) !== input.selection.attempt ||
      current.rows[0].lease_expires_at !== input.selection.leaseExpiresAt ||
      input.selection.leaseExpiresAt <= now ||
      validateSelectionRow(current.rows[0], input).selectionIntegrityHash !== input.selection.selectionIntegrityHash
    ) {
      throw new DomainError('CONFLICT');
    }
    for (const chunk of input.chunks) {
      await tx.execute({
        sql: `INSERT INTO runbook_retrieval_chunks(
          retrieval_id, rank, generation_id, chunk_id, vector_id, content_hash,
          metadata_hash, score_text, score, section_ordinal, chunk_ordinal
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          input.selection.retrievalId,
          chunk.rank,
          input.selection.generation.generationId,
          chunk.metadata.chunkId,
          chunk.metadata.vectorId,
          chunk.contentHash,
          chunk.metadataHash,
          chunk.score.toString(),
          chunk.score,
          chunk.metadata.sectionOrdinal,
          chunk.metadata.chunkOrdinal,
        ],
      });
    }
    const finished = await tx.execute({
      sql: `UPDATE runbook_retrievals SET status = 'succeeded', finished_at = ?,
        lease_token = NULL, lease_expires_at = NULL, aggregate_integrity_hash = ?
        WHERE retrieval_id = ? AND status = 'in_progress' AND attempt = ?
          AND lease_token = ? AND lease_expires_at > ?`,
      args: [now, aggregate, input.selection.retrievalId, input.selection.attempt, input.selection.leaseToken, now],
    });
    if (finished.rowsAffected !== 1) throw new DomainError('CONFLICT');
    await appendRetrievalTimeline(tx, {
      timelineId,
      type: 'runbook.retrieved',
      now,
      input,
      payload: {
        retrievalId: input.selection.retrievalId,
        runbookId: input.selection.generation.runbookId,
        version: input.selection.generation.version,
        generationId: input.selection.generation.generationId,
        chunkIds: input.chunks.map(chunk => chunk.metadata.chunkId).join(','),
      },
    });
    return input.selection.retrievalId;
  });
}

export async function persistFailedRetrieval(
  store: OperationalStore,
  input: RetrievalScope &
    Readonly<{
      errorCode: RunbookErrorCode;
      selection?: PersistedSelection;
    }>,
  dependencies: Readonly<{ clock?: Clock; ids?: IdGenerator }> = {},
): Promise<string> {
  const ids = dependencies.ids ?? uuidGenerator;
  const retrievalId = input.selection?.retrievalId ?? ids.next();
  const timelineId = ids.next();
  const now = (dependencies.clock ?? systemClock).now();
  const status = input.errorCode === 'RUNBOOK_SCORE_INSUFFICIENT' ? 'manual_review' : 'failed';
  const aggregate = failedIntegrityHash(
    retrievalId,
    input.selection?.selectionIntegrityHash ?? null,
    input.errorCode,
    input.queryHash,
    now,
    status,
    input.selection?.attempt ?? 0,
  );
  return store.transaction(async tx => {
    const existing = await tx.execute({
      sql: `${selectionQuery}
        WHERE r.tenant_id = ? AND r.incident_id = ? AND r.workflow_run_id = ?
          AND r.query_hash = ? AND r.policy_version = 1`,
      args: [input.tenantId, input.incidentId, input.workflowRunId, input.queryHash],
    });
    if (existing.rows[0]) {
      if (!input.selection) {
        if (existing.rows[0].error_code !== input.errorCode) throw new DomainError('CONFLICT');
        return String(existing.rows[0].retrieval_id);
      }
      const persisted = validateSelectionRow(existing.rows[0], input);
      await assertCleanupNotClaimed(tx, input.selection.generation.generationId);
      if (
        existing.rows[0].status !== 'in_progress' ||
        !input.selection.leaseToken ||
        !input.selection.leaseExpiresAt ||
        input.selection.leaseExpiresAt <= now ||
        existing.rows[0].lease_token !== input.selection.leaseToken ||
        Number(existing.rows[0].attempt) !== input.selection.attempt ||
        persisted.selectionIntegrityHash !== input.selection.selectionIntegrityHash
      ) {
        throw new DomainError('CONFLICT');
      }
      const updated = await tx.execute({
        sql: `UPDATE runbook_retrievals SET status = ?, error_code = ?,
          lease_token = NULL, lease_expires_at = NULL,
          finished_at = ?, aggregate_integrity_hash = ?
          WHERE retrieval_id = ? AND status = 'in_progress' AND attempt = ?
            AND lease_token = ? AND lease_expires_at > ?`,
        args: [
          status,
          input.errorCode,
          now,
          aggregate,
          retrievalId,
          input.selection.attempt,
          input.selection.leaseToken,
          now,
        ],
      });
      if (updated.rowsAffected !== 1) throw new DomainError('CONFLICT');
    } else {
      if (input.selection) throw new DomainError('CONFLICT');
      await tx.execute({
        sql: `INSERT INTO runbook_retrievals(
          retrieval_id, tenant_id, incident_id, workflow_run_id, correlation_id,
          incident_kind, query_hash, status, error_code, threshold, top_k,
          policy_version, selected_at, finished_at, aggregate_integrity_hash
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
        args: [
          retrievalId,
          input.tenantId,
          input.incidentId,
          input.workflowRunId,
          input.correlationId,
          input.incidentKind,
          input.queryHash,
          status,
          input.errorCode,
          input.threshold.toString(),
          input.topK,
          now,
          now,
          aggregate,
        ],
      });
    }
    await appendRetrievalTimeline(tx, {
      timelineId,
      type: 'runbook.retrieval_failed',
      now,
      input,
      payload: { retrievalId, errorCode: input.errorCode },
    });
    return retrievalId;
  });
}
