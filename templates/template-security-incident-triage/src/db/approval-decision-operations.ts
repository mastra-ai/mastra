import { decisionFingerprint, deriveResumeToken, digestResumeToken } from '../approval/resume-token.js';
import { systemClock, type Clock } from '../domain/clock.js';
import { DomainError, parseDomainSchema } from '../domain/errors.js';
import { uuidGenerator, type IdGenerator } from '../domain/id-generator.js';
import { ApprovalDecisionSchema, type ApprovalDecision } from '../schemas/approval.js';
import { insertTimelineAndOutbox } from './incident-operations.js';
import type { OperationalStore } from './operational-store.js';

type DecisionInput = Readonly<{
  decision: ApprovalDecision;
  expectedIncidentVersion: number;
  runId: string;
  correlationId: string;
  /** Identifies whether the decision came from a local or dashboard boundary. */
  decisionProvenance?: 'local' | 'dashboard';
}>;

export async function decideApproval(
  store: OperationalStore,
  input: DecisionInput,
  dependencies: Readonly<{
    clock?: Clock;
    ids?: IdGenerator;
    resumeToken?: Readonly<{
      tokenId: string;
      token: string;
      workflowRunId: string;
      decisionFingerprint: string;
    }>;
  }> = {},
): Promise<ApprovalDecision> {
  const decision = parseDomainSchema(ApprovalDecisionSchema, input.decision);
  const decisionProvenance = input.decisionProvenance ?? 'local';
  const now = (dependencies.clock ?? systemClock).now();
  const ids = dependencies.ids ?? uuidGenerator;
  return store.transaction(async tx => {
    const result = await tx.execute({
      sql: `SELECT a.decision, a.decided_by, a.decided_by_role, a.decision_reason,
        a.decided_at, a.decision_provenance, a.requested_at, a.expires_at, a.plan_hash, a.plan_hash_version,
        p.plan_hash AS containment_plan_hash,
        p.plan_hash_version AS containment_plan_hash_version,
        i.current_plan_id, i.current_run_id, i.updated_at AS incident_updated_at,
        a.workflow_run_id, a.decision_fingerprint
        FROM approvals a JOIN containment_plans p
          ON p.tenant_id = a.tenant_id AND p.incident_id = a.incident_id AND p.id = a.plan_id
        JOIN incidents i ON i.tenant_id = a.tenant_id AND i.id = a.incident_id
        WHERE a.tenant_id = ? AND a.incident_id = ? AND a.plan_id = ? AND a.id = ?`,
      args: [decision.tenantId, decision.incidentId, decision.planId, decision.approvalId],
    });
    const current = result.rows[0];
    if (!current) throw new DomainError('NOT_FOUND');
    if (
      current.plan_hash !== decision.planHash ||
      Number(current.plan_hash_version) !== decision.planHashVersion ||
      current.containment_plan_hash !== decision.planHash ||
      Number(current.containment_plan_hash_version) !== decision.planHashVersion
    )
      throw new DomainError('CONFLICT');
    if (current.decision !== null) {
      if (
        current.decision === decision.decision &&
        current.decided_by === decision.decidedBy &&
        current.decided_by_role === decision.decidedByRole &&
        current.decision_provenance === decisionProvenance &&
        current.decision_reason === (decision.reason ?? null)
      )
        return parseDomainSchema(ApprovalDecisionSchema, {
          ...decision,
          decidedAt: current.decided_at,
        });
      throw new DomainError('CONFLICT');
    }
    if (
      current.current_plan_id !== decision.planId ||
      current.workflow_run_id !== input.runId ||
      current.current_run_id !== input.runId ||
      String(current.requested_at) > decision.decidedAt ||
      String(current.incident_updated_at) > decision.decidedAt ||
      decision.decidedAt > now ||
      String(current.expires_at) <= now
    )
      throw new DomainError('CONFLICT');
    const fingerprint = dependencies.resumeToken?.decisionFingerprint ?? decisionFingerprint(decision, input.runId);
    const approvalUpdate = await tx.execute({
      sql: `UPDATE approvals SET decision = ?, decided_by = ?, decided_by_role = ?,
        decision_reason = ?, decided_at = ?, decision_fingerprint = ?, decision_provenance = ?
        WHERE tenant_id = ? AND incident_id = ? AND plan_id = ? AND id = ?
          AND plan_hash_version = ? AND plan_hash = ? AND decision IS NULL`,
      args: [
        decision.decision,
        decision.decidedBy,
        decision.decidedByRole,
        decision.reason ?? null,
        decision.decidedAt,
        fingerprint,
        decisionProvenance,
        decision.tenantId,
        decision.incidentId,
        decision.planId,
        decision.approvalId,
        decision.planHashVersion,
        decision.planHash,
      ],
    });
    if (approvalUpdate.rowsAffected !== 1) throw new DomainError('CONFLICT');
    const incidentUpdate = await tx.execute({
      sql: `UPDATE incidents SET status = ?, version = version + 1,
        timeline_sequence = timeline_sequence + 1, updated_at = ?
        WHERE tenant_id = ? AND id = ? AND current_plan_id = ?
          AND status = 'awaiting_approval' AND version = ? AND updated_at <= ?
        RETURNING timeline_sequence`,
      args: [
        decision.decision,
        decision.decidedAt,
        decision.tenantId,
        decision.incidentId,
        decision.planId,
        input.expectedIncidentVersion,
        decision.decidedAt,
      ],
    });
    const incident = incidentUpdate.rows[0];
    if (!incident) throw new DomainError('CONFLICT');
    if (dependencies.resumeToken) {
      await tx.execute({
        sql: `INSERT INTO approval_resume_tokens(id, tenant_id, incident_id,
          workflow_run_id, approval_id, decision, decision_fingerprint,
          digest_version, token_digest, issued_at, expires_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
        args: [
          dependencies.resumeToken.tokenId,
          decision.tenantId,
          decision.incidentId,
          dependencies.resumeToken.workflowRunId,
          decision.approvalId,
          decision.decision,
          fingerprint,
          digestResumeToken(dependencies.resumeToken.token),
          decision.decidedAt,
          String(current.expires_at),
        ],
      });
    }
    await insertTimelineAndOutbox(tx, {
      timelineId: ids.next(),
      eventId: ids.next(),
      incidentId: decision.incidentId,
      tenantId: decision.tenantId,
      sequence: Number(incident.timeline_sequence),
      type: 'approval.decided',
      eventType: 'security.approval.decided',
      runId: input.runId,
      correlationId: input.correlationId,
      causationId: decision.approvalId,
      occurredAt: decision.decidedAt,
      payload: {
        approvalId: decision.approvalId,
        decision: decision.decision,
        planId: decision.planId,
      },
    });
    return decision;
  });
}

export async function decideApprovalAndIssueResumeToken(
  store: OperationalStore,
  input: DecisionInput & Readonly<{ resumeSecret: string }>,
  dependencies: Readonly<{ clock?: Clock; ids?: IdGenerator }> = {},
): Promise<Readonly<{ decision: ApprovalDecision; resumeToken: string }>> {
  const parsed = parseDomainSchema(ApprovalDecisionSchema, input.decision);
  const existing = await store.execute({
    sql: `SELECT a.decision, a.decided_by, a.decided_by_role, a.decision_reason,
      a.decided_at, a.workflow_run_id, a.decision_fingerprint
      FROM approvals a WHERE a.tenant_id = ? AND a.incident_id = ? AND a.id = ?`,
    args: [parsed.tenantId, parsed.incidentId, parsed.approvalId],
  });
  const row = existing.rows[0];
  if (row?.decision !== null && row?.decision !== undefined) {
    const persistedDecision = parseDomainSchema(ApprovalDecisionSchema, {
      ...parsed,
      decidedAt: row.decided_at,
    });
    const persistedFingerprint = decisionFingerprint(persistedDecision, input.runId);
    const persistedResumeToken = deriveResumeToken(input.resumeSecret, {
      tenantId: parsed.tenantId,
      incidentId: parsed.incidentId,
      workflowRunId: input.runId,
      approvalId: parsed.approvalId,
      decisionFingerprint: persistedFingerprint,
    });
    if (
      row.decision !== parsed.decision ||
      row.decided_by !== parsed.decidedBy ||
      row.decided_by_role !== parsed.decidedByRole ||
      row.decision_reason !== (parsed.reason ?? null) ||
      row.workflow_run_id !== input.runId ||
      row.decision_fingerprint !== persistedFingerprint
    )
      throw new DomainError('CONFLICT');
    const token = await store.execute({
      sql: `SELECT token_digest FROM approval_resume_tokens
        WHERE tenant_id = ? AND incident_id = ? AND workflow_run_id = ?
          AND approval_id = ? AND decision = ?`,
      args: [parsed.tenantId, parsed.incidentId, input.runId, parsed.approvalId, parsed.decision],
    });
    if (token.rows[0]?.token_digest !== digestResumeToken(persistedResumeToken)) throw new DomainError('CONFLICT');
    return {
      decision: persistedDecision,
      resumeToken: persistedResumeToken,
    };
  }
  const fingerprint = decisionFingerprint(parsed, input.runId);
  const resumeToken = deriveResumeToken(input.resumeSecret, {
    tenantId: parsed.tenantId,
    incidentId: parsed.incidentId,
    workflowRunId: input.runId,
    approvalId: parsed.approvalId,
    decisionFingerprint: fingerprint,
  });
  const decision = await decideApproval(store, input, {
    ...dependencies,
    resumeToken: {
      tokenId: `resume_${fingerprint}`,
      token: resumeToken,
      workflowRunId: input.runId,
      decisionFingerprint: fingerprint,
    },
  });
  return { decision, resumeToken };
}
