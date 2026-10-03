import type { ChannelsStorage, MastraStorage } from '@mastra/core/storage';
import { supportsThreadMappings } from '@mastra/core/storage';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createSampleConfig, createSampleInstallation, createSampleThreadMapping } from './data';

export function createChannelsTests({ storage }: { storage: MastraStorage }) {
  const describeChannels = storage.stores?.channels ? describe : describe.skip;
  // Gated before the describe call so non-capable stores skip, never pass vacuously.
  const describeMappings =
    storage.stores?.channels && supportsThreadMappings(storage.stores.channels) ? describe : describe.skip;

  let channelsStorage: ChannelsStorage;

  describeChannels('Channels Storage', () => {
    beforeAll(async () => {
      const channels = await storage.getStore('channels');
      if (!channels) throw new Error('Channels storage not found');
      channelsStorage = channels;
    });

    beforeEach(async () => {
      await channelsStorage.dangerouslyClearAll();
    });

    describe('saveInstallation + getInstallation', () => {
      it('saves and retrieves an installation by ID', async () => {
        const installation = createSampleInstallation({ id: 'install-1' });
        await channelsStorage.saveInstallation(installation);

        const fetched = await channelsStorage.getInstallation('install-1');
        expect(fetched).not.toBeNull();
        expect(fetched!.id).toBe('install-1');
        expect(fetched!.platform).toBe('slack');
        expect(fetched!.agentId).toBe(installation.agentId);
        expect(fetched!.status).toBe('active');
        expect(fetched!.data).toEqual(installation.data);
      });

      it('returns null for non-existent installation', async () => {
        const fetched = await channelsStorage.getInstallation('missing');
        expect(fetched).toBeNull();
      });

      it('updates an existing installation (upsert)', async () => {
        const installation = createSampleInstallation({ id: 'install-1', status: 'pending' });
        await channelsStorage.saveInstallation(installation);

        const updated = createSampleInstallation({
          id: 'install-1',
          status: 'active',
          data: { ...installation.data, teamId: 'T999999' },
        });
        await channelsStorage.saveInstallation(updated);

        const fetched = await channelsStorage.getInstallation('install-1');
        expect(fetched!.status).toBe('active');
        expect(fetched!.data.teamId).toBe('T999999');
      });

      it('preserves createdAt when updating', async () => {
        const installation = createSampleInstallation({
          id: 'install-1',
          createdAt: new Date('2025-01-01T00:00:00.000Z'),
        });
        await channelsStorage.saveInstallation(installation);

        const updated = createSampleInstallation({
          id: 'install-1',
          status: 'active',
        });
        await channelsStorage.saveInstallation(updated);

        const fetched = await channelsStorage.getInstallation('install-1');
        expect(fetched!.createdAt.toISOString()).toBe('2025-01-01T00:00:00.000Z');
      });

      it('stores error messages for failed installations', async () => {
        const installation = createSampleInstallation({
          id: 'install-1',
          status: 'error',
          error: 'OAuth token expired',
        });
        await channelsStorage.saveInstallation(installation);

        const fetched = await channelsStorage.getInstallation('install-1');
        expect(fetched!.status).toBe('error');
        expect(fetched!.error).toBe('OAuth token expired');
      });
    });

    describe('getInstallationByAgent', () => {
      it('retrieves installation by platform and agentId', async () => {
        const installation = createSampleInstallation({
          id: 'install-1',
          platform: 'slack',
          agentId: 'agent-123',
        });
        await channelsStorage.saveInstallation(installation);

        const fetched = await channelsStorage.getInstallationByAgent('slack', 'agent-123');
        expect(fetched).not.toBeNull();
        expect(fetched!.id).toBe('install-1');
      });

      it('returns null when no match exists', async () => {
        const fetched = await channelsStorage.getInstallationByAgent('slack', 'missing');
        expect(fetched).toBeNull();
      });

      it('does not match across platforms', async () => {
        const installation = createSampleInstallation({
          id: 'install-1',
          platform: 'slack',
          agentId: 'agent-123',
        });
        await channelsStorage.saveInstallation(installation);

        const fetched = await channelsStorage.getInstallationByAgent('discord', 'agent-123');
        expect(fetched).toBeNull();
      });
    });

    describe('getInstallationByWebhookId', () => {
      it('retrieves installation by webhookId', async () => {
        const installation = createSampleInstallation({
          id: 'install-1',
          webhookId: 'webhook-abc',
        });
        await channelsStorage.saveInstallation(installation);

        const fetched = await channelsStorage.getInstallationByWebhookId('webhook-abc');
        expect(fetched).not.toBeNull();
        expect(fetched!.id).toBe('install-1');
      });

      it('returns null when webhookId does not exist', async () => {
        const fetched = await channelsStorage.getInstallationByWebhookId('missing');
        expect(fetched).toBeNull();
      });

      it('handles installations without webhookId', async () => {
        const installation = createSampleInstallation({
          id: 'install-1',
          webhookId: undefined,
        });
        await channelsStorage.saveInstallation(installation);

        const fetched = await channelsStorage.getInstallation('install-1');
        expect(fetched!.webhookId).toBeUndefined();
      });
    });

    describe('listInstallations', () => {
      it('lists all installations for a platform', async () => {
        await channelsStorage.saveInstallation(createSampleInstallation({ id: 'i1', platform: 'slack' }));
        await channelsStorage.saveInstallation(createSampleInstallation({ id: 'i2', platform: 'slack' }));
        await channelsStorage.saveInstallation(createSampleInstallation({ id: 'i3', platform: 'discord' }));

        const slackInstallations = await channelsStorage.listInstallations('slack');
        expect(slackInstallations).toHaveLength(2);
        expect(slackInstallations.map(i => i.id).sort()).toEqual(['i1', 'i2']);
      });

      it('returns empty array when no installations exist', async () => {
        const installations = await channelsStorage.listInstallations('slack');
        expect(installations).toEqual([]);
      });
    });

    describe('deleteInstallation', () => {
      it('deletes an installation by ID', async () => {
        const installation = createSampleInstallation({ id: 'install-1' });
        await channelsStorage.saveInstallation(installation);

        await channelsStorage.deleteInstallation('install-1');

        const fetched = await channelsStorage.getInstallation('install-1');
        expect(fetched).toBeNull();
      });

      it('is idempotent (does not throw when deleting non-existent)', async () => {
        await expect(channelsStorage.deleteInstallation('missing')).resolves.not.toThrow();
      });
    });

    describe('saveConfig + getConfig', () => {
      it('saves and retrieves platform configuration', async () => {
        const config = createSampleConfig({ platform: 'slack' });
        await channelsStorage.saveConfig(config);

        const fetched = await channelsStorage.getConfig('slack');
        expect(fetched).not.toBeNull();
        expect(fetched!.platform).toBe('slack');
        expect(fetched!.data).toEqual(config.data);
      });

      it('returns null for non-existent config', async () => {
        const fetched = await channelsStorage.getConfig('missing');
        expect(fetched).toBeNull();
      });

      it('updates existing config (upsert)', async () => {
        const config = createSampleConfig({
          platform: 'slack',
          data: { appConfigToken: 'old-token' },
        });
        await channelsStorage.saveConfig(config);

        const updated = createSampleConfig({
          platform: 'slack',
          data: { appConfigToken: 'new-token', clientId: 'client_999' },
        });
        await channelsStorage.saveConfig(updated);

        const fetched = await channelsStorage.getConfig('slack');
        expect(fetched!.data.appConfigToken).toBe('new-token');
        expect(fetched!.data.clientId).toBe('client_999');
      });

      it('separates configs by platform', async () => {
        await channelsStorage.saveConfig(createSampleConfig({ platform: 'slack' }));
        await channelsStorage.saveConfig(createSampleConfig({ platform: 'discord' }));

        const slack = await channelsStorage.getConfig('slack');
        const discord = await channelsStorage.getConfig('discord');

        expect(slack).not.toBeNull();
        expect(discord).not.toBeNull();
        expect(slack!.platform).toBe('slack');
        expect(discord!.platform).toBe('discord');
      });
    });

    describe('deleteConfig', () => {
      it('deletes platform configuration', async () => {
        const config = createSampleConfig({ platform: 'slack' });
        await channelsStorage.saveConfig(config);

        await channelsStorage.deleteConfig('slack');

        const fetched = await channelsStorage.getConfig('slack');
        expect(fetched).toBeNull();
      });

      it('is idempotent (does not throw when deleting non-existent)', async () => {
        await expect(channelsStorage.deleteConfig('missing')).resolves.not.toThrow();
      });
    });

    describeMappings('thread mappings', () => {
      const mappings = () => {
        if (!supportsThreadMappings(channelsStorage)) throw new Error('store does not support thread mappings');
        return channelsStorage;
      };

      it('returns null for a missing key', async () => {
        const fetched = await mappings().getThreadMapping({
          platform: 'slack',
          ownerId: 'owner',
          externalThreadId: 'slack:C1:missing',
        });
        expect(fetched).toBeNull();
      });

      it('upserts and reads back all fields with subscribed false by default', async () => {
        const input = createSampleThreadMapping();
        const stored = await mappings().upsertThreadMapping(input);

        expect(stored.platform).toBe(input.platform);
        expect(stored.ownerId).toBe(input.ownerId);
        expect(stored.externalThreadId).toBe(input.externalThreadId);
        expect(stored.externalChannelId).toBe(input.externalChannelId);
        expect(stored.threadId).toBe(input.threadId);
        expect(stored.subscribed).toBe(false);
        expect(stored.createdAt).toBeInstanceOf(Date);
        expect(stored.updatedAt).toBeInstanceOf(Date);

        const fetched = await mappings().getThreadMapping(input);
        expect(fetched).toEqual(stored);
      });

      it('keeps threadId and createdAt on conflict, replaces externalChannelId', async () => {
        const input = createSampleThreadMapping({ externalChannelId: 'C-old' });
        const first = await mappings().upsertThreadMapping(input);

        await new Promise(resolve => setTimeout(resolve, 5));
        const second = await mappings().upsertThreadMapping({
          ...input,
          threadId: 'another-thread',
          externalChannelId: 'C-new',
        });

        expect(second.threadId).toBe(first.threadId);
        expect(second.externalChannelId).toBe('C-new');
        expect(second.createdAt.getTime()).toBe(first.createdAt.getTime());
        expect(second.updatedAt.getTime()).toBeGreaterThanOrEqual(first.updatedAt.getTime());

        const fetched = await mappings().getThreadMapping(input);
        expect(fetched!.threadId).toBe(first.threadId);
        expect(fetched!.externalChannelId).toBe('C-new');
      });

      it('keeps subscribed when omitted and sets it when provided on conflict', async () => {
        const input = createSampleThreadMapping();
        await mappings().upsertThreadMapping({ ...input, subscribed: true });

        const kept = await mappings().upsertThreadMapping(input);
        expect(kept.subscribed).toBe(true);

        const flipped = await mappings().upsertThreadMapping({ ...input, subscribed: false });
        expect(flipped.subscribed).toBe(false);
      });

      it('stores the same externalThreadId under two owners as two rows', async () => {
        const externalThreadId = 'slack:C1:shared';
        const a = await mappings().upsertThreadMapping(
          createSampleThreadMapping({ ownerId: 'owner-a', externalThreadId, threadId: 'thread-a' }),
        );
        const b = await mappings().upsertThreadMapping(
          createSampleThreadMapping({ ownerId: 'owner-b', externalThreadId, threadId: 'thread-b' }),
        );

        expect(a.threadId).toBe('thread-a');
        expect(b.threadId).toBe('thread-b');
        const fetchedA = await mappings().getThreadMapping({ platform: 'slack', ownerId: 'owner-a', externalThreadId });
        const fetchedB = await mappings().getThreadMapping({ platform: 'slack', ownerId: 'owner-b', externalThreadId });
        expect(fetchedA!.threadId).toBe('thread-a');
        expect(fetchedB!.threadId).toBe('thread-b');
      });

      it('setThreadSubscribed flips the flag and is a no-op on a missing key', async () => {
        const input = createSampleThreadMapping();
        await mappings().upsertThreadMapping(input);

        await mappings().setThreadSubscribed(input, true);
        expect((await mappings().getThreadMapping(input))!.subscribed).toBe(true);

        await mappings().setThreadSubscribed(input, false);
        expect((await mappings().getThreadMapping(input))!.subscribed).toBe(false);

        const missing = { platform: 'slack', ownerId: 'nobody', externalThreadId: 'slack:C1:none' };
        await expect(mappings().setThreadSubscribed(missing, true)).resolves.not.toThrow();
        expect(await mappings().getThreadMapping(missing)).toBeNull();
      });

      it('getThreadMappingByThreadId finds the row', async () => {
        const input = createSampleThreadMapping({ threadId: 'reverse-thread' });
        await mappings().upsertThreadMapping(input);

        const fetched = await mappings().getThreadMappingByThreadId('reverse-thread');
        expect(fetched).not.toBeNull();
        expect(fetched!.externalThreadId).toBe(input.externalThreadId);

        expect(await mappings().getThreadMappingByThreadId('no-such-thread')).toBeNull();
      });

      it('deleteThreadMapping removes the row and is idempotent', async () => {
        const input = createSampleThreadMapping();
        await mappings().upsertThreadMapping(input);

        await mappings().deleteThreadMapping(input);
        expect(await mappings().getThreadMapping(input)).toBeNull();

        await expect(mappings().deleteThreadMapping(input)).resolves.not.toThrow();
      });

      it('dangerouslyClearAll clears mappings', async () => {
        const input = createSampleThreadMapping();
        await mappings().upsertThreadMapping(input);

        await channelsStorage.dangerouslyClearAll();
        expect(await mappings().getThreadMapping(input)).toBeNull();
      });
    });
  });
}
