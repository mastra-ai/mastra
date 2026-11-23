import { resolveRunbookRoot } from '../mastra/knowledge/root.js';

import { DomainError } from '../domain/errors.js';
import type { Correlation } from '../evidence/contracts.js';
import { readVerifiedEvidence } from '../evidence/persistence.js';
import { readTriageRetrieval, readTriageScope, readTriageSelectedChunkIds } from '../db/triage-read-operations.js';
import { listAuthoritativeChunks, findSuccessfulRetrieval } from '../db/runbook-retrieval-read.js';
import type { OperationalStore } from '../db/operational-store.js';
import type { Evidence } from '../schemas/evidence.js';
import type { IncidentKind } from '../schemas/incident.js';
import { utcTimestamp } from '../schemas/common.js';
import { AlertSchema } from '../schemas/alert.js';
import type { RunbookRetrievedSchema } from '../mastra/steps/retrieve-runbook.js';
import { validatePersistedAllowedActions } from '../mastra/knowledge/allowlist.js';
import { sha256 } from '../mastra/knowledge/hashes.js';
import { loadRunbook, type LoadedRunbook } from '../mastra/knowledge/loader.js';
import type { ContainmentActionType } from '../schemas/containment.js';
import { assertRunbookPolicy } from './policy.js';
import { assertCorrelationDerivedData } from './correlation-validation.js';

const fileByKind: Readonly<Record<IncidentKind, string>> = {
  unauthorized_privilege_change: 'unauthorized-privilege-change.md',
  disallowed_country_login: 'disallowed-country-login.md',
  unknown_device_login: 'unknown-device-login.md',
};

export type DecisionContext = Readonly<{
  correlation: Correlation;
  evidence: readonly Evidence[];
  runbook: LoadedRunbook;
  allowedActions: readonly ContainmentActionType[];
  startedAt: string;
}>;

export async function loadDecisionContext(
  store: OperationalStore,
  retrieval: typeof RunbookRetrievedSchema._output,
  correlation: Correlation,
  dependencies: Readonly<{ runbookRoot?: string }> = {},
): Promise<DecisionContext> {
  assertRetrievalScope(retrieval, correlation);
  const scope = await readTriageScope(store, {
    tenantId: correlation.context.tenantId,
    incidentId: correlation.context.incidentId,
    workflowRunId: correlation.context.workflowRunId,
    alertId: correlation.context.alertId,
  });
  if (
    !scope ||
    scope.kind !== correlation.context.incidentKind ||
    scope.subject_id !== correlation.context.subjectId ||
    scope.current_run_id !== correlation.context.workflowRunId ||
    scope.status !== 'investigating' ||
    scope.workflow_status !== 'running' ||
    scope.alert_id !== correlation.context.alertId
  )
    throw new DomainError('CONFLICT');
  let alertValue: unknown;
  try {
    alertValue = JSON.parse(String(scope.canonical_json));
  } catch {
    throw new DomainError('VALIDATION_FAILED');
  }
  const alert = AlertSchema.safeParse(alertValue);
  if (
    !alert.success ||
    alert.data.alertId !== correlation.context.alertId ||
    alert.data.tenantId !== correlation.context.tenantId ||
    alert.data.subjectId !== correlation.context.subjectId ||
    alert.data.kind !== correlation.context.incidentKind ||
    alert.data.occurredAt !== correlation.context.occurredAt ||
    alert.data.sessionId !== correlation.context.sessionId ||
    alert.data.deviceId !== correlation.context.deviceId ||
    alert.data.ip !== correlation.context.ip
  )
    throw new DomainError('CONFLICT');
  const startedAt = utcTimestamp.safeParse(scope.started_at);
  if (!startedAt.success) throw new DomainError('VALIDATION_FAILED');

  const evidenceIds = correlation.orderedEvents.map(item => item.evidenceId);
  assertEvidenceSet(correlation, evidenceIds);
  const evidence = await readVerifiedEvidence(store, correlation.context, evidenceIds);
  for (const [index, item] of evidence.entries()) {
    if (item.observedAt !== correlation.orderedEvents[index]?.observedAt) throw new DomainError('CONFLICT');
  }
  assertCorrelationDerivedData(correlation, evidence);

  const row = await readTriageRetrieval(store, retrieval.retrievalId);
  if (!row) throw new DomainError('NOT_FOUND');
  assertRetrievalRow(row, retrieval, correlation);
  const threshold = Number(row.threshold);
  const topK = Number(row.top_k);
  if (!Number.isFinite(threshold) || !Number.isInteger(topK)) throw new DomainError('VALIDATION_FAILED');
  const verifiedRetrieval = await findSuccessfulRetrieval(store, {
    tenantId: correlation.context.tenantId,
    incidentId: correlation.context.incidentId,
    workflowRunId: correlation.context.workflowRunId,
    correlationId: correlation.context.correlationId,
    incidentKind: correlation.context.incidentKind,
    queryHash: String(row.query_hash),
    threshold,
    topK,
  });
  if (!verifiedRetrieval || verifiedRetrieval.retrievalId !== retrieval.retrievalId)
    throw new DomainError('VALIDATION_FAILED');
  const selectedIds = await readTriageSelectedChunkIds(store, retrieval.retrievalId);
  if (selectedIds.join('\0') !== retrieval.chunkIds.join('\0')) throw new DomainError('CONFLICT');

  const chunks = await listAuthoritativeChunks(store, retrieval.generationId);
  if (chunks.size !== Number(row.current_chunk_count)) throw new DomainError('VALIDATION_FAILED');
  const orderedChunks = [...chunks.values()].sort(
    (left, right) =>
      left.metadata.sectionOrdinal - right.metadata.sectionOrdinal ||
      left.metadata.chunkOrdinal - right.metadata.chunkOrdinal,
  );
  const aggregate = sha256(orderedChunks.map(chunk => `${chunk.metadata.chunkId}:${chunk.metadataHash}`).join('\n'));
  if (aggregate !== row.current_aggregate_hash) throw new DomainError('VALIDATION_FAILED');
  for (const chunkId of selectedIds) if (!chunks.has(chunkId)) throw new DomainError('CONFLICT');

  const runbook = await loadRunbook(
    dependencies.runbookRoot ?? resolveRunbookRoot(),
    fileByKind[correlation.context.incidentKind],
  );
  if (
    runbook.metadata.id !== retrieval.runbookId ||
    runbook.metadata.version !== retrieval.version ||
    runbook.sourceHash !== row.current_source_hash ||
    runbook.parsedHash !== row.parsed_hash
  )
    throw new DomainError('VALIDATION_FAILED');
  try {
    assertRunbookPolicy(correlation.context.incidentKind, runbook);
  } catch {
    throw new DomainError('VALIDATION_FAILED');
  }
  const allowedActions = validatePersistedAllowedActions(
    correlation.context.incidentKind,
    String(row.current_allowed_actions_json),
  );
  if (allowedActions.join('\0') !== runbook.allowedActions.join('\0')) throw new DomainError('CONFLICT');
  return Object.freeze({
    correlation,
    evidence,
    runbook,
    allowedActions,
    startedAt: startedAt.data,
  });
}

