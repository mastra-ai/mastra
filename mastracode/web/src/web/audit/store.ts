/**
 * Persistence wrappers for Factory audit events, delegating to the `audit`
 * factory storage domain registered on the seeded {@link FactoryStore} (see
 * `../storage/domains/audit`).
 *
 * `recordAuditEvent` is deliberately swallow-on-failure: auditing must never
 * break the mutation it observes, so insert errors are logged with an
 * `[Audit]` prefix and dropped. Reads are cursor-paginated newest-first.
 */

import { getFactoryStore } from '../runtime-config';
import type {
  AuditEventPage,
  AuditEventRow,
  ListAuditEventsInput,
  RecordAuditEventInput,
} from '../storage/domains/audit/base';

export type { AuditEventPage, AuditEventRow, ListAuditEventsInput, RecordAuditEventInput };

/**
 * Append one audit event. Failures are logged and swallowed — auditing never
 * breaks the factory. Returns the inserted row, or `null` on failure.
 */
export async function recordAuditEvent(input: RecordAuditEventInput): Promise<AuditEventRow | null> {
  try {
    const store = getFactoryStore();
    await store.ensureReady('audit');
    return await store.audit.record(input);
  } catch (err) {
    console.warn('[Audit] Failed to record audit event', {
      action: input.action,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/** List an org's audit events newest-first with keyset pagination. */
export async function listAuditEvents(input: ListAuditEventsInput): Promise<AuditEventPage> {
  const store = getFactoryStore();
  await store.ensureReady('audit');
  return store.audit.list(input);
}
