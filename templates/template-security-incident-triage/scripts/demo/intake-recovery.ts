import type { OperationalStore } from '../../src/db/operational-store.js';
import type { IncidentKind } from '../../src/schemas/incident.js';
import { InProcessDomainPubSub } from '../../src/workers/in-process-domain-pubsub.js';
import { OutboxDispatcher } from '../../src/workers/outbox-dispatcher.js';
import { ingestLocalDemoAlert, demoNow, demoOutboxOptions, silentDemoLogger } from './webhook-intake.js';

/** Every intake/recovery failure releases the owned store and transport. */
export async function ingestDemoWithRecovery(openStore: () => OperationalStore, kind: IncidentKind) {
  const unavailable = new InProcessDomainPubSub();
  let store: OperationalStore | undefined;
  try {
    store = openStore();
    const intake = await ingestLocalDemoAlert(store, kind);
    await new OutboxDispatcher(
      store,
      unavailable,
      demoOutboxOptions,
      silentDemoLogger,
      () => new Date(demoNow),
    ).runOnce();
    const pending = await store.execute({
      sql: 'SELECT published_at,attempt_count FROM outbox_events WHERE id=?',
      args: [intake.scope.eventId],
    });
    if (pending.rows[0]?.published_at !== null || pending.rows[0]?.attempt_count !== 1)
      throw new Error('DEMO_OUTBOX_RECOVERY_PRECONDITION_FAILED');
    return intake;
  } finally {
    await unavailable.close();
    store?.close();
  }
}
