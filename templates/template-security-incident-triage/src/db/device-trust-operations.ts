import { randomUUID } from 'node:crypto';

import { DomainError } from '../domain/errors.js';
import { canonicalJson } from '../evidence/canonicalize.js';
import { AlertSchema, type Alert } from '../schemas/alert.js';
import {
  DeviceAttestationProofSchema,
  verifyDeviceAttestation,
  type DeviceAttestationProof,
} from '../device-trust/attestation.js';
import type { OperationalStore, StoreTransaction } from './operational-store.js';

type QueryStore = Pick<OperationalStore, 'execute'> | StoreTransaction;

export type DeviceTrustState = Readonly<{
  attestation: DeviceAttestationProof;
  alert: Alert;
  signatureValid: boolean;
  authorizedAtIncident: boolean;
  currentlyAuthorized: boolean;
}>;

export async function recordDeviceAttestation(
  store: OperationalStore,
  untrustedProof: unknown,
): Promise<DeviceAttestationProof> {
  const proof = verifyDeviceAttestation(untrustedProof);
  if (!proof) throw new DomainError('VALIDATION_FAILED');
  const { payload } = proof;
  await store.execute({
    sql: `INSERT INTO device_attestations(
        id, tenant_id, subject_id, session_id, device_id, source,
        source_event_id, public_key_spki, payload_json, signature,
        issued_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      payload.attestationId,
      payload.tenantId,
      payload.subjectId,
      payload.sessionId,
      payload.deviceId,
      payload.source,
      payload.sourceEventId,
      proof.publicKeySpki,
      canonicalJson(payload),
      proof.signature,
      payload.issuedAt,
      payload.expiresAt,
    ],
  });
  return proof;
}

export async function readDeviceTrustForIncident(
  store: QueryStore,
  input: Readonly<{ tenantId: string; incidentId: string }>,
): Promise<DeviceTrustState | null> {
  const result = await store.execute({
    sql: `SELECT a.canonical_json, d.payload_json, d.public_key_spki, d.signature
      FROM alerts a
      JOIN device_attestations d
        ON d.source = a.source AND d.source_event_id = a.source_event_id
      WHERE a.tenant_id = ? AND a.incident_id = ?
        AND a.kind = 'unknown_device_login'
      LIMIT 1`,
    args: [input.tenantId, input.incidentId],
  });
  const row = result.rows[0];
  if (!row) return null;
  try {
    const alert = AlertSchema.parse(JSON.parse(String(row.canonical_json)));
    const proof = DeviceAttestationProofSchema.parse({
      payload: JSON.parse(String(row.payload_json)),
      publicKeySpki: String(row.public_key_spki),
      signature: String(row.signature),
    });
    const verified = verifyDeviceAttestation(proof);
    const scoped = Boolean(
      verified &&
      alert.source === verified.payload.source &&
      alert.sourceEventId === verified.payload.sourceEventId &&
      alert.tenantId === verified.payload.tenantId &&
      alert.subjectId === verified.payload.subjectId &&
      alert.sessionId === verified.payload.sessionId &&
      alert.deviceId === verified.payload.deviceId &&
      alert.occurredAt === verified.payload.issuedAt &&
      alert.occurredAt < verified.payload.expiresAt,
    );
    const authorization = await store.execute({
      sql: `SELECT authorized_at, revoked_at, metadata_json
        FROM authorized_devices
        WHERE tenant_id = ? AND subject_id = ? AND device_id = ?
        LIMIT 1`,
      args: [alert.tenantId, alert.subjectId, proof.payload.deviceId],
    });
    const authorizationRow = authorization.rows[0];
    let keyMatches = false;
    if (authorizationRow?.metadata_json) {
      const metadata: unknown = JSON.parse(String(authorizationRow.metadata_json));
      keyMatches =
        Boolean(metadata && typeof metadata === 'object') &&
        (metadata as Record<string, unknown>).publicKeySpki === proof.publicKeySpki;
    }
    const authorizedAt = authorizationRow?.authorized_at;
    const revokedAt = authorizationRow?.revoked_at;
    return {
      attestation: proof,
      alert,
      signatureValid: scoped,
      authorizedAtIncident:
        scoped &&
        keyMatches &&
        typeof authorizedAt === 'string' &&
        authorizedAt <= alert.occurredAt &&
        (revokedAt === null || (typeof revokedAt === 'string' && revokedAt > alert.occurredAt)),
      currentlyAuthorized: scoped && keyMatches && revokedAt === null,
    };
  } catch {
    return null;
  }
}

export async function decideDeviceAuthorization(
  store: OperationalStore,
  input: Readonly<{
    tenantId: string;
    incidentId: string;
    actorId: string;
    actorRole: 'soc_manager';
    action: 'authorize' | 'revoke';
    reason: string;
    occurredAt?: string;
  }>,
): Promise<Readonly<{ deviceId: string; authorized: boolean }>> {
  const reason = input.reason.trim();
  if (!reason || reason.length > 2_000) throw new DomainError('VALIDATION_FAILED');
  return store.transaction(async tx => {
    const state = await readDeviceTrustForIncident(tx, input);
    if (!state?.signatureValid) throw new DomainError('CONFLICT');
    if (
      (input.action === 'authorize' && state.currentlyAuthorized) ||
      (input.action === 'revoke' && !state.currentlyAuthorized)
    )
      throw new DomainError('CONFLICT');
    const occurredAt = input.occurredAt ?? new Date().toISOString();
    const { payload, publicKeySpki } = state.attestation;
    if (input.action === 'authorize') {
      await tx.execute({
        sql: `INSERT INTO authorized_devices(
            id, tenant_id, subject_id, device_id, authorized_at, revoked_at, metadata_json
          ) VALUES (?, ?, ?, ?, ?, NULL, ?)
          ON CONFLICT(tenant_id, subject_id, device_id) DO UPDATE SET
            authorized_at = excluded.authorized_at,
            revoked_at = NULL,
            metadata_json = excluded.metadata_json`,
        args: [
          `authorized_device_${randomUUID()}`,
          input.tenantId,
          payload.subjectId,
          payload.deviceId,
          occurredAt,
          canonicalJson({
            algorithm: 'Ed25519',
            publicKeySpki,
            authorizedBy: input.actorId,
            attestationId: payload.attestationId,
          }),
        ],
      });
    } else {
      const revoked = await tx.execute({
        sql: `UPDATE authorized_devices SET revoked_at = ?
          WHERE tenant_id = ? AND subject_id = ? AND device_id = ?
            AND revoked_at IS NULL`,
        args: [occurredAt, input.tenantId, payload.subjectId, payload.deviceId],
      });
      if (revoked.rowsAffected !== 1) throw new DomainError('CONFLICT');
    }
    await tx.execute({
      sql: `INSERT INTO device_authorization_audit(
        id, tenant_id, subject_id, device_id, attestation_id, action,
        decided_by, decided_by_role, reason, occurred_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        `device_auth_audit_${randomUUID()}`,
        input.tenantId,
        payload.subjectId,
        payload.deviceId,
        payload.attestationId,
        input.action === 'authorize' ? 'authorized' : 'revoked',
        input.actorId,
        input.actorRole,
        reason,
        occurredAt,
      ],
    });
    return {
      deviceId: payload.deviceId,
      authorized: input.action === 'authorize',
    };
  });
}
