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

  it('decodes values written by the plaintext encryptor and marks them for encryption', async () => {
    const plaintext = createPlaintextFactorySecretEncryption();
    const encryption = createFactorySecretEncryption({ primary: { id: 'current', key: key(1) } });

    for (const value of [{ type: 'api_key', key: 'sk-fake' }, 'sk-custom-key']) {
      const decrypted = await encryption.decrypt(await plaintext.encrypt(value));
      expect(decrypted).toEqual({ value, needsReencryption: true });

      const migrated = await encryption.encrypt(decrypted.value);
      await expect(encryption.decrypt(migrated)).resolves.toEqual({ value, needsReencryption: false });
    }
  });

  it('keeps raw pre-encryption secret strings unchanged', async () => {
    const encryption = createFactorySecretEncryption({ primary: { id: 'current', key: key(1) } });

    await expect(encryption.decrypt('sk-ant-raw-legacy')).resolves.toEqual({
      value: 'sk-ant-raw-legacy',
      needsReencryption: true,
    });
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

  it('refuses encrypted envelopes instead of returning them as the secret', async () => {
    const keyed = createFactorySecretEncryption({ primary: { id: 'v1', key: key(1) } });
    const envelope = await keyed.encrypt({ type: 'oauth', access: 'at' });

    await expect(createPlaintextFactorySecretEncryption().decrypt(envelope)).rejects.toThrow(
      /no secret encryption key configured/,
    );
  });
});

describe('createFactorySecretEncryption nested envelopes', () => {
  it('unwraps envelopes stored as JSON text or re-encrypted inside another envelope', async () => {
    const encryption = createFactorySecretEncryption({ primary: { id: 'v1', key: key(1) } });
    const value = { type: 'oauth', access: 'at' };
    const envelope = await encryption.encrypt(value);

    await expect(encryption.decrypt(JSON.stringify(envelope))).resolves.toEqual({ value, needsReencryption: true });
    await expect(encryption.decrypt(await encryption.encrypt(envelope))).resolves.toEqual({
      value,
      needsReencryption: true,
    });
  });

  it('keeps secrets that only look like envelopes as literal values', async () => {
    const encryption = createFactorySecretEncryption({ primary: { id: 'v1', key: key(1) } });
    const other = createFactorySecretEncryption({ primary: { id: 'other', key: key(2) } });
    for (const lookalike of ['mastra:factory-secret:v1:not-a-real-envelope', await other.encrypt('foreign')]) {
      await expect(encryption.decrypt(await encryption.encrypt(lookalike))).resolves.toEqual({
        value: lookalike,
        needsReencryption: false,
      });
    }
  });

  it('stops unwrapping after a bounded number of nested envelopes', async () => {
    const encryption = createFactorySecretEncryption({ primary: { id: 'v1', key: key(1) } });
    let value: unknown = 'secret';
    for (let i = 0; i < 10; i++) value = await encryption.encrypt(value);

    const { value: result } = await encryption.decrypt<string>(value);
    expect(result).toMatch(/^mastra:factory-secret:v1:/);
  });
});
