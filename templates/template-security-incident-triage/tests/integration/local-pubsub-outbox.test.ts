import { describe, expect, it } from 'vitest';
import { createTempDatabase } from '../helpers/temp-libsql.js';
import { migrateOperationalStore } from '../../src/db/migrate.js';
import { createIncidentFromAlert } from '../../src/db/incident-operations.js';
import { fixedClock } from '../../src/domain/clock.js';
import { sequenceIdGenerator } from '../../src/domain/id-generator.js';
import { makeAlert } from '../fixtures/domain.js';
import { InProcessDomainPubSub } from '../../src/workers/in-process-domain-pubsub.js';
import { OutboxDispatcher } from '../../src/workers/outbox-dispatcher.js';
import { startWorkflowWorker } from '../../src/workers/workflow-worker.js';
import { materializeInvestigationStart } from '../../src/db/workflow-run-operations.js';

describe('local PubSub and durable outbox', () => {
  it('does not publish a busy/no-ACK command and retries after the consumer lease expires', async () => {
    const database = await createTempDatabase();
    const store = database.createStore();
    const pubsub = new InProcessDomainPubSub();
    let stop = async () => {};
    try {
      await migrateOperationalStore(store);
      await createIncidentFromAlert(store, makeAlert(), {
        clock: fixedClock('2026-08-27T12:00:00.000Z'),
        ids: sequenceIdGenerator(['incident-1', 'timeline-1', 'outbox-1']),
      });
      await store.execute({
        sql: "INSERT INTO consumer_effect_ledger(tenant_id,consumer_group,event_id,status,attempt_count,fence_token,lease_expires_at) VALUES('tenant-1','security-workflow-starters','outbox-1','processing',1,'first-owner',?)",
        args: [new Date(Date.now() + 60_000).toISOString()],
      });
      let starts = 0;
      stop = await startWorkflowWorker({
        pubsub,
        store,
        logger: { write: () => {} },
        maxAttempts: 3,
        workflow: {
          createRun: async () => ({
            startAsync: async ({ inputData }) => {
              starts++;
              await materializeInvestigationStart(store, inputData, {
                clock: fixedClock('2026-08-27T12:00:01.000Z'),
              });
              return { runId: inputData.eventId };
            },
          }),
        },
      });
      let now = '2026-08-27T12:00:00.000Z';
      const dispatcher = new OutboxDispatcher(
        store,
        pubsub,
        {
          batchSize: 1,
          leaseMs: 10_000,
          maxAttempts: 5,
          backoffBaseMs: 1,
          backoffCapMs: 10,
          recoveryGraceMs: 1_000,
        },
        { write: () => {} },
        () => new Date(now),
      );
      await dispatcher.runOnce();
      let row = await store.execute({
        sql: "SELECT published_at,attempt_count FROM outbox_events WHERE id='outbox-1'",
      });
      expect(row.rows[0]).toEqual({ published_at: null, attempt_count: 1 });
      expect(starts).toBe(0);
      await store.execute({
        sql: "UPDATE consumer_effect_ledger SET lease_expires_at='1970-01-01T00:00:00.000Z' WHERE event_id='outbox-1'",
      });
      now = '2026-08-27T12:00:01.000Z';
      await dispatcher.runOnce();
      row = await store.execute({
        sql: "SELECT published_at FROM outbox_events WHERE id='outbox-1'",
      });
      expect(row.rows[0]?.published_at).toBeTruthy();
      expect(starts).toBe(1);
    } finally {
      await stop();
      await pubsub.close();
      store.close();
      await database.cleanup();
    }
  });
});
