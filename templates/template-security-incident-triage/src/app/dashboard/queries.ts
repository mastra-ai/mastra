import type { InValue } from '@libsql/client';

import type { OperationalStore } from '../../db/operational-store.js';
import { DomainError } from '../../domain/errors.js';
import { readDeviceTrustForIncident } from '../../db/device-trust-operations.js';
import { decodeCursor, encodeCursor, type DashboardTimelineEvent } from './contracts.js';
import { redactTimelinePayload } from './redaction.js';
import { TriageResultSchema, ValidatedContainmentPlanSchema } from '../../triage/decision-contracts.js';
import { calculatePlanHash } from '../../containment/plan-canonicalization.js';

type Row = Record<string, InValue>;
type DashboardQueryStore = Pick<OperationalStore, 'execute'>;

export type DashboardOperationalState = Readonly<{
  decision:
    | 'not_requested'
    | 'pending'
    | 'approved'
    | 'rejected'
    | 'manual_review'
    | 'accepted'
    | 'resolved'
    | 'dismissed';
  execution:
    | 'not_started'
    | 'awaiting_decision'
    | 'in_progress'
    | 'completed'
    | 'partial'
    | 'failed'
    | 'not_executed'
    | 'not_applicable';
}>;

type DecisionState = DashboardOperationalState['decision'];
type ExecutionState = DashboardOperationalState['execution'];
type OperationalStateInput = Readonly<{
  incidentStatus: string;
  triageStatus?: string;
  approvalDecision?: string | null;
  manualReviewDecision?: string | null;
  actionStatuses: readonly string[];
}>;

/** One semantic projection shared by SSR and every SSE detail refresh. */
export function projectDashboardOperationalState(input: OperationalStateInput): DashboardOperationalState {
  const decision = projectDecisionState(input);
  return {
    decision,
    execution: projectExecutionState(input, decision),
  };
}

function projectDecisionState(input: OperationalStateInput): DecisionState {
  if (input.approvalDecision === 'approved' || input.approvalDecision === 'rejected') return input.approvalDecision;
  if (
    input.manualReviewDecision === 'accepted' ||
    input.manualReviewDecision === 'resolved' ||
    input.manualReviewDecision === 'dismissed'
  )
    return input.manualReviewDecision;
  if (input.triageStatus === 'manual-review') return 'manual_review';
  if (input.incidentStatus === 'awaiting_approval') return 'pending';
  if (['approved', 'containing', 'contained'].includes(input.incidentStatus)) return 'approved';
  if (input.incidentStatus === 'rejected') return 'rejected';
  return 'not_requested';
}

function projectExecutionState(input: OperationalStateInput, decision: DecisionState): ExecutionState {
  const completed = input.actionStatuses.filter(status => status === 'completed').length;
  const failed = input.actionStatuses.filter(status => status === 'failed').length;
  if (input.actionStatuses.length === 0) {
    if (input.incidentStatus === 'failed') return 'failed';
    if (input.triageStatus === 'manual-review' || input.incidentStatus === 'closed') return 'not_applicable';
    return input.incidentStatus === 'awaiting_approval' ? 'awaiting_decision' : 'not_started';
  }
  if (completed === input.actionStatuses.length) return 'completed';
  if (failed > 0 && completed > 0) return 'partial';
  if (failed > 0 || input.incidentStatus === 'failed') return 'failed';
  if (decision === 'rejected' || input.incidentStatus === 'rejected') return 'not_executed';
  if (input.actionStatuses.includes('executing') || input.incidentStatus === 'containing') return 'in_progress';
  return decision === 'pending' ? 'awaiting_decision' : 'not_started';
}

