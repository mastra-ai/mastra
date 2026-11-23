import type { OperationalStore } from '../../src/db/operational-store.js';
import { readAuthoritativeTriageResult } from '../../src/db/triage-result-operations.js';
import type { Correlation } from '../../src/evidence/contracts.js';
import { readVerifiedEvidence } from '../../src/evidence/persistence.js';
import type { LoadedRunbook } from '../../src/mastra/knowledge/loader.js';
import { buildIncidentSummary, createSummaryCandidate } from '../../src/triage/claims.js';
import { readSecurityEvalAuthority } from '../../src/mastra/evals/authority-store.js';
import { WorkflowObservationSchema } from '../../src/mastra/evals/workflow-artifact.js';
import { buildSeverityDecision } from '../../src/triage/decision-validation.js';
import { createContainmentCandidate, resolveContainmentActions } from '../../src/containment/action-registry.js';
import { buildValidatedContainmentPlan } from '../../src/containment/plan-builder.js';
import { canonicalJson } from '../../src/evidence/canonicalize.js';
import { evalHash } from '../../src/mastra/evals/workflow-corpus.js';

/** Projection is read after actual workflow execution, never from expected labels. */
export async function observeWorkflow(
  store: OperationalStore,
  caseId: string,
  correlation: Correlation,
  runbooks: readonly LoadedRunbook[],
  execution: {
    startStatus: string;
    finalStatus: string;
    responseStatus: string;
    preApprovalEffects: number;
    authorizationProbes: { name: string; blocked: boolean }[];
  },
) {
  const scope = correlation.context;
  const triage = await store.transaction(tx => readAuthoritativeTriageResult(tx, scope));
  const verified = await readVerifiedEvidence(
    store,
    scope,
    correlation.orderedEvents.map(event => event.evidenceId),
  );
  const provenance = await readSecurityEvalAuthority(store, {
    ...scope,
    asOf: '2026-08-28T10:03:00.000Z',
  });
  const runbook = runbooks.find(book => book.metadata.incidentKinds.includes(scope.incidentKind));
  if (!runbook) throw new Error('EVAL_RUNBOOK_AUTHORITY_MISSING');
  const selected = provenance.runbooks.get(runbook.metadata.id);
  if (
    !selected ||
    !selected.active ||
    selected.version !== runbook.metadata.version ||
    selected.hash !== runbook.sourceHash ||
    canonicalJson(selected.rules) !== canonicalJson(runbook.metadata.mandatoryRules) ||
    canonicalJson(selected.allowedActions) !== canonicalJson(runbook.allowedActions)
  )
    throw new Error('EVAL_RUNBOOK_AUTHORITY_MISMATCH');
  const timing = await store.execute({
    sql: 'SELECT started_at FROM workflow_runs WHERE tenant_id=? AND incident_id=? AND run_id=?',
    args: [scope.tenantId, scope.incidentId, scope.workflowRunId],
  });
  const context = {
    correlation,
    evidence: verified,
    runbook,
    allowedActions: runbook.allowedActions,
    startedAt: String(timing.rows[0]?.started_at),
  };
  const canonicalDecision = triage.status === 'ready-for-approval' ? buildSeverityDecision(context) : null;
  const canonicalPlan = canonicalDecision
    ? buildValidatedContainmentPlan(
        context,
        resolveContainmentActions(context, canonicalDecision, createContainmentCandidate(context, canonicalDecision)),
      )
    : null;
  const incident = await store.execute({
    sql: 'SELECT severity,status FROM incidents WHERE tenant_id=? AND id=?',
    args: [scope.tenantId, scope.incidentId],
  });
  const tables = [
    'approvals',
    'containment_plans',
    'containment_actions',
    'containment_action_attempts',
    'local_containment_effects',
  ] as const;
  const data = [];
  for (const table of tables) {
    const result = await store.execute({
      sql: `SELECT * FROM ${table} WHERE tenant_id=? AND incident_id=?`,
      args: [scope.tenantId, scope.incidentId],
    });
    // No resume token, raw evidence or provider payload is published.
    data.push(
      result.rows.map(value => ({
        ...Object.fromEntries(
          Object.entries(value).filter(
            ([key]) =>
              ![
                'decision_fingerprint',
                'decision_reason',
                'plan_json',
                'input_json',
                'fence_token',
                'provider_ref',
                'result_ref',
              ].includes(key),
          ),
        ),
        ...(typeof value.input_json === 'string'
          ? {
              input_hash: evalHash(canonicalJson(JSON.parse(value.input_json))),
            }
          : {}),
      })),
    );
  }
  return WorkflowObservationSchema.parse({
    caseId,
    ...execution,
    severity: incident.rows[0]?.severity,
    incidentStatus: incident.rows[0]?.status,
    triage,
    authority: {
      evidence: verified.map(value => ({
        id: value.evidenceId,
        hash: value.integrityHash,
      })),
      canonicalSummary:
        triage.status === 'ready-for-approval'
          ? buildIncidentSummary(context, triage.decision, createSummaryCandidate(context))
          : null,
      canonicalDecision,
      canonicalPlan,
      runbookReference: `[runbook:${runbook.metadata.id}@${runbook.metadata.version}]`,
      runbookHash: runbook.sourceHash,
      mandatoryRules: runbook.metadata.mandatoryRules,
      selectedRunbook: {
        active: selected.active,
        hash: selected.hash,
        rules: selected.rules,
        allowedActions: selected.allowedActions,
      },
      allowedActions: runbook.allowedActions,
      approvals: data[0],
      plans: data[1],
      actions: data[2],
      attempts: data[3],
      effects: data[4],
    },
  });
}
