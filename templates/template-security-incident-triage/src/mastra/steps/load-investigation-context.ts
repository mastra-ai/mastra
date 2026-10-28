import { createStep } from '@mastra/core/workflows';

import { createLibSqlOperationalStore } from '../../db/libsql-operational-store.js';
import type { OperationalStore } from '../../db/operational-store.js';
import { DomainError, parseDomainSchema } from '../../domain/errors.js';
import { InvestigationContextSchema, type InvestigationContext } from '../../evidence/contracts.js';
import { AlertSchema } from '../../schemas/alert.js';
import { InvestigationStartedSchema } from './retrieve-runbook.js';
import { withinWorkflowBoundary } from '../workflow-trace.js';

export async function loadInvestigationContext(
  store: OperationalStore,
  input: typeof InvestigationStartedSchema._output,
): Promise<InvestigationContext> {
  const result = await store.execute({
    sql: `SELECT i.kind, i.subject_id, i.current_run_id, a.canonical_json
      FROM incidents i
      JOIN alerts a ON a.tenant_id = i.tenant_id AND a.incident_id = i.id
      WHERE i.tenant_id = ? AND i.id = ? AND a.id = ?`,
    args: [input.tenantId, input.incidentId, input.alertId],
  });
  const row = result.rows[0];
  if (!row) throw new DomainError('NOT_FOUND');
  if (row.current_run_id !== input.eventId) throw new DomainError('CONFLICT');
  let canonical: unknown;
  try {
    canonical = JSON.parse(String(row.canonical_json));
  } catch {
    throw new DomainError('VALIDATION_FAILED');
  }
  const alert = parseDomainSchema(AlertSchema, canonical);
  if (
    alert.tenantId !== input.tenantId ||
    alert.alertId !== input.alertId ||
    alert.subjectId !== row.subject_id ||
    alert.kind !== row.kind
  ) {
    throw new DomainError('CONFLICT');
  }
  const base = {
    eventId: input.eventId,
    alertId: input.alertId,
    incidentId: input.incidentId,
    tenantId: input.tenantId,
    correlationId: input.correlationId,
    subjectId: alert.subjectId,
    workflowRunId: input.eventId,
    incidentKind: alert.kind,
    occurredAt: alert.occurredAt,
    ...(alert.sessionId ? { sessionId: alert.sessionId } : {}),
    ...(alert.deviceId ? { deviceId: alert.deviceId } : {}),
    ...(alert.ip ? { ip: alert.ip } : {}),
  };
  if (alert.changes?.contextVersion !== 2 || alert.kind !== 'unauthorized_privilege_change')
    return parseDomainSchema(InvestigationContextSchema, {
      schemaVersion: 1,
      ...base,
    });

  const previousRole = alert.changes?.previousRole;
  const currentRole = alert.changes?.nextRole;
  if (!isRole(previousRole) || !isRole(currentRole)) throw new DomainError('VALIDATION_FAILED');
  const approval = await store.execute({
    sql: `SELECT approved, actor_id, previous_role, current_role
      FROM identity_role_change_authorizations
      WHERE tenant_id = ? AND subject_id = ? AND source_event_id = ?`,
    args: [alert.tenantId, alert.subjectId, alert.sourceEventId],
  });
  const authority = approval.rows[0];
  const approved =
    authority &&
    authority.actor_id === alert.actor.id &&
    authority.previous_role === previousRole &&
    authority.current_role === currentRole &&
    (Number(authority.approved) === 1 || Number(authority.approved) === 0)
      ? Number(authority.approved) === 1
      : undefined;
  return parseDomainSchema(InvestigationContextSchema, {
    schemaVersion: 2,
    ...base,
    actorId: alert.actor.id,
    roleChange: { previousRole, currentRole },
    ...(approved === undefined ? {} : { changeApproved: approved }),
  });
}

function isRole(value: unknown): value is 'admin' | 'member' | 'viewer' {
  return value === 'admin' || value === 'member' || value === 'viewer';
}

export function createLoadInvestigationContextStep(openStore: () => OperationalStore = createLibSqlOperationalStore) {
  return createStep({
    id: 'load-investigation-context',
    description: 'Loads and validates tenant-scoped alert, incident, subject, and run context.',
    inputSchema: InvestigationStartedSchema,
    outputSchema: InvestigationContextSchema,
    execute: async ({ inputData }) => {
      const store = openStore();
      try {
        return await withinWorkflowBoundary(
          store,
          {
            tenantId: inputData.tenantId,
            incidentId: inputData.incidentId,
            workflowRunId: inputData.eventId,
            correlationId: inputData.correlationId,
            boundary: 'workflow.context',
            stepId: 'load-investigation-context',
          },
          () => loadInvestigationContext(store, inputData),
        );
      } finally {
        store.close();
      }
    },
  });
}
