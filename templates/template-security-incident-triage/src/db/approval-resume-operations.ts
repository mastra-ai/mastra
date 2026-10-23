import { digestResumeToken } from '../approval/resume-token.js';
import { systemClock, type Clock } from '../domain/clock.js';
import { DomainError, parseDomainSchema } from '../domain/errors.js';
import {
  AuthoritativeApprovalResultSchema,
  ExpiredApprovalResultSchema,
  type AuthoritativeApprovalResult,
  type ExpiredApprovalResult,
} from '../schemas/approval.js';
import type { OperationalStore } from './operational-store.js';

type TokenBinding = Readonly<{
  token: string;
  tenantId: string;
  incidentId: string;
  workflowRunId: string;
  approvalId: string;
}>;

export async function consumeResumeToken(
  store: OperationalStore,
  input: TokenBinding,
  dependencies: Readonly<{ clock?: Clock }> = {},
): Promise<AuthoritativeApprovalResult> {
  const existing = await store.execute({
    sql: `SELECT consumed_at FROM approval_resume_tokens
      WHERE token_digest = ? AND tenant_id = ? AND incident_id = ?
        AND workflow_run_id = ? AND approval_id = ?`,
    args: [digestResumeToken(input.token), input.tenantId, input.incidentId, input.workflowRunId, input.approvalId],
  });
  if (existing.rows[0]?.consumed_at) throw new DomainError('CONFLICT');
  return (await authorizeResumeToken(store, input, dependencies)).authoritative;
}

export async function authorizeResumeToken(
  store: OperationalStore,
  input: TokenBinding,
  dependencies: Readonly<{ clock?: Clock }> = {},
): Promise<
  Readonly<{
    resumeReceiptId: string;
    authoritative: AuthoritativeApprovalResult;
    resumed: boolean;
  }>
> {
  const now = (dependencies.clock ?? systemClock).now();
  return store.transaction(async tx => {
    const result = await tx.execute({
      sql: `SELECT t.*, a.plan_id, a.plan_hash_version, a.plan_hash,
        a.decided_by, a.decided_by_role, a.decided_at,
        a.expires_at AS approval_expires_at, i.current_plan_id,
        i.current_run_id, i.status AS incident_status
        FROM approval_resume_tokens t JOIN approvals a
          ON a.id = t.approval_id AND a.tenant_id = t.tenant_id
          AND a.incident_id = t.incident_id
        JOIN incidents i ON i.tenant_id = t.tenant_id AND i.id = t.incident_id
        WHERE t.token_digest = ? AND t.tenant_id = ? AND t.incident_id = ?
          AND t.workflow_run_id = ? AND t.approval_id = ?`,
      args: [digestResumeToken(input.token), input.tenantId, input.incidentId, input.workflowRunId, input.approvalId],
    });
    const row = result.rows[0];
    if (
      !row ||
      String(row.expires_at) <= now ||
      row.approval_expires_at !== row.expires_at ||
      row.current_plan_id !== row.plan_id ||
      row.current_run_id !== input.workflowRunId ||
      !['approved', 'rejected'].includes(String(row.incident_status)) ||
      row.decision !== row.incident_status ||
      row.decided_by_role !== 'soc_manager'
    )
      throw new DomainError('CONFLICT');
    if (row.consumed_at === null) {
      const consumed = await tx.execute({
        sql: `UPDATE approval_resume_tokens SET consumed_at = ?
          WHERE id = ? AND consumed_at IS NULL AND expires_at > ?`,
        args: [now, String(row.id), now],
      });
      if (consumed.rowsAffected !== 1) throw new DomainError('CONFLICT');
    }
    return {
      resumeReceiptId: String(row.id),
      authoritative: parseDomainSchema(AuthoritativeApprovalResultSchema, {
        approvalId: input.approvalId,
        planId: row.plan_id,
        incidentId: input.incidentId,
        tenantId: input.tenantId,
        workflowRunId: input.workflowRunId,
        planHashVersion: Number(row.plan_hash_version),
        planHash: row.plan_hash,
        decision: row.decision,
        decidedBy: row.decided_by,
        decidedByRole: row.decided_by_role,
        decidedAt: row.decided_at,
        expiresAt: row.expires_at,
      }),
      resumed: row.resumed_at !== null,
    };
  });
}