export async function listDashboardIncidents(
  store: DashboardQueryStore,
  input: Readonly<{
    tenantId: string;
    limit: number;
    kind?: string;
    status?: string;
    severity?: string;
    cursor?: string;
    cursorSecret: string;
  }>,
) {
  const filters = JSON.stringify({
    kind: input.kind ?? null,
    status: input.status ?? null,
    severity: input.severity ?? null,
  });
  const cursor = input.cursor
    ? decodeCursor(input.cursor, { tenantId: input.tenantId, filters }, input.cursorSecret)
    : null;
  if (input.cursor && !cursor) throw new DomainError('VALIDATION_FAILED');
  const clauses = ['tenant_id = ?'];
  const args: InValue[] = [input.tenantId];
  for (const [column, value] of [
    ['kind', input.kind],
    ['status', input.status],
    ['severity', input.severity],
  ] as const) {
    if (value) {
      clauses.push(`${column} = ?`);
      args.push(value);
    }
  }
  if (cursor) {
    clauses.push('(updated_at < ? OR (updated_at = ? AND id < ?))');
    args.push(cursor.updatedAt, cursor.updatedAt, cursor.incidentId);
  }
  args.push(input.limit + 1);
  const result = await store.execute({
    sql: `SELECT id, kind, severity, status, subject_id, current_run_id, created_at, updated_at
      FROM incidents WHERE ${clauses.join(' AND ')}
      ORDER BY updated_at DESC, id DESC LIMIT ?`,
    args,
  });
  const rows = result.rows.slice(0, input.limit) as Row[];
  const items = rows.map(row => ({
    incidentId: String(row.id),
    kind: String(row.kind),
    severity: row.severity === null ? null : String(row.severity),
    status: String(row.status),
    subjectRef: String(row.subject_id),
    workflowRunId: row.current_run_id === null ? null : String(row.current_run_id),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }));
  const next = result.rows.length > input.limit ? rows.at(-1) : undefined;
  return {
    items,
    page: {
      limit: input.limit,
      nextCursor: next
        ? encodeCursor(
            {
              updatedAt: String(next.updated_at),
              incidentId: String(next.id),
              tenantId: input.tenantId,
              filters,
            },
            input.cursorSecret,
          )
        : null,
    },
  };
}

export async function readDashboardStatistics(store: DashboardQueryStore, tenantId: string) {
  const result = await store.execute({
    sql: `SELECT
      COUNT(*) AS total_count,
      SUM(CASE WHEN status IN ('received','investigating','awaiting_approval','approved','containing') THEN 1 ELSE 0 END) AS open_count,
      SUM(CASE WHEN status = 'awaiting_approval' THEN 1 ELSE 0 END) AS awaiting_approval_count,
      SUM(CASE WHEN severity IN ('high','critical') AND status IN ('received','investigating','awaiting_approval','approved','containing') THEN 1 ELSE 0 END) AS high_priority_count
      FROM incidents WHERE tenant_id = ?`,
    args: [tenantId],
  });
  const row = result.rows[0];
  return {
    total: Number(row?.total_count ?? 0),
    open: Number(row?.open_count ?? 0),
    awaitingApproval: Number(row?.awaiting_approval_count ?? 0),
    highPriority: Number(row?.high_priority_count ?? 0),
  };
}

export async function readDashboardIncident(
  store: OperationalStore,
  input: Readonly<{ tenantId: string; incidentId: string }>,
) {
  return store.transaction(tx => readDashboardIncidentSnapshot(tx, input));
}

/**
 * All reads which form a detail DTO share one LibSQL transaction snapshot.
 * This prevents a committed approval/timeline from being combined with the
 * pre-commit incident pointer or containment plan.
 */
