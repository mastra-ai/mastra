import type { Clock } from '../domain/clock.js';
import { systemClock } from '../domain/clock.js';
import type { IdGenerator } from '../domain/id-generator.js';
import { uuidGenerator } from '../domain/id-generator.js';
import {
  expirePendingApproval,
  markResumeReceiptResumed,
  type ExpiredApprovalWork,
} from '../db/approval-operations.js';
import { deliverExternalIncident } from '../db/provider-delivery-operations.js';
import type { OperationalStore } from '../db/operational-store.js';
import { ExternalIncidentProjectionSchema, type IncidentProvider } from '../providers/incident-provider.js';
import { retryPartialContainment } from '../containment/partial-retry.js';
import type { LocalContainmentState } from '../containment/local-state.js';
import type { IdentityProvider } from '../providers/identity-provider.js';
import { ContainmentPlanSchema } from '../schemas/containment.js';
import type { ReconcileApprovalRun } from '../approval/workflow-resume-reconciler.js';
import { startWorkflowBoundary } from '../mastra/observability.js';
import { advanceWorkflowTrace, readWorkflowTrace } from '../mastra/workflow-trace.js';

export class ApprovalRecoveryWorker {
  constructor(
    private readonly dependencies: Readonly<{
      store: OperationalStore;
      provider: IncidentProvider;
      reconcileApprovalRun: ReconcileApprovalRun;
      clock?: Clock;
      ids?: IdGenerator;
      maxProviderAttempts?: number;
      providerTimeoutMs?: number;
      containmentState?: LocalContainmentState;
      mode?: 'local' | 'staging' | 'production';
      actionTimeoutMs?: number;
      rateLimit?: number;
      identityProvider?: IdentityProvider;
    }>,
  ) {}

  async runOnce(): Promise<
    Readonly<{
      resumed: number;
      expired: number;
      delivered: number;
      containmentRetried: number;
    }>
  > {
    let firstError: unknown;
    const attempt = async (operation: () => Promise<boolean>) => {
      try {
        return await operation();
      } catch (error) {
        firstError ??= error;
        return false;
      }
    };
    const resumed = await attempt(() => this.resumeDecisionOne());
    const expired = await attempt(() => this.expireOne());
    const containmentRetried = await attempt(() => this.retryContainmentOne());
    const delivered = await attempt(() => this.deliverOne());
    await attempt(() => this.completeTerminalRunOne());
    if (firstError) throw firstError;
    return {
      resumed: resumed ? 1 : 0,
      expired: expired ? 1 : 0,
      delivered: delivered ? 1 : 0,
      containmentRetried: containmentRetried ? 1 : 0,
    };
  }

  private async resumeDecisionOne(): Promise<boolean> {
    const due = await this.dependencies.store.execute({
      sql: `SELECT token.id, token.workflow_run_id, token.decision,
          incident.status AS incident_status, run.status AS workflow_status
        FROM approval_resume_tokens token JOIN approvals approval
          ON approval.tenant_id = token.tenant_id
          AND approval.incident_id = token.incident_id
          AND approval.workflow_run_id = token.workflow_run_id
          AND approval.id = token.approval_id
        JOIN incidents incident
          ON incident.tenant_id = approval.tenant_id
          AND incident.id = approval.incident_id
          AND incident.current_plan_id = approval.plan_id
          AND incident.current_run_id = token.workflow_run_id
        JOIN workflow_runs run
          ON run.tenant_id = token.tenant_id
          AND run.incident_id = token.incident_id
          AND run.run_id = token.workflow_run_id
        WHERE token.consumed_at IS NOT NULL AND token.resumed_at IS NULL
        ORDER BY token.consumed_at, token.id LIMIT 1`,
    });
    const row = due.rows[0];
    if (!row) return false;
    if (row.incident_status === 'closed' && row.workflow_status === 'completed') {
      await markResumeReceiptResumed(this.dependencies.store, String(row.id), {
        clock: this.dependencies.clock,
      });
      return true;
    }
    const reconciliation = await this.dependencies.reconcileApprovalRun({
      workflowRunId: String(row.workflow_run_id),
      resumeReceiptId: String(row.id),
      expectedResultStatuses: row.decision === 'approved' ? ['contained', 'failed'] : ['rejected'],
    });
    if (reconciliation === 'in_progress') return false;
    await markResumeReceiptResumed(this.dependencies.store, String(row.id), {
      clock: this.dependencies.clock,
    });
    return true;
  }

