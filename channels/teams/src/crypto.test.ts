import { describe, expect, it } from 'vitest';
import { InMemoryChannelsStorage } from '@mastra/core/storage';
import { decrypt, encrypt, isEncrypted } from './crypto';
import { TeamsInstallStore } from './index';
import type { TeamsInstallation } from './index';

const KEY = 'a-32+char-passphrase-for-testing-only';

const install: TeamsInstallation = {
  id: 'inst-1',
  agentId: 'agent-1',
  webhookId: 'wh-1',
  status: 'active',
  appId: 'app-guid-1',
  entraObjectId: 'obj-1',
  appPassword: 'client-secret-xyz',
  appType: 'MultiTenant',
  botName: 'My Bot',
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

describe('TeamsInstallStore encryption at rest', () => {
  it('encrypts appPassword in storage but returns plaintext on read', async () => {
    const storage = new InMemoryChannelsStorage();
    const store = new TeamsInstallStore(storage, KEY);
    await store.save(install);

    // Raw record: the client secret is ciphertext, non-secrets are plaintext.
    const record = await storage.getInstallationByAgent('teams', 'agent-1');
    expect(isEncrypted(String(record?.data.appPassword))).toBe(true);
    expect(String(record?.data.appPassword)).not.toContain('client-secret-xyz');
    expect(record?.data.appId).toBe('app-guid-1');
    expect(record?.data.botName).toBe('My Bot');

    // Reads decrypt transparently.
    const read = await store.getByAgent('agent-1');
    expect(read?.appPassword).toBe('client-secret-xyz');
  });

  it('stores plaintext when no key is configured', async () => {
    const storage = new InMemoryChannelsStorage();
    await new TeamsInstallStore(storage).save(install);
    const record = await storage.getInstallationByAgent('teams', 'agent-1');
    expect(record?.data.appPassword).toBe('client-secret-xyz');
  });

  it('refuses to read encrypted secrets without a key', async () => {
    const storage = new InMemoryChannelsStorage();
    await new TeamsInstallStore(storage, KEY).save(install);
    await expect(new TeamsInstallStore(storage).getByAgent('agent-1')).rejects.toThrow(/encrypted at rest/);
  });
});
