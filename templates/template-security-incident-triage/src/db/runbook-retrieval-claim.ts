import type { Clock } from '../domain/clock.js';
import { systemClock } from '../domain/clock.js';
import { DomainError } from '../domain/errors.js';
import type { IdGenerator } from '../domain/id-generator.js';
import { uuidGenerator } from '../domain/id-generator.js';
import type { OperationalStore } from './operational-store.js';
import type { EligibleGeneration } from './runbook-operations.js';
import {
  assertCleanupNotClaimed,
  assertCurrentSelection,
  canonicalCitation,
  failedIntegrityHash,
  retrievalLeaseExpiry,
  retrievalLeaseToken,
  selectionIntegrityHash,
  selectionQuery,
  validateSelectionRow,
} from './runbook-retrieval-integrity.js';
import type { PersistedSelection, RetrievalScope } from './runbook-retrieval-types.js';

export async function claimRetrievalSelection(
  store: OperationalStore,
  input: RetrievalScope,
  generation: EligibleGeneration | undefined,
  dependencies: Readonly<{ clock?: Clock; ids?: IdGenerator }> = {},
): Promise<PersistedSelection | undefined> {
  const now = (dependencies.clock ?? systemClock).now();
  return store.transaction(async tx => {
    const existing = await tx.execute({
      sql: `${selectionQuery}
        WHERE r.tenant_id = ? AND r.incident_id = ? AND r.workflow_run_id = ?
          AND r.query_hash = ? AND r.policy_version = 1`,
      args: [input.tenantId, input.incidentId, input.workflowRunId, input.queryHash],
    });
    if (existing.rows[0]) {
      const row = existing.rows[0];
      const selection = validateSelectionRow(row, input);
      await assertCleanupNotClaimed(tx, selection.generation.generationId);
      const nextAttempt = selection.attempt + 1;
      const leaseToken = retrievalLeaseToken(selection.retrievalId, nextAttempt, now);
      const leaseExpiresAt = retrievalLeaseExpiry(now);
      let updated;
      if (row.status === 'failed' && row.error_code === 'RUNBOOK_BACKEND_UNAVAILABLE') {
        if (
          typeof row.finished_at !== 'string' ||
          row.aggregate_integrity_hash !==
            failedIntegrityHash(
              selection.retrievalId,
              selection.selectionIntegrityHash,
              'RUNBOOK_BACKEND_UNAVAILABLE',
              input.queryHash,
              row.finished_at,
              'failed',
              selection.attempt,
            )
        ) {
          throw new DomainError('VALIDATION_FAILED');
        }
        updated = await tx.execute({
          sql: `UPDATE runbook_retrievals SET status = 'in_progress', error_code = NULL,
            attempt = ?, lease_token = ?, lease_expires_at = ?,
            finished_at = NULL, aggregate_integrity_hash = NULL
            WHERE retrieval_id = ? AND status = 'failed'
              AND error_code = 'RUNBOOK_BACKEND_UNAVAILABLE' AND attempt = ?`,
          args: [nextAttempt, leaseToken, leaseExpiresAt, selection.retrievalId, selection.attempt],
        });
      } else if (
        row.status === 'in_progress' &&
        typeof row.lease_token === 'string' &&
        typeof row.lease_expires_at === 'string' &&
        row.lease_expires_at <= now
      ) {
        updated = await tx.execute({
          sql: `UPDATE runbook_retrievals SET attempt = ?, lease_token = ?,
            lease_expires_at = ? WHERE retrieval_id = ? AND status = 'in_progress'
            AND attempt = ? AND lease_token = ? AND lease_expires_at <= ?`,
          args: [
            nextAttempt,
            leaseToken,
            leaseExpiresAt,
            selection.retrievalId,
            selection.attempt,
            row.lease_token,
            now,
          ],
        });
      } else {
        throw new DomainError('CONFLICT');
      }
      if (updated.rowsAffected !== 1) throw new DomainError('CONFLICT');
      return {
        ...selection,
        attempt: nextAttempt,
        leaseToken,
        leaseExpiresAt,
      };
    }
    if (!generation) return undefined;
    const proposedRetrievalId = (dependencies.ids ?? uuidGenerator).next();
    await assertCurrentSelection(tx, generation);
    await assertCleanupNotClaimed(tx, generation.generationId);
    const citation = canonicalCitation(generation.runbookId, generation.version);
    const attempt = 1;
    const leaseToken = retrievalLeaseToken(proposedRetrievalId, attempt, now);
    const leaseExpiresAt = retrievalLeaseExpiry(now);
    const selection = {
      retrievalId: proposedRetrievalId,
      generation,
      citation,
      selectedAt: now,
      selectionIntegrityHash: selectionIntegrityHash(proposedRetrievalId, generation, citation, input, now),
      attempt,
      leaseToken,
      leaseExpiresAt,
    };
    await tx.execute({
      sql: `INSERT INTO runbook_retrievals(
        retrieval_id, tenant_id, incident_id, workflow_run_id, correlation_id,
        incident_kind, runbook_id, version, generation_id, index_name,
        activation_revision, source_hash, generation_aggregate_hash, citation,
        allowed_actions_json, mandatory_rules_json,
        query_hash, status, error_code, attempt, lease_token, lease_expires_at,
        threshold, top_k, policy_version,
        selected_at, finished_at, selection_integrity_hash, aggregate_integrity_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'in_progress',
        NULL, ?, ?, ?, ?, ?, 1, ?, NULL, ?, NULL)`,
      args: [
        selection.retrievalId,
        input.tenantId,
        input.incidentId,
        input.workflowRunId,
        input.correlationId,
        generation.incidentKind,
        generation.runbookId,
        generation.version,
        generation.generationId,
        generation.indexName,
        generation.revision,
        generation.sourceHash,
        generation.aggregateHash,
        citation,
        generation.allowedActionsJson,
        generation.mandatoryRulesJson,
        input.queryHash,
        attempt,
        leaseToken,
        leaseExpiresAt,
        input.threshold.toString(),
        input.topK,
        now,
        selection.selectionIntegrityHash,
      ],
    });
    return selection;
  });
}