export async function markResumeReceiptResumed(
  store: OperationalStore,
  resumeReceiptId: string,
  dependencies: Readonly<{ clock?: Clock }> = {},
): Promise<void> {
  const now = (dependencies.clock ?? systemClock).now();
  const updated = await store.execute({
    sql: `UPDATE approval_resume_tokens SET resumed_at = ?
      WHERE id = ? AND consumed_at IS NOT NULL AND resumed_at IS NULL`,
    args: [now, resumeReceiptId],
  });
  if (updated.rowsAffected === 1) return;
  const current = await store.execute({
    sql: 'SELECT resumed_at FROM approval_resume_tokens WHERE id = ?',
    args: [resumeReceiptId],
  });
  if (!current.rows[0]?.resumed_at) throw new DomainError('CONFLICT');
}

export async function readConsumedResumeReceipt(
  store: OperationalStore,
  input: Readonly<{
    resumeReceiptId: string;
    tenantId: string;
    incidentId: string;
    workflowRunId: string;
    approvalId: string;
  }>,
): Promise<AuthoritativeApprovalResult | ExpiredApprovalResult> {
  if (input.resumeReceiptId === `expiry_${input.approvalId}`) {
    const result = await store.execute({
      sql: `SELECT a.plan_id, a.plan_hash_version, a.plan_hash, a.expires_at,
        i.updated_at, i.status FROM approvals a JOIN incidents i
          ON i.tenant_id = a.tenant_id AND i.id = a.incident_id
        WHERE a.tenant_id = ? AND a.incident_id = ? AND a.id = ?
          AND a.workflow_run_id = ? AND a.decision IS NULL`,
      args: [input.tenantId, input.incidentId, input.approvalId, input.workflowRunId],
    });
    const row = result.rows[0];
    if (!row || row.status !== 'failed') throw new DomainError('CONFLICT');
    return parseDomainSchema(ExpiredApprovalResultSchema, {
      approvalId: input.approvalId,
      planId: row.plan_id,
      incidentId: input.incidentId,
      tenantId: input.tenantId,
      workflowRunId: input.workflowRunId,
      planHashVersion: Number(row.plan_hash_version),
      planHash: row.plan_hash,
      decision: 'expired',
      expiredAt: row.updated_at,
      expiresAt: row.expires_at,
    });
  }
  const result = await store.execute({
    sql: `SELECT t.consumed_at, a.plan_id, a.plan_hash_version, a.plan_hash,
      a.decision, a.decided_by, a.decided_by_role, a.decided_at, a.expires_at
      FROM approval_resume_tokens t JOIN approvals a
        ON a.tenant_id = t.tenant_id AND a.incident_id = t.incident_id
        AND a.workflow_run_id = t.workflow_run_id AND a.id = t.approval_id
      WHERE t.id = ? AND t.tenant_id = ? AND t.incident_id = ?
        AND t.workflow_run_id = ? AND t.approval_id = ?`,
    args: [input.resumeReceiptId, input.tenantId, input.incidentId, input.workflowRunId, input.approvalId],
  });
  const row = result.rows[0];
  if (!row?.consumed_at) throw new DomainError('CONFLICT');
  return parseDomainSchema(AuthoritativeApprovalResultSchema, {
    approvalId: input.approvalId,
    planId: row.plan_id,
    incidentId: input.incidentId,
    tenantId: input.tenantId,
    workflowRunId: input.workflowRunId,
    planHashVersion: Number(row.plan_hash_version),
    planHash: row.plan_hash,
    decision: row.decision,
    decidedBy: row.decided_by,
    decidedByRole: row.decided_by_role,
    decidedAt: row.decided_at,
    expiresAt: row.expires_at,
  });
}
