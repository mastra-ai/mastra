import { createHash } from 'node:crypto';
import { createStep } from '@mastra/core/workflows';

import { requestApproval } from '../../db/approval-operations.js';
import { createLibSqlOperationalStore } from '../../db/libsql-operational-store.js';
import type { OperationalStore } from '../../db/operational-store.js';
import type { Clock } from '../../domain/clock.js';
import { systemClock } from '../../domain/clock.js';
import type { IdGenerator } from '../../domain/id-generator.js';
import { ApprovalRequestSchema } from '../../schemas/approval.js';
import { ApprovalRequestedResultSchema } from '../../approval/contracts.js';
import { TriageResultSchema } from '../../triage/decision-contracts.js';
import { withinWorkflowBoundary } from '../workflow-trace.js';

export function createRequestApprovalStep(
  dependencies: Readonly<{
    openStore?: () => OperationalStore;
    clock?: Clock;
    ids?: IdGenerator;
  }> = {},
) {
  return createStep({
    id: 'request-approval',
    description: 'Atomically persists the validated plan, approval, transition, timeline, and outbox.',
    inputSchema: TriageResultSchema,
    outputSchema: ApprovalRequestedResultSchema,
    execute: async ({ inputData }) => {
      if (inputData.status !== 'ready-for-approval') return inputData;
      const tenantId = inputData.plan.tenantId;
      const incidentId = inputData.plan.incidentId;
      const workflowRunId = inputData.decision.workflowRunId;
      if (inputData.decision.incidentId !== incidentId || inputData.decision.tenantId !== tenantId) {
        return {
          status: 'blocked' as const,
          incidentId,
          reasonCodes: ['SCOPE_CHECK_FAILED' as const],
        };
      }
      const clock = dependencies.clock ?? systemClock;
      const store = (dependencies.openStore ?? createLibSqlOperationalStore)();
      let requestedAt = clock.now();
      try {
        const prior = await store.execute({
          sql: `SELECT requested_at FROM approvals
            WHERE tenant_id = ? AND incident_id = ? AND plan_id = ?`,
          args: [tenantId, incidentId, inputData.plan.planId],
        });
        if (prior.rows[0]?.requested_at) {
          requestedAt = String(prior.rows[0].requested_at);
        }
        const approval = ApprovalRequestSchema.parse({
          schemaVersion: 1,
          approvalId: `approval_${createHash('sha256')
            .update(`${tenantId}\0${incidentId}\0${workflowRunId}\0${inputData.plan.planHash}`)
            .digest('hex')}`,
          planId: inputData.plan.planId,
          incidentId,
          tenantId,
          planHashVersion: inputData.plan.planHashVersion,
          planHash: inputData.plan.planHash,
          requestedAt,
          expiresAt: inputData.plan.expiresAt,
          status: 'pending',
        });
        const incident = await store.execute({
          sql: `SELECT i.version, COALESCE(source.correlation_id,
              (SELECT received.correlation_id FROM outbox_events received
                WHERE received.tenant_id = i.tenant_id
                  AND received.incident_id = i.id
                  AND received.type = 'security.alert.received'
                ORDER BY received.occurred_at ASC LIMIT 1)) AS correlation_id
            FROM incidents i
            JOIN workflow_runs run ON run.tenant_id = i.tenant_id
              AND run.incident_id = i.id AND run.run_id = i.current_run_id
            LEFT JOIN outbox_events source ON source.id = run.run_id
            WHERE i.tenant_id = ? AND i.id = ? AND i.current_run_id = ?
              AND i.status IN ('investigating','awaiting_approval')`,
          args: [tenantId, incidentId, workflowRunId],
        });
        const incidentRow = incident.rows[0];
        if (!incidentRow || typeof incidentRow.correlation_id !== 'string') {
          return {
            status: 'blocked' as const,
            incidentId,
            reasonCodes: ['SCOPE_CHECK_FAILED' as const],
          };
        }
        const expectedIncidentVersion = Number(incidentRow.version);
        const correlationId = incidentRow.correlation_id;
        await withinWorkflowBoundary(
          store,
          {
            tenantId,
            incidentId,
            workflowRunId,
            correlationId,
            boundary: 'approval.request',
            stepId: 'request-approval',
          },
          () =>
            requestApproval(
              store,
              {
                plan: inputData.plan,
                approval,
                expectedIncidentVersion,
                runId: workflowRunId,
                correlationId,
              },
              {
                clock,
                ...(dependencies.ids ? { ids: dependencies.ids } : {}),
              },
            ),
        );
        return ApprovalRequestedResultSchema.parse({
          status: 'approval-requested',
          decision: inputData.decision,
          summary: inputData.summary,
          plan: inputData.plan,
          approval,
          workflowRunId,
          correlationId,
        });
      } finally {
        store.close();
      }
    },
  });
}
