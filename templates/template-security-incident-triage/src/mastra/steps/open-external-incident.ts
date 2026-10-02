import { createStep } from '@mastra/core/workflows';

import { ApprovalRequestedResultSchema } from '../../approval/contracts.js';
import { deliverExternalIncident } from '../../db/provider-delivery-operations.js';
import { createLibSqlOperationalStore } from '../../db/libsql-operational-store.js';
import type { OperationalStore } from '../../db/operational-store.js';
import type { Clock } from '../../domain/clock.js';
import { DomainError } from '../../domain/errors.js';
import type { IdGenerator } from '../../domain/id-generator.js';
import { ExternalIncidentProjectionSchema, type IncidentProvider } from '../../providers/incident-provider.js';
import { LocalIncidentProvider } from '../../providers/local-incident-provider.js';
import { withinWorkflowBoundary } from '../workflow-trace.js';

export function createOpenExternalIncidentStep(
  dependencies: Readonly<{
    openStore?: () => OperationalStore;
    provider?: IncidentProvider;
    clock?: Clock;
    ids?: IdGenerator;
    maxAttempts?: number;
    timeoutMs?: number;
  }> = {},
) {
  const provider = dependencies.provider ?? new LocalIncidentProvider();
  const providerId = provider.providerId ?? 'local-incident';
  return createStep({
    id: 'open-external-incident',
    description: 'Creates and verifies the required redacted external incident before approval suspension.',
    inputSchema: ApprovalRequestedResultSchema,
    outputSchema: ApprovalRequestedResultSchema,
    execute: async ({ inputData }) => {
      if (inputData.status !== 'approval-requested') return inputData;
      const store = (dependencies.openStore ?? createLibSqlOperationalStore)();
      try {
        const incident = await store.execute({
          sql: `SELECT kind, status, created_at FROM incidents
            WHERE tenant_id = ? AND id = ?`,
          args: [inputData.plan.tenantId, inputData.plan.incidentId],
        });
        const row = incident.rows[0];
        if (!row) return inputData;
        const summaryCode = {
          unauthorized_privilege_change: 'PRIVILEGE_CHANGE_REQUIRES_REVIEW',
          disallowed_country_login: 'COUNTRY_LOGIN_REQUIRES_REVIEW',
          unknown_device_login: 'UNKNOWN_DEVICE_REQUIRES_REVIEW',
        }[String(row.kind)];
        if (!summaryCode) return inputData;
        const projection = ExternalIncidentProjectionSchema.parse({
          incidentId: inputData.plan.incidentId,
          tenantId: inputData.plan.tenantId,
          kind: row.kind,
          severity: inputData.decision.severity,
          status: row.status,
          occurredAt: row.created_at,
          summaryCode,
          planHashVersion: inputData.plan.planHashVersion,
          planHash: inputData.plan.planHash,
          actionTypes: inputData.plan.actions.map(action => action.type),
        });
        const delivery = await withinWorkflowBoundary(
          store,
          {
            tenantId: inputData.plan.tenantId,
            incidentId: inputData.plan.incidentId,
            workflowRunId: inputData.workflowRunId,
            correlationId: inputData.correlationId,
            boundary: 'provider.linear',
            stepId: 'open-external-incident',
            provider: providerId,
          },
          () =>
            deliverExternalIncident(
              store,
              provider,
              {
                operation: 'open-awaiting-approval',
                projection,
                workflowRunId: inputData.workflowRunId,
                correlationId: inputData.correlationId,
              },
              {
                ...(dependencies.clock ? { clock: dependencies.clock } : {}),
                ...(dependencies.ids ? { ids: dependencies.ids } : {}),
                ...(dependencies.maxAttempts ? { maxAttempts: dependencies.maxAttempts } : {}),
                ...(dependencies.timeoutMs ? { timeoutMs: dependencies.timeoutMs } : {}),
              },
            ),
        );
        // D-026 orders the externally traceable, redacted issue before the
        // first suspend.  A durable retry/uncertain record is not evidence of
        // the remote state, so let the workflow retry instead of suspending.
        if (delivery.status === 'exhausted') throw new DomainError('PROVIDER_DELIVERY_FAILED');
        if (delivery.status === 'uncertain') throw new DomainError('PROVIDER_DELIVERY_UNCERTAIN');
        if (delivery.status !== 'succeeded')
          throw new DomainError('PROVIDER_DELIVERY_PENDING', {
            retryable: true,
          });
        return inputData;
      } finally {
        store.close();
      }
    },
  });
}
