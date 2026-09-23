import { AlertSchema, type Alert } from '../schemas/alert.js';
import { IncidentSchema, type Incident, type IncidentStatus } from '../schemas/incident.js';
import { assertTransition } from '../domain/incident-state.js';
import { DomainError, parseDomainSchema } from '../domain/errors.js';
import { systemClock, type Clock } from '../domain/clock.js';
import { uuidGenerator, type IdGenerator } from '../domain/id-generator.js';
import { DomainEventSchema } from '../schemas/domain-event.js';
import { boundedJsonObject } from '../schemas/common.js';
import type { OperationalStore, SqlResult, StoreTransaction } from './operational-store.js';
import { TimelineWriteSchema } from './timeline-schema.js';

export type OperationDependencies = Readonly<{
  clock?: Clock;
  ids?: IdGenerator;
  correlationId?: string;
  traceContext?: Readonly<{
    traceId: string;
    parentSpanId?: string;
    runId: string;
    requestId: string;
  }>;
  enforceAlertOrdering?: boolean;
  /**
   * Defaults to true. Studio can persist a webhook-shaped input inside the
   * already-running workflow and mark its intake event as consumed, avoiding
   * a second run through the background dispatcher.
   */
  scheduleWorkflow?: boolean;
  /** May enrich an alert only with local, transactionally verified facts. */
  beforeIncidentWrite?: (tx: StoreTransaction, alert: Alert, incidentId: string) => Promise<Alert | void>;
  /**
   * Reserves provider-owned ordering state before an incident exists. A
   * canonical duplicate returns the already durable incident identity, so no
   * second alert, timeline or outbox record is written.
   */
  preflightAlert?: (
    tx: StoreTransaction,
    alert: Alert,
    incidentId: string,
  ) => Promise<Alert | Readonly<{ duplicateIncidentId: string }> | void>;
}>;

type TransitionDependencies = OperationDependencies &
  Readonly<{
    assertReady?: (tx: StoreTransaction) => Promise<void>;
  }>;

const reservedTransitionPayloadKeys = new Set([
  'category',
  'causationId',
  'correlationId',
  'data',
  'eventId',
  'eventType',
  'from',
  'incidentId',
  'occurredAt',
  'payload',
  'runId',
  'schemaVersion',
  'sequence',
  'tenantId',
  'timelineId',
  'to',
  'type',
]);

export async function createIncidentFromAlert(
  store: OperationalStore,
  untrustedAlert: Alert,
  dependencies: OperationDependencies = {},
): Promise<Incident> {
  return (await createIncidentFromAlertResult(store, untrustedAlert, dependencies)).incident;
}