function assertRetrievalScope(retrieval: typeof RunbookRetrievedSchema._output, correlation: Correlation) {
  if (retrieval.runId !== correlation.context.workflowRunId) throw new DomainError('CONFLICT');
}

function assertEvidenceSet(correlation: Correlation, orderedIds: readonly string[]) {
  const branchIds = correlation.branches.flatMap(branch => branch.evidenceIds);
  if (
    new Set(branchIds).size !== branchIds.length ||
    new Set(orderedIds).size !== orderedIds.length ||
    [...branchIds].sort().join('\0') !== [...orderedIds].sort().join('\0')
  )
    throw new DomainError('CONFLICT');
}

function assertRetrievalRow(
  row: Record<string, unknown>,
  retrieval: typeof RunbookRetrievedSchema._output,
  correlation: Correlation,
) {
  if (
    row.status !== 'succeeded' ||
    row.tenant_id !== correlation.context.tenantId ||
    row.incident_id !== correlation.context.incidentId ||
    row.workflow_run_id !== correlation.context.workflowRunId ||
    row.correlation_id !== correlation.context.correlationId ||
    row.incident_kind !== correlation.context.incidentKind ||
    row.runbook_id !== retrieval.runbookId ||
    row.version !== retrieval.version ||
    row.generation_id !== retrieval.generationId ||
    row.citation !== retrieval.citation ||
    row.generation_state !== 'active' ||
    row.declared_status !== 'active' ||
    row.active_generation_id !== retrieval.generationId ||
    Number(row.activation_revision) !== Number(row.current_activation_revision) ||
    row.index_name !== row.current_index_name ||
    row.source_hash !== row.current_source_hash ||
    row.generation_aggregate_hash !== row.current_aggregate_hash ||
    row.allowed_actions_json !== row.current_allowed_actions_json
  )
    throw new DomainError('CONFLICT');
}