async function readDashboardIncidentSnapshot(
  store: DashboardQueryStore,
  input: Readonly<{ tenantId: string; incidentId: string }>,
) {
  const incident = await store.execute({
    sql: `SELECT id, kind, severity, status, subject_id, current_run_id, current_plan_id, created_at, updated_at FROM incidents WHERE tenant_id = ? AND id = ?`,
    args: [input.tenantId, input.incidentId],
  });
  const row = incident.rows[0] as Row | undefined;
  if (!row) throw new DomainError('NOT_FOUND');
  // The cursor is deliberately derived from the same bounded read as the
  // rendered timeline. A separate MAX(sequence) can observe an event which
  // was not in the DOM snapshot, causing the browser to skip it on replay.
  const timelineSnapshot = await readDashboardTimelineSnapshot(store, input, 200);
  const [evidence, plan, approval, actions, workflow, manualReviewDecision, runbookRows] = await Promise.all([
    store.execute({
      sql: `SELECT id, source, provider, observed_at, collected_at, confidence, incomplete, error_code FROM evidence_items WHERE tenant_id = ? AND incident_id = ? ORDER BY observed_at LIMIT 200`,
      args: [input.tenantId, input.incidentId],
    }),
    store.execute({
      sql: `SELECT id, plan_version, plan_hash_version, plan_hash, expires_at, plan_json FROM containment_plans WHERE tenant_id = ? AND incident_id = ? AND id = ?`,
      args: [input.tenantId, input.incidentId, row.current_plan_id ?? ''],
    }),
    store.execute({
      sql: `SELECT id, plan_id, plan_hash_version, plan_hash, decision, decided_at, decision_reason, expires_at FROM approvals WHERE tenant_id = ? AND incident_id = ? AND plan_id = ? ORDER BY requested_at DESC LIMIT 1`,
      args: [input.tenantId, input.incidentId, row.current_plan_id ?? ''],
    }),
    store.execute({
      sql: `SELECT action_id, action_type, status, result_ref FROM containment_actions WHERE tenant_id = ? AND incident_id = ? AND plan_id = ? ORDER BY ordinal`,
      args: [input.tenantId, input.incidentId, row.current_plan_id ?? ''],
    }),
    store.execute({
      sql: `SELECT triage_result_json FROM workflow_runs WHERE tenant_id = ? AND incident_id = ? AND run_id = ?`,
      args: [input.tenantId, input.incidentId, row.current_run_id ?? ''],
    }),
    store.execute({
      sql: `SELECT payload_json, occurred_at FROM timeline_events
        WHERE tenant_id = ? AND incident_id = ?
          AND type = 'triage.manual_review.decided'
          AND json_extract(payload_json, '$.workflowRunId') = ?
        ORDER BY sequence DESC LIMIT 1`,
      args: [input.tenantId, input.incidentId, row.current_run_id ?? ''],
    }),
    store.execute({
      sql: `WITH selected_retrieval AS (
          SELECT retrieval_id, runbook_id, version, generation_id
          FROM runbook_retrievals
          WHERE tenant_id = ? AND incident_id = ? AND workflow_run_id = ?
            AND status = 'succeeded'
          ORDER BY finished_at DESC LIMIT 1
        )
        SELECT r.retrieval_id, r.runbook_id, r.version, v.owner, v.source_path,
          c.section_key, c.section_ordinal, c.chunk_ordinal, c.text,
          CASE WHEN rc.chunk_id IS NULL THEN 0 ELSE 1 END AS selected
        FROM selected_retrieval r
        JOIN runbook_versions v
          ON v.runbook_id = r.runbook_id AND v.version = r.version
        JOIN runbook_chunks c ON c.generation_id = r.generation_id
        LEFT JOIN runbook_retrieval_chunks rc
          ON rc.retrieval_id = r.retrieval_id
          AND rc.generation_id = c.generation_id AND rc.chunk_id = c.chunk_id
        ORDER BY c.section_ordinal, c.chunk_ordinal LIMIT 100`,
      args: [input.tenantId, input.incidentId, row.current_run_id ?? ''],
    }),
  ]);
  const triageResult = parseTriageResult(workflow.rows[0]?.triage_result_json);
  const canonicalPlan = parseCanonicalPlan(plan.rows[0]?.plan_json);
  if (plan.rows[0]) {
    if (
      !canonicalPlan ||
      canonicalPlan.planId !== String(plan.rows[0].id) ||
      canonicalPlan.incidentId !== input.incidentId ||
      canonicalPlan.tenantId !== input.tenantId ||
      canonicalPlan.planHash !== String(plan.rows[0].plan_hash) ||
      calculatePlanHash(canonicalPlan) !== canonicalPlan.planHash ||
      canonicalPlan.planHashVersion !== Number(plan.rows[0].plan_hash_version) ||
      canonicalPlan.expiresAt !== String(plan.rows[0].expires_at) ||
      !triageResult ||
      triageResult.status !== 'ready-for-approval' ||
      triageResult.plan.planHash !== canonicalPlan.planHash ||
      triageResult.plan.planId !== canonicalPlan.planId ||
      !sameActions(triageResult.plan.actions, canonicalPlan.actions) ||
      !sameActions(
        canonicalPlan.actions,
        actions.rows.map(action => ({
          actionId: String(action.action_id),
          type: String(action.action_type),
        })),
      )
    )
      throw new DomainError('NOT_FOUND');
    const approvalRow = approval.rows[0];
    if (
      approvalRow &&
      (String(approvalRow.plan_id) !== canonicalPlan.planId ||
        Number(approvalRow.plan_hash_version) !== canonicalPlan.planHashVersion ||
        String(approvalRow.plan_hash) !== canonicalPlan.planHash ||
        String(approvalRow.expires_at) !== canonicalPlan.expiresAt)
    )
      throw new DomainError('NOT_FOUND');
  }
  const projectedActions = actions.rows.map(item => ({
    actionId: String(item.action_id),
    type: String(item.action_type),
    status: String(item.status),
    resultRef: null,
  }));
  const completed = projectedActions.filter(action => action.status === 'completed').length;
  const failed = projectedActions.filter(action => action.status === 'failed').length;
  const deviceTrustState = await readDeviceTrustForIncident(store, input);
  const projectedManualReviewDecision = parseManualReviewDecision(
    manualReviewDecision.rows[0]?.payload_json,
    manualReviewDecision.rows[0]?.occurred_at,
  );
  const operationalState = projectDashboardOperationalState({
    incidentStatus: String(row.status),
    ...(triageResult?.status ? { triageStatus: triageResult.status } : {}),
    approvalDecision:
      approval.rows[0]?.decision === null || approval.rows[0]?.decision === undefined
        ? null
        : String(approval.rows[0].decision),
    manualReviewDecision: projectedManualReviewDecision?.decision ?? null,
    actionStatuses: projectedActions.map(action => action.status),
  });
  return {
    incident: {
      incidentId: String(row.id),
      kind: String(row.kind),
      severity: row.severity === null ? null : String(row.severity),
      status: String(row.status),
      subjectRef: String(row.subject_id),
      workflowRunId: row.current_run_id === null ? null : String(row.current_run_id),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    },
    deviceTrust: deviceTrustState
      ? {
          deviceId: deviceTrustState.attestation.payload.deviceId,
          signatureValid: deviceTrustState.signatureValid,
          authorizedAtIncident: deviceTrustState.authorizedAtIncident,
          currentlyAuthorized: deviceTrustState.currentlyAuthorized,
        }
      : null,
    evidence: evidence.rows.map(item => ({
      evidenceId: String(item.id),
      source: String(item.source),
      provider: String(item.provider),
      observedAt: String(item.observed_at),
      collectedAt: String(item.collected_at),
      confidence: Number(item.confidence),
      state: Number(item.incomplete) === 1 ? 'missing' : 'fact',
      errorCode: item.error_code === null ? null : 'EVIDENCE_UNAVAILABLE',
    })),
    timeline: timelineSnapshot.timeline,
    timelineCursor: `${input.incidentId}:${timelineSnapshot.cursor}`,
    plan:
      plan.rows[0] && canonicalPlan
        ? {
            planId: String(plan.rows[0].id),
            version: Number(plan.rows[0].plan_version),
            planHashVersion: Number(plan.rows[0].plan_hash_version),
            planHash: String(plan.rows[0].plan_hash),
            expiresAt: String(plan.rows[0].expires_at),
          }
        : null,
    approval: approval.rows[0]
      ? {
          approvalId: String(approval.rows[0].id),
          decision: approval.rows[0].decision === null ? null : String(approval.rows[0].decision),
          decidedAt: approval.rows[0].decided_at === null ? null : String(approval.rows[0].decided_at),
          reason:
            approval.rows[0].decision_reason === null ? null : String(approval.rows[0].decision_reason).slice(0, 2000),
          expiresAt: String(approval.rows[0].expires_at),
        }
      : null,
    actions: projectedActions,
    operationalState,
    outcome: {
      status:
        failed > 0 && completed > 0
          ? 'partial'
          : failed > 0
            ? 'failed'
            : completed === projectedActions.length && completed > 0
              ? 'completed'
              : 'pending',
      completedCount: completed,
      failedCount: failed,
    },
    triage:
      triageResult?.status === 'ready-for-approval' && Boolean(canonicalPlan)
        ? {
            summary: triageResult.summary.summary,
            facts: triageResult.summary.facts.map(fact => fact.text),
            hypotheses: triageResult.summary.hypotheses.map(hypothesis => hypothesis.text),
            runbook: triageResult.decision.runbookReference,
            actions: canonicalPlan!.actions.map(action => ({
              actionId: action.actionId,
              type: action.type,
              targetRef: action.targetId,
              impact: action.impact,
              preconditions: action.preconditions,
              rollback: action.rollback,
              verification: action.verification,
            })),
          }
        : null,
    manualReview:
      triageResult?.status === 'manual-review'
        ? {
            status: triageResult.status,
            reasonCodes: triageResult.reasonCodes,
            decision: projectedManualReviewDecision,
          }
        : null,
    runbook: projectDashboardRunbook(runbookRows.rows as Row[]),
  };
}

