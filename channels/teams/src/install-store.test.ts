import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryChannelsStorage } from '@mastra/core/storage';
import { TeamsInstallStore } from './install-store';
import type { TeamsInstallation } from './types';

const KEY_A = 'original-encryption-key';
const KEY_B = 'rotated-encryption-key';

const INSTALLATION: TeamsInstallation = {
  id: 'install-1',
  agentId: 'agent-1',
  webhookId: 'webhook-1',
  status: 'active',
  appId: 'app-id',
  entraObjectId: 'entra-object-id',
  appPassword: 'super-secret',
  appTenantId: 'tenant-id',
  appType: 'SingleTenant',
  botName: 'My Bot',
  messagingEndpoint: 'https://example.com/teams/events/webhook-1',
  installedAt: new Date('2026-01-01T00:00:00Z'),
};

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Persist an installation encrypted under {@link KEY_A}. */
async function seedStorage(): Promise<InMemoryChannelsStorage> {
  const storage = new InMemoryChannelsStorage();
  await new TeamsInstallStore(storage, KEY_A).save(INSTALLATION);
  return storage;
}

describe('TeamsInstallStore with an undecryptable record', () => {
  it('round-trips the secret under the original key', async () => {
    const storage = await seedStorage();
    const install = await new TeamsInstallStore(storage, KEY_A).getByAgent('agent-1');
    expect(install?.appPassword).toBe('super-secret');
    expect(install?.secretUnreadable).toBeUndefined();
  });

  it('list() does not throw when the encryption key changed; the record is marked unreadable', async () => {
    const storage = await seedStorage();
    const store = new TeamsInstallStore(storage, KEY_B);

    const installations = await store.list();

    expect(installations).toHaveLength(1);
    expect(installations[0]!.secretUnreadable).toBe(true);
    expect(installations[0]!.appPassword).toBeUndefined();
    // Non-secret fields survive so disconnect can still clean up.
    expect(installations[0]!.entraObjectId).toBe('entra-object-id');
    expect(installations[0]!.appId).toBe('app-id');
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Cannot decrypt the stored bot secret'));
  });

  it('warns once per record, not once per read', async () => {
    const storage = await seedStorage();
    const store = new TeamsInstallStore(storage, KEY_B);

    await store.list();
    await store.getByAgent('agent-1');
    await store.getByWebhookId('webhook-1');

    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('marks the record unreadable when no key is configured at all', async () => {
    const storage = await seedStorage();
    const store = new TeamsInstallStore(storage, undefined);

    const install = await store.getByAgent('agent-1');

    expect(install?.secretUnreadable).toBe(true);
    expect(install?.appPassword).toBeUndefined();
  });

  it('deleteByAgent removes the record even though its secret is unreadable', async () => {
    const storage = await seedStorage();
    const store = new TeamsInstallStore(storage, KEY_B);

    await store.deleteByAgent('agent-1');

    expect(await storage.getInstallationByAgent('teams', 'agent-1')).toBeNull();
  });
});
