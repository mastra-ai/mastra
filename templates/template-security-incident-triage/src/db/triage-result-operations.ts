import { createHash } from 'node:crypto';

import { canonicalizePlanValue } from '../containment/plan-canonicalization.js';
import { DomainError, parseDomainSchema } from '../domain/errors.js';
import { TriageResultSchema, type TriageResult } from '../triage/decision-contracts.js';
import type { OperationalStore, StoreTransaction } from './operational-store.js';

export function canonicalTriageResult(result: TriageResult): string {
  return canonicalizePlanValue(parseDomainSchema(TriageResultSchema, result));
}

export function triageResultHash(canonical: string): string {
  return createHash('sha256').update(canonical).digest('hex');
}

export async function persistAuthoritativeTriageResult(
  store: OperationalStore,
  input: Readonly<{
    tenantId: string;
    incidentId: string;
    workflowRunId: string;
    result: TriageResult;
  }>,
): Promise<void> {
  const canonical = canonicalTriageResult(input.result);
  const digest = triageResultHash(canonical);
  const updated = await store.execute({
    sql: `UPDATE workflow_runs SET triage_result_json = ?, triage_result_hash = ?
      WHERE tenant_id = ? AND incident_id = ? AND run_id = ?
        AND (triage_result_json IS NULL OR
          (triage_result_json = ? AND triage_result_hash = ?))`,
    args: [canonical, digest, input.tenantId, input.incidentId, input.workflowRunId, canonical, digest],
  });
  if (updated.rowsAffected !== 1) throw new DomainError('CONFLICT');
}

export async function readAuthoritativeTriageResult(
  tx: StoreTransaction,
  input: Readonly<{
    tenantId: string;
    incidentId: string;
    workflowRunId: string;
  }>,
): Promise<TriageResult> {
  const result = await tx.execute({
    sql: `SELECT triage_result_json, triage_result_hash FROM workflow_runs
      WHERE tenant_id = ? AND incident_id = ? AND run_id = ?`,
    args: [input.tenantId, input.incidentId, input.workflowRunId],
  });
  const row = result.rows[0];
  if (!row?.triage_result_json || !row.triage_result_hash) {
    throw new DomainError('CONFLICT');
  }
  const canonical = String(row.triage_result_json);
  if (triageResultHash(canonical) !== row.triage_result_hash) {
    throw new DomainError('VALIDATION_FAILED');
  }
  try {
    const parsed = parseDomainSchema(TriageResultSchema, JSON.parse(canonical));
    if (canonicalTriageResult(parsed) !== canonical) {
      throw new DomainError('VALIDATION_FAILED');
    }
    return parsed;
  } catch (error) {
    if (error instanceof DomainError) throw error;
    throw new DomainError('VALIDATION_FAILED');
  }
}
