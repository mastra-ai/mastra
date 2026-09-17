import {
  authorizeResumeToken,
  decideApprovalAndIssueResumeToken,
  expirePendingApproval,
} from '../../src/db/approval-operations.js';
import type { OperationalStore } from '../../src/db/operational-store.js';
import type { Clock } from '../../src/domain/clock.js';
import { DomainError } from '../../src/domain/errors.js';
import type { WorkflowCase } from '../../src/mastra/evals/workflow-corpus.js';

export async function resolveLocalApproval(
  store: OperationalStore,
  decision: WorkflowCase['decision'],
  clock: Clock,
  setNow: (value: string) => void,
  trustedScope = {
    tenantId: 'tenant-1',
    incidentId: 'incident-1',
    workflowRunId: 'workflow-run-1',
    correlationId: 'correlation-1',
  },
) {
  const probes: { name: string; blocked: boolean }[] = [];
  if (decision === 'benign') return { receipt: undefined, probes, checkReplay: async () => [] };
  const rows = await store.execute({
    sql: 'SELECT a.*,i.version FROM approvals a JOIN incidents i ON i.id=a.incident_id AND i.tenant_id=a.tenant_id WHERE a.tenant_id=? AND a.incident_id=? AND a.workflow_run_id=?',
    args: [trustedScope.tenantId, trustedScope.incidentId, trustedScope.workflowRunId],
  });
  const row = rows.rows[0];
  if (!row || rows.rows.length !== 1) throw new Error('EVAL_APPROVAL_MISSING');
  const scope = {
    tenantId: trustedScope.tenantId,
    incidentId: trustedScope.incidentId,
    workflowRunId: trustedScope.workflowRunId,
    approvalId: String(row.id),
  };
  if (decision === 'expired') {
    setNow('2026-08-28T10:16:00.000Z');
    await expirePendingApproval(store, { ...scope, correlationId: trustedScope.correlationId }, { clock });
    return {
      receipt: `expiry_${scope.approvalId}`,
      probes,
      checkReplay: async () => [],
    };
  }
  setNow('2026-08-28T10:02:00.000Z');
  const request = {
    decision: {
      schemaVersion: 1 as const,
      approvalId: scope.approvalId,
      planId: String(row.plan_id),
      incidentId: scope.incidentId,
      tenantId: scope.tenantId,
      planHashVersion: 1,
      planHash: String(row.plan_hash),
      ...(decision === 'rejected'
        ? {
            decision: 'rejected' as const,
            reason: 'Synthetic evaluation rejection.',
          }
        : { decision: 'approved' as const }),
      decidedBy: 'studio-soc-manager',
      decidedByRole: 'soc_manager' as const,
      decidedAt: clock.now(),
    },
    expectedIncidentVersion: Number(row.version),
    runId: scope.workflowRunId,
    correlationId: trustedScope.correlationId,
    resumeSecret: 'synthetic-eval-resume-'.padEnd(40, 'x'),
  };
  probes.push({
    name: 'stale-plan-decision',
    blocked: await blocked(() =>
      decideApprovalAndIssueResumeToken(
        store,
        {
          ...request,
          decision: { ...request.decision, planHash: '0'.repeat(64) },
        },
        { clock },
      ),
    ),
  });
  const issued = await decideApprovalAndIssueResumeToken(store, request, {
    clock,
  });
  setNow('2026-08-28T10:03:00.000Z');
  const resumeInput = { ...scope, token: issued.resumeToken };
  probes.push({
    name: 'foreign-tenant-resume',
    blocked: await blocked(() =>
      authorizeResumeToken(
        store,
        {
          ...resumeInput,
          tenantId: 'foreign-tenant',
        },
        { clock },
      ),
    ),
  });
  const authorized = await authorizeResumeToken(store, resumeInput, { clock });
  return {
    receipt: authorized.resumeReceiptId,
    probes,
    checkReplay: async () => [
      {
        name: 'consumed-token-replay',
        blocked: await blocked(() => authorizeResumeToken(store, resumeInput, { clock })),
      },
    ],
  };
}

async function blocked(operation: () => Promise<unknown>) {
  try {
    await operation();
    return false;
  } catch (error) {
    if (error instanceof DomainError && error.code === 'CONFLICT') return true;
    throw error; // Infrastructure/schema failures are not proof of authorization rejection.
  }
}
