import { describe, expect, it } from 'vitest';

import { createEphemeralDeviceAttestation, verifyDeviceAttestation } from '../../src/device-trust/attestation.js';

const payload = {
  schemaVersion: 1 as const,
  attestationId: 'attestation_test',
  source: 'first-party-device-trust',
  sourceEventId: 'event_test',
  tenantId: 'tenant_test',
  subjectId: 'user_test',
  sessionId: 'session_test',
  issuedAt: '2026-09-03T18:00:00.000Z',
  expiresAt: '2026-09-03T18:05:00.000Z',
};

describe('device attestation', () => {
  it('creates a self-consistent Ed25519 proof', () => {
    const proof = createEphemeralDeviceAttestation(payload);
    expect(verifyDeviceAttestation(proof)).toEqual(proof);
    expect(proof.payload.deviceId).toMatch(/^device_[a-f0-9]{64}$/u);
  });

  it('rejects a proof whose signed scope was changed', () => {
    const proof = createEphemeralDeviceAttestation(payload);
    expect(
      verifyDeviceAttestation({
        ...proof,
        payload: { ...proof.payload, sessionId: 'session_other' },
      }),
    ).toBeNull();
  });
});