  private async retryContainmentOne(): Promise<boolean> {
    // Approval expiry never grants another mutation. It does not, however,
    // permit an old uncertain WorkOS ledger to remain non-terminal forever.
    // Sweep that read-only recovery budget before considering normal retries.
    if (await this.sweepExhaustedWorkOsReconciliationOne()) return true;
    if (!this.dependencies.containmentState) return false;
    const now = (this.dependencies.clock ?? systemClock).now();
    const due = await this.dependencies.store.execute({
      sql: `SELECT i.tenant_id, i.id AS incident_id, i.current_run_id,
        a.id AS approval_id,
        (SELECT completed.correlation_id FROM timeline_events completed
          WHERE completed.tenant_id = i.tenant_id
            AND completed.incident_id = i.id
            AND completed.type = 'containment.completed'
            AND completed.causation_id = a.id
            AND json_extract(completed.payload_json, '$.status') = 'contained'
          ORDER BY completed.sequence DESC LIMIT 1
        ) AS containment_correlation_id
        FROM incidents i JOIN approvals a
          ON a.tenant_id = i.tenant_id AND a.incident_id = i.id
          AND a.plan_id = i.current_plan_id
        WHERE a.decision = 'approved' AND (
          (i.status IN ('failed','containing') AND a.expires_at > ?
            AND NOT EXISTS (
              SELECT 1 FROM containment_action_attempts active
              WHERE active.tenant_id = i.tenant_id
                AND active.incident_id = i.id
                AND active.plan_id = i.current_plan_id
                AND active.status = 'executing' AND active.lease_expires_at > ?
            )
            AND EXISTS (
              SELECT 1 FROM containment_actions action
              WHERE action.tenant_id = i.tenant_id AND action.incident_id = i.id
                AND action.plan_id = i.current_plan_id
                AND action.status IN ('pending','failed','blocked','timed_out')
                AND (
                  SELECT count(*) FROM containment_action_attempts attempt
                  WHERE attempt.tenant_id = action.tenant_id
                    AND attempt.plan_id = action.plan_id
                    AND attempt.action_id = action.action_id
                ) < 3
            ))
          OR (i.status = 'contained' AND NOT EXISTS (
            SELECT 1 FROM timeline_events terminal
            WHERE terminal.tenant_id = i.tenant_id
              AND terminal.incident_id = i.id
              AND terminal.type = 'incident.status_changed'
              AND json_extract(terminal.payload_json, '$.to') = 'closed'
          ))
        )
        ORDER BY i.updated_at, i.id LIMIT 1`,
      args: [now, now],
    });
    const row = due.rows[0];
    if (!row) return false;
    const correlationId =
      typeof row.containment_correlation_id === 'string'
        ? row.containment_correlation_id
        : `partial_retry_${String(row.approval_id)}`;
    const retried = await retryPartialContainment(
      this.dependencies.store,
      {
        tenantId: String(row.tenant_id),
        incidentId: String(row.incident_id),
        workflowRunId: String(row.current_run_id),
        approvalId: String(row.approval_id),
        correlationId,
        state: this.dependencies.containmentState,
        mode: this.dependencies.mode ?? 'local',
        timeoutMs: this.dependencies.actionTimeoutMs ?? 1_000,
        rateLimit: this.dependencies.rateLimit ?? 8,
        ...(this.dependencies.identityProvider ? { identityProvider: this.dependencies.identityProvider } : {}),
      },
      {
        clock: this.dependencies.clock,
        ids: this.dependencies.ids,
      },
    );
    if (retried.status === 'contained') {
      const projection = await this.recoveredContainmentProjection(String(row.tenant_id), String(row.incident_id));
      await deliverExternalIncident(
        this.dependencies.store,
        this.dependencies.provider,
        {
          operation: 'final-contained',
          projection,
          workflowRunId: String(row.current_run_id),
          correlationId,
        },
        {
          clock: this.dependencies.clock,
          ids: this.dependencies.ids ?? uuidGenerator,
          maxAttempts: this.dependencies.maxProviderAttempts,
          timeoutMs: this.dependencies.providerTimeoutMs,
        },
      );
    }
    return true;
  }

  private async completeTerminalRunOne(): Promise<boolean> {
    const now = (this.dependencies.clock ?? systemClock).now();
    const completed = await this.dependencies.store.execute({
      sql: `UPDATE workflow_runs SET status = 'completed', finished_at = ?
        WHERE id = (
          SELECT run.id FROM workflow_runs run JOIN incidents incident
            ON incident.tenant_id = run.tenant_id
            AND incident.id = run.incident_id
            AND incident.current_run_id = run.run_id
          WHERE run.status = 'running' AND incident.status = 'closed'
          ORDER BY incident.updated_at, run.started_at LIMIT 1
        ) AND status = 'running'`,
      args: [now],
    });
    return completed.rowsAffected === 1;
  }

