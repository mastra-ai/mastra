import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { ControlPlaneError } from './contracts.js';

const envelopeSchema = z
  .object({
    version: z.literal(1),
    keyId: z.string().regex(/^[a-f0-9]{16}$/),
    nonce: z.string().regex(/^[a-f0-9]{24}$/),
    tag: z.string().regex(/^[a-f0-9]{32}$/),
    ciphertext: z
      .string()
      .min(2)
      .max(32768)
      .regex(/^(?:[a-f0-9]{2})+$/),
  })
  .strict();
export type CredentialBinding = { targetId: string; profileId: string; role: string; credentialRevision: number };
const associatedData = (binding: CredentialBinding) =>
  Buffer.from(
    JSON.stringify([
      'security-scanner-credential-v1',
      binding.targetId,
      binding.profileId,
      binding.role,
      binding.credentialRevision,
    ]),
  );
export class CredentialVault {
  private readonly key?: Buffer;
  constructor(key?: string) {
    this.key = key ? Buffer.from(key, 'hex') : undefined;
  }
  seal(value: unknown, binding: CredentialBinding) {
    if (!this.key || this.key.length !== 32) throw new ControlPlaneError('CREDENTIAL_KEY_REQUIRED', 503);
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, nonce);
    cipher.setAAD(associatedData(binding));
    const plaintext = Buffer.from(JSON.stringify(value));
    try {
      const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
      return JSON.stringify({
        version: 1,
        keyId: this.keyId(),
        nonce: nonce.toString('hex'),
        tag: cipher.getAuthTag().toString('hex'),
        ciphertext: ciphertext.toString('hex'),
      });
    } finally {
      plaintext.fill(0);
    }
  }
  open(envelope: string, binding: CredentialBinding): unknown {
    try {
      if (!this.key || this.key.length !== 32) throw new Error();
      const data = envelopeSchema.parse(JSON.parse(envelope));
      if (data.keyId !== this.keyId()) throw new Error();
      const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(data.nonce, 'hex'));
      decipher.setAAD(associatedData(binding));
      decipher.setAuthTag(Buffer.from(data.tag, 'hex'));
      const plaintext = Buffer.concat([decipher.update(Buffer.from(data.ciphertext, 'hex')), decipher.final()]);
      try {
        return JSON.parse(plaintext.toString('utf8'));
      } finally {
        plaintext.fill(0);
      }
    } catch {
      throw new ControlPlaneError('CREDENTIAL_UNAVAILABLE', 503);
    }
  }
  private keyId() {
    return createHash('sha256').update(this.key!).digest('hex').slice(0, 16);
  }
}
