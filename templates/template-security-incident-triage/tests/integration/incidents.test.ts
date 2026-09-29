import { afterEach, describe, expect, it } from 'vitest';

import {
  createIncidentFromAlert,
  createIncidentFromAlertResult,
  getIncident,
  transitionIncident,
} from '../../src/db/incident-operations.js';
import { migrateOperationalStore } from '../../src/db/migrate.js';
import { fixedClock } from '../../src/domain/clock.js';
import { DomainError } from '../../src/domain/errors.js';
import { sequenceIdGenerator } from '../../src/domain/id-generator.js';
import { materializeSecurityIncidentInput } from '../../src/mastra/workflows/security-incident-workflow.js';
import { firstTimestamp, makeAlert, secondTimestamp } from '../fixtures/domain.js';
import { createTempDatabase, type TempDatabase } from '../helpers/temp-libsql.js';

const databases: TempDatabase[] = [];

afterEach(async () => {
  await Promise.all(databases.splice(0).map(database => database.cleanup()));
});

async function setup() {
  const database = await createTempDatabase();
  databases.push(database);
  const store = database.createStore();
  await migrateOperationalStore(store);
  return { database, store };
}

async function expectValidationFailure(operation: Promise<unknown>) {
  try {
    await operation;
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError);
    if (!(error instanceof DomainError)) throw error;
    expect(error).toMatchObject({
      name: 'DomainError',
      code: 'VALIDATION_FAILED',
      message: 'The request is invalid.',
      retryable: false,
    });
    expect(error.toPublic()).toEqual({
      code: 'VALIDATION_FAILED',
      message: 'The request is invalid.',
      retryable: false,
    });
    expect(error).not.toHaveProperty('issues');
    return;
  }
  throw new Error('expected validation failure');
}

