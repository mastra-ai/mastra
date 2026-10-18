import type { OperationalStore } from './operational-store.js';

export async function readTriageScope(
  store: OperationalStore,
  input: Readonly<{
    tenantId: string;
    incidentId: string;
    workflowRunId: string;
    alertId: string;
  }>,
) {
  const result = await store.execute({
    sql: `SELECT i.kind, i.subject_id, i.current_run_id, i.status,
      w.started_at, w.status AS workflow_status, a.id AS alert_id, a.canonical_json
      FROM incidents i
      JOIN workflow_runs w ON w.tenant_id = i.tenant_id
        AND w.incident_id = i.id AND w.run_id = i.current_run_id
      JOIN alerts a ON a.tenant_id = i.tenant_id AND a.incident_id = i.id
      WHERE i.tenant_id = ? AND i.id = ? AND w.run_id = ? AND a.id = ?`,
    args: [input.tenantId, input.incidentId, input.workflowRunId, input.alertId],
  });
  return result.rows[0];
}

export async function readTriageRetrieval(store: OperationalStore, retrievalId: string) {
  const result = await store.execute({
    sql: `SELECT r.*, g.state AS generation_state,
      g.chunk_count AS current_chunk_count,
      g.aggregate_hash AS current_aggregate_hash,
      g.index_name AS current_index_name,
      v.declared_status, v.source_hash AS current_source_hash,
      v.parsed_hash, v.allowed_actions_json AS current_allowed_actions_json,
      a.generation_id AS active_generation_id, a.revision AS current_activation_revision
      FROM runbook_retrievals r
      JOIN runbook_generations g ON g.generation_id = r.generation_id
        AND g.runbook_id = r.runbook_id AND g.version = r.version
        AND g.incident_kind = r.incident_kind
      JOIN runbook_versions v ON v.runbook_id = r.runbook_id AND v.version = r.version
      LEFT JOIN runbook_activations a ON a.incident_kind = r.incident_kind
      WHERE r.retrieval_id = ?`,
    args: [retrievalId],
  });
  return result.rows[0];
}

export async function readTriageSelectedChunkIds(
  store: OperationalStore,
  retrievalId: string,
): Promise<readonly string[]> {
  const result = await store.execute({
    sql: `SELECT chunk_id FROM runbook_retrieval_chunks
      WHERE retrieval_id = ? ORDER BY rank`,
    args: [retrievalId],
  });
  return result.rows.map(row => String(row.chunk_id));
}
