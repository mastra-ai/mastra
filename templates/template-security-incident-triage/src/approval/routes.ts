import type { Hono } from 'hono';
import { randomUUID } from 'node:crypto';

import {
  authorizeResumeToken,
  decideApprovalAndIssueResumeToken,
  expirePendingApproval,
  markResumeReceiptResumed,
} from '../db/approval-operations.js';
import type { OperationalStore } from '../db/operational-store.js';
import { DomainError } from '../domain/errors.js';
import type { Clock } from '../domain/clock.js';
import { systemClock } from '../domain/clock.js';
import type { ApprovalConfig } from '../env.js';
import type { AppEnv } from '../http-context.js';
import type { StructuredLogger } from '../logging.js';
import { ApprovalDecisionRequestSchema } from '../schemas/approval.js';
import { startWorkflowBoundary } from '../mastra/observability.js';
import { advanceWorkflowTrace, readWorkflowTrace } from '../mastra/workflow-trace.js';
import { DecisionAuthenticationError, type DecisionAuthenticator } from './decision-authenticator.js';
import type { ReconcileApprovalRun } from './workflow-resume-reconciler.js';

export function registerApprovalRoutes(
  app: Hono<AppEnv>,
  dependencies: Readonly<{
    config: ApprovalConfig;
    store: OperationalStore;
    logger: StructuredLogger;
    authenticator: DecisionAuthenticator;
    reconcileApprovalRun: ReconcileApprovalRun;
    clock?: Clock;
  }>,
): void {
  app.post('/api/incidents/:incidentId/approvals/:approvalId/decision', async context => {
    const rawBody = new Uint8Array(await context.req.arrayBuffer());
    let decisionTrace: ReturnType<typeof startWorkflowBoundary> | undefined;
    try {
      const auth = await dependencies.authenticator.authenticate({
        method: context.req.method,
        path: new URL(context.req.url).pathname,
        rawBody,
        signature: context.req.header('X-Decision-Signature'),
        nonce: context.req.header('X-Decision-Nonce'),
        tenantId: context.req.header('X-Decision-Tenant'),
      });
      if (
        auth.role !== 'soc_manager' ||
        !auth.local ||
        dependencies.config.mode !== 'local' ||
        !dependencies.config.localApprovalsEnabled ||
        !dependencies.config.approvalResumeSecret
      ) {
        throw new DecisionAuthenticationError('AUTHENTICATION_MODE_DENIED');
      }
      const body = ApprovalDecisionRequestSchema.safeParse(parseJson(rawBody));
      if (!body.success) throw new DomainError('VALIDATION_FAILED');
      const incidentId = context.req.param('incidentId');
      const approvalId = context.req.param('approvalId');
      const state = await dependencies.store.execute({
        sql: `SELECT i.version, i.current_run_id, a.plan_id, a.plan_hash_version,
            a.plan_hash, a.workflow_run_id, a.expires_at
            FROM approvals a JOIN incidents i
              ON i.tenant_id = a.tenant_id AND i.id = a.incident_id
            WHERE a.tenant_id = ? AND a.incident_id = ? AND a.id = ?`,
        args: [auth.tenantId, incidentId, approvalId],
      });
      const row = state.rows[0];
      if (
        !row ||
        row.plan_id !== body.data.planId ||
        Number(row.plan_hash_version) !== body.data.planHashVersion ||
        row.plan_hash !== body.data.planHash ||
        row.current_run_id !== row.workflow_run_id ||
        typeof row.workflow_run_id !== 'string'
      ) {
        throw new DomainError('NOT_FOUND');
      }
      const traceCorrelationId =
        typeof context.get('correlationId') === 'string' ? context.get('correlationId') : row.workflow_run_id;
      const traceRequestId =
        typeof context.get('requestId') === 'string' ? context.get('requestId') : row.workflow_run_id;
      const workflowTrace = await readWorkflowTrace(dependencies.store, {
        tenantId: auth.tenantId,
        incidentId,
        workflowRunId: row.workflow_run_id,
      });
      decisionTrace = startWorkflowBoundary({
        boundary: 'approval.decision',
        tenantId: auth.tenantId,
        incidentId,
        runId: row.workflow_run_id,
        correlationId: traceCorrelationId,
        requestId: traceRequestId,
        ...(workflowTrace ? { context: workflowTrace } : {}),
        identifiers: { stepId: 'approval-decision', provider: 'linear' },
      });
      const now = (dependencies.clock ?? systemClock).now();
      if (String(row.expires_at) <= now) {
        const expiryTrace = startWorkflowBoundary({
          boundary: 'approval.expiry',
          tenantId: auth.tenantId,
          incidentId,
          runId: row.workflow_run_id,
          correlationId: traceCorrelationId,
          requestId: traceRequestId,
          context: decisionTrace.context,
          identifiers: { stepId: 'approval-expiry', provider: 'linear' },
        });
        try {
          await expirePendingApproval(
            dependencies.store,
            {
              tenantId: auth.tenantId,
              incidentId,
              approvalId,
              workflowRunId: row.workflow_run_id,
              correlationId: context.get('correlationId'),
            },
            { clock: dependencies.clock },
          );
          expiryTrace.span.end({ attributes: { success: true } as never });
          if (workflowTrace)
            await advanceWorkflowTrace(dependencies.store, {
              tenantId: auth.tenantId,
              incidentId,
              workflowRunId: row.workflow_run_id,
              previous: workflowTrace,
              next: {
                ...expiryTrace.context,
                runId: row.workflow_run_id,
                requestId: workflowTrace.requestId,
              },
            });
        } catch (error) {
          expiryTrace.span.error({ error: error as Error, endSpan: true });
          throw error;
        }
        throw new DomainError('CONFLICT');
      }
      const decision =
        body.data.decision === 'approved'
          ? {
              schemaVersion: 1 as const,
              approvalId,
              planId: body.data.planId,
              incidentId,
              tenantId: auth.tenantId,
              planHashVersion: body.data.planHashVersion,
              planHash: body.data.planHash,
              decision: 'approved' as const,
              decidedBy: auth.actorId,
              decidedByRole: 'soc_manager' as const,
              decidedAt: now,
              ...(body.data.reason ? { reason: body.data.reason } : {}),
            }
          : {
              schemaVersion: 1 as const,
              approvalId,
              planId: body.data.planId,
              incidentId,
              tenantId: auth.tenantId,
              planHashVersion: body.data.planHashVersion,
              planHash: body.data.planHash,
              decision: 'rejected' as const,
              decidedBy: auth.actorId,
              decidedByRole: 'soc_manager' as const,
              decidedAt: now,
              reason: body.data.reason!,
            };
      // Source-only request annotations are validated/authenticated with the
      // decision body, then intentionally discarded before persistence.
      void body.data.comment;
      void body.data.actorHint;
      const issued = await decideApprovalAndIssueResumeToken(
        dependencies.store,
        {
          decision,
          expectedIncidentVersion: Number(row.version),
          runId: row.workflow_run_id,
          correlationId: context.get('correlationId'),
          resumeSecret: dependencies.config.approvalResumeSecret,
        },
        { clock: dependencies.clock },
      );
      // Persist decision parentage before the reconciler can resume the
      // suspended workflow in this same request.
      decisionTrace.span.end({ attributes: { success: true } as never });
      if (workflowTrace)
        await advanceWorkflowTrace(dependencies.store, {
          tenantId: auth.tenantId,
          incidentId,
          workflowRunId: row.workflow_run_id,
          previous: workflowTrace,
          next: {
            ...decisionTrace.context,
            runId: row.workflow_run_id,
            requestId: workflowTrace.requestId,
          },
        });
      const authorized = await authorizeResumeToken(
        dependencies.store,
        {
          token: issued.resumeToken,
          tenantId: auth.tenantId,
          incidentId,
          workflowRunId: row.workflow_run_id,
          approvalId,
        },
        { clock: dependencies.clock },
      );
      context.set('incidentId', incidentId);
      context.set('workflowRunId', row.workflow_run_id);
      let resumeCompleted = authorized.resumed;
      if (!authorized.resumed) {
        const reconciliation = await dependencies.reconcileApprovalRun({
          workflowRunId: row.workflow_run_id,
          resumeReceiptId: authorized.resumeReceiptId,
          expectedResultStatuses: issued.decision.decision === 'approved' ? ['contained', 'failed'] : ['rejected'],
        });
        resumeCompleted = reconciliation === 'completed';
        if (resumeCompleted) {
          await markResumeReceiptResumed(dependencies.store, authorized.resumeReceiptId, { clock: dependencies.clock });
        }
      }
      return context.json({
        approvalId,
        incidentId,
        decision: issued.decision.decision,
        decidedAt: issued.decision.decidedAt,
        resumed: resumeCompleted,
      });
    } catch (error) {
      if (decisionTrace) decisionTrace.span.error({ error: error as Error, endSpan: true });
      const authError = error instanceof DecisionAuthenticationError;
      const domain = error instanceof DomainError ? error : undefined;
      const status = authError ? 401 : domain?.code === 'NOT_FOUND' ? 404 : 409;
      const code = authError ? error.code : (domain?.code ?? 'DECISION_FAILED');
      try {
        await dependencies.store.execute({
          sql: `INSERT INTO approval_decision_audit(
              id, claimed_tenant_id, claimed_incident_id, claimed_approval_id,
              outcome, reason_code, occurred_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: [
            randomUUID(),
            context.req.header('X-Decision-Tenant') ?? null,
            context.req.param('incidentId'),
            context.req.param('approvalId'),
            code === 'CONFLICT'
              ? 'replayed'
              : code === 'AUTHENTICATION_EXPIRED'
                ? 'expired'
                : authError
                  ? 'invalid'
                  : 'blocked',
            code.slice(0, 64),
            (dependencies.clock ?? systemClock).now(),
          ],
        });
      } catch {
        // The request still fails closed if the audit store is unavailable.
      }
      dependencies.logger.write({
        event: 'approval.decision.rejected',
        requestId: context.get('requestId'),
        correlationId: context.get('correlationId'),
        errorCode: code,
        status,
      });
      return context.json(
        {
          code,
          message: 'The approval decision was rejected.',
          requestId: context.get('requestId'),
          retryable: false,
        },
        status,
      );
    }
  });
}

function parseJson(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new DomainError('VALIDATION_FAILED');
  }
}
