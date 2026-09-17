import { afterEach, describe, expect, it } from 'vitest';

import { createIncidentFromAlert } from '../../src/db/incident-operations.js';
import { migrateOperationalStore } from '../../src/db/migrate.js';
import { readAuthoritativeTriageResult } from '../../src/db/triage-result-operations.js';
import { materializeInvestigationStart } from '../../src/db/workflow-run-operations.js';
import { fixedClock } from '../../src/domain/clock.js';
import { sequenceIdGenerator } from '../../src/domain/id-generator.js';
import { createRequestApprovalStep } from '../../src/mastra/steps/request-approval.js';
import { makeAlert, makePlan, seedAuthoritativeTriageResult } from '../fixtures/domain.js';
import { createTempDatabase, type TempDatabase } from '../helpers/temp-libsql.js';

const databases: TempDatabase[] = [];

afterEach(async () => {
  await Promise.all(databases.splice(0).map(database => database.cleanup()));
});

describe('Studio approval scope', () => {
  it('resolves durable run and correlation data instead of requiring them in the initial webhook input', async () => {
    const database = await createTempDatabase();
    databases.push(database);
    const store = database.createStore();
    try {
      await migrateOperationalStore(store);
      await createIncidentFromAlert(store, makeAlert(), {
        correlationId: 'correlation-1',
        clock: fixedClock('2026-08-27T12:00:00.000Z'),
        ids: sequenceIdGenerator(['incident-1', 'timeline-1', 'run-1']),
      });
      await materializeInvestigationStart(
        store,
        {
          eventId: 'run-1',
          incidentId: 'incident-1',
          tenantId: 'tenant-1',
          alertId: 'alert-1',
          correlationId: 'correlation-1',
        },
        {
          clock: fixedClock('2026-08-27T12:00:30.000Z'),
          ids: sequenceIdGenerator(['timeline-2', 'outbox-2']),
        },
      );
      await seedAuthoritativeTriageResult(store, makePlan());
      const triage = await store.transaction(tx =>
        readAuthoritativeTriageResult(tx, {
          tenantId: 'tenant-1',
          incidentId: 'incident-1',
          workflowRunId: 'run-1',
        }),
      );
      const step = createRequestApprovalStep({
        openStore: () => database.createStore(),
        clock: fixedClock('2026-08-27T12:01:00.000Z'),
        ids: sequenceIdGenerator(['action-row-1', 'timeline-3', 'outbox-3']),
      });

      await expect(step.execute!({ inputData: triage } as never)).resolves.toMatchObject({
        status: 'approval-requested',
        workflowRunId: 'run-1',
        correlationId: 'correlation-1',
      });
      const state = await store.execute({
        sql: `SELECT i.status AS incident_status, a.decision AS approval_decision
          FROM incidents i JOIN approvals a
            ON a.tenant_id = i.tenant_id AND a.incident_id = i.id
          WHERE i.tenant_id = 'tenant-1' AND i.id = 'incident-1'`,
      });
      expect(state.rows[0]).toEqual({
        incident_status: 'awaiting_approval',
        approval_decision: null,
      });
    } finally {
      store.close();
    }
  });
});
