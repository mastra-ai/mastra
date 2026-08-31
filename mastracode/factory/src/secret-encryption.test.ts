import { describe, expect, it } from 'vitest';
import { createFactorySecretEncryption, createPlaintextFactorySecretEncryption } from './secret-encryption.js';

const key = (fill: number) => new Uint8Array(32).fill(fill);

describe('createFactorySecretEncryption', () => {
  it('round-trips JSON values with randomized ciphertext', async () => {
    const encryption = createFactorySecretEncryption({ primary: { id: 'current', key: key(1) } });
    const value = { apiKey: 'top-secret', nested: ['value'] };

    const first = await encryption.encrypt(value);
    const second = await encryption.encrypt(value);

    expect(first).not.toBe(second);
    expect(first).not.toContain('top-secret');
    await expect(encryption.decrypt(first)).resolves.toEqual({ value, needsReencryption: false });
  });

  it('treats values without the envelope marker as legacy plaintext', async () => {
    const encryption = createFactorySecretEncryption({ primary: { id: 'current', key: key(1) } });
    const legacy = { type: 'api-key', key: 'legacy' };

    await expect(encryption.decrypt(legacy)).resolves.toEqual({ value: legacy, needsReencryption: true });
  });

  it('decrypts previous keys and marks them for rotation', async () => {
    const oldEncryption = createFactorySecretEncryption({ primary: { id: 'old', key: key(1) } });
    const encryption = createFactorySecretEncryption({
      primary: { id: 'current', key: key(2) },
      previous: [{ id: 'old', key: key(1) }],
    });
    const encrypted = await oldEncryption.encrypt('secret');

    await expect(encryption.decrypt(encrypted)).resolves.toEqual({ value: 'secret', needsReencryption: true });
  });

  it('fails closed for malformed, unknown-key, and tampered envelopes', async () => {
    const encryption = createFactorySecretEncryption({ primary: { id: 'current', key: key(1) } });
    const encrypted = await encryption.encrypt('secret');
    const prefix = 'mastra:factory-secret:v1:';
    const envelope = JSON.parse(Buffer.from(encrypted.slice(prefix.length), 'base64url').toString('utf8'));

    await expect(encryption.decrypt(`${prefix}not-json`)).rejects.toThrow('Invalid encrypted value');

    const unknownKey = { ...envelope, keyId: 'missing' };
    await expect(
      encryption.decrypt(`${prefix}${Buffer.from(JSON.stringify(unknownKey)).toString('base64url')}`),
    ).rejects.toThrow('Unknown key id');

    const tampered = { ...envelope, ciphertext: `${envelope.ciphertext}A` };
    await expect(
      encryption.decrypt(`${prefix}${Buffer.from(JSON.stringify(tampered)).toString('base64url')}`),
    ).rejects.toThrow('Unable to decrypt');
  });

  it('validates key length and unique ids', () => {
    expect(() => createFactorySecretEncryption({ primary: { id: 'short', key: key(1).slice(1) } })).toThrow(
      'exactly 32 bytes',
    );
    expect(() =>
      createFactorySecretEncryption({
        primary: { id: 'same', key: key(1) },
        previous: [{ id: 'same', key: key(2) }],
      }),
    ).toThrow('Duplicate key id');
  });
});

describe('createPlaintextFactorySecretEncryption', () => {
  it('provides explicit local-only JSON compatibility', async () => {
    const encryption = createPlaintextFactorySecretEncryption();
    const encrypted = await encryption.encrypt({ apiKey: 'local' });

    expect(encrypted).toBe('{"apiKey":"local"}');
    await expect(encryption.decrypt(encrypted)).resolves.toEqual({
      value: { apiKey: 'local' },
      needsReencryption: false,
    });
  });

  it('treats pre-encryption raw secret strings as legacy values needing rewrite', async () => {
    const encryption = createPlaintextFactorySecretEncryption();

    // Pre-encryption rows stored bare secrets (e.g. `custom_providers.api_key`),
    // which are not valid JSON. They must round-trip instead of failing boot.
    await expect(encryption.decrypt('sk-ant-api03-abc123')).resolves.toEqual({
      value: 'sk-ant-api03-abc123',
      needsReencryption: true,
    });

    // And the migration rewrite converges: encrypt → decrypt is stable JSON.
    const migrated = await encryption.encrypt('sk-ant-api03-abc123');
    await expect(encryption.decrypt(migrated)).resolves.toEqual({
      value: 'sk-ant-api03-abc123',
      needsReencryption: false,
    });
  });

  it('passes through legacy non-string values untouched', async () => {
    const encryption = createPlaintextFactorySecretEncryption();
    const legacy = { type: 'api-key', key: 'legacy' };

    await expect(encryption.decrypt(legacy)).resolves.toEqual({ value: legacy, needsReencryption: false });
  });
});