export function projectDashboardRunbook(rows: readonly Row[]) {
  const first = rows[0];
  if (
    !first ||
    typeof first.retrieval_id !== 'string' ||
    typeof first.runbook_id !== 'string' ||
    typeof first.version !== 'string' ||
    typeof first.owner !== 'string' ||
    typeof first.source_path !== 'string'
  )
    return null;
  const sections = new Map<string, { ordinal: number; chunks: string[]; selected: boolean }>();
  for (const row of rows) {
    if (
      row.retrieval_id !== first.retrieval_id ||
      row.runbook_id !== first.runbook_id ||
      row.version !== first.version ||
      row.owner !== first.owner ||
      row.source_path !== first.source_path ||
      typeof row.section_key !== 'string' ||
      typeof row.text !== 'string'
    )
      return null;
    const ordinal = Number(row.section_ordinal);
    if (!Number.isInteger(ordinal) || ordinal < 1 || ordinal > 32) return null;
    const section = sections.get(row.section_key) ?? {
      ordinal,
      chunks: [],
      selected: false,
    };
    if (section.ordinal !== ordinal) return null;
    section.chunks.push(row.text.slice(0, 1_200));
    section.selected ||= Number(row.selected) === 1;
    sections.set(row.section_key, section);
  }
  return {
    retrievalId: first.retrieval_id,
    runbookId: first.runbook_id,
    version: first.version,
    owner: first.owner,
    sourcePath: first.source_path,
    sections: [...sections.entries()]
      .sort(([, left], [, right]) => left.ordinal - right.ordinal)
      .map(([key, section]) => {
        const content = section.chunks.join('\n\n').trim();
        const [heading, ...body] = content.split('\n');
        return {
          key,
          title: heading?.startsWith('## ') ? heading.slice(3).trim() : key.replaceAll('-', ' '),
          content: (heading?.startsWith('## ') ? body.join('\n') : content).trim(),
          selected: section.selected,
        };
      }),
  };
}