export async function createIncidentFromAlertResult(
  store: OperationalStore,
  untrustedAlert: Alert,
  dependencies: OperationDependencies = {},
): Promise<Readonly<{ incident: Incident; duplicate: boolean }>> {
  const alert = parseDomainSchema(AlertSchema, untrustedAlert);
  if (dependencies.enforceAlertOrdering) {
    await store.execute({ sql: 'SELECT 1' });
  }
  const clock = dependencies.clock ?? systemClock;
  const ids = dependencies.ids ?? uuidGenerator;
  const incidentId = ids.next();
  const timelineId = ids.next();
  const eventId = ids.next();
  const now = clock.now();

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await store.transaction(async tx => {
        if (dependencies.enforceAlertOrdering) {
          const existingIdentity = await tx.execute({
            sql: `SELECT a.canonical_json, i.* FROM alerts a
              JOIN incidents i ON i.tenant_id = a.tenant_id AND i.id = a.incident_id
              WHERE a.source = ? AND a.source_event_id = ?`,
            args: [alert.source, alert.sourceEventId],
          });
          const existingRow = existingIdentity.rows[0];
          if (existingRow) {
            if (
              typeof existingRow.canonical_json !== 'string' ||
              !alertsAreEquivalent(existingRow.canonical_json, alert)
            ) {
              throw new DomainError('CONFLICT');
            }
            return {
              duplicate: true,
              incident: incidentFromRow(existingRow),
            };
          }
        }

        // Provider-owned replay resolution runs before the generic stream
        // query. This lets a consumed expected callback remain idempotent even
        // after newer events have advanced the same WorkOS membership.
        const preflight = await dependencies.preflightAlert?.(tx, alert, incidentId);
        if (isDuplicatePreflight(preflight)) {
          const existingIncident = await tx.execute({
            sql: 'SELECT * FROM incidents WHERE tenant_id = ? AND id = ?',
            args: [alert.tenantId, preflight.duplicateIncidentId],
          });
          const row = existingIncident.rows[0];
          if (!row) throw new DomainError('CONFLICT');
          return { duplicate: true, incident: incidentFromRow(row) };
        }
        const preflightAlert = preflight ?? alert;
        assertAlertIdentityUnchanged(alert, preflightAlert);

        if (dependencies.enforceAlertOrdering) {
          const orderingObject = alertOrderingObject(alert);
          const newerInStream = await tx.execute({
            sql: `SELECT 1 FROM alerts
              WHERE source = ? AND tenant_id = ?
                AND CASE
                  WHEN json_extract(canonical_json, '$.sessionId') IS NOT NULL THEN 'session'
                  WHEN json_extract(canonical_json, '$.changes.membershipId') IS NOT NULL THEN 'membership'
                  ELSE json_extract(canonical_json, '$.target.type')
                END = ?
                AND CASE
                  WHEN json_extract(canonical_json, '$.sessionId') IS NOT NULL
                    THEN json_extract(canonical_json, '$.sessionId')
                  WHEN json_extract(canonical_json, '$.changes.membershipId') IS NOT NULL
                    THEN json_extract(canonical_json, '$.changes.membershipId')
                  ELSE json_extract(canonical_json, '$.target.id')
                END = ? AND occurred_at > ?
              LIMIT 1`,
            args: [alert.source, alert.tenantId, orderingObject.type, orderingObject.id, alert.occurredAt],
          });
          if (newerInStream.rows.length > 0) {
            throw new DomainError('EVENT_OUT_OF_ORDER');
          }
        }

        await tx.execute({
          sql: `INSERT INTO incidents(
          id, tenant_id, kind, subject_id, status, version, timeline_sequence, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'received', 0, 1, ?, ?)`,
          args: [incidentId, alert.tenantId, alert.kind, alert.subjectId, now, now],
        });
        // The incident is intentionally durable before a provider-specific
        // enrichment runs. This gives derived records (such as a WorkOS
        // restore snapshot) the exact incident identity that will be
        // authorized later, while the surrounding transaction still rolls the
        // whole ingest back on any failure.
        const persistedAlert =
          (await dependencies.beforeIncidentWrite?.(tx, preflightAlert, incidentId)) ?? preflightAlert;
        assertAlertIdentityUnchanged(alert, persistedAlert);
        await tx.execute({
          sql: `INSERT INTO alerts(
          id, incident_id, tenant_id, source, source_event_id, kind, occurred_at,
          subject_id, canonical_json, raw_payload_ref, schema_version, idempotency_key
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            persistedAlert.alertId,
            incidentId,
            persistedAlert.tenantId,
            persistedAlert.source,
            persistedAlert.sourceEventId,
            persistedAlert.kind,
            persistedAlert.occurredAt,
            persistedAlert.subjectId,
            JSON.stringify(persistedAlert),
            persistedAlert.rawPayloadRef,
            persistedAlert.schemaVersion,
            persistedAlert.idempotencyKey,
          ],
        });
        await insertTimelineAndOutbox(tx, {
          timelineId,
          eventId,
          incidentId,
          tenantId: persistedAlert.tenantId,
          sequence: 1,
          type: 'incident.received',
          eventType: 'security.alert.received',
          runId: incidentId,
          correlationId: dependencies.correlationId ?? persistedAlert.idempotencyKey,
          causationId: persistedAlert.sourceEventId,
          occurredAt: now,
          payload: {
            alertId: persistedAlert.alertId,
            status: 'received',
            ...(dependencies.traceContext ? { __traceContext: JSON.stringify(dependencies.traceContext) } : {}),
          },
        });
        if (dependencies.scheduleWorkflow === false) {
          await tx.execute({
            sql: 'UPDATE outbox_events SET published_at = ? WHERE id = ?',
            args: [now, eventId],
          });
        }
        return {
          duplicate: false,
          incident: parseDomainSchema(IncidentSchema, {
            schemaVersion: 1,
            incidentId,
            tenantId: persistedAlert.tenantId,
            subjectId: persistedAlert.subjectId,
            kind: persistedAlert.kind,
            status: 'received',
            version: 0,
            timelineSequence: 1,
            createdAt: now,
            updatedAt: now,
          }),
        };
      });
    } catch (error) {
      lastError = error;
      try {
        const existing = await store.execute({
          sql: `SELECT a.incident_id, a.canonical_json
            FROM alerts a
            WHERE a.source = ? AND a.source_event_id = ?`,
          args: [alert.source, alert.sourceEventId],
        });
        const row = existing.rows[0];
        if (
          row &&
          typeof row.canonical_json === 'string' &&
          alertsAreEquivalent(row.canonical_json, alert) &&
          typeof row.incident_id === 'string'
        ) {
          return {
            duplicate: true,
            incident: await getIncident(store, alert.tenantId, row.incident_id),
          };
        }
      } catch (readError) {
        lastError = readError;
      }
      if (lastError instanceof DomainError && lastError.retryable && attempt < 2) {
        await new Promise<void>(resolve => setImmediate(resolve));
        continue;
      }
      throw lastError instanceof DomainError ? lastError : new DomainError('STORAGE_UNAVAILABLE');
    }
  }
  throw lastError;
}

function isDuplicatePreflight(
  value: Alert | Readonly<{ duplicateIncidentId: string }> | void,
): value is Readonly<{ duplicateIncidentId: string }> {
  return Boolean(value && 'duplicateIncidentId' in value);
}

/**
 * Order is an object property, not a user or incident-kind property. Sessions
 * and memberships are authoritative when supplied; other normalized events
 * use their declared target as a narrow, stable fallback.
 */
function alertOrderingObject(alert: Alert): Readonly<{ type: string; id: string }> {
  if (alert.sessionId) return { type: 'session', id: alert.sessionId };
  const membershipId = alert.changes?.membershipId;
  if (typeof membershipId === 'string') return { type: 'membership', id: membershipId };
  return { type: alert.target.type, id: alert.target.id };
}

export async function getIncident(store: OperationalStore, tenantId: string, incidentId: string): Promise<Incident> {
  const result = await store.execute({
    sql: `SELECT id, tenant_id, kind, subject_id, status, severity, version,
      timeline_sequence, created_at, updated_at, closed_at
      FROM incidents WHERE tenant_id = ? AND id = ?`,
    args: [tenantId, incidentId],
  });
  const row = result.rows[0];
  if (!row) throw new DomainError('NOT_FOUND');
  return incidentFromRow(row);
}

export async function transitionIncident(
  store: OperationalStore,
  input: Readonly<{
    tenantId: string;
    incidentId: string;
    expectedVersion: number;
    to: IncidentStatus;
    runId: string;
    correlationId: string;
    causationId?: string;
    payload?: Readonly<Record<string, string | number | boolean | null>>;
  }>,
  dependencies: TransitionDependencies = {},
): Promise<Incident> {
  if (input.to === 'approved' || input.to === 'rejected') {
    throw new DomainError('VALIDATION_FAILED');
  }
  const payloadResult = boundedJsonObject.safeParse(input.payload ?? {});
  if (
    !payloadResult.success ||
    Object.keys(payloadResult.data).length > 30 ||
    Object.keys(payloadResult.data).some(key => reservedTransitionPayloadKeys.has(key))
  ) {
    throw new DomainError('VALIDATION_FAILED');
  }
  const clock = dependencies.clock ?? systemClock;
  const ids = dependencies.ids ?? uuidGenerator;
  const occurredAt = clock.now();

  return store.transaction(async tx => {
    await dependencies.assertReady?.(tx);
    const current = await tx.execute({
      sql: 'SELECT status, updated_at FROM incidents WHERE tenant_id = ? AND id = ?',
      args: [input.tenantId, input.incidentId],
    });
    const status = current.rows[0]?.status;
    if (typeof status !== 'string') throw new DomainError('NOT_FOUND');
    if (String(current.rows[0]?.updated_at) > occurredAt) {
      throw new DomainError('CONFLICT');
    }
    assertTransition(status as IncidentStatus, input.to);

    const updated = await tx.execute({
      sql: `UPDATE incidents
        SET status = ?, version = version + 1,
          timeline_sequence = timeline_sequence + 1, updated_at = ?,
          closed_at = CASE WHEN ? = 'closed' THEN ? ELSE closed_at END
        WHERE tenant_id = ? AND id = ? AND status = ? AND version = ?
          AND updated_at <= ?
        RETURNING *`,
      args: [
        input.to,
        occurredAt,
        input.to,
        occurredAt,
        input.tenantId,
        input.incidentId,
        status,
        input.expectedVersion,
        occurredAt,
      ],
    });
    const row = updated.rows[0];
    if (!row) throw new DomainError('CONFLICT');

    await insertTimelineAndOutbox(tx, {
      timelineId: ids.next(),
      eventId: ids.next(),
      incidentId: input.incidentId,
      tenantId: input.tenantId,
      sequence: Number(row.timeline_sequence),
      type: 'incident.status_changed',
      eventType: 'security.incident.updated',
      runId: input.runId,
      correlationId: input.correlationId,
      causationId: input.causationId,
      occurredAt,
      payload: { ...payloadResult.data, from: status, to: input.to },
    });
    return incidentFromRow(row);
  });
}

function alertsAreEquivalent(canonicalJson: string, alert: Alert): boolean {
  let decoded: unknown;
  try {
    decoded = JSON.parse(canonicalJson) as unknown;
  } catch {
    throw new DomainError('VALIDATION_FAILED');
  }
  const persisted = parseDomainSchema(AlertSchema, decoded);
  const persistedCommand: Partial<Alert> = { ...persisted };
  const retriedCommand: Partial<Alert> = { ...alert };
  delete persistedCommand.alertId;
  delete retriedCommand.alertId;
  delete persistedCommand.rawPayloadRef;
  delete retriedCommand.rawPayloadRef;
  // A verified official WorkOS event may acquire local predecessor facts in
  // the write transaction. Retries carry the original provider shape, so the
  // derived facts are deliberately excluded from idempotency comparison.
  if (persisted.source === 'workos' && alert.source === 'workos') {
    for (const command of [persistedCommand, retriedCommand]) {
      // A staging test intent can replace the provider's unknown actor with a
      // locally authenticated service actor. It is derived in the same
      // transaction as the predecessor facts and is absent from webhook
      // retries, so it is excluded from provider-payload equivalence.
      delete command.actor;
      delete (command.changes as Record<string, unknown> | undefined)?.contextVersion;
      delete (command.changes as Record<string, unknown> | undefined)?.previousRole;
      delete (command.changes as Record<string, unknown> | undefined)?.nextRole;
    }
  }
  return JSON.stringify(canonicalizeJson(persistedCommand)) === JSON.stringify(canonicalizeJson(retriedCommand));
}

function assertAlertIdentityUnchanged(original: Alert, candidate: Alert): void {
  const immutable = [
    'schemaVersion',
    'alertId',
    'source',
    'sourceEventId',
    'kind',
    'occurredAt',
    'tenantId',
    'subjectId',
    'rawPayloadRef',
    'idempotencyKey',
  ] as const;
  if (immutable.some(key => candidate[key] !== original[key])) throw new DomainError('VALIDATION_FAILED');
}

function canonicalizeJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeJson);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonicalizeJson(child)]),
  );
}

export async function insertTimelineAndOutbox(
  tx: StoreTransaction,
  input: Readonly<{
    timelineId: string;
    eventId: string;
    incidentId: string;
    tenantId: string;
    sequence: number;
    type: string;
    eventType:
      | 'security.alert.received'
      | 'security.workflow.updated'
      | 'security.approval.requested'
      | 'security.approval.decided'
      | 'security.containment.completed'
      | 'security.incident.updated'
      | 'security.dead-letter';
    runId: string;
    correlationId: string;
    causationId?: string;
    occurredAt: string;
    payload: Readonly<Record<string, string | number | boolean | null>>;
    schemaVersion?: 1;
  }>,
): Promise<void> {
  const timelineResult = TimelineWriteSchema.safeParse({
    timelineId: input.timelineId,
    incidentId: input.incidentId,
    tenantId: input.tenantId,
    sequence: input.sequence,
    type: input.type,
    correlationId: input.correlationId,
    ...(input.causationId === undefined ? {} : { causationId: input.causationId }),
    occurredAt: input.occurredAt,
    payload: input.payload,
    schemaVersion: input.schemaVersion ?? 1,
  });
  const domainEventResult = DomainEventSchema.safeParse({
    type: input.eventType,
    runId: input.runId,
    data: {
      eventId: input.eventId,
      schemaVersion: input.schemaVersion ?? 1,
      occurredAt: input.occurredAt,
      incidentId: input.incidentId,
      tenantId: input.tenantId,
      correlationId: input.correlationId,
      ...(input.causationId === undefined ? {} : { causationId: input.causationId }),
      payload: input.payload,
    },
  });
  if (!timelineResult.success || !domainEventResult.success) {
    throw new DomainError('VALIDATION_FAILED');
  }
  const timeline = timelineResult.data;
  const domainEvent = domainEventResult.data;
  const payload = JSON.stringify(domainEvent.data.payload);
  await tx.execute({
    sql: `INSERT INTO timeline_events(
      id, incident_id, tenant_id, sequence, type, category, correlation_id,
      causation_id, payload_json, schema_version, occurred_at
    ) VALUES (?, ?, ?, ?, ?, 'domain', ?, ?, ?, 1, ?)`,
    args: [
      timeline.timelineId,
      timeline.incidentId,
      timeline.tenantId,
      timeline.sequence,
      timeline.type,
      timeline.correlationId,
      timeline.causationId ?? null,
      payload,
      timeline.occurredAt,
    ],
  });
  await tx.execute({
    sql: `INSERT INTO outbox_events(
      id, type, run_id, incident_id, tenant_id, schema_version,
      correlation_id, causation_id, payload_json, occurred_at, available_at
    ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`,
    args: [
      domainEvent.data.eventId,
      domainEvent.type,
      domainEvent.runId,
      domainEvent.data.incidentId,
      domainEvent.data.tenantId,
      domainEvent.data.correlationId,
      domainEvent.data.causationId ?? null,
      payload,
      domainEvent.data.occurredAt,
      domainEvent.data.occurredAt,
    ],
  });
}

function incidentFromRow(row: SqlResult['rows'][number]): Incident {
  return parseDomainSchema(IncidentSchema, {
    schemaVersion: 1,
    incidentId: row.id,
    tenantId: row.tenant_id,
    subjectId: row.subject_id,
    kind: row.kind,
    ...(row.severity === null ? {} : { severity: row.severity }),
    status: row.status,
    version: Number(row.version),
    timelineSequence: Number(row.timeline_sequence),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.closed_at === null ? {} : { closedAt: row.closed_at }),
  });
}
