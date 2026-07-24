import { describe, expect, it } from 'vitest';
import { InMemoryChannelsStorage } from '@mastra/core/storage';
import { decrypt, encrypt, isEncrypted } from './crypto';
import { TelegramInstallStore } from './index';
import type { TelegramInstallation } from './index';

const KEY = 'a-32+char-passphrase-for-testing-only';

const install: TelegramInstallation = {
  id: 'inst-1',
  agentId: 'agent-1',
  webhookId: 'wh-1',
  status: 'active',
  botToken: '123:SECRET-TOKEN',
  secretToken: 'webhook-secret',
  username: 'my_bot',
  installedAt: new Date('2026-07-05T00:00:00Z'),
};

describe('crypto', () => {
  it('round-trips a value', () => {
    const cipher = encrypt('hello', KEY);
    expect(cipher).not.toBe('hello');
    expect(isEncrypted(cipher)).toBe(true);
    expect(decrypt(cipher, KEY)).toBe('hello');
  });

  it('produces a fresh IV each call', () => {
    expect(encrypt('x', KEY)).not.toBe(encrypt('x', KEY));
  });

  it('decrypt is a no-op on plaintext', () => {
    expect(isEncrypted('plain')).toBe(false);
    expect(decrypt('plain', KEY)).toBe('plain');
  });

  it('the wrong key fails to decrypt', () => {
    expect(() => decrypt(encrypt('secret', KEY), 'different-key')).toThrow();
  });
});

describe('TelegramInstallStore encryption at rest', () => {
  it('encrypts botToken/secretToken in storage but returns plaintext on read', async () => {
    const storage = new InMemoryChannelsStorage();
    const store = new TelegramInstallStore(storage, KEY);
    await store.save(install);

    // Raw record: secrets are ciphertext, non-secrets are plaintext.
    const record = await storage.getInstallationByAgent('telegram', 'agent-1');
    expect(isEncrypted(String(record?.data.botToken))).toBe(true);
    expect(isEncrypted(String(record?.data.secretToken))).toBe(true);
    expect(String(record?.data.botToken)).not.toContain('123:SECRET-TOKEN');
    expect(record?.data.username).toBe('my_bot');

    // Reads decrypt transparently.
    const read = await store.getByAgent('agent-1');
    expect(read?.botToken).toBe('123:SECRET-TOKEN');
    expect(read?.secretToken).toBe('webhook-secret');
  });

  it('stores plaintext when no key is configured', async () => {
    const storage = new InMemoryChannelsStorage();
    await new TelegramInstallStore(storage).save(install);
    const record = await storage.getInstallationByAgent('telegram', 'agent-1');
    expect(record?.data.botToken).toBe('123:SECRET-TOKEN');
  });
});