  private async sweepExhaustedWorkOsReconciliationOne(): Promise<boolean> {
    const now = (this.dependencies.clock ?? systemClock).now();
    return this.dependencies.store.transaction(async tx => {
      const due = await tx.execute({
        sql: `SELECT ledger.idempotency_key, ledger.tenant_id, ledger.incident_id,
          ledger.plan_id, ledger.action_id, attempt.id AS attempt_id,
          attempt.fence_token
          FROM provider_effect_ledger ledger
          JOIN containment_action_attempts attempt
            ON attempt.tenant_id = ledger.tenant_id
            AND attempt.incident_id = ledger.incident_id
            AND attempt.plan_id = ledger.plan_id
            AND attempt.action_id = ledger.action_id
            AND attempt.status = 'executing'
            AND attempt.lease_expires_at <= ?
          WHERE ledger.provider = 'workos' AND ledger.status = 'uncertain'
            AND (SELECT count(*) FROM containment_action_attempts attempt
              WHERE attempt.tenant_id = ledger.tenant_id
                AND attempt.plan_id = ledger.plan_id
                AND attempt.action_id = ledger.action_id) >= 6
            AND NOT EXISTS (
              SELECT 1 FROM containment_action_attempts active
              WHERE active.tenant_id = ledger.tenant_id
                AND active.incident_id = ledger.incident_id
                AND active.plan_id = ledger.plan_id
                AND active.action_id = ledger.action_id
                AND active.status = 'executing'
                AND active.lease_expires_at > ?
            )
          ORDER BY ledger.claimed_at, ledger.idempotency_key, attempt.attempt DESC LIMIT 1`,
        args: [now, now],
      });
      const row = due.rows[0];
      if (!row) return false;
      const attempt = await tx.execute({
        sql: `UPDATE containment_action_attempts SET status = 'failed', finished_at = ?,
          error_code = 'PROVIDER_FAILED', verification = 'not_run'
          WHERE id = ? AND status = 'executing' AND fence_token = ?
            AND lease_expires_at <= ?`,
        args: [now, String(row.attempt_id), String(row.fence_token), now],
      });
      if (attempt.rowsAffected !== 1) throw new Error('stale containment attempt fence');
      const action = await tx.execute({
        sql: `UPDATE containment_actions SET status = 'failed'
          WHERE tenant_id = ? AND incident_id = ? AND plan_id = ? AND action_id = ?
            AND status = 'executing'`,
        args: [String(row.tenant_id), String(row.incident_id), String(row.plan_id), String(row.action_id)],
      });
      if (action.rowsAffected !== 1) throw new Error('stale containment action fence');
      const ledger = await tx.execute({
        sql: `UPDATE provider_effect_ledger SET status = 'failed', completed_at = ?
          WHERE provider = 'workos' AND idempotency_key = ? AND status = 'uncertain'`,
        args: [now, String(row.idempotency_key)],
      });
      if (ledger.rowsAffected !== 1) throw new Error('stale WorkOS ledger');
      return true;
    });
  }

  private async recoveredContainmentProjection(tenantId: string, incidentId: string) {
    const result = await this.dependencies.store.execute({
      sql: `SELECT i.kind, i.status, i.created_at, p.plan_json,
          json_extract(run.triage_result_json, '$.decision.severity') AS severity
        FROM incidents i JOIN containment_plans p
          ON p.tenant_id = i.tenant_id AND p.incident_id = i.id
          AND p.id = i.current_plan_id
        JOIN workflow_runs run
          ON run.tenant_id = i.tenant_id AND run.incident_id = i.id
          AND run.run_id = i.current_run_id
        WHERE i.tenant_id = ? AND i.id = ?`,
      args: [tenantId, incidentId],
    });
    const row = result.rows[0];
    if (!row) throw new Error('recovered containment projection is missing');
    const plan = ContainmentPlanSchema.parse(JSON.parse(String(row.plan_json)));
    return ExternalIncidentProjectionSchema.parse({
      incidentId,
      tenantId,
      kind: row.kind,
      severity: row.severity,
      status: row.status,
      occurredAt: row.created_at,
      summaryCode: 'CONTAINMENT_SUCCEEDED',
      planHashVersion: plan.planHashVersion,
      planHash: plan.planHash,
      actionTypes: plan.actions.map(action => action.type),
    });
  }