describe('incident persistence', () => {
  it('materializes a Studio webhook input into the same durable workflow reference', async () => {
    const { store } = await setup();
    try {
      const reference = await materializeSecurityIncidentInput(store, {
        schemaVersion: 1,
        source: 'reference-auth',
        sourceEventId: 'studio-country-1',
        kind: 'disallowed_country_login',
        occurredAt: firstTimestamp,
        tenantId: 'tenant-1',
        subjectId: 'subject-1',
        sessionId: 'session-1',
        ip: '200.160.2.3',
        actor: { id: 'subject-1', type: 'user' },
        target: { id: 'session-1', type: 'session' },
      });
      expect(reference).toMatchObject({
        tenantId: 'tenant-1',
        incidentId: expect.any(String),
        eventId: expect.any(String),
        alertId: expect.stringMatching(/^alert_/u),
        correlationId: expect.stringMatching(/^[a-f0-9]{64}$/u),
      });
      const event = await store.execute({
        sql: 'SELECT published_at FROM outbox_events WHERE id = ?',
        args: [reference.eventId],
      });
      expect(event.rows[0]?.published_at).toEqual(expect.any(String));
    } finally {
      store.close();
    }
  });

  it('rejects the Studio-only webhook shape when the entrypoint is disabled', async () => {
    const { store } = await setup();
    try {
      await expect(
        materializeSecurityIncidentInput(
          store,
          {
            schemaVersion: 1,
            source: 'reference-auth',
            sourceEventId: 'studio-disabled-1',
            kind: 'unknown_device_login',
            occurredAt: firstTimestamp,
            tenantId: 'tenant-1',
            subjectId: 'subject-1',
            sessionId: 'session-1',
            deviceId: 'device-1',
            actor: { id: 'subject-1', type: 'user' },
            target: { id: 'device-1', type: 'device' },
          },
          false,
        ),
      ).rejects.toThrow('STUDIO_WEBHOOK_INPUT_DISABLED');
      const counts = await store.execute({
        sql: 'SELECT count(*) AS incidents FROM incidents',
      });
      expect(counts.rows[0]?.incidents).toBe(0);
    } finally {
      store.close();
    }
  });

  it('keeps the Studio intake event durable but already consumed', async () => {
    const { store } = await setup();
    try {
      await createIncidentFromAlertResult(store, makeAlert(), {
        clock: fixedClock(firstTimestamp),
        ids: sequenceIdGenerator(['incident-1', 'timeline-1', 'outbox-1']),
        scheduleWorkflow: false,
      });
      const outbox = await store.execute({
        sql: 'SELECT type, published_at FROM outbox_events WHERE id = ?',
        args: ['outbox-1'],
      });
      expect(outbox.rows[0]).toEqual({
        type: 'security.alert.received',
        published_at: firstTimestamp,
      });
    } finally {
      store.close();
    }
  });

  it('maps invalid alerts and corrupted persisted records to redacted domain errors', async () => {
    const { store } = await setup();
    try {
      await expectValidationFailure(createIncidentFromAlert(store, makeAlert({ source: '' })));
      const empty = await store.execute({
        sql: `SELECT
          (SELECT count(*) FROM incidents) AS incident_count,
          (SELECT count(*) FROM alerts) AS alert_count,
          (SELECT count(*) FROM timeline_events) AS timeline_count,
          (SELECT count(*) FROM outbox_events) AS outbox_count`,
      });
      expect(empty.rows[0]).toEqual({
        incident_count: 0,
        alert_count: 0,
        timeline_count: 0,
        outbox_count: 0,
      });

      await createIncidentFromAlert(store, makeAlert(), {
        clock: fixedClock(firstTimestamp),
        ids: sequenceIdGenerator(['incident-1', 'timeline-1', 'outbox-1']),
      });
      await store.execute({
        sql: "UPDATE alerts SET canonical_json = '{}' WHERE id = 'alert-1'",
      });
      await expectValidationFailure(
        createIncidentFromAlert(store, makeAlert({ alertId: 'alert-retry' }), {
          clock: fixedClock(firstTimestamp),
          ids: sequenceIdGenerator(['incident-retry', 'timeline-retry', 'outbox-retry']),
        }),
      );

      await store.execute({ sql: 'PRAGMA ignore_check_constraints = ON' });
      await store.execute({
        sql: "UPDATE incidents SET status = 'corrupted' WHERE id = 'incident-1'",
      });
      await store.execute({ sql: 'PRAGMA ignore_check_constraints = OFF' });
      await expectValidationFailure(getIncident(store, 'tenant-1', 'incident-1'));

      const unchanged = await store.execute({
        sql: `SELECT
          (SELECT count(*) FROM incidents) AS incident_count,
          (SELECT count(*) FROM alerts) AS alert_count,
          (SELECT count(*) FROM timeline_events) AS timeline_count,
          (SELECT count(*) FROM outbox_events) AS outbox_count`,
      });
      expect(unchanged.rows[0]).toEqual({
        incident_count: 1,
        alert_count: 1,
        timeline_count: 1,
        outbox_count: 1,
      });
    } finally {
      store.close();
    }
  });

  it('deduplicates concurrent source events without creating partial rows', async () => {
    const { database, store: first } = await setup();
    const second = database.createStore();
    try {
      const [one, two] = await Promise.all([
        createIncidentFromAlert(first, makeAlert(), {
          clock: fixedClock('2026-08-27T12:00:00.000Z'),
          ids: sequenceIdGenerator(['incident-1', 'timeline-1', 'outbox-1']),
        }),
        createIncidentFromAlert(second, makeAlert({ alertId: 'alert-retry' }), {
          clock: fixedClock('2026-08-27T12:00:00.000Z'),
          ids: sequenceIdGenerator(['incident-2', 'timeline-2', 'outbox-2']),
        }),
      ]);
      expect(one.incidentId).toBe(two.incidentId);
      for (const table of ['incidents', 'alerts', 'timeline_events', 'outbox_events']) {
        const count = await first.execute({
          sql: `SELECT count(*) AS count FROM ${table}`,
        });
        expect(Number(count.rows[0]?.count), table).toBe(1);
      }
    } finally {
      first.close();
      second.close();
    }
  });

  it('rejects a semantically divergent retry for the same source event', async () => {
    const { store } = await setup();
    try {
      await createIncidentFromAlert(store, makeAlert(), {
        clock: fixedClock(firstTimestamp),
        ids: sequenceIdGenerator(['incident-1', 'timeline-1', 'outbox-1']),
      });
      await expect(
        createIncidentFromAlert(
          store,
          makeAlert({
            alertId: 'alert-retry',
            kind: 'unknown_device_login',
          }),
          {
            ids: sequenceIdGenerator(['incident-retry', 'timeline-retry', 'outbox-retry']),
          },
        ),
      ).rejects.toMatchObject({ code: 'CONFLICT' });

      expect(await getIncident(store, 'tenant-1', 'incident-1')).toMatchObject({
        kind: 'unauthorized_privilege_change',
      });
      const counts = await store.execute({
        sql: `SELECT
          (SELECT count(*) FROM incidents) AS incident_count,
          (SELECT count(*) FROM alerts) AS alert_count`,
      });
      expect(counts.rows[0]).toEqual({ incident_count: 1, alert_count: 1 });
    } finally {
      store.close();
    }
  });

  it('fails closed for cross-tenant duplicate identity and tenant reads', async () => {
    const { store } = await setup();
    try {
      await createIncidentFromAlert(store, makeAlert(), {
        ids: sequenceIdGenerator(['incident-1', 'timeline-1', 'outbox-1']),
      });
      await expect(
        createIncidentFromAlert(
          store,
          makeAlert({
            alertId: 'alert-2',
            tenantId: 'tenant-2',
            idempotencyKey: 'other-key',
          }),
          {
            ids: sequenceIdGenerator(['incident-2', 'timeline-2', 'outbox-2']),
          },
        ),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
      await expect(getIncident(store, 'tenant-2', 'incident-1')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    } finally {
      store.close();
    }
  });

  it('uses optimistic locking and leaves no effects for a stale write', async () => {
    const { store } = await setup();
    try {
      await createIncidentFromAlert(store, makeAlert(), {
        clock: fixedClock(firstTimestamp),
        ids: sequenceIdGenerator(['incident-1', 'timeline-1', 'outbox-1']),
      });
      await expect(
        transitionIncident(
          store,
          {
            tenantId: 'tenant-1',
            incidentId: 'incident-1',
            expectedVersion: 0,
            to: 'investigating',
            runId: 'run-1',
            correlationId: 'correlation-1',
          },
          { clock: fixedClock('2026-08-27T11:59:00.000Z') },
        ),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
      const transitioned = await transitionIncident(
        store,
        {
          tenantId: 'tenant-1',
          incidentId: 'incident-1',
          expectedVersion: 0,
          to: 'investigating',
          runId: 'run-1',
          correlationId: 'correlation-1',
        },
        {
          clock: fixedClock(secondTimestamp),
          ids: sequenceIdGenerator(['timeline-2', 'outbox-2']),
        },
      );
      expect(transitioned).toMatchObject({
        status: 'investigating',
        version: 1,
        timelineSequence: 2,
      });
      await expect(
        transitionIncident(store, {
          tenantId: 'tenant-1',
          incidentId: 'incident-1',
          expectedVersion: 0,
          to: 'failed',
          runId: 'run-1',
          correlationId: 'correlation-1',
        }),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
      const counts = await store.execute({
        sql: `SELECT
          (SELECT count(*) FROM timeline_events) AS timeline_count,
          (SELECT count(*) FROM outbox_events) AS outbox_count`,
      });
      expect(counts.rows[0]).toEqual({ timeline_count: 2, outbox_count: 2 });
    } finally {
      store.close();
    }
  });

  it('rejects reserved transition payload fields and persists the authoritative transition', async () => {
    const { store } = await setup();
    try {
      await createIncidentFromAlert(store, makeAlert(), {
        clock: fixedClock(firstTimestamp),
        ids: sequenceIdGenerator(['incident-1', 'timeline-1', 'outbox-1']),
      });

      const reservedPayloads: ReadonlyArray<Readonly<Record<string, string | number | boolean | null>>> = [
        { from: 'closed', to: 'received' },
        { incidentId: 'forged-incident' },
      ];
      for (const payload of reservedPayloads) {
        await expect(
          transitionIncident(store, {
            tenantId: 'tenant-1',
            incidentId: 'incident-1',
            expectedVersion: 0,
            to: 'investigating',
            runId: 'run-1',
            correlationId: 'correlation-1',
            payload,
          }),
        ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
      }

      expect(await getIncident(store, 'tenant-1', 'incident-1')).toMatchObject({
        status: 'received',
        version: 0,
        timelineSequence: 1,
      });
      const unchanged = await store.execute({
        sql: `SELECT
          (SELECT count(*) FROM timeline_events) AS timeline_count,
          (SELECT count(*) FROM outbox_events) AS outbox_count`,
      });
      expect(unchanged.rows[0]).toEqual({
        timeline_count: 1,
        outbox_count: 1,
      });

      await transitionIncident(
        store,
        {
          tenantId: 'tenant-1',
          incidentId: 'incident-1',
          expectedVersion: 0,
          to: 'investigating',
          runId: 'run-1',
          correlationId: 'correlation-1',
          payload: { reason: 'triage_started' },
        },
        {
          clock: fixedClock(secondTimestamp),
          ids: sequenceIdGenerator(['timeline-2', 'outbox-2']),
        },
      );

      expect(await getIncident(store, 'tenant-1', 'incident-1')).toMatchObject({
        status: 'investigating',
        version: 1,
        timelineSequence: 2,
      });
      const persisted = await store.execute({
        sql: `SELECT
          (SELECT payload_json FROM timeline_events WHERE id = 'timeline-2') AS timeline_payload,
          (SELECT payload_json FROM outbox_events WHERE id = 'outbox-2') AS outbox_payload`,
      });
      const expectedPayload = {
        reason: 'triage_started',
        from: 'received',
        to: 'investigating',
      };
      expect(JSON.parse(String(persisted.rows[0]?.timeline_payload))).toEqual(expectedPayload);
      expect(JSON.parse(String(persisted.rows[0]?.outbox_payload))).toEqual(expectedPayload);
    } finally {
      store.close();
    }
  });

  it('rolls back state, timeline and outbox when either event insert fails', async () => {
    const { store } = await setup();
    try {
      await createIncidentFromAlert(store, makeAlert(), {
        ids: sequenceIdGenerator(['incident-1', 'timeline-1', 'outbox-1']),
      });
      for (const target of ['timeline_events', 'outbox_events'] as const) {
        await store.execute({
          sql: `CREATE TRIGGER reject_${target} BEFORE INSERT ON ${target}
            BEGIN SELECT RAISE(ABORT, 'forced'); END`,
        });
        await expect(
          transitionIncident(
            store,
            {
              tenantId: 'tenant-1',
              incidentId: 'incident-1',
              expectedVersion: 0,
              to: 'investigating',
              runId: 'run-1',
              correlationId: 'correlation-1',
            },
            {
              ids: sequenceIdGenerator([`timeline-${target}`, `outbox-${target}`]),
            },
          ),
        ).rejects.toMatchObject({ code: 'STORAGE_UNAVAILABLE' });
        await store.execute({ sql: `DROP TRIGGER reject_${target}` });
        expect(await getIncident(store, 'tenant-1', 'incident-1')).toMatchObject({
          status: 'received',
          version: 0,
          timelineSequence: 1,
        });
        const counts = await store.execute({
          sql: `SELECT
            (SELECT count(*) FROM timeline_events) AS timeline_count,
            (SELECT count(*) FROM outbox_events) AS outbox_count`,
        });
        expect(counts.rows[0]).toEqual({ timeline_count: 1, outbox_count: 1 });
      }
    } finally {
      store.close();
    }
  });

  it('preserves materialized state, timeline and outbox after reopening', async () => {
    const { database, store } = await setup();
    await createIncidentFromAlert(store, makeAlert(), {
      ids: sequenceIdGenerator(['incident-1', 'timeline-1', 'outbox-1']),
    });
    await transitionIncident(
      store,
      {
        tenantId: 'tenant-1',
        incidentId: 'incident-1',
        expectedVersion: 0,
        to: 'investigating',
        runId: 'run-1',
        correlationId: 'correlation-1',
      },
      { ids: sequenceIdGenerator(['timeline-2', 'outbox-2']) },
    );
    store.close();

    const reopened = database.createStore();
    try {
      await migrateOperationalStore(reopened);
      expect(await getIncident(reopened, 'tenant-1', 'incident-1')).toMatchObject({
        status: 'investigating',
        version: 1,
        timelineSequence: 2,
      });
      const consistency = await reopened.execute({
        sql: `SELECT
          (SELECT timeline_sequence FROM incidents WHERE id = 'incident-1') AS materialized,
          (SELECT max(sequence) FROM timeline_events WHERE incident_id = 'incident-1') AS timeline,
          (SELECT count(*) FROM outbox_events WHERE incident_id = 'incident-1') AS outbox_count`,
      });
      expect(consistency.rows[0]).toEqual({
        materialized: 2,
        timeline: 2,
        outbox_count: 2,
      });
    } finally {
      reopened.close();
    }
  });
});
