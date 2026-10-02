import { afterEach, describe, expect, it } from 'vitest';

import { createIncidentFromAlert } from '../../src/db/incident-operations.js';
import { migrateOperationalStore } from '../../src/db/migrate.js';
import { materializeInvestigationStart } from '../../src/db/workflow-run-operations.js';
import { fixedClock } from '../../src/domain/clock.js';
import { sequenceIdGenerator } from '../../src/domain/id-generator.js';
import { createFinalizeIncidentStep } from '../../src/mastra/steps/finalize-incident.js';
import { makeAlert } from '../fixtures/domain.js';
import { createTempDatabase, type TempDatabase } from '../helpers/temp-libsql.js';

const databases: TempDatabase[] = [];

afterEach(async () => {
  await Promise.all(databases.splice(0).map(database => database.cleanup()));
});

async function setupInvestigatingIncident() {
  const database = await createTempDatabase();
  databases.push(database);
  const store = database.createStore();
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
  return { database, store };
}

describe('triage stop finalization', () => {
  it('closes a policy-proven benign incident and completes its workflow', async () => {
    const { database, store } = await setupInvestigatingIncident();
    try {
      const inputData = {
        status: 'benign' as const,
        incidentId: 'incident-1',
        reasonCodes: ['BENIGN_EXPLANATION' as const] as const,
      };
      const step = createFinalizeIncidentStep({
        openStore: () => database.createStore(),
        clock: fixedClock('2026-08-27T12:01:00.000Z'),
        ids: sequenceIdGenerator(['timeline-3', 'outbox-3']),
      });

      await expect(
        step.execute!({
          inputData,
          getInitData: () => ({
            tenantId: 'tenant-1',
            eventId: 'run-1',
            incidentId: 'incident-1',
            correlationId: 'correlation-1',
          }),
        } as never),
      ).resolves.toEqual(inputData);

      const state = await store.execute({
        sql: `SELECT i.status AS incident_status, w.status AS workflow_status,
            w.finished_at, w.triage_result_json
          FROM incidents i JOIN workflow_runs w
            ON w.tenant_id = i.tenant_id AND w.incident_id = i.id
          WHERE i.tenant_id = 'tenant-1' AND i.id = 'incident-1'`,
      });
      expect(state.rows[0]).toMatchObject({
        incident_status: 'closed',
        workflow_status: 'completed',
        finished_at: '2026-08-27T12:01:00.000Z',
      });
      expect(JSON.parse(String(state.rows[0]?.triage_result_json))).toEqual(inputData);
      const timeline = await store.execute({
        sql: `SELECT type, payload_json FROM timeline_events
          WHERE tenant_id = 'tenant-1' AND incident_id = 'incident-1'
          ORDER BY sequence DESC LIMIT 1`,
      });
      expect(timeline.rows[0]?.type).toBe('incident.status_changed');
      expect(JSON.parse(String(timeline.rows[0]?.payload_json))).toMatchObject({
        from: 'investigating',
        to: 'closed',
        resolution: 'benign',
        reasonCodes: 'BENIGN_EXPLANATION',
      });
    } finally {
      store.close();
    }
  });

  it('persists manual review and completes the operational run for Studio webhook input', async () => {
    const { database, store } = await setupInvestigatingIncident();
    try {
      const inputData = {
        status: 'manual-review' as const,
        incidentId: 'incident-1',
        reasonCodes: ['REQUIRED_EVIDENCE_MISSING' as const],
      };
      const step = createFinalizeIncidentStep({
        openStore: () => database.createStore(),
        clock: fixedClock('2026-08-27T12:01:00.000Z'),
        ids: sequenceIdGenerator(['timeline-3', 'outbox-3']),
      });
      const execute = step.execute!;
      const execution = {
        inputData,
        // A webhook-shaped Studio invocation has a tenant but no durable
        // incident/run identifiers in its original workflow input.
        getInitData: () => ({ tenantId: 'tenant-1' }),
      };

      await expect(execute(execution as never)).resolves.toEqual(inputData);
      const state = await store.execute({
        sql: `SELECT i.status AS incident_status, w.status AS workflow_status,
            w.finished_at, w.triage_result_json
          FROM incidents i JOIN workflow_runs w
            ON w.tenant_id = i.tenant_id AND w.incident_id = i.id
          WHERE i.tenant_id = 'tenant-1' AND i.id = 'incident-1'`,
      });
      expect(state.rows[0]).toMatchObject({
        incident_status: 'investigating',
        workflow_status: 'completed',
        finished_at: '2026-08-27T12:01:00.000Z',
      });
      expect(JSON.parse(String(state.rows[0]?.triage_result_json))).toEqual(inputData);
      const timeline = await store.execute({
        sql: `SELECT type, payload_json FROM timeline_events
          WHERE tenant_id = 'tenant-1' AND incident_id = 'incident-1'
          ORDER BY sequence DESC LIMIT 1`,
      });
      expect(timeline.rows[0]?.type).toBe('triage.completed');
      expect(JSON.parse(String(timeline.rows[0]?.payload_json))).toMatchObject({
        status: 'manual-review',
        reasonCodes: 'REQUIRED_EVIDENCE_MISSING',
      });

      await expect(execute(execution as never)).resolves.toEqual(inputData);
      const replayCount = await store.execute({
        sql: `SELECT count(*) AS count FROM timeline_events
          WHERE tenant_id = 'tenant-1' AND incident_id = 'incident-1'
            AND type = 'triage.completed'`,
      });
      expect(replayCount.rows[0]?.count).toBe(1);
    } finally {
      store.close();
    }
  });

  it('marks an integrity-blocked incident failed while completing the controlled workflow', async () => {
    const { database, store } = await setupInvestigatingIncident();
    try {
      const inputData = {
        status: 'blocked' as const,
        incidentId: 'incident-1',
        reasonCodes: ['INTEGRITY_CHECK_FAILED' as const],
      };
      const step = createFinalizeIncidentStep({
        openStore: () => database.createStore(),
        clock: fixedClock('2026-08-27T12:01:00.000Z'),
        ids: sequenceIdGenerator(['timeline-3', 'outbox-3']),
      });

      await expect(
        step.execute!({
          inputData,
          getInitData: () => ({
            tenantId: 'tenant-1',
            eventId: 'run-1',
            incidentId: 'incident-1',
            correlationId: 'correlation-1',
          }),
        } as never),
      ).resolves.toEqual(inputData);

      const state = await store.execute({
        sql: `SELECT i.status AS incident_status, w.status AS workflow_status,
            w.finished_at, w.triage_result_json
          FROM incidents i JOIN workflow_runs w
            ON w.tenant_id = i.tenant_id AND w.incident_id = i.id
          WHERE i.tenant_id = 'tenant-1' AND i.id = 'incident-1'`,
      });
      expect(state.rows[0]).toMatchObject({
        incident_status: 'failed',
        workflow_status: 'completed',
        finished_at: '2026-08-27T12:01:00.000Z',
      });
      expect(JSON.parse(String(state.rows[0]?.triage_result_json))).toEqual(inputData);
      const timeline = await store.execute({
        sql: `SELECT type, payload_json FROM timeline_events
          WHERE tenant_id = 'tenant-1' AND incident_id = 'incident-1'
          ORDER BY sequence DESC LIMIT 1`,
      });
      expect(timeline.rows[0]?.type).toBe('incident.status_changed');
      expect(JSON.parse(String(timeline.rows[0]?.payload_json))).toMatchObject({
        from: 'investigating',
        to: 'failed',
        triageStatus: 'blocked',
        reasonCodes: 'INTEGRITY_CHECK_FAILED',
      });
    } finally {
      store.close();
    }
  });
});
