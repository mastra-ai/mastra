import { createHash, createPublicKey, generateKeyPairSync, sign, verify } from 'node:crypto';

import { z } from 'zod';

import { canonicalJson } from '../evidence/canonicalize.js';
import { opaqueId, tenantIdSchema, utcTimestamp } from '../schemas/common.js';

const base64Url = z.string().regex(/^[A-Za-z0-9_-]+$/u);

export const DeviceAttestationPayloadSchema = z
  .object({
    schemaVersion: z.literal(1),
    attestationId: opaqueId,
    source: z.string().trim().min(1).max(64),
    sourceEventId: opaqueId,
    tenantId: tenantIdSchema,
    subjectId: opaqueId,
    sessionId: opaqueId,
    deviceId: opaqueId,
    issuedAt: utcTimestamp,
    expiresAt: utcTimestamp,
  })
  .strict()
  .refine(value => value.expiresAt > value.issuedAt, {
    message: 'Device attestation must expire after it is issued.',
  });

export type DeviceAttestationPayload = z.infer<typeof DeviceAttestationPayloadSchema>;

export const DeviceAttestationProofSchema = z
  .object({
    payload: DeviceAttestationPayloadSchema,
    publicKeySpki: base64Url.max(256),
    signature: base64Url.max(256),
  })
  .strict();

export type DeviceAttestationProof = z.infer<typeof DeviceAttestationProofSchema>;

export function createEphemeralDeviceAttestation(
  payload: Omit<DeviceAttestationPayload, 'deviceId'>,
): DeviceAttestationProof {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const publicKeySpki = publicKey.export({ type: 'spki', format: 'der' }).toString('base64url');
  const parsedPayload = DeviceAttestationPayloadSchema.parse({
    ...payload,
    deviceId: deviceIdFromPublicKey(publicKeySpki),
  });
  const signature = sign(null, Buffer.from(canonicalJson(parsedPayload), 'utf8'), privateKey).toString('base64url');
  return DeviceAttestationProofSchema.parse({
    payload: parsedPayload,
    publicKeySpki,
    signature,
  });
}

export function verifyDeviceAttestation(untrustedProof: unknown): DeviceAttestationProof | null {
  const parsed = DeviceAttestationProofSchema.safeParse(untrustedProof);
  if (!parsed.success) return null;
  try {
    const publicKeyBytes = Buffer.from(parsed.data.publicKeySpki, 'base64url');
    const signatureBytes = Buffer.from(parsed.data.signature, 'base64url');
    if (publicKeyBytes.toString('base64url') !== parsed.data.publicKeySpki) return null;
    if (signatureBytes.toString('base64url') !== parsed.data.signature) return null;
    const publicKey = createPublicKey({
      key: publicKeyBytes,
      format: 'der',
      type: 'spki',
    });
    if (publicKey.asymmetricKeyType !== 'ed25519') return null;
    if (deviceIdFromPublicKey(parsed.data.publicKeySpki) !== parsed.data.payload.deviceId) return null;
    return verify(null, Buffer.from(canonicalJson(parsed.data.payload), 'utf8'), publicKey, signatureBytes)
      ? parsed.data
      : null;
  } catch {
    return null;
  }
}

export function deviceIdFromPublicKey(publicKeySpki: string): string {
  // Parsing rejects arbitrary bytes before they can acquire a trusted ID.
  const key = createPublicKey({
    key: Buffer.from(publicKeySpki, 'base64url'),
    format: 'der',
    type: 'spki',
  });
  if (key.asymmetricKeyType !== 'ed25519') throw new Error('Device keys must use Ed25519.');
  const canonicalSpki = key.export({ type: 'spki', format: 'der' });
  return `device_${createHash('sha256').update(canonicalSpki).digest('hex')}`;
}