function parseManualReviewDecision(payload: unknown, occurredAt: unknown) {
  if (typeof payload !== 'string' || typeof occurredAt !== 'string') return null;
  try {
    const value = JSON.parse(payload) as Record<string, unknown>;
    if (value.decision !== 'accepted' && value.decision !== 'dismissed' && value.decision !== 'resolved') return null;
    return {
      decision: value.decision,
      decidedAt: occurredAt,
      reason: typeof value.reason === 'string' ? value.reason.slice(0, 2_000) : null,
    };
  } catch {
    return null;
  }
}

/** Lightweight tenant-scoped handshake validation for SSE. */
export async function dashboardIncidentExists(
  store: OperationalStore,
  input: Readonly<{ tenantId: string; incidentId: string }>,
): Promise<boolean> {
  const result = await store.execute({
    sql: 'SELECT 1 FROM incidents WHERE tenant_id = ? AND id = ? LIMIT 1',
    args: [input.tenantId, input.incidentId],
  });
  return result.rows.length === 1;
}

export async function dashboardLastTimelineSequence(
  store: OperationalStore,
  input: Readonly<{ tenantId: string; incidentId: string }>,
): Promise<number> {
  const result = await store.execute({
    sql: 'SELECT MAX(sequence) AS sequence FROM timeline_events WHERE tenant_id = ? AND incident_id = ?',
    args: [input.tenantId, input.incidentId],
  });
  const sequence = result.rows[0]?.sequence;
  return sequence === null || sequence === undefined ? 0 : Number(sequence);
}

