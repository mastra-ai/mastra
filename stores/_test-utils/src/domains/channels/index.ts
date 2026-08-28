import type { ChannelsStorage, MastraStorage } from '@mastra/core/storage';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createSampleConfig, createSampleInstallation } from './data';

export function createChannelsTests({ storage }: { storage: MastraStorage }) {
  const describeChannels = storage.stores?.channels ? describe : describe.skip;
  const describeState = storage.stores?.channels?.supportsChannelState ? describe : describe.skip;

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

    describeState('state', () => {
      const NEVER_EXPIRES = null;
      const RACERS = 10;
      const inAnHour = () => Date.now() + 60 * 60 * 1000;
      const anHourAgo = () => Date.now() - 60 * 60 * 1000;

      it('round-trips a value', async () => {
        await channelsStorage.setState('agent-1', 'k', { replied: true, count: 2 }, NEVER_EXPIRES);

        const entry = await channelsStorage.getState('agent-1', 'k');
        expect(entry).toEqual({ value: { replied: true, count: 2 } });
      });

      it('returns null for a missing key', async () => {
        expect(await channelsStorage.getState('agent-1', 'missing')).toBeNull();
      });

      it('distinguishes a stored null from a missing key', async () => {
        await channelsStorage.setState('agent-1', 'k', null, NEVER_EXPIRES);

        expect(await channelsStorage.getState('agent-1', 'k')).toEqual({ value: null });
      });

      it('scopes keys by owner so two agents can hold the same key', async () => {
        await channelsStorage.setState('agent-1', 'msg-1', 'from-a', NEVER_EXPIRES);
        await channelsStorage.setState('agent-2', 'msg-1', 'from-b', NEVER_EXPIRES);

        expect(await channelsStorage.getState('agent-1', 'msg-1')).toEqual({ value: 'from-a' });
        expect(await channelsStorage.getState('agent-2', 'msg-1')).toEqual({ value: 'from-b' });
      });

      it('overwrites an existing value', async () => {
        await channelsStorage.setState('agent-1', 'k', 'first', NEVER_EXPIRES);
        await channelsStorage.setState('agent-1', 'k', 'second', NEVER_EXPIRES);

        expect(await channelsStorage.getState('agent-1', 'k')).toEqual({ value: 'second' });
      });

      it('hides an expired value', async () => {
        await channelsStorage.setState('agent-1', 'k', 'stale', anHourAgo());

        expect(await channelsStorage.getState('agent-1', 'k')).toBeNull();
      });

      it('keeps a value that has not reached its deadline', async () => {
        await channelsStorage.setState('agent-1', 'k', 'fresh', inAnHour());

        expect(await channelsStorage.getState('agent-1', 'k')).toEqual({ value: 'fresh' });
      });

      it('grants the claim when the key is free', async () => {
        expect(await channelsStorage.setStateIfNotExists('agent-1', 'msg-1', 'a', inAnHour())).toBe(true);
        expect(await channelsStorage.getState('agent-1', 'msg-1')).toEqual({ value: 'a' });
      });

      it('refuses the claim when a live entry exists, leaving it untouched', async () => {
        await channelsStorage.setStateIfNotExists('agent-1', 'msg-1', 'winner', inAnHour());

        expect(await channelsStorage.setStateIfNotExists('agent-1', 'msg-1', 'loser', inAnHour())).toBe(false);
        expect(await channelsStorage.getState('agent-1', 'msg-1')).toEqual({ value: 'winner' });
      });

      it('lets a claim through once the previous one has expired', async () => {
        await channelsStorage.setStateIfNotExists('agent-1', 'msg-1', 'old', anHourAgo());

        expect(await channelsStorage.setStateIfNotExists('agent-1', 'msg-1', 'new', inAnHour())).toBe(true);
        expect(await channelsStorage.getState('agent-1', 'msg-1')).toEqual({ value: 'new' });
      });

      it('grants exactly one claim when many callers race for the same key', async () => {
        // Regression for #18877: setStateIfNotExists must be a single statement. A
        // read-then-write implementation lets several of these interleave and all return
        // true, which is duplicate Slack replies.

        // Pools connect lazily, so the first concurrent burst is staggered by connection
        // setup and runs single file — enough for a read-then-write to pass. These
        // throwaway reads leave RACERS connections idle so the claims below really do race.
        await Promise.all(Array.from({ length: RACERS }, (_, i) => channelsStorage.getState('agent-1', `warmup-${i}`)));

        const attempts = Array.from({ length: RACERS }, (_, i) =>
          channelsStorage.setStateIfNotExists('agent-1', 'msg-1', `caller-${i}`, inAnHour()),
        );

        const results = await Promise.all(attempts);

        expect(results.filter(Boolean)).toHaveLength(1);
      });

      it('deletes a state entry', async () => {
        await channelsStorage.setState('agent-1', 'k', 'v', NEVER_EXPIRES);

        await channelsStorage.deleteState('agent-1', 'k');

        expect(await channelsStorage.getState('agent-1', 'k')).toBeNull();
      });

      it('is idempotent when deleting a missing key', async () => {
        await expect(channelsStorage.deleteState('agent-1', 'missing')).resolves.not.toThrow();
      });

      it('sweeps expired entries and spares live ones', async () => {
        await channelsStorage.setState('agent-1', 'dead', 'x', anHourAgo());
        await channelsStorage.setState('agent-1', 'alive', 'y', inAnHour());
        await channelsStorage.setState('agent-1', 'forever', 'z', NEVER_EXPIRES);

        await channelsStorage.deleteExpiredState(Date.now());

        // A swept key is claimable again; the survivors are not.
        expect(await channelsStorage.setStateIfNotExists('agent-1', 'dead', 'reclaimed', inAnHour())).toBe(true);
        expect(await channelsStorage.getState('agent-1', 'alive')).toEqual({ value: 'y' });
        expect(await channelsStorage.getState('agent-1', 'forever')).toEqual({ value: 'z' });
      });
    });
  });
}
