import { createStep } from '@mastra/core/workflows';

import { ContainmentExecutionResultSchema } from '../../approval/contracts.js';
import { createLibSqlOperationalStore } from '../../db/libsql-operational-store.js';
import type { OperationalStore } from '../../db/operational-store.js';
import { deliverExternalIncident } from '../../db/provider-delivery-operations.js';
import type { Clock } from '../../domain/clock.js';
import type { IdGenerator } from '../../domain/id-generator.js';
import { ExternalIncidentProjectionSchema, type IncidentProvider } from '../../providers/incident-provider.js';
import { LocalIncidentProvider } from '../../providers/local-incident-provider.js';
import { withinWorkflowBoundary } from '../workflow-trace.js';

export function createUpdateExternalIncidentStep(
  dependencies: Readonly<{
    openStore?: () => OperationalStore;
    provider?: IncidentProvider;
    clock?: Clock;
    ids?: IdGenerator;
  }> = {},
) {
  const provider = dependencies.provider ?? new LocalIncidentProvider();
  const providerId = provider.providerId ?? 'local-incident';
  return createStep({
    id: 'update-external-incident',
    description: 'Updates the redacted external incident without changing local authority.',
    inputSchema: ContainmentExecutionResultSchema,
    outputSchema: ContainmentExecutionResultSchema,
    execute: async ({ inputData }) => {
      if (
        inputData.status === 'benign' ||
        inputData.status === 'manual-review' ||
        inputData.status === 'blocked' ||
        // Expiry is an authority boundary, not a containment failure. The
        // The approval dispatcher already records the durable approval.expired
        // timeline/outbox event before resuming this run; do not turn that
        // zero-effect path into an external final-failed delivery.
        inputData.status === 'expired'
      )
        return inputData;
      const store = (dependencies.openStore ?? createLibSqlOperationalStore)();
      try {
        const incident = await store.execute({
          sql: `SELECT kind, severity, status, created_at FROM incidents
            WHERE tenant_id = ? AND id = ?`,
          args: [inputData.plan.tenantId, inputData.plan.incidentId],
        });
        const open = await store.execute({
          sql: `SELECT external_ref FROM provider_deliveries
            WHERE provider = ? AND tenant_id = ? AND incident_id = ?
              AND operation = 'open-awaiting-approval'`,
          args: [providerId, inputData.plan.tenantId, inputData.plan.incidentId],
        });
        const row = incident.rows[0];
        if (!row) return inputData;
        const operation =
          inputData.status === 'rejected'
            ? 'decision-rejected'
            : inputData.status === 'containment-succeeded'
              ? 'final-contained'
              : 'final-failed';
        const projection = ExternalIncidentProjectionSchema.parse({
          incidentId: inputData.plan.incidentId,
          tenantId: inputData.plan.tenantId,
          kind: row.kind,
          severity: inputData.decision.severity,
          status: row.status,
          occurredAt: row.created_at,
          summaryCode:
            inputData.status === 'rejected'
              ? 'CONTAINMENT_REJECTED'
              : inputData.status === 'containment-succeeded'
                ? 'CONTAINMENT_SUCCEEDED'
                : 'CONTAINMENT_FAILED',
          planHashVersion: 1,
          planHash: inputData.plan.planHash,
          actionTypes: inputData.plan.actions.map(action => action.type),
        });
        await withinWorkflowBoundary(
          store,
          {
            tenantId: inputData.plan.tenantId,
            incidentId: inputData.plan.incidentId,
            workflowRunId: inputData.workflowRunId,
            correlationId: inputData.correlationId,
            boundary: 'provider.linear.final',
            stepId: 'update-external-incident',
            provider: providerId,
          },
          () =>
            deliverExternalIncident(
              store,
              provider,
              {
                operation,
                projection,
                workflowRunId: inputData.workflowRunId,
                correlationId: inputData.correlationId,
                ...(open.rows[0]?.external_ref ? { existingExternalRef: String(open.rows[0].external_ref) } : {}),
              },
              {
                ...(dependencies.clock ? { clock: dependencies.clock } : {}),
                ...(dependencies.ids ? { ids: dependencies.ids } : {}),
              },
            ),
        );
        return inputData;
      } finally {
        store.close();
      }
    },
  });
}
