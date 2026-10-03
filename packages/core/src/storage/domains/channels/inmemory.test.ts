import { describe, it, expect, beforeEach } from 'vitest';

import type { ChannelInstallation, ChannelConfig, ChannelThreadMappingInput } from './base';
import { ChannelsStorage, supportsThreadMappings } from './base';
import { InMemoryChannelsStorage } from './inmemory';

function makeMapping(overrides: Partial<ChannelThreadMappingInput> = {}): ChannelThreadMappingInput {
  return {
    platform: 'slack',
    ownerId: 'owner-1',
    externalThreadId: 'slack:C1:1700000000.000100',
    externalChannelId: 'C1',
    threadId: 'thread-1',
    ...overrides,
  };
}

function makeInstallation(overrides: Partial<ChannelInstallation> = {}): ChannelInstallation {
  return {
    id: 'inst-1',
    platform: 'slack',
    agentId: 'agent-1',
    status: 'active',
    webhookId: 'wh-1',
    data: { botToken: 'xoxb-123' },
    configHash: 'hash-1',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeConfig(overrides: Partial<ChannelConfig> = {}): ChannelConfig {
  return {
    platform: 'slack',
    data: { token: 'config-token' },
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('InMemoryChannelsStorage', () => {
  let storage: InMemoryChannelsStorage;

  beforeEach(() => {
    storage = new InMemoryChannelsStorage();
  });

  describe('installations', () => {
    it('saves and retrieves an installation by ID', async () => {
      const inst = makeInstallation();
      await storage.saveInstallation(inst);

      const result = await storage.getInstallation('inst-1');
      expect(result).toEqual(inst);
    });

    it('returns null for non-existent installation', async () => {
      expect(await storage.getInstallation('missing')).toBeNull();
    });

    it('upserts on save (overwrites by ID)', async () => {
      await storage.saveInstallation(makeInstallation({ status: 'pending' }));
      await storage.saveInstallation(makeInstallation({ status: 'active' }));

      const result = await storage.getInstallation('inst-1');
      expect(result?.status).toBe('active');
    });

    it('returns clones (no external mutation)', async () => {
      const inst = makeInstallation();
      await storage.saveInstallation(inst);

      const a = await storage.getInstallation('inst-1');
      const b = await storage.getInstallation('inst-1');
      expect(a).not.toBe(b);
      expect(a).toEqual(b);
    });

    it('deletes an installation', async () => {
      await storage.saveInstallation(makeInstallation());
      await storage.deleteInstallation('inst-1');

      expect(await storage.getInstallation('inst-1')).toBeNull();
    });

    it('delete is no-op for non-existent ID', async () => {
      await expect(storage.deleteInstallation('missing')).resolves.toBeUndefined();
    });
  });

  describe('getInstallationByAgent', () => {
    it('finds installation by platform and agentId', async () => {
      await storage.saveInstallation(makeInstallation());

      const result = await storage.getInstallationByAgent('slack', 'agent-1');
      expect(result?.id).toBe('inst-1');
    });

    it('returns null when no match', async () => {
      await storage.saveInstallation(makeInstallation());

      expect(await storage.getInstallationByAgent('discord', 'agent-1')).toBeNull();
      expect(await storage.getInstallationByAgent('slack', 'other-agent')).toBeNull();
    });

    it('prefers active over pending', async () => {
      await storage.saveInstallation(makeInstallation({ id: 'pending-1', status: 'pending' }));
      await storage.saveInstallation(makeInstallation({ id: 'active-1', status: 'active' }));

      const result = await storage.getInstallationByAgent('slack', 'agent-1');
      expect(result?.id).toBe('active-1');
    });

    it('prefers pending over error', async () => {
      await storage.saveInstallation(makeInstallation({ id: 'error-1', status: 'error' }));
      await storage.saveInstallation(makeInstallation({ id: 'pending-1', status: 'pending' }));

      const result = await storage.getInstallationByAgent('slack', 'agent-1');
      expect(result?.id).toBe('pending-1');
    });

    it('returns error status when it is the only match', async () => {
      await storage.saveInstallation(makeInstallation({ id: 'error-1', status: 'error' }));

      const result = await storage.getInstallationByAgent('slack', 'agent-1');
      expect(result?.id).toBe('error-1');
    });
  });

  describe('getInstallationByWebhookId', () => {
    it('finds installation by webhookId', async () => {
      await storage.saveInstallation(makeInstallation({ webhookId: 'wh-abc' }));

      const result = await storage.getInstallationByWebhookId('wh-abc');
      expect(result?.id).toBe('inst-1');
    });

    it('returns null for unknown webhookId', async () => {
      expect(await storage.getInstallationByWebhookId('unknown')).toBeNull();
    });
  });

  describe('listInstallations', () => {
    it('lists installations filtered by platform', async () => {
      await storage.saveInstallation(makeInstallation({ id: 'slack-1', platform: 'slack' }));
      await storage.saveInstallation(makeInstallation({ id: 'slack-2', platform: 'slack', agentId: 'agent-2' }));
      await storage.saveInstallation(makeInstallation({ id: 'discord-1', platform: 'discord' }));

      const slackList = await storage.listInstallations('slack');
      expect(slackList).toHaveLength(2);
      expect(slackList.map(i => i.id).sort()).toEqual(['slack-1', 'slack-2']);

      const discordList = await storage.listInstallations('discord');
      expect(discordList).toHaveLength(1);
    });

    it('returns empty array for unknown platform', async () => {
      expect(await storage.listInstallations('unknown')).toEqual([]);
    });

    it('returns clones', async () => {
      await storage.saveInstallation(makeInstallation());

      const [a] = await storage.listInstallations('slack');
      const [b] = await storage.listInstallations('slack');
      expect(a).not.toBe(b);
      expect(a).toEqual(b);
    });
  });

  describe('config', () => {
    it('saves and retrieves config by platform', async () => {
      const config = makeConfig();
      await storage.saveConfig(config);

      const result = await storage.getConfig('slack');
      expect(result).toEqual(config);
    });

    it('returns null for non-existent config', async () => {
      expect(await storage.getConfig('missing')).toBeNull();
    });

    it('upserts by platform key', async () => {
      await storage.saveConfig(makeConfig({ data: { token: 'old' } }));
      await storage.saveConfig(makeConfig({ data: { token: 'new' } }));

      const result = await storage.getConfig('slack');
      expect(result?.data.token).toBe('new');
    });

    it('deletes config by platform', async () => {
      await storage.saveConfig(makeConfig());
      await storage.deleteConfig('slack');

      expect(await storage.getConfig('slack')).toBeNull();
    });

    it('returns clones', async () => {
      await storage.saveConfig(makeConfig());

      const a = await storage.getConfig('slack');
      const b = await storage.getConfig('slack');
      expect(a).not.toBe(b);
      expect(a).toEqual(b);
    });
  });

  describe('dangerouslyClearAll', () => {
    it('clears all installations and configs', async () => {
      await storage.saveInstallation(makeInstallation());
      await storage.saveConfig(makeConfig());

      await storage.dangerouslyClearAll();

      expect(await storage.getInstallation('inst-1')).toBeNull();
      expect(await storage.getConfig('slack')).toBeNull();
    });

    it('clears thread mappings', async () => {
      const input = makeMapping();
      await storage.upsertThreadMapping(input);

      await storage.dangerouslyClearAll();

      expect(await storage.getThreadMapping(input)).toBeNull();
    });
  });

  describe('thread mappings', () => {
    it('returns null for a missing key', async () => {
      expect(await storage.getThreadMapping(makeMapping())).toBeNull();
    });

    it('upserts and reads back all fields with subscribed false by default', async () => {
      const input = makeMapping();
      const stored = await storage.upsertThreadMapping(input);

      expect(stored).toMatchObject({ ...input, subscribed: false });
      expect(stored.createdAt).toBeInstanceOf(Date);
      expect(stored.updatedAt).toBeInstanceOf(Date);
      expect(await storage.getThreadMapping(input)).toEqual(stored);
    });

    it('returns copies, not the stored object', async () => {
      const input = makeMapping();
      const stored = await storage.upsertThreadMapping(input);
      stored.threadId = 'mutated';

      expect((await storage.getThreadMapping(input))!.threadId).toBe('thread-1');
    });

    it('keeps threadId and createdAt on conflict, replaces externalChannelId', async () => {
      const input = makeMapping({ externalChannelId: 'C-old' });
      const first = await storage.upsertThreadMapping(input);

      const second = await storage.upsertThreadMapping({
        ...input,
        threadId: 'another-thread',
        externalChannelId: 'C-new',
      });

      expect(second.threadId).toBe('thread-1');
      expect(second.externalChannelId).toBe('C-new');
      expect(second.createdAt.getTime()).toBe(first.createdAt.getTime());
      expect((await storage.getThreadMapping(input))!.threadId).toBe('thread-1');
    });

    it('keeps subscribed when omitted and sets it when provided on conflict', async () => {
      const input = makeMapping();
      await storage.upsertThreadMapping({ ...input, subscribed: true });

      expect((await storage.upsertThreadMapping(input)).subscribed).toBe(true);
      expect((await storage.upsertThreadMapping({ ...input, subscribed: false })).subscribed).toBe(false);
    });

    it('stores the same externalThreadId under two owners as two rows', async () => {
      await storage.upsertThreadMapping(makeMapping({ ownerId: 'owner-a', threadId: 'thread-a' }));
      await storage.upsertThreadMapping(makeMapping({ ownerId: 'owner-b', threadId: 'thread-b' }));

      expect((await storage.getThreadMapping(makeMapping({ ownerId: 'owner-a' })))!.threadId).toBe('thread-a');
      expect((await storage.getThreadMapping(makeMapping({ ownerId: 'owner-b' })))!.threadId).toBe('thread-b');
    });

    it('setThreadSubscribed flips the flag and is a no-op on a missing key', async () => {
      const input = makeMapping();
      await storage.upsertThreadMapping(input);

      await storage.setThreadSubscribed(input, true);
      expect((await storage.getThreadMapping(input))!.subscribed).toBe(true);
      await storage.setThreadSubscribed(input, false);
      expect((await storage.getThreadMapping(input))!.subscribed).toBe(false);

      const missing = makeMapping({ externalThreadId: 'slack:C1:none' });
      await storage.setThreadSubscribed(missing, true);
      expect(await storage.getThreadMapping(missing)).toBeNull();
    });

    it('getThreadMappingByThreadId finds the row', async () => {
      const input = makeMapping();
      await storage.upsertThreadMapping(input);

      const fetched = await storage.getThreadMappingByThreadId('thread-1');
      expect(fetched!.externalThreadId).toBe(input.externalThreadId);
      expect(await storage.getThreadMappingByThreadId('no-such-thread')).toBeNull();
    });

    it('deleteThreadMapping removes the row and is idempotent', async () => {
      const input = makeMapping();
      await storage.upsertThreadMapping(input);

      await storage.deleteThreadMapping(input);
      expect(await storage.getThreadMapping(input)).toBeNull();
      await expect(storage.deleteThreadMapping(input)).resolves.toBeUndefined();
    });
  });
});

describe('supportsThreadMappings', () => {
  it('is true for InMemoryChannelsStorage', () => {
    expect(supportsThreadMappings(new InMemoryChannelsStorage())).toBe(true);
  });

  it('is false for a store implementing only the abstract methods', () => {
    class LegacyChannelsStorage extends ChannelsStorage {
      async saveInstallation(): Promise<void> {}
      async getInstallation(): Promise<ChannelInstallation | null> {
        return null;
      }
      async getInstallationByAgent(): Promise<ChannelInstallation | null> {
        return null;
      }
      async getInstallationByWebhookId(): Promise<ChannelInstallation | null> {
        return null;
      }
      async listInstallations(): Promise<ChannelInstallation[]> {
        return [];
      }
      async deleteInstallation(): Promise<void> {}
      async saveConfig(): Promise<void> {}
      async getConfig(): Promise<ChannelConfig | null> {
        return null;
      }
      async deleteConfig(): Promise<void> {}
      async dangerouslyClearAll(): Promise<void> {}
    }

    expect(supportsThreadMappings(new LegacyChannelsStorage())).toBe(false);
  });
});
