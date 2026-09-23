import { createHash } from 'node:crypto';

import { systemClock, type Clock } from '../domain/clock.js';
import type { OperationalStore } from './operational-store.js';

export async function persistStandaloneDeadLetter(
  store: Pick<OperationalStore, 'execute'>,
  input: Readonly<{
    eventType: string;
    eventRef: string;
    errorCode: string;
    tenantId?: string;
    incidentId?: string;
  }>,
  clock: Clock = systemClock,
): Promise<void> {
  const id = `dead_${createHash('sha256')
    .update(input.eventType)
    .update('\0')
    .update(input.eventRef)
    .update('\0')
    .update(input.errorCode)
    .digest('hex')}`;
  await store.execute({
    sql: `INSERT OR IGNORE INTO dead_letter_events(
      id, source_outbox_id, event_type, event_ref, tenant_id, incident_id,
      error_code, attempt_count, created_at
    ) VALUES (?, NULL, ?, ?, ?, ?, ?, 1, ?)`,
    args: [
      id,
      input.eventType,
      input.eventRef,
      input.tenantId ?? null,
      input.incidentId ?? null,
      input.errorCode,
      clock.now(),
    ],
  });
}
