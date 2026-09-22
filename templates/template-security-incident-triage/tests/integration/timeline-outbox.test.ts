import { afterEach, describe, expect, it } from 'vitest';

import {
  createIncidentFromAlert,
  getIncident,
  insertTimelineAndOutbox,
  transitionIncident,
} from '../../src/db/incident-operations.js';
import { migrateOperationalStore } from '../../src/db/migrate.js';
import { appendTimelineEvent, listTimelineEvents } from '../../src/db/timeline-operations.js';
import * as timelineApi from '../../src/db/timeline-operations.js';
import { fixedClock } from '../../src/domain/clock.js';
import { sequenceIdGenerator } from '../../src/domain/id-generator.js';
import { makeAlert } from '../fixtures/domain.js';
import { createTempDatabase, type TempDatabase } from '../helpers/temp-libsql.js';

const databases: TempDatabase[] = [];

afterEach(async () => {
  await Promise.all(databases.splice(0).map(database => database.cleanup()));
});

describe('append-only timeline', () => {
  it('allocates a monotonic sequence and exposes no mutation API', async () => {
    const database = await createTempDatabase();
    databases.push(database);
    const store = database.createStore();
    try {
      await migrateOperationalStore(store);
      await createIncidentFromAlert(store, makeAlert(), {
        clock: fixedClock('2026-08-27T12:00:00.000Z'),
        ids: sequenceIdGenerator(['incident-1', 'timeline-1', 'outbox-1']),
      });
      for (const [index, timestamp] of ['2026-08-27T12:01:00.000Z', '2026-08-27T12:02:00.000Z'].entries()) {
        await appendTimelineEvent(
          store,
          {
            incidentId: 'incident-1',
            tenantId: 'tenant-1',
            type: 'evidence.collected',
            correlationId: 'correlation-1',
            payload: { index },
          },
          {
            clock: fixedClock(timestamp),
            ids: sequenceIdGenerator([`timeline-${index + 2}`]),
          },
        );
      }
      const events = await listTimelineEvents(store, 'tenant-1', 'incident-1');
      expect(events.map(event => event.sequence)).toEqual([1, 2, 3]);
      expect(Object.keys(timelineApi).sort()).toEqual(['appendTimelineEvent', 'listTimelineEvents']);
      expect(await listTimelineEvents(store, 'tenant-2', 'incident-1')).toEqual([]);
    } finally {
      store.close();
    }
  });

  it('rejects unbounded payloads and invalid envelope IDs atomically', async () => {
    const database = await createTempDatabase();
    databases.push(database);
    const store = database.createStore();
    try {
      await migrateOperationalStore(store);
      await createIncidentFromAlert(store, makeAlert(), {
        clock: fixedClock('2026-08-27T12:00:00.000Z'),
        ids: sequenceIdGenerator(['incident-1', 'timeline-1', 'outbox-1']),
      });

      for (const payload of [{ nested: { raw: 'unbounded' } }, { oversized: 'x'.repeat(2_049) }]) {
        await expect(
          appendTimelineEvent(store, {
            incidentId: 'incident-1',
            tenantId: 'tenant-1',
            type: 'evidence.collected',
            correlationId: 'correlation-1',
            payload: payload as never,
          }),
        ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
      }

      for (const identifiers of [
        { runId: '', correlationId: 'correlation-1' },
        { runId: 'run-1', correlationId: '' },
        { runId: 'run-1', correlationId: 'correlation-1', causationId: '' },
      ]) {
        await expect(
          transitionIncident(
            store,
            {
              tenantId: 'tenant-1',
              incidentId: 'incident-1',
              expectedVersion: 0,
              to: 'investigating',
              ...identifiers,
            },
            {
              clock: fixedClock('2026-08-27T12:01:00.000Z'),
              ids: sequenceIdGenerator(['timeline-invalid', 'outbox-invalid']),
            },
          ),
        ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
      }

      for (const invalid of [
        { eventType: 'security.invalid', schemaVersion: 1 },
        { eventType: 'security.incident.updated', schemaVersion: 2 },
      ] as const) {
        await expect(
          store.transaction(tx =>
            insertTimelineAndOutbox(tx, {
              timelineId: 'timeline-invalid-direct',
              eventId: 'outbox-invalid-direct',
              incidentId: 'incident-1',
              tenantId: 'tenant-1',
              sequence: 2,
              type: 'incident.status_changed',
              eventType: invalid.eventType as never,
              runId: 'run-1',
              correlationId: 'correlation-1',
              occurredAt: '2026-08-27T12:01:00.000Z',
              payload: { status: 'investigating' },
              schemaVersion: invalid.schemaVersion as never,
            }),
          ),
        ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
      }

      expect(await getIncident(store, 'tenant-1', 'incident-1')).toMatchObject({
        status: 'received',
        version: 0,
        timelineSequence: 1,
        updatedAt: '2026-08-27T12:00:00.000Z',
      });
      const counts = await store.execute({
        sql: `SELECT
          (SELECT count(*) FROM timeline_events) AS timeline_count,
          (SELECT count(*) FROM outbox_events) AS outbox_count`,
      });
      expect(counts.rows[0]).toEqual({ timeline_count: 1, outbox_count: 1 });
    } finally {
      store.close();
    }
  });

  it('fails closed on corrupted timeline payloads and regressing clocks', async () => {
    const database = await createTempDatabase();
    databases.push(database);
    const store = database.createStore();
    try {
      await migrateOperationalStore(store);
      await createIncidentFromAlert(store, makeAlert(), {
        clock: fixedClock('2026-08-27T12:00:00.000Z'),
        ids: sequenceIdGenerator(['incident-1', 'timeline-1', 'outbox-1']),
      });
      await expect(
        appendTimelineEvent(
          store,
          {
            incidentId: 'incident-1',
            tenantId: 'tenant-1',
            type: 'evidence.collected',
            correlationId: 'correlation-1',
            payload: { status: 'collected' },
          },
          { clock: fixedClock('2026-08-27T11:59:00.000Z') },
        ),
      ).rejects.toMatchObject({ code: 'CONFLICT' });

      await store.execute({
        sql: `UPDATE timeline_events
          SET payload_json = '{"nested":{"raw":"unbounded"}}'
          WHERE id = 'timeline-1'`,
      });
      await expect(listTimelineEvents(store, 'tenant-1', 'incident-1')).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
      });

      await store.execute({
        sql: `UPDATE timeline_events SET payload_json = '{}', schema_version = 2
          WHERE id = 'timeline-1'`,
      });
      await expect(listTimelineEvents(store, 'tenant-1', 'incident-1')).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
      });

      expect(await getIncident(store, 'tenant-1', 'incident-1')).toMatchObject({
        timelineSequence: 1,
        updatedAt: '2026-08-27T12:00:00.000Z',
      });
    } finally {
      store.close();
    }
  });
});
