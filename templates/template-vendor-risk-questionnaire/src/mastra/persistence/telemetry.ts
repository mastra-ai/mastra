import type { Client } from '@libsql/client';
import { domainEventSchema } from '../contracts/telemetry.ts';
import type { DomainEvent } from '../contracts/telemetry.ts';
import { canonicalJson } from '../intake/source.ts';

// Called within the same transaction as its authoritative business-state change.
export async function persistDomainEvent(db: Pick<Client, 'execute'>, runId: string, key: string, raw: DomainEvent) {
  await db.execute({
    sql: 'INSERT INTO vrq_events (run_id,event_key,event_json) VALUES (?,?,?) ON CONFLICT(run_id,event_key) DO NOTHING',
    args: [runId, key, canonicalJson(domainEventSchema.parse(raw))],
  });
}
