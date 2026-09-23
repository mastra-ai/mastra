import type { OperationalStore } from '../../db/operational-store.js';
import type { SecurityEvalAuthority } from './scorers.js';

/**
 * Read-only projection for scoring.  It deliberately queries durable domain
 * rows after an E2E workflow; neither input.jsonl nor expected.jsonl is an
 * authority source.
 */
export async function readSecurityEvalAuthority(
  store: OperationalStore,
  input: Readonly<{
    tenantId: string;
    incidentId: string;
    workflowRunId: string;
    asOf: string;
  }>,
): Promise<SecurityEvalAuthority> {
  // LibSQL's operational adapter serializes statements on a single durable
  // connection; issue reads in that order to avoid turning a read projection
  // into a transient SQLITE_BUSY source.
  const evidenceRows = await store.execute({
    sql: `SELECT id,integrity_hash,tenant_id,incident_id,workflow_run_id
      FROM evidence_items WHERE tenant_id=? AND incident_id=? AND workflow_run_id=?`,
    args: [input.tenantId, input.incidentId, input.workflowRunId],
  });
  const runbookRows = await store.execute({
    sql: `SELECT a.retrieval_id,a.runbook_id,a.version,a.source_hash,a.generation_id,
        a.chunk_ids_json,a.mandatory_rules_json,a.allowed_actions_json,
        v.declared_status,v.mandatory_rules_json AS catalog_rules,
        v.allowed_actions_json AS catalog_actions
      FROM runbook_authority_snapshots a
      JOIN runbook_retrievals r ON r.retrieval_id=a.retrieval_id
        AND r.tenant_id=a.tenant_id AND r.incident_id=a.incident_id
        AND r.workflow_run_id=a.workflow_run_id AND r.status='succeeded'
        AND r.runbook_id=a.runbook_id AND r.version=a.version
        AND r.source_hash=a.source_hash AND r.generation_id=a.generation_id
        AND r.allowed_actions_json=a.allowed_actions_json
        AND r.mandatory_rules_json=a.mandatory_rules_json
      JOIN runbook_generations g ON g.generation_id=r.generation_id
        AND g.runbook_id=r.runbook_id AND g.version=r.version
        AND g.incident_kind=r.incident_kind
      JOIN runbook_versions v ON v.runbook_id=r.runbook_id
        AND v.version=r.version AND v.source_hash=r.source_hash
      WHERE a.tenant_id=? AND a.incident_id=? AND a.workflow_run_id=?`,
    args: [input.tenantId, input.incidentId, input.workflowRunId],
  });
  const approvalRows = await store.execute({
    sql: 'SELECT id,tenant_id,incident_id,workflow_run_id,decision,expires_at FROM approvals WHERE tenant_id=? AND incident_id=? AND workflow_run_id=?',
    args: [input.tenantId, input.incidentId, input.workflowRunId],
  });
  const planRows = await store.execute({
    sql: 'SELECT p.id,p.plan_hash,p.tenant_id,p.incident_id,a.id AS approval_id,a.workflow_run_id FROM containment_plans p JOIN approvals a ON a.plan_id=p.id WHERE p.tenant_id=? AND p.incident_id=? AND a.workflow_run_id=?',
    args: [input.tenantId, input.incidentId, input.workflowRunId],
  });
  const actionRows = await store.execute({
    sql: 'SELECT c.action_id,c.plan_id,c.action_type,c.target_id FROM containment_actions c JOIN approvals a ON a.plan_id=c.plan_id WHERE a.tenant_id=? AND a.incident_id=? AND a.workflow_run_id=?',
    args: [input.tenantId, input.incidentId, input.workflowRunId],
  });
  const effectRows = await store.execute({
    sql: 'SELECT e.action_id,e.plan_id,e.tenant_id,e.incident_id,e.target_id,a.id AS approval_id FROM local_containment_effects e JOIN approvals a ON a.plan_id=e.plan_id WHERE a.tenant_id=? AND a.incident_id=? AND a.workflow_run_id=?',
    args: [input.tenantId, input.incidentId, input.workflowRunId],
  });
  const evidence = new Map(
    evidenceRows.rows.map(
      row =>
        [
          String(row.id),
          {
            hash: String(row.integrity_hash),
            tenant: String(row.tenant_id),
            incident: String(row.incident_id),
            runId: input.workflowRunId,
          },
        ] as const,
    ),
  );
  const runbooks = new Map<
    string,
    Readonly<{
      version: string;
      hash: string;
      active: boolean;
      rules: readonly string[];
      allowedActions: readonly string[];
      chunkIds: readonly string[];
    }>
  >();
  for (const row of runbookRows.rows) {
    const rules = parseStringList(row.mandatory_rules_json);
    const actions = parseStringList(row.allowed_actions_json);
    const chunks = parseStringList(row.chunk_ids_json);
    if (
      !rules.length ||
      !actions.length ||
      !chunks.length ||
      row.mandatory_rules_json !== row.catalog_rules ||
      row.allowed_actions_json !== row.catalog_actions ||
      typeof row.generation_id !== 'string' ||
      typeof row.retrieval_id !== 'string' ||
      !(await selectedChunksMatch(store, String(row.retrieval_id), String(row.generation_id), chunks))
    )
      continue;
    runbooks.set(String(row.runbook_id), {
      version: String(row.version),
      hash: String(row.source_hash),
      active: row.declared_status === 'active',
      rules,
      allowedActions: actions,
      chunkIds: chunks,
    });
  }
  const approvals = new Map(
    approvalRows.rows.map(row => [
      String(row.id),
      {
        tenant: String(row.tenant_id),
        incident: String(row.incident_id),
        runId: String(row.workflow_run_id),
        status:
          row.decision === null ? (String(row.expires_at) <= input.asOf ? 'expired' : 'pending') : String(row.decision),
        ttlValid: row.decision === 'approved' && String(row.expires_at) > input.asOf,
      } as const,
    ]),
  );
  const plans = new Map(
    planRows.rows.map(row => [
      String(row.id),
      {
        approvalId: String(row.approval_id),
        tenant: String(row.tenant_id),
        incident: String(row.incident_id),
        runId: String(row.workflow_run_id),
        hash: String(row.plan_hash),
      } as const,
    ]),
  );
  const actions = new Map(
    actionRows.rows.map(row => [
      String(row.action_id),
      {
        planId: String(row.plan_id),
        action: String(row.action_type),
        target: String(row.target_id),
      } as const,
    ]),
  );
  const effects = new Map(
    effectRows.rows.map(row => [
      String(row.action_id),
      {
        approvalId: String(row.approval_id),
        tenant: String(row.tenant_id),
        incident: String(row.incident_id),
        runId: input.workflowRunId,
        target: String(row.target_id),
        verified: true,
      },
    ]),
  );
  return { evidence, runbooks, approvals, plans, actions, effects };
}