  private async expireOne(): Promise<boolean> {
    const now = (this.dependencies.clock ?? systemClock).now();
    const due = await this.dependencies.store.execute({
      sql: `SELECT a.tenant_id, a.incident_id, a.id AS approval_id,
        a.workflow_run_id, i.status AS incident_status
        FROM approvals a JOIN incidents i
          ON i.tenant_id = a.tenant_id AND i.id = a.incident_id
        WHERE a.decision IS NULL AND a.expires_at <= ?
          AND a.expiry_resumed_at IS NULL
          AND i.status IN ('awaiting_approval','failed')
        ORDER BY a.expires_at, a.id LIMIT 1`,
      args: [now],
    });
    const row = due.rows[0];
    if (!row) return false;
    const work: ExpiredApprovalWork = {
      tenantId: String(row.tenant_id),
      incidentId: String(row.incident_id),
      approvalId: String(row.approval_id),
      workflowRunId: String(row.workflow_run_id),
      correlationId: `expiry_${String(row.approval_id)}`,
    };
    const workflowTrace = await readWorkflowTrace(this.dependencies.store, {
      tenantId: work.tenantId,
      incidentId: work.incidentId,
      workflowRunId: work.workflowRunId,
    });
    const trace = startWorkflowBoundary({
      boundary: 'approval.expiry',
      tenantId: work.tenantId,
      incidentId: work.incidentId,
      runId: work.workflowRunId,
      correlationId: work.correlationId,
      requestId: work.approvalId,
      ...(workflowTrace ? { context: workflowTrace } : {}),
      identifiers: { stepId: 'approval-expiry', provider: 'linear' },
    });
    try {
      if (row.incident_status === 'awaiting_approval') {
        const changed = await expirePendingApproval(this.dependencies.store, work, {
          clock: this.dependencies.clock,
          ids: this.dependencies.ids ?? uuidGenerator,
        });
        if (!changed) {
          trace.span.end({ attributes: { success: false } as never });
          return false;
        }
      }
      // The reconciler resumes immediately below; persist the completed
      // expiry span first so approval.resume cannot reopen approval.await.
      trace.span.end({ attributes: { success: true } as never });
      if (workflowTrace)
        await advanceWorkflowTrace(this.dependencies.store, {
          tenantId: work.tenantId,
          incidentId: work.incidentId,
          workflowRunId: work.workflowRunId,
          previous: workflowTrace,
          next: {
            ...trace.context,
            runId: work.workflowRunId,
            requestId: workflowTrace.requestId,
          },
        });
      const reconciliation = await this.dependencies.reconcileApprovalRun({
        workflowRunId: work.workflowRunId,
        resumeReceiptId: `expiry_${work.approvalId}`,
        expectedResultStatuses: ['expired'],
      });
      if (reconciliation === 'in_progress') {
        trace.span.end({ attributes: { success: false } as never });
        return false;
      }
      const marked = await this.dependencies.store.execute({
        sql: `UPDATE approvals SET expiry_resumed_at = ?
          WHERE tenant_id = ? AND incident_id = ? AND id = ?
            AND decision IS NULL AND expiry_resumed_at IS NULL`,
        args: [now, work.tenantId, work.incidentId, work.approvalId],
      });
      trace.span.end({
        attributes: { success: marked.rowsAffected === 1 } as never,
      });
      return marked.rowsAffected === 1;
    } catch (error) {
      trace.span.error({ error: error as Error, endSpan: true });
      throw error;
    }
  }

  private async deliverOne(): Promise<boolean> {
    const now = (this.dependencies.clock ?? systemClock).now();
    const providerId = this.dependencies.provider.providerId ?? 'local-incident';
    const due = await this.dependencies.store.execute({
      sql: `SELECT * FROM provider_deliveries
        WHERE provider = ? AND status IN ('pending','retry','delivering','uncertain')
          AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
        ORDER BY CASE operation WHEN 'open-awaiting-approval' THEN 0 ELSE 1 END,
          next_attempt_at, id LIMIT 1`,
      args: [providerId, now],
    });
    const row = due.rows[0];
    if (!row?.projection_json || !row.workflow_run_id || !row.correlation_id) {
      return false;
    }
    let projection: unknown;
    try {
      projection = JSON.parse(String(row.projection_json));
    } catch {
      return false;
    }
    const parsed = ExternalIncidentProjectionSchema.parse(projection);
    const delivered = await deliverExternalIncident(
      this.dependencies.store,
      this.dependencies.provider,
      {
        operation: parseOperation(String(row.operation)),
        projection: parsed,
        workflowRunId: String(row.workflow_run_id),
        correlationId: String(row.correlation_id),
      },
      {
        clock: this.dependencies.clock,
        ids: this.dependencies.ids ?? uuidGenerator,
        maxAttempts: this.dependencies.maxProviderAttempts,
        timeoutMs: this.dependencies.providerTimeoutMs,
      },
    );
    return delivered.status !== 'in_progress' && delivered.status !== 'uncertain';
  }
}

function parseOperation(value: string) {
  if (
    value === 'open-awaiting-approval' ||
    value === 'decision-rejected' ||
    value === 'final-contained' ||
    value === 'final-failed'
  ) {
    return value;
  }
  throw new Error('invalid provider operation');
}
