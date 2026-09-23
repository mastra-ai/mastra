import { EventEmitterPubSub } from '@mastra/core/events';
import { afterEach, describe, expect, it } from 'vitest';

import { OutboxDispatcher } from '../../src/workers/outbox-dispatcher.js';
import {
  claimOutboxBatch,
  markOutboxPublished,
  reconcilePublishedAlertsWithoutRun,
  recordOutboxFailure,
} from '../../src/db/outbox-operations.js';
import { createIncidentFromAlert } from '../../src/db/incident-operations.js';
import { migrateOperationalStore } from '../../src/db/migrate.js';
import type { OperationalStore } from '../../src/db/operational-store.js';
import { materializeInvestigationStart } from '../../src/db/workflow-run-operations.js';
import { fixedClock } from '../../src/domain/clock.js';
import { DomainError } from '../../src/domain/errors.js';
import { sequenceIdGenerator } from '../../src/domain/id-generator.js';
import { makeAlert } from '../fixtures/domain.js';
import { makeServerConfig } from '../fixtures/alert-intake.js';
import { createTempDatabase, type TempDatabase } from '../helpers/temp-libsql.js';

const databases: TempDatabase[] = [];
const silentLogger = { write: () => {} };

afterEach(async () => {
  await Promise.all(databases.splice(0).map(database => database.cleanup()));
});

async function setup() {
  const database = await createTempDatabase();
  databases.push(database);
  const store = database.createStore();
  await migrateOperationalStore(store);
  await createIncidentFromAlert(store, makeAlert(), {
    clock: fixedClock('2026-08-27T12:00:00.000Z'),
    ids: sequenceIdGenerator(['incident-1', 'timeline-1', 'outbox-1']),
  });
  return { database, store };
}

function failPublishedMark(store: OperationalStore): OperationalStore {
  return {
    execute: async statement => {
      if (statement.sql.includes('UPDATE outbox_events SET published_at =')) {
        throw new DomainError('STORAGE_UNAVAILABLE', { retryable: true });
      }
      return store.execute(statement);
    },
    transaction: fn => store.transaction(fn),
    close: () => {},
  };
}

