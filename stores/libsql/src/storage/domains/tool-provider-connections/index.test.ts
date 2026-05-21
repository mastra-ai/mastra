import { createClient } from '@libsql/client';
import { beforeEach, describe, expect, it } from 'vitest';

import { ToolProviderConnectionsLibSQL } from './index';

describe('ToolProviderConnectionsLibSQL', () => {
  let store: ToolProviderConnectionsLibSQL;

  beforeEach(async () => {
    const client = createClient({ url: 'file::memory:?cache=shared' });
    store = new ToolProviderConnectionsLibSQL({ client, maxRetries: 1, initialBackoffMs: 10 });
    await store.init();
  });

  describe('upsert / get', () => {
    it('inserts a new row with createdAt/updatedAt and returns it from get', async () => {
      const row = await store.upsert({
        authorId: 'u1',
        providerId: 'composio',
        toolkit: 'gmail',
        connectionId: 'ca_1',
        label: 'Work',
      });

      expect(row.authorId).toBe('u1');
      expect(row.label).toBe('Work');
      expect(row.scope).toBe('per-author');
      expect(row.createdAt).toBeInstanceOf(Date);
      expect(row.updatedAt).toBeInstanceOf(Date);

      const fetched = await store.get({ authorId: 'u1', providerId: 'composio', connectionId: 'ca_1' });
      expect(fetched).not.toBeNull();
      expect(fetched!.label).toBe('Work');
      expect(fetched!.toolkit).toBe('gmail');
    });

    it('updates label on second upsert and preserves createdAt', async () => {
      const first = await store.upsert({
        authorId: 'u1',
        providerId: 'composio',
        toolkit: 'gmail',
        connectionId: 'ca_1',
        label: 'Work',
      });

      await new Promise(resolve => setTimeout(resolve, 5));

      const second = await store.upsert({
        authorId: 'u1',
        providerId: 'composio',
        toolkit: 'gmail',
        connectionId: 'ca_1',
        label: 'Personal',
      });

      expect(second.label).toBe('Personal');
      expect(second.createdAt.toISOString()).toBe(first.createdAt.toISOString());
      expect(second.updatedAt.getTime()).toBeGreaterThanOrEqual(first.updatedAt.getTime());
    });

    it('stores label as null when not provided', async () => {
      const row = await store.upsert({
        authorId: 'u1',
        providerId: 'composio',
        toolkit: 'gmail',
        connectionId: 'ca_1',
        label: null,
      });
      expect(row.label).toBeNull();

      const fetched = await store.get({ authorId: 'u1', providerId: 'composio', connectionId: 'ca_1' });
      expect(fetched?.label).toBeNull();
    });

    it('persists scope when provided and preserves scope on update', async () => {
      await store.upsert({
        authorId: 'shared',
        providerId: 'composio',
        toolkit: 'slack',
        connectionId: 'ca_shared',
        label: 'Team Slack',
        scope: 'shared',
      });

      const fetched = await store.get({ authorId: 'shared', providerId: 'composio', connectionId: 'ca_shared' });
      expect(fetched?.scope).toBe('shared');

      // Update without specifying scope keeps the original scope.
      const updated = await store.upsert({
        authorId: 'shared',
        providerId: 'composio',
        toolkit: 'slack',
        connectionId: 'ca_shared',
        label: 'Renamed',
      });
      expect(updated.scope).toBe('shared');
    });

    it('supports caller-supplied scope', async () => {
      const row = await store.upsert({
        authorId: 'tenant-42',
        providerId: 'composio',
        toolkit: 'gmail',
        connectionId: 'ca_cs',
        label: null,
        scope: 'caller-supplied',
      });
      expect(row.scope).toBe('caller-supplied');

      const fetched = await store.get({ authorId: 'tenant-42', providerId: 'composio', connectionId: 'ca_cs' });
      expect(fetched?.scope).toBe('caller-supplied');
    });

    it('returns null for missing rows', async () => {
      const fetched = await store.get({ authorId: 'u1', providerId: 'composio', connectionId: 'missing' });
      expect(fetched).toBeNull();
    });

    it('scopes uniqueness on (authorId, providerId, connectionId)', async () => {
      await store.upsert({
        authorId: 'u1',
        providerId: 'composio',
        toolkit: 'gmail',
        connectionId: 'ca_1',
        label: 'Work',
      });
      await store.upsert({
        authorId: 'u2',
        providerId: 'composio',
        toolkit: 'gmail',
        connectionId: 'ca_1',
        label: 'Other-user',
      });

      const u1 = await store.get({ authorId: 'u1', providerId: 'composio', connectionId: 'ca_1' });
      const u2 = await store.get({ authorId: 'u2', providerId: 'composio', connectionId: 'ca_1' });
      expect(u1?.label).toBe('Work');
      expect(u2?.label).toBe('Other-user');
    });
  });

  describe('list', () => {
    beforeEach(async () => {
      await store.upsert({
        authorId: 'u1',
        providerId: 'composio',
        toolkit: 'gmail',
        connectionId: 'ca_1',
        label: 'Work',
      });
      await store.upsert({
        authorId: 'u1',
        providerId: 'composio',
        toolkit: 'gmail',
        connectionId: 'ca_2',
        label: 'Personal',
      });
      await store.upsert({
        authorId: 'u1',
        providerId: 'composio',
        toolkit: 'slack',
        connectionId: 'ca_3',
        label: null,
      });
      await store.upsert({
        authorId: 'u2',
        providerId: 'composio',
        toolkit: 'gmail',
        connectionId: 'ca_4',
        label: 'Other',
      });
      await store.upsert({
        authorId: 'shared',
        providerId: 'composio',
        toolkit: 'slack',
        connectionId: 'ca_shared',
        label: 'Team',
        scope: 'shared',
      });
    });

    it('lists only rows for the given author', async () => {
      const rows = await store.list({ authorId: 'u1' });
      expect(rows).toHaveLength(3);
      expect(rows.every(r => r.authorId === 'u1')).toBe(true);
    });

    it('filters by providerId', async () => {
      const rows = await store.list({ authorId: 'u1', providerId: 'composio' });
      expect(rows).toHaveLength(3);
    });

    it('filters by toolkit', async () => {
      const rows = await store.list({ authorId: 'u1', toolkit: 'gmail' });
      expect(rows).toHaveLength(2);
      expect(rows.map(r => r.connectionId).sort()).toEqual(['ca_1', 'ca_2']);
    });

    it('filters by scope', async () => {
      const rows = await store.list({ scope: 'shared' });
      expect(rows).toHaveLength(1);
      expect(rows[0].connectionId).toBe('ca_shared');
    });

    it('lists across all authors when authorId is omitted', async () => {
      const rows = await store.list({});
      expect(rows.length).toBeGreaterThanOrEqual(5);
    });

    it('returns empty list when author has no rows', async () => {
      const rows = await store.list({ authorId: 'nobody' });
      expect(rows).toEqual([]);
    });
  });

  describe('delete', () => {
    it('removes a single row and is idempotent', async () => {
      await store.upsert({
        authorId: 'u1',
        providerId: 'composio',
        toolkit: 'gmail',
        connectionId: 'ca_1',
        label: 'Work',
      });

      await store.delete({ authorId: 'u1', providerId: 'composio', connectionId: 'ca_1' });
      expect(await store.get({ authorId: 'u1', providerId: 'composio', connectionId: 'ca_1' })).toBeNull();

      await expect(
        store.delete({ authorId: 'u1', providerId: 'composio', connectionId: 'ca_1' }),
      ).resolves.toBeUndefined();
    });

    it('does not touch other authors / providers / connections', async () => {
      await store.upsert({
        authorId: 'u1',
        providerId: 'composio',
        toolkit: 'gmail',
        connectionId: 'ca_1',
        label: 'Work',
      });
      await store.upsert({
        authorId: 'u2',
        providerId: 'composio',
        toolkit: 'gmail',
        connectionId: 'ca_1',
        label: 'Other-user',
      });

      await store.delete({ authorId: 'u1', providerId: 'composio', connectionId: 'ca_1' });
      expect(await store.get({ authorId: 'u1', providerId: 'composio', connectionId: 'ca_1' })).toBeNull();
      expect(await store.get({ authorId: 'u2', providerId: 'composio', connectionId: 'ca_1' })).not.toBeNull();
    });
  });

  describe('dangerouslyClearAll', () => {
    it('clears every row', async () => {
      await store.upsert({
        authorId: 'u1',
        providerId: 'composio',
        toolkit: 'gmail',
        connectionId: 'ca_1',
        label: 'Work',
      });
      await store.upsert({
        authorId: 'u2',
        providerId: 'composio',
        toolkit: 'slack',
        connectionId: 'ca_2',
        label: 'Team',
      });

      await store.dangerouslyClearAll();

      expect(await store.list({ authorId: 'u1' })).toEqual([]);
      expect(await store.list({ authorId: 'u2' })).toEqual([]);
    });
  });
});
