import { createHash } from 'node:crypto';

import { identitySnapshotIntegrityHash } from '../containment/gateway.js';
import { DomainError } from '../domain/errors.js';
import { canonicalJson } from '../evidence/canonicalize.js';
import type { Alert } from '../schemas/alert.js';
import type { StoreTransaction } from './operational-store.js';
import { consumeStagingPrivilegeChange } from './staging-privilege-intent-operations.js';
import {
  consumeExpectedWorkosMembershipCallback,
  findConsumedWorkosMembershipCallback,
  findExpectedWorkosMembershipCallback,
  type ExpectedWorkosMembershipCallback,
} from './workos-expected-callback-operations.js';

/**
 * Reserves the authoritative WorkOS ordering position before an incident is
 * inserted. A same-position/same-state-and-event-type delivery is a no-op
 * that points to the original incident; a different state or allowlisted
 * provider event type at that position fails closed.
 */
export async function reserveWorkosObservedState(
  tx: StoreTransaction,
  alert: Alert,
  incidentId: string,
): Promise<Alert | Readonly<{ duplicateIncidentId: string }>> {
  if (alert.source !== 'workos') return alert;
  if (alert.sessionId) return reserveObservedSession(tx, alert, incidentId);
  if (alert.kind !== 'unauthorized_privilege_change') return alert;

  const membershipId = alert.changes?.membershipId;
  const observedCurrentRole = alert.changes?.observedCurrentRole;
  if (typeof membershipId !== 'string' || !isRole(observedCurrentRole)) throw new DomainError('VALIDATION_FAILED');
  // Internally normalized membership events default to the active state;
  // WorkOS webhook normalization always supplies the observed status.
  const observedStatus = alert.changes?.observedStatus ?? 'active';
  if (!isMembershipStatus(observedStatus)) throw new DomainError('VALIDATION_FAILED');

  const stateHash = observedStateHash(alert, 'membership');
  const existing = await tx.execute({
    sql: `SELECT observed_role, observed_state_hash, observed_at, version, incident_id
      FROM workos_observed_memberships
      WHERE tenant_id = ? AND subject_id = ? AND membership_id = ?`,
    args: [alert.tenantId, alert.subjectId, membershipId],
  });
  const previous = existing.rows[0];
  const replay = await findConsumedWorkosMembershipCallback(tx, {
    alert,
    membershipId,
    stateHash,
  });
  if (replay) return duplicateFrom(replay.incidentId);
  if (previous && String(previous.observed_at) > alert.occurredAt) throw new DomainError('EVENT_OUT_OF_ORDER');

  const observedPreviousRole = isRole(previous?.observed_role) ? previous.observed_role : undefined;
  const expectedCallback = await findExpectedWorkosMembershipCallback(tx, {
    alert,
    membershipId,
    observedRole: observedCurrentRole,
    observedStatus,
    ...(observedPreviousRole ? { observedPreviousRole } : {}),
  });
  const authoritativeIncidentId = expectedCallback?.incidentId ?? incidentId;
  const duplicate = await reserveWorkosPosition(tx, {
    alert,
    objectType: 'membership',
    objectId: membershipId,
    stateHash,
    incidentId: authoritativeIncidentId,
  });
  if (duplicate) return duplicate;
  const stagingIntent = expectedCallback
    ? undefined
    : await consumeStagingPrivilegeChange(tx, {
        tenantId: alert.tenantId,
        subjectId: alert.subjectId,
        membershipId,
        currentRole: observedCurrentRole,
        sourceEventId: alert.sourceEventId,
        occurredAt: alert.occurredAt,
        ...(observedPreviousRole ? { observedPreviousRole } : {}),
      });
  const previousRole = observedPreviousRole ?? stagingIntent?.previousRole;
  const hasTransition = isRole(previousRole) && previousRole !== observedCurrentRole;
  if (previous) {
    const updated = await tx.execute({
      sql: `UPDATE workos_observed_memberships
        SET observed_role = ?, observed_status = ?, observed_state_hash = ?, incident_id = ?,
          source_event_id = ?, observed_at = ?, version = ?
        WHERE tenant_id = ? AND subject_id = ? AND membership_id = ?
          AND version = ? AND observed_at < ?`,
      args: [
        observedCurrentRole,
        observedStatus,
        stateHash,
        authoritativeIncidentId,
        alert.sourceEventId,
        alert.occurredAt,
        Number(previous.version) + 1,
        alert.tenantId,
        alert.subjectId,
        membershipId,
        Number(previous.version),
        alert.occurredAt,
      ],
    });
    if (updated.rowsAffected !== 1) throw new DomainError('CONFLICT');
  } else {
    await tx.execute({
      sql: `INSERT INTO workos_observed_memberships(
        tenant_id, subject_id, membership_id, observed_role, observed_status,
        observed_state_hash, incident_id, source_event_id, observed_at, version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      args: [
        alert.tenantId,
        alert.subjectId,
        membershipId,
        observedCurrentRole,
        observedStatus,
        stateHash,
        authoritativeIncidentId,
        alert.sourceEventId,
        alert.occurredAt,
      ],
    });
  }
  if (expectedCallback) {
    await consumeExpectedWorkosMembershipCallback(tx, {
      callback: expectedCallback,
      sourceEventId: alert.sourceEventId,
      stateHash,
      observedAt: alert.occurredAt,
    });
    await appendExpectedCallbackTimeline(tx, alert, expectedCallback);
    return duplicateFrom(expectedCallback.incidentId);
  }
  if (!hasTransition) return alert;

  // The predecessor is authoritative local state, not provider input. This
  // marker lets the later snapshot write run only after the incident exists.
  return {
    ...alert,
    ...(stagingIntent ? { actor: { id: stagingIntent.actorId, type: 'service' as const } } : {}),
    changes: {
      ...alert.changes,
      contextVersion: 2,
      previousRole,
      nextRole: observedCurrentRole,
      observedCurrentRole,
    },
  };
}

async function appendExpectedCallbackTimeline(
  tx: StoreTransaction,
  alert: Alert,
  callback: ExpectedWorkosMembershipCallback,
): Promise<void> {
  const latest = await tx.execute({
    sql: `SELECT max(occurred_at) AS occurred_at FROM timeline_events
      WHERE tenant_id = ? AND incident_id = ?`,
    args: [callback.tenantId, callback.incidentId],
  });
  const latestOccurredAt = latest.rows[0]?.occurred_at;
  const timelineOccurredAt =
    typeof latestOccurredAt === 'string' && latestOccurredAt > alert.occurredAt ? latestOccurredAt : alert.occurredAt;
  const updated = await tx.execute({
    sql: `UPDATE incidents SET timeline_sequence = timeline_sequence + 1,
      updated_at = CASE WHEN updated_at < ? THEN ? ELSE updated_at END
      WHERE tenant_id = ? AND id = ? RETURNING timeline_sequence`,
    args: [timelineOccurredAt, timelineOccurredAt, callback.tenantId, callback.incidentId],
  });
  const sequence = Number(updated.rows[0]?.timeline_sequence);
  if (!Number.isSafeInteger(sequence) || sequence < 1) throw new DomainError('CONFLICT');
  await tx.execute({
    sql: `INSERT INTO timeline_events(
      id, incident_id, tenant_id, sequence, type, category, correlation_id,
      causation_id, payload_json, schema_version, occurred_at
    ) VALUES (?, ?, ?, ?, 'provider.effect.callback_observed', 'domain', ?, ?, ?, 1, ?)`,
    args: [
      `workos_callback_${digest(`${callback.tenantId}\0${alert.sourceEventId}`)}`,
      callback.incidentId,
      callback.tenantId,
      sequence,
      callback.incidentId,
      alert.sourceEventId,
      JSON.stringify({
        provider: 'workos',
        operation: 'restore_previous_role',
        membershipId: callback.membershipId,
        previousRole: callback.expectedPreviousRole,
        restoredRole: callback.expectedRole,
        sourceEventId: alert.sourceEventId,
        result: 'expected_callback_suppressed',
      }),
      timelineOccurredAt,
    ],
  });
}

/**
 * Writes the minimum restore-authorizing snapshot after the preflight has
 * reserved a non-duplicate state and the incident row exists. No raw WorkOS
 * payload, signature or provider response is retained.
 */
export async function persistWorkosSnapshotBeforeIncident(
  tx: StoreTransaction,
  alert: Alert,
  incidentId: string,
): Promise<Alert> {
  if (alert.source !== 'workos' || alert.sessionId) return alert;
  const membershipId = alert.changes?.membershipId;
  const previousRole = alert.changes?.previousRole;
  const observedCurrentRole = alert.changes?.observedCurrentRole;
  if (
    typeof membershipId !== 'string' ||
    !isRole(previousRole) ||
    !isRole(observedCurrentRole) ||
    previousRole === observedCurrentRole
  )
    return alert;

  const snapshot = {
    membershipId,
    previousRole,
    currentRole: observedCurrentRole,
    observedCurrentRole,
  };
  const snapshotRef = `protected://workos/snapshot/${digest(alert.sourceEventId)}`;
  const integrityHash = identitySnapshotIntegrityHash({
    tenantId: alert.tenantId,
    incidentId,
    subjectId: alert.subjectId,
    sourceEventId: alert.sourceEventId,
    snapshot,
    snapshotRef,
    schemaVersion: 1,
  });
  await tx.execute({
    sql: `INSERT INTO identity_snapshots(
      id, tenant_id, incident_id, subject_id, source_event_id, snapshot_json, snapshot_ref,
      integrity_hash, schema_version, captured_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    args: [
      `snapshot_${digest(`${alert.tenantId}\0${alert.subjectId}\0${alert.sourceEventId}`)}`,
      alert.tenantId,
      incidentId,
      alert.subjectId,
      alert.sourceEventId,
      JSON.stringify(snapshot),
      snapshotRef,
      integrityHash,
      alert.occurredAt,
    ],
  });
  return alert;
}

async function reserveObservedSession(
  tx: StoreTransaction,
  alert: Alert,
  incidentId: string,
): Promise<Alert | Readonly<{ duplicateIncidentId: string }>> {
  const status = alert.changes?.sessionStatus;
  if (!alert.sessionId || !isSessionStatus(status)) throw new DomainError('VALIDATION_FAILED');
  const stateHash = observedStateHash(alert, 'session');
  const existing = await tx.execute({
    sql: `SELECT observed_state_hash, observed_at, version, incident_id
      FROM workos_observed_sessions
      WHERE tenant_id = ? AND subject_id = ? AND session_id = ?`,
    args: [alert.tenantId, alert.subjectId, alert.sessionId],
  });
  const previous = existing.rows[0];
  const duplicate = await reserveWorkosPosition(tx, {
    alert,
    objectType: 'session',
    objectId: alert.sessionId,
    stateHash,
    incidentId,
  });
  if (duplicate) return duplicate;
  if (previous && String(previous.observed_at) > alert.occurredAt) throw new DomainError('EVENT_OUT_OF_ORDER');
  if (previous) {
    const updated = await tx.execute({
      sql: `UPDATE workos_observed_sessions SET observed_status = ?, observed_state_hash = ?,
        incident_id = ?, source_event_id = ?, observed_at = ?, version = ?
        WHERE tenant_id = ? AND subject_id = ? AND session_id = ?
          AND version = ? AND observed_at < ?`,
      args: [
        status,
        stateHash,
        incidentId,
        alert.sourceEventId,
        alert.occurredAt,
        Number(previous.version) + 1,
        alert.tenantId,
        alert.subjectId,
        alert.sessionId,
        Number(previous.version),
        alert.occurredAt,
      ],
    });
    if (updated.rowsAffected !== 1) throw new DomainError('CONFLICT');
    return alert;
  }
  await tx.execute({
    sql: `INSERT INTO workos_observed_sessions(
      tenant_id, subject_id, session_id, observed_status, observed_state_hash,
      incident_id, source_event_id, observed_at, version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    args: [
      alert.tenantId,
      alert.subjectId,
      alert.sessionId,
      status,
      stateHash,
      incidentId,
      alert.sourceEventId,
      alert.occurredAt,
    ],
  });
  return alert;
}

function duplicateFrom(value: unknown): Readonly<{ duplicateIncidentId: string }> {
  if (typeof value !== 'string' || !value) throw new DomainError('CONFLICT');
  return { duplicateIncidentId: value };
}

async function reserveWorkosPosition(
  tx: StoreTransaction,
  input: Readonly<{
    alert: Alert;
    objectType: 'membership' | 'session';
    objectId: string;
    stateHash: string;
    incidentId: string;
  }>,
): Promise<Readonly<{ duplicateIncidentId: string }> | undefined> {
  const existing = await tx.execute({
    sql: `SELECT state_hash, incident_id FROM workos_observed_positions
      WHERE tenant_id = ? AND subject_id = ? AND object_type = ? AND object_id = ?
        AND observed_at = ?`,
    args: [input.alert.tenantId, input.alert.subjectId, input.objectType, input.objectId, input.alert.occurredAt],
  });
  const position = existing.rows[0];
  if (position) {
    if (String(position.state_hash) !== input.stateHash) throw new DomainError('CONFLICT');
    return duplicateFrom(position.incident_id);
  }
  const inserted = await tx.execute({
    sql: `INSERT INTO workos_observed_positions(
      tenant_id, subject_id, object_type, object_id, observed_at, state_hash, incident_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
    args: [
      input.alert.tenantId,
      input.alert.subjectId,
      input.objectType,
      input.objectId,
      input.alert.occurredAt,
      input.stateHash,
      input.incidentId,
    ],
  });
  if (inserted.rowsAffected === 1) return undefined;
  const raced = await tx.execute({
    sql: `SELECT state_hash, incident_id FROM workos_observed_positions
      WHERE tenant_id = ? AND subject_id = ? AND object_type = ? AND object_id = ?
        AND observed_at = ?`,
    args: [input.alert.tenantId, input.alert.subjectId, input.objectType, input.objectId, input.alert.occurredAt],
  });
  const resolved = raced.rows[0];
  if (!resolved || String(resolved.state_hash) !== input.stateHash) throw new DomainError('CONFLICT');
  return duplicateFrom(resolved.incident_id);
}

function observedStateHash(alert: Alert, kind: 'membership' | 'session'): string {
  const eventType = workosEventType(alert, kind);
  const common = {
    schemaVersion: 1,
    source: alert.source,
    // `alert.kind` is an incident classification. Keep the closed WorkOS
    // lifecycle discriminator separately so session.created and
    // session.revoked cannot converge at one object/timestamp position.
    eventType,
    kind: alert.kind,
    tenantId: alert.tenantId,
    subjectId: alert.subjectId,
    target: { id: alert.target.id, type: alert.target.type },
  };
  const canonicalState =
    kind === 'membership'
      ? {
          ...common,
          object: {
            type: 'membership',
            id: alert.changes?.membershipId,
            role: alert.changes?.observedCurrentRole,
            status: alert.changes?.observedStatus ?? 'active',
          },
        }
      : {
          ...common,
          object: {
            type: 'session',
            id: alert.sessionId,
            status: alert.changes?.sessionStatus,
            ip: alert.ip ?? null,
            deviceId: alert.deviceId ?? null,
          },
        };
  // No delivery ID, raw reference or raw bytes participates in equality. The
  // canonical material is immediately hashed and never persisted itself.
  return digest(canonicalJson(canonicalState));
}

function workosEventType(
  alert: Alert,
  objectType: 'membership' | 'session',
): 'organization_membership.updated' | 'session.created' | 'session.revoked' {
  const value = alert.changes?.workosEventType;
  if (objectType === 'membership') {
    if (value === 'organization_membership.updated') return value;
  } else if (value === 'session.created' || value === 'session.revoked') {
    return value;
  }
  // This preflight is a provider trust boundary. Only the real normalizer may
  // attach a lifecycle discriminator, and no untyped value may silently
  // share a canonical ordering position with an official event.
  throw new DomainError('VALIDATION_FAILED');
}

function digest(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function isRole(value: unknown): value is 'admin' | 'member' | 'viewer' {
  return value === 'admin' || value === 'member' || value === 'viewer';
}

function isMembershipStatus(value: unknown): value is 'active' | 'inactive' | 'pending' {
  return value === 'active' || value === 'inactive' || value === 'pending';
}

function isSessionStatus(value: unknown): value is 'active' | 'revoked' | 'expired' {
  return value === 'active' || value === 'revoked' || value === 'expired';
}