export async function listDashboardTimeline(
  store: OperationalStore,
  input: Readonly<{ tenantId: string; incidentId: string }>,
  afterSequence: number,
  limit: number,
): Promise<readonly DashboardTimelineEvent[]> {
  const result = await store.execute({
    sql: `SELECT t.sequence, t.type, t.occurred_at, t.payload_json, i.current_run_id FROM timeline_events t JOIN incidents i ON i.tenant_id = t.tenant_id AND i.id = t.incident_id WHERE t.tenant_id = ? AND t.incident_id = ? AND t.sequence > ? ORDER BY t.sequence LIMIT ?`,
    args: [input.tenantId, input.incidentId, afterSequence, limit],
  });
  return result.rows.map(row => ({
    incidentId: input.incidentId,
    workflowRunId: row.current_run_id === null ? null : String(row.current_run_id),
    sequence: Number(row.sequence),
    type: String(row.type),
    occurredAt: String(row.occurred_at),
    payloadRedacted: redactTimelinePayload(parsePayload(row.payload_json)),
  }));
}

/**
 * Reads the current bounded timeline window and its replay cursor at one
 * database boundary. The cursor is the last returned event, never a later
 * global maximum, so a concurrent append is replayed rather than skipped.
 */
export async function readDashboardTimelineSnapshot(
  store: DashboardQueryStore,
  input: Readonly<{ tenantId: string; incidentId: string }>,
  limit: number,
): Promise<Readonly<{ timeline: readonly DashboardTimelineEvent[]; cursor: number }>> {
  const result = await store.execute({
    sql: `/* dashboard_timeline_snapshot */ SELECT * FROM (SELECT t.sequence, t.type, t.occurred_at, t.payload_json, i.current_run_id FROM timeline_events t JOIN incidents i ON i.tenant_id = t.tenant_id AND i.id = t.incident_id WHERE t.tenant_id = ? AND t.incident_id = ? ORDER BY t.sequence DESC LIMIT ?) ORDER BY sequence ASC`,
    args: [input.tenantId, input.incidentId, limit],
  });
  const timeline = result.rows.map(row => ({
    incidentId: input.incidentId,
    workflowRunId: row.current_run_id === null ? null : String(row.current_run_id),
    sequence: Number(row.sequence),
    type: String(row.type),
    occurredAt: String(row.occurred_at),
    payloadRedacted: redactTimelinePayload(parsePayload(row.payload_json)),
  }));
  return { timeline, cursor: timeline.at(-1)?.sequence ?? 0 };
}

function parsePayload(value: unknown): unknown {
  try {
    return typeof value === 'string' ? JSON.parse(value) : {};
  } catch {
    return {};
  }
}

function parseTriageResult(value: unknown) {
  try {
    return typeof value === 'string' ? (TriageResultSchema.safeParse(JSON.parse(value)).data ?? null) : null;
  } catch {
    return null;
  }
}

function parseCanonicalPlan(value: unknown) {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : null;
    const result = ValidatedContainmentPlanSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

function sameActions(
  left: readonly { actionId: string; type: string }[],
  right: readonly { actionId: string; type: string }[],
): boolean {
  return (
    left.length === right.length &&
    left.every((action, index) => action.actionId === right[index]?.actionId && action.type === right[index]?.type)
  );
}
