import {
  authorizeResumeToken,
  decideApprovalAndIssueResumeToken,
  expirePendingApproval,
  markResumeReceiptResumed,
} from '../../db/approval-operations.js';
import type { OperationalStore } from '../../db/operational-store.js';
import { systemClock, type Clock } from '../../domain/clock.js';
import { DomainError } from '../../domain/errors.js';
import type { ApprovalConfig } from '../../env.js';
import type { ReconcileApprovalRun } from '../../approval/workflow-resume-reconciler.js';
import type { DashboardPrincipal } from '../auth/dashboard-principal.js';
import type { z } from 'zod';
import type { DashboardDecisionRequestSchema } from './contracts.js';

/** Calls the approval CAS/ledger authority; this module does not create approval state. */
export async function decideDashboardApproval(
  input: Readonly<{
    store: OperationalStore;
    approvalConfig: ApprovalConfig;
    principal: DashboardPrincipal;
    incidentId: string;
    body: z.infer<typeof DashboardDecisionRequestSchema>;
    correlationId: string;
    reconcileApprovalRun: ReconcileApprovalRun;
    clock?: Clock;
  }>,
) {
  if (input.principal.role !== 'soc_manager' || !input.approvalConfig.approvalResumeSecret) {
    throw new DomainError('NOT_FOUND');
  }
  const row = (
    await input.store.execute({
      sql: `SELECT i.version, i.current_run_id, a.id AS approval_id, a.plan_id, a.plan_hash_version,
      a.plan_hash, a.workflow_run_id, a.expires_at FROM approvals a JOIN incidents i
      ON i.tenant_id = a.tenant_id AND i.id = a.incident_id
      WHERE a.tenant_id = ? AND a.incident_id = ? AND a.plan_id = ?`,
      args: [input.principal.tenantId, input.incidentId, input.body.planId],
    })
  ).rows[0];
  if (
    !row ||
    row.plan_hash !== input.body.planHash ||
    Number(row.plan_hash_version) !== input.body.planHashVersion ||
    row.current_run_id !== row.workflow_run_id ||
    typeof row.workflow_run_id !== 'string' ||
    typeof row.approval_id !== 'string'
  ) {
    throw new DomainError('NOT_FOUND');
  }
  const now = (input.clock ?? systemClock).now();
  if (String(row.expires_at) <= now) {
    await expirePendingApproval(
      input.store,
      {
        tenantId: input.principal.tenantId,
        incidentId: input.incidentId,
        approvalId: row.approval_id,
        workflowRunId: row.workflow_run_id,
        correlationId: input.correlationId,
      },
      { clock: input.clock },
    );
    throw new DomainError('CONFLICT');
  }
  const decision =
    input.body.decision === 'approved'
      ? {
          schemaVersion: 1 as const,
          approvalId: row.approval_id,
          planId: input.body.planId,
          incidentId: input.incidentId,
          tenantId: input.principal.tenantId,
          planHashVersion: input.body.planHashVersion,
          planHash: input.body.planHash,
          decision: 'approved' as const,
          decidedBy: input.principal.userRef,
          decidedByRole: 'soc_manager' as const,
          decidedAt: now,
          ...(input.body.reason ? { reason: input.body.reason } : {}),
        }
      : {
          schemaVersion: 1 as const,
          approvalId: row.approval_id,
          planId: input.body.planId,
          incidentId: input.incidentId,
          tenantId: input.principal.tenantId,
          planHashVersion: input.body.planHashVersion,
          planHash: input.body.planHash,
          decision: 'rejected' as const,
          decidedBy: input.principal.userRef,
          decidedByRole: 'soc_manager' as const,
          decidedAt: now,
          reason: input.body.reason!,
        };
  const issued = await decideApprovalAndIssueResumeToken(
    input.store,
    {
      decision,
      expectedIncidentVersion: Number(row.version),
      runId: row.workflow_run_id,
      correlationId: input.correlationId,
      resumeSecret: input.approvalConfig.approvalResumeSecret,
      decisionProvenance: 'dashboard',
    },
    { clock: input.clock },
  );
  const authorized = await authorizeResumeToken(
    input.store,
    {
      token: issued.resumeToken,
      tenantId: input.principal.tenantId,
      incidentId: input.incidentId,
      workflowRunId: row.workflow_run_id,
      approvalId: row.approval_id,
    },
    { clock: input.clock },
  );
  let resumed = authorized.resumed;
  if (!resumed) {
    const result = await input.reconcileApprovalRun({
      workflowRunId: row.workflow_run_id,
      resumeReceiptId: authorized.resumeReceiptId,
      expectedResultStatuses: issued.decision.decision === 'approved' ? ['contained', 'failed'] : ['rejected'],
    });
    resumed = result === 'completed';
    if (resumed)
      await markResumeReceiptResumed(input.store, authorized.resumeReceiptId, {
        clock: input.clock,
      });
  }
  return {
    approvalId: row.approval_id,
    incidentId: input.incidentId,
    decision: issued.decision.decision,
    decidedAt: issued.decision.decidedAt,
    resumed,
  };
}
