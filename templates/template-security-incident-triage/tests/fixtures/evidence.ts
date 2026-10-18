import { createIncidentFromAlert } from '../../src/db/incident-operations.js';
import { migrateOperationalStore } from '../../src/db/migrate.js';
import type { OperationalStore } from '../../src/db/operational-store.js';
import { materializeInvestigationStart } from '../../src/db/workflow-run-operations.js';
import { fixedClock } from '../../src/domain/clock.js';
import { sequenceIdGenerator } from '../../src/domain/id-generator.js';
import { loadInvestigationContext } from '../../src/mastra/steps/load-investigation-context.js';
import type { IncidentKind } from '../../src/schemas/incident.js';
import { makeAlert } from './domain.js';

export const evidenceCollectedAt = '2026-08-27T12:01:00.000Z';

export async function seedInvestigationInvestigation(
  store: OperationalStore,
  kind: IncidentKind = 'unauthorized_privilege_change',
) {
  await migrateOperationalStore(store);
  await createIncidentFromAlert(
    store,
    makeAlert({
      kind,
      ...(kind === 'unknown_device_login' ? { deviceId: 'device-new-1' } : {}),
      ...(kind === 'disallowed_country_login' ? { ip: '198.51.100.8' } : {}),
    }),
    {
      clock: fixedClock('2026-08-27T12:00:00.000Z'),
      ids: sequenceIdGenerator(['incident-1', 'timeline-1', 'outbox-1']),
    },
  );
  const workflowInput = {
    eventId: 'workflow-run-1',
    incidentId: 'incident-1',
    tenantId: 'tenant-1',
    alertId: 'alert-1',
    correlationId: 'correlation-1',
  };
  await materializeInvestigationStart(store, workflowInput, {
    clock: fixedClock('2026-08-27T12:00:30.000Z'),
    ids: sequenceIdGenerator(['timeline-2', 'outbox-2']),
  });
  const context = await loadInvestigationContext(store, {
    ...workflowInput,
    runId: workflowInput.eventId,
    duplicate: false,
  });
  return { workflowInput, context };
}
