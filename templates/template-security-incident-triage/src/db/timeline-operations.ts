import { systemClock, type Clock } from '../domain/clock.js';
import { DomainError, parseDomainSchema } from '../domain/errors.js';
import { uuidGenerator, type IdGenerator } from '../domain/id-generator.js';
import {
  AppendTimelineEventInputSchema,
  TimelineEventSchema,
  TimelineWriteSchema,
  type TimelineEvent,
} from './timeline-schema.js';
import type { OperationalStore } from './operational-store.js';

export type { TimelineEvent } from './timeline-schema.js';

export async function appendTimelineEvent(
  store: OperationalStore,
  input: Readonly<{
    incidentId: string;
    tenantId: string;
    type: string;
    correlationId: string;
    causationId?: string;
    payload: Readonly<Record<string, string | number | boolean | null>>;
  }>,
  dependencies: Readonly<{ clock?: Clock; ids?: IdGenerator }> = {},
): Promise<TimelineEvent> {
  const parsedInput = parseDomainSchema(AppendTimelineEventInputSchema, input);
  const id = (dependencies.ids ?? uuidGenerator).next();
  const occurredAt = (dependencies.clock ?? systemClock).now();
  return store.transaction(async tx => {
    const updated = await tx.execute({
      sql: `UPDATE incidents SET timeline_sequence = timeline_sequence + 1,
        updated_at = ? WHERE tenant_id = ? AND id = ? AND updated_at <= ?
        RETURNING timeline_sequence`,
      args: [occurredAt, parsedInput.tenantId, parsedInput.incidentId, occurredAt],
    });
    const row = updated.rows[0];
    if (!row) {
      const existing = await tx.execute({
        sql: 'SELECT 1 FROM incidents WHERE tenant_id = ? AND id = ?',
        args: [parsedInput.tenantId, parsedInput.incidentId],
      });
      throw new DomainError(existing.rows.length === 0 ? 'NOT_FOUND' : 'CONFLICT');
    }
    const sequence = Number(row.timeline_sequence);
    const event = parseDomainSchema(TimelineWriteSchema, {
      timelineId: id,
      incidentId: parsedInput.incidentId,
      tenantId: parsedInput.tenantId,
      sequence,
      type: parsedInput.type,
      correlationId: parsedInput.correlationId,
      ...(parsedInput.causationId ? { causationId: parsedInput.causationId } : {}),
      occurredAt,
      payload: parsedInput.payload,
      schemaVersion: 1,
    });
    await tx.execute({
      sql: `INSERT INTO timeline_events(
        id, incident_id, tenant_id, sequence, type, category, correlation_id,
        causation_id, payload_json, schema_version, occurred_at
      ) VALUES (?, ?, ?, ?, ?, 'domain', ?, ?, ?, 1, ?)`,
      args: [
        event.timelineId,
        event.incidentId,
        event.tenantId,
        event.sequence,
        event.type,
        event.correlationId,
        event.causationId ?? null,
        JSON.stringify(event.payload),
        event.occurredAt,
      ],
    });
    return parseDomainSchema(TimelineEventSchema, {
      id: event.timelineId,
      incidentId: event.incidentId,
      tenantId: event.tenantId,
      sequence: event.sequence,
      type: event.type,
      occurredAt: event.occurredAt,
      payload: event.payload,
    });
  });
}

export async function listTimelineEvents(
  store: OperationalStore,
  tenantId: string,
  incidentId: string,
): Promise<readonly TimelineEvent[]> {
  const result = await store.execute({
    sql: `SELECT id, incident_id, tenant_id, sequence, type, correlation_id,
      causation_id, schema_version, occurred_at, payload_json
      FROM timeline_events WHERE tenant_id = ? AND incident_id = ? ORDER BY sequence`,
    args: [tenantId, incidentId],
  });
  return result.rows.map(row => {
    const persisted = parseDomainSchema(TimelineWriteSchema, {
      timelineId: row.id,
      incidentId: row.incident_id,
      tenantId: row.tenant_id,
      sequence: Number(row.sequence),
      type: row.type,
      correlationId: row.correlation_id,
      ...(row.causation_id === null ? {} : { causationId: row.causation_id }),
      occurredAt: row.occurred_at,
      payload: parsePayload(row.payload_json),
      schemaVersion: Number(row.schema_version),
    });
    return parseDomainSchema(TimelineEventSchema, {
      id: persisted.timelineId,
      incidentId: persisted.incidentId,
      tenantId: persisted.tenantId,
      sequence: persisted.sequence,
      type: persisted.type,
      occurredAt: persisted.occurredAt,
      payload: persisted.payload,
    });
  });
}

function parsePayload(value: unknown): unknown {
  if (typeof value !== 'string') throw new DomainError('VALIDATION_FAILED');
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new DomainError('VALIDATION_FAILED');
  }
}