describe('outbox dispatcher', () => {
  it('uses an expiring fence and prevents two dispatchers claiming the same row', async () => {
    const { database, store } = await setup();
    const second = database.createStore();
    try {
      const [one, two] = await Promise.all([
        claimOutboxBatch(store, {
          now: '2026-08-27T12:00:00.000Z',
          leaseUntil: '2026-08-27T12:00:10.000Z',
          limit: 1,
        }),
        claimOutboxBatch(second, {
          now: '2026-08-27T12:00:00.000Z',
          leaseUntil: '2026-08-27T12:00:11.000Z',
          limit: 1,
        }),
      ]);
      expect(one.length + two.length).toBe(1);
      const claimed = one[0] ?? two[0]!;
      expect(
        await markOutboxPublished(store, {
          id: 'outbox-1',
          leaseToken: 'wrong-fence',
          publishedAt: '2026-08-27T12:00:01.000Z',
        }),
      ).toBe(false);
      const afterExpiry = await claimOutboxBatch(store, {
        now: '2026-08-27T12:00:12.000Z',
        leaseUntil: '2026-08-27T12:00:22.000Z',
        limit: 1,
      });
      expect(afterExpiry).toHaveLength(1);
      expect(afterExpiry[0]?.valid).toBe(true);
      if (!afterExpiry[0]?.valid || !claimed.valid) {
        throw new Error('expected valid claims');
      }
      expect(afterExpiry[0].event.data.eventId).toBe(claimed.event.data.eventId);
    } finally {
      store.close();
      second.close();
    }
  });

  it('publishes through the official local PubSub and marks success', async () => {
    const { store } = await setup();
    const pubsub = new EventEmitterPubSub();
    const delivered: string[] = [];
    await pubsub.subscribe('security.alert.received', async (event, ack) => {
      delivered.push(event.data.eventId as string);
      await ack?.();
    });
    try {
      const dispatcher = new OutboxDispatcher(
        store,
        pubsub,
        makeServerConfig().outbox,
        silentLogger,
        () => new Date('2026-08-27T12:00:01.000Z'),
      );
      expect(await dispatcher.runOnce()).toBe(1);
      await pubsub.flush();
      expect(delivered).toEqual(['outbox-1']);
      const row = await store.execute({
        sql: "SELECT published_at, attempt_count FROM outbox_events WHERE id = 'outbox-1'",
      });
      expect(row.rows[0]).toEqual({
        published_at: '2026-08-27T12:00:01.000Z',
        attempt_count: 0,
      });
    } finally {
      await pubsub.close();
      store.close();
    }
  });

  it('re-delivers after a successful publish whose mark failed without consuming the retry budget', async () => {
    const { store } = await setup();
    const pubsub = new EventEmitterPubSub();
    const delivered: string[] = [];
    await pubsub.subscribe('security.alert.received', async (event, ack) => {
      delivered.push(event.data.eventId as string);
      await ack?.();
    });
    try {
      const first = new OutboxDispatcher(
        failPublishedMark(store),
        pubsub,
        { ...makeServerConfig().outbox, batchSize: 1, maxAttempts: 1 },
        silentLogger,
        () => new Date('2026-08-27T12:00:01.000Z'),
      );
      expect(await first.runOnce()).toBe(1);
      await pubsub.flush();
      expect(delivered).toEqual(['outbox-1']);
      const afterMarkFailure = await store.execute({
        sql: `SELECT published_at, available_at, attempt_count, error_code,
          (SELECT count(*) FROM dead_letter_events) AS dead_count
          FROM outbox_events WHERE id = 'outbox-1'`,
      });
      expect(afterMarkFailure.rows[0]).toEqual({
        published_at: null,
        available_at: '2026-08-27T12:00:11.000Z',
        attempt_count: 0,
        error_code: null,
        dead_count: 0,
      });

      const recovery = new OutboxDispatcher(
        store,
        pubsub,
        { ...makeServerConfig().outbox, batchSize: 1, maxAttempts: 1 },
        silentLogger,
        () => new Date('2026-08-27T12:00:12.000Z'),
      );
      expect(await recovery.runOnce()).toBe(1);
      await pubsub.flush();
      expect(delivered).toEqual(['outbox-1', 'outbox-1']);
      const recovered = await store.execute({
        sql: `SELECT published_at, attempt_count, error_code,
          (SELECT count(*) FROM dead_letter_events) AS dead_count
          FROM outbox_events WHERE id = 'outbox-1'`,
      });
      expect(recovered.rows[0]).toEqual({
        published_at: '2026-08-27T12:00:12.000Z',
        attempt_count: 0,
        error_code: null,
        dead_count: 0,
      });
    } finally {
      await pubsub.close();
      store.close();
    }
  });

  it('does not create a terminal dead-letter when publish materializes the workflow before mark failure', async () => {
    const { database, store } = await setup();
    const markerStore = database.createStore();
    class MaterializingPubSub extends EventEmitterPubSub {
      override async publish(): Promise<void> {
        await materializeInvestigationStart(
          markerStore,
          {
            eventId: 'outbox-1',
            incidentId: 'incident-1',
            tenantId: 'tenant-1',
            alertId: 'alert-1',
            correlationId: 'correlation-1',
          },
          {
            clock: fixedClock('2026-08-27T12:00:01.000Z'),
            ids: sequenceIdGenerator(['timeline-2', 'outbox-2']),
          },
        );
      }
    }
    class FailingPubSub extends EventEmitterPubSub {
      override async publish(): Promise<void> {
        throw new Error('broker unavailable after earlier delivery');
      }
    }
    const firstPubsub = new MaterializingPubSub();
    const recoveryPubsub = new FailingPubSub();
    try {
      const first = new OutboxDispatcher(
        failPublishedMark(store),
        firstPubsub,
        { ...makeServerConfig().outbox, batchSize: 1, maxAttempts: 1 },
        silentLogger,
        () => new Date('2026-08-27T12:00:01.000Z'),
      );
      expect(await first.runOnce()).toBe(1);
      const afterMarkFailure = await store.execute({
        sql: `SELECT published_at, attempt_count, error_code,
          (SELECT count(*) FROM workflow_runs WHERE run_id = 'outbox-1') AS run_count,
          (SELECT count(*) FROM dead_letter_events) AS dead_count
          FROM outbox_events WHERE id = 'outbox-1'`,
      });
      expect(afterMarkFailure.rows[0]).toEqual({
        published_at: null,
        attempt_count: 0,
        error_code: null,
        run_count: 1,
        dead_count: 0,
      });

      const recovery = new OutboxDispatcher(
        store,
        recoveryPubsub,
        { ...makeServerConfig().outbox, batchSize: 1, maxAttempts: 1 },
        silentLogger,
        () => new Date('2026-08-27T12:00:12.000Z'),
      );
      expect(await recovery.runOnce()).toBe(1);
      const recovered = await store.execute({
        sql: `SELECT published_at, attempt_count, error_code,
          (SELECT count(*) FROM workflow_runs WHERE run_id = 'outbox-1') AS run_count,
          (SELECT count(*) FROM dead_letter_events) AS dead_count,
          (SELECT status FROM incidents WHERE id = 'incident-1') AS incident_status
          FROM outbox_events WHERE id = 'outbox-1'`,
      });
      expect(recovered.rows[0]).toEqual({
        published_at: '2026-08-27T12:00:12.000Z',
        attempt_count: 0,
        error_code: null,
        run_count: 1,
        dead_count: 0,
        incident_status: 'investigating',
      });
    } finally {
      await firstPubsub.close();
      await recoveryPubsub.close();
      markerStore.close();
      store.close();
    }
  });

  it('serializes retry exhaustion against concurrent workflow materialization', async () => {
    const { database, store } = await setup();
    const materializationStore = database.createStore();
    let releaseMaterialization = () => {};
    const mayMaterialize = new Promise<void>(resolve => {
      releaseMaterialization = resolve;
    });
    let signalMaterialization = () => {};
    const materializationStarted = new Promise<void>(resolve => {
      signalMaterialization = resolve;
    });
    const delayedStore: OperationalStore = {
      execute: statement => materializationStore.execute(statement),
      transaction: async fn => {
        signalMaterialization();
        await mayMaterialize;
        return materializationStore.transaction(fn);
      },
      close: () => materializationStore.close(),
    };
    try {
      const claimed = await claimOutboxBatch(store, {
        now: '2026-08-27T12:00:01.000Z',
        leaseUntil: '2026-08-27T12:00:11.000Z',
        limit: 1,
      });
      expect(claimed).toHaveLength(1);
      const materializing = materializeInvestigationStart(
        delayedStore,
        {
          eventId: 'outbox-1',
          incidentId: 'incident-1',
          tenantId: 'tenant-1',
          alertId: 'alert-1',
          correlationId: 'correlation-1',
        },
        {
          clock: fixedClock('2026-08-27T12:00:01.000Z'),
          ids: sequenceIdGenerator(['timeline-2', 'outbox-2']),
        },
      );
      await materializationStarted;
      expect(
        await recordOutboxFailure(store, {
          id: 'outbox-1',
          leaseToken: '2026-08-27T12:00:11.000Z',
          now: '2026-08-27T12:00:02.000Z',
          errorCode: 'PUBSUB_UNAVAILABLE',
          maxAttempts: 1,
          backoffBaseMs: 1_000,
          backoffCapMs: 60_000,
        }),
      ).toBe('dead_letter');
      releaseMaterialization();
      expect(await materializing).toEqual({
        duplicate: true,
        runId: 'outbox-1',
      });
      const state = await store.execute({
        sql: `SELECT published_at, attempt_count, status,
          (SELECT count(*) FROM workflow_runs) AS runs,
          (SELECT count(*) FROM dead_letter_events) AS dead_letters
          FROM outbox_events
          JOIN incidents ON incidents.id = outbox_events.incident_id
          WHERE outbox_events.id = 'outbox-1'`,
      });
      expect(state.rows[0]).toEqual({
        published_at: null,
        attempt_count: 1,
        status: 'received',
        runs: 0,
        dead_letters: 1,
      });
    } finally {
      releaseMaterialization();
      delayedStore.close();
      store.close();
    }
  });

  it('backs off confirmed failures and dead-letters at the bounded maximum', async () => {
    const { store } = await setup();
    class FailingPubSub extends EventEmitterPubSub {
      override async publish(): Promise<void> {
        throw new Error('sensitive broker detail');
      }
    }
    const pubsub = new FailingPubSub();
    try {
      for (const timestamp of ['2026-08-27T12:00:01.000Z', '2026-08-27T12:01:01.000Z', '2026-08-27T12:02:01.000Z']) {
        const dispatcher = new OutboxDispatcher(
          store,
          pubsub,
          { ...makeServerConfig().outbox, maxAttempts: 3 },
          silentLogger,
          () => new Date(timestamp),
        );
        expect(await dispatcher.runOnce()).toBe(1);
      }
      const row = await store.execute({
        sql: `SELECT attempt_count, error_code, published_at,
          (SELECT count(*) FROM dead_letter_events WHERE source_outbox_id = outbox_events.id) AS dead_count
          FROM outbox_events WHERE id = 'outbox-1'`,
      });
      expect(row.rows[0]).toEqual({
        attempt_count: 3,
        error_code: 'PUBSUB_UNAVAILABLE',
        published_at: null,
        dead_count: 1,
      });
    } finally {
      await pubsub.close();
      store.close();
    }
  });

  it('recovers a publish-before-marker crash but not a materialized run', async () => {
    const { store } = await setup();
    try {
      const claimed = await claimOutboxBatch(store, {
        now: '2026-08-27T12:00:01.000Z',
        leaseUntil: '2026-08-27T12:00:11.000Z',
        limit: 1,
      });
      await markOutboxPublished(store, {
        id: 'outbox-1',
        leaseToken: claimed[0]!.leaseToken,
        publishedAt: '2026-08-27T12:00:02.000Z',
      });
      expect(
        await reconcilePublishedAlertsWithoutRun(store, {
          now: '2026-08-27T12:01:00.000Z',
          olderThan: '2026-08-27T12:00:50.000Z',
        }),
      ).toBe(1);
      const row = await store.execute({
        sql: "SELECT published_at, available_at FROM outbox_events WHERE id = 'outbox-1'",
      });
      expect(row.rows[0]).toEqual({
        published_at: null,
        available_at: '2026-08-27T12:01:00.000Z',
      });
    } finally {
      store.close();
    }
  });

  it('dead-letters a corrupted persisted event instead of poisoning polling', async () => {
    const { store } = await setup();
    const pubsub = new EventEmitterPubSub();
    try {
      await store.execute({
        sql: `UPDATE outbox_events SET payload_json = '{"nested":{"invalid":true}}'
          WHERE id = 'outbox-1'`,
      });
      const dispatcher = new OutboxDispatcher(
        store,
        pubsub,
        { ...makeServerConfig().outbox, maxAttempts: 1 },
        silentLogger,
        () => new Date('2026-08-27T12:00:01.000Z'),
      );
      expect(await dispatcher.runOnce()).toBe(1);
      const result = await store.execute({
        sql: `SELECT error_code, attempt_count,
          (SELECT count(*) FROM dead_letter_events WHERE source_outbox_id = 'outbox-1') AS dead_count
          FROM outbox_events WHERE id = 'outbox-1'`,
      });
      expect(result.rows[0]).toEqual({
        error_code: 'EVENT_INVALID',
        attempt_count: 1,
        dead_count: 1,
      });
    } finally {
      await pubsub.close();
      store.close();
    }
  });
});
