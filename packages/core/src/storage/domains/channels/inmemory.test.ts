import { describe, it, expect, beforeEach } from 'vitest';

import type { ChannelInstallation, ChannelConfig } from './base';
import { InMemoryChannelsStorage } from './inmemory';

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
  });
});