function parseStringList(value: unknown): readonly string[] {
  if (typeof value !== 'string') return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) &&
      parsed.length > 0 &&
      new Set(parsed).size === parsed.length &&
      parsed.every(item => typeof item === 'string' && item.length > 0)
      ? Object.freeze([...parsed])
      : [];
  } catch {
    return [];
  }
}

/** Reconcile the public snapshot with the selected rows and their current
 * catalog identities. An authority row is unusable on any discontinuity. */
async function selectedChunksMatch(
  store: OperationalStore,
  retrievalId: string,
  generationId: string,
  snapshotChunkIds: readonly string[],
): Promise<boolean> {
  const selected = await store.execute({
    sql: `SELECT rc.rank,rc.generation_id,rc.chunk_id,rc.vector_id,
        rc.content_hash,rc.metadata_hash,rc.section_ordinal,rc.chunk_ordinal,
        c.vector_id AS catalog_vector_id,c.content_hash AS catalog_content_hash,
        c.metadata_hash AS catalog_metadata_hash,c.section_ordinal AS catalog_section_ordinal,
        c.chunk_ordinal AS catalog_chunk_ordinal
      FROM runbook_retrieval_chunks rc
      JOIN runbook_chunks c ON c.generation_id=rc.generation_id
        AND c.chunk_id=rc.chunk_id AND c.vector_id=rc.vector_id
      WHERE rc.retrieval_id=? AND rc.generation_id=? ORDER BY rc.rank`,
    args: [retrievalId, generationId],
  });
  if (selected.rows.length !== snapshotChunkIds.length) return false;
  return selected.rows.every(
    (row, index) =>
      Number(row.rank) === index + 1 &&
      row.generation_id === generationId &&
      row.chunk_id === snapshotChunkIds[index] &&
      row.vector_id === row.catalog_vector_id &&
      row.content_hash === row.catalog_content_hash &&
      row.metadata_hash === row.catalog_metadata_hash &&
      Number(row.section_ordinal) === Number(row.catalog_section_ordinal) &&
      Number(row.chunk_ordinal) === Number(row.catalog_chunk_ordinal),
  );
}
