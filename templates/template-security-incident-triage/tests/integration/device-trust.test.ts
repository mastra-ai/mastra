import { afterEach, describe, expect, it } from 'vitest';

import { createEphemeralDeviceAttestation } from '../../src/device-trust/attestation.js';
import {
  decideDeviceAuthorization,
  readDeviceTrustForIncident,
  recordDeviceAttestation,
} from '../../src/db/device-trust-operations.js';
import { createIncidentFromAlertResult } from '../../src/db/incident-operations.js';
import { migrateOperationalStore } from '../../src/db/migrate.js';
import { AlertSchema } from '../../src/schemas/alert.js';
import { FirstPartyDeviceTrustEvidenceProvider } from '../../src/providers/endpoint-evidence-provider.js';
import { createTempDatabase, type TempDatabase } from '../helpers/temp-libsql.js';

const databases: TempDatabase[] = [];

afterEach(async () => {
  await Promise.all(databases.splice(0).map(database => database.cleanup()));
});

describe('first-party device trust', () => {
  it('keeps incident-time evidence immutable while a manager authorizes and revokes the device', async () => {
    const database = await createTempDatabase();
    databases.push(database);
    const store = database.createStore();
    await migrateOperationalStore(store);
    const occurredAt = '2026-09-03T18:00:00.000Z';
    const proof = createEphemeralDeviceAttestation({
      schemaVersion: 1,
      attestationId: 'attestation_test',
      source: 'first-party-device-trust',
      sourceEventId: 'event_test',
      tenantId: 'tenant_test',
      subjectId: 'user_test',
      sessionId: 'session_test',
      issuedAt: occurredAt,
      expiresAt: '2026-09-03T18:05:00.000Z',
    });
    await recordDeviceAttestation(store, proof);
    const alert = AlertSchema.parse({
      schemaVersion: 1,
      alertId: 'alert_test',
      source: proof.payload.source,
      sourceEventId: proof.payload.sourceEventId,
      kind: 'unknown_device_login',
      occurredAt,
      tenantId: proof.payload.tenantId,
      subjectId: proof.payload.subjectId,
      sessionId: proof.payload.sessionId,
      deviceId: proof.payload.deviceId,
      actor: { id: 'user_test', type: 'user' },
      target: { id: proof.payload.deviceId, type: 'device' },
      changes: { attestationId: proof.payload.attestationId },
      rawPayloadRef: `sha256:${'a'.repeat(64)}`,
      idempotencyKey: 'device_test',
    });
    const created = await createIncidentFromAlertResult(store, alert, {
      clock: { now: () => occurredAt },
      scheduleWorkflow: false,
    });

    await expect(
      readDeviceTrustForIncident(store, {
        tenantId: 'tenant_test',
        incidentId: created.incident.incidentId,
      }),
    ).resolves.toMatchObject({
      signatureValid: true,
      authorizedAtIncident: false,
      currentlyAuthorized: false,
    });
    const provider = new FirstPartyDeviceTrustEvidenceProvider(database.createStore);
    const evidence = await provider.inspect(
      {
        tenantId: 'tenant_test',
        incidentId: created.incident.incidentId,
        subjectId: 'user_test',
        workflowRunId: 'workflow_test',
        incidentKind: 'unknown_device_login',
        occurredAt,
        sessionId: 'session_test',
        deviceId: proof.payload.deviceId,
      },
      { signal: new AbortController().signal, attempt: 1 },
    );
    expect(evidence).toMatchObject({
      status: 'success',
      provider: 'first-party-device-trust',
      facts: expect.arrayContaining([
        expect.objectContaining({
          factType: 'device.signatureValid',
          value: true,
        }),
        expect.objectContaining({
          factType: 'device.authorized',
          value: false,
        }),
      ]),
    });

    await decideDeviceAuthorization(store, {
      tenantId: 'tenant_test',
      incidentId: created.incident.incidentId,
      actorId: 'manager_test',
      actorRole: 'soc_manager',
      action: 'authorize',
      reason: 'Corporate device verified by the SOC.',
      occurredAt: '2026-09-03T18:01:00.000Z',
    });
    await expect(
      readDeviceTrustForIncident(store, {
        tenantId: 'tenant_test',
        incidentId: created.incident.incidentId,
      }),
    ).resolves.toMatchObject({
      authorizedAtIncident: false,
      currentlyAuthorized: true,
    });

    await decideDeviceAuthorization(store, {
      tenantId: 'tenant_test',
      incidentId: created.incident.incidentId,
      actorId: 'manager_test',
      actorRole: 'soc_manager',
      action: 'revoke',
      reason: 'Device retired.',
      occurredAt: '2026-09-03T18:02:00.000Z',
    });
    const audit = await store.execute({
      sql: 'SELECT action FROM device_authorization_audit ORDER BY occurred_at',
    });
    expect(audit.rows).toEqual([{ action: 'authorized' }, { action: 'revoked' }]);
    store.close();
  });
});
