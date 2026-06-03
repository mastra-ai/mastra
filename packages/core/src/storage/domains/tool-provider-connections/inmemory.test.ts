import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryDB } from '../inmemory-db';
import { InMemoryToolProviderConnectionsStorage } from './inmemory';

describe('InMemoryToolProviderConnectionsStorage', () => {
  let db: InMemoryDB;
  let store: InMemoryToolProviderConnectionsStorage;

  beforeEach(() => {
    db = new InMemoryDB();
    store = new InMemoryToolProviderConnectionsStorage({ db });
  });

  describe('upsert / get', () => {
    it('inserts a new row with createdAt/updatedAt and returns it from get', async () => {
      const row = await store.upsertConnection({
        authorId: 'u1',
        providerId: 'composio',
        toolkit: 'gmail',
        connectionId: 'ca_1',
        label: 'Work',
      });

      expect(row.authorId).toBe('u1');
      expect(row.label).toBe('Work');
      expect(row.createdAt).toBeInstanceOf(Date);
      expect(row.updatedAt).toBeInstanceOf(Date);

      const fetched = await store.getConnectionById({ authorId: 'u1', providerId: 'composio', connectionId: 'ca_1' });
      expect(fetched).toEqual(row);
    });

    it('updates label on second upsert and preserves createdAt', async () => {
      const first = await store.upsertConnection({
        authorId: 'u1',
        providerId: 'composio',
        toolkit: 'gmail',
        connectionId: 'ca_1',
        label: 'Work',
      });

      // ensure time advances enough for updatedAt to differ
      await new Promise(resolve => setTimeout(resolve, 5));

      const second = await store.upsertConnection({
        authorId: 'u1',
        providerId: 'composio',
        toolkit: 'gmail',
        connectionId: 'ca_1',
        label: 'Personal',
      });

      expect(second.label).toBe('Personal');
      expect(second.createdAt).toEqual(first.createdAt);
      expect(second.updatedAt.getTime()).toBeGreaterThanOrEqual(first.updatedAt.getTime());
    });

    it('stores label as null when not provided', async () => {
      const row = await store.upsertConnection({
        authorId: 'u1',
        providerId: 'composio',
        toolkit: 'gmail',
        connectionId: 'ca_1',
        label: null,
      });
      expect(row.label).toBeNull();
    });

    it('returns null for missing rows', async () => {
      const fetched = await store.getConnectionById({
        authorId: 'u1',
        providerId: 'composio',
        connectionId: 'missing',
      });
      expect(fetched).toBeNull();
    });

    it('scopes uniqueness on (authorId, providerId, connectionId)', async () => {
      await store.upsertConnection({
        authorId: 'u1',
        providerId: 'composio',
        toolkit: 'gmail',
        connectionId: 'ca_1',
        label: 'Work',
      });
      await store.upsertConnection({
        authorId: 'u2',
        providerId: 'composio',
        toolkit: 'gmail',
        connectionId: 'ca_1',
        label: 'Other-user',
      });

      const u1 = await store.getConnectionById({ authorId: 'u1', providerId: 'composio', connectionId: 'ca_1' });
      const u2 = await store.getConnectionById({ authorId: 'u2', providerId: 'composio', connectionId: 'ca_1' });
      expect(u1?.label).toBe('Work');
      expect(u2?.label).toBe('Other-user');
    });
  });

  describe('list', () => {
    beforeEach(async () => {
      await store.upsertConnection({
        authorId: 'u1',
        providerId: 'composio',
        toolkit: 'gmail',
        connectionId: 'ca_1',
        label: 'Work',
      });
      await store.upsertConnection({
        authorId: 'u1',
        providerId: 'composio',
        toolkit: 'gmail',
        connectionId: 'ca_2',
        label: 'Personal',
      });
      await store.upsertConnection({
        authorId: 'u1',
        providerId: 'composio',
        toolkit: 'slack',
        connectionId: 'ca_3',
        label: null,
      });
      await store.upsertConnection({
        authorId: 'u2',
        providerId: 'composio',
        toolkit: 'gmail',
        connectionId: 'ca_4',
        label: 'Other',
      });
    });

    it('lists only rows for the given author', async () => {
      const rows = await store.listConnectionsByAuthor({ authorId: 'u1' });
      expect(rows).toHaveLength(3);
      expect(rows.every(r => r.authorId === 'u1')).toBe(true);
    });

    it('filters by providerId', async () => {
      const rows = await store.listConnectionsByAuthor({ authorId: 'u1', providerId: 'composio' });
      expect(rows).toHaveLength(3);
    });

    it('filters by toolkit', async () => {
      const rows = await store.listConnectionsByAuthor({ authorId: 'u1', toolkit: 'gmail' });
      expect(rows).toHaveLength(2);
      expect(rows.map(r => r.connectionId).sort()).toEqual(['ca_1', 'ca_2']);
    });

    it('returns empty list when author has no rows', async () => {
      const rows = await store.listConnectionsByAuthor({ authorId: 'nobody' });
      expect(rows).toEqual([]);
    });
  });

  describe('scope', () => {
    it('defaults scope to per-author when omitted on upsert', async () => {
      const row = await store.upsertConnection({
        authorId: 'u1',
        providerId: 'composio',
        toolkit: 'gmail',
        connectionId: 'ca_1',
        label: 'Work',
      });
      expect(row.scope).toBe('per-author');
    });

    it('persists shared scope and preserves it on re-upsert', async () => {
      const first = await store.upsertConnection({
        authorId: 'shared',
        providerId: 'composio',
        toolkit: 'gmail',
        connectionId: 'ca_s',
        label: 'Team Gmail',
        scope: 'shared',
      });
      expect(first.scope).toBe('shared');

      // Re-upsert without scope retains the existing scope
      const second = await store.upsertConnection({
        authorId: 'shared',
        providerId: 'composio',
        toolkit: 'gmail',
        connectionId: 'ca_s',
        label: 'Team Gmail v2',
      });
      expect(second.scope).toBe('shared');
      expect(second.label).toBe('Team Gmail v2');
    });

    it('filters list by scope', async () => {
      await store.upsertConnection({
        authorId: 'u1',
        providerId: 'composio',
        toolkit: 'gmail',
        connectionId: 'ca_a',
        label: 'A',
      });
      await store.upsertConnection({
        authorId: 'shared',
        providerId: 'composio',
        toolkit: 'gmail',
        connectionId: 'ca_b',
        label: 'B',
        scope: 'shared',
      });

      const sharedRows = await store.listConnectionsByAuthor({ providerId: 'composio', scope: 'shared' });
      expect(sharedRows.map(r => r.connectionId)).toEqual(['ca_b']);

      const perAuthorRows = await store.listConnectionsByAuthor({ providerId: 'composio', scope: 'per-author' });
      expect(perAuthorRows.map(r => r.connectionId)).toEqual(['ca_a']);
    });
  });

  describe('delete', () => {
    it('removes a single row and is idempotent', async () => {
      await store.upsertConnection({
        authorId: 'u1',
        providerId: 'composio',
        toolkit: 'gmail',
        connectionId: 'ca_1',
        label: 'Work',
      });

      await store.deleteConnection({ authorId: 'u1', providerId: 'composio', connectionId: 'ca_1' });
      const fetched = await store.getConnectionById({ authorId: 'u1', providerId: 'composio', connectionId: 'ca_1' });
      expect(fetched).toBeNull();

      // idempotent — no throw on missing row
      await expect(
        store.deleteConnection({ authorId: 'u1', providerId: 'composio', connectionId: 'ca_1' }),
      ).resolves.toBeUndefined();
    });

    it('does not touch other authors / providers / connections', async () => {
      await store.upsertConnection({
        authorId: 'u1',
        providerId: 'composio',
        toolkit: 'gmail',
        connectionId: 'ca_1',
        label: 'Work',
      });
      await store.upsertConnection({
        authorId: 'u2',
        providerId: 'composio',
        toolkit: 'gmail',
        connectionId: 'ca_1',
        label: 'Other-user',
      });

      await store.deleteConnection({ authorId: 'u1', providerId: 'composio', connectionId: 'ca_1' });
      expect(
        await store.getConnectionById({ authorId: 'u1', providerId: 'composio', connectionId: 'ca_1' }),
      ).toBeNull();
      expect(
        await store.getConnectionById({ authorId: 'u2', providerId: 'composio', connectionId: 'ca_1' }),
      ).not.toBeNull();
    });
  });

  describe('dangerouslyClearAll', () => {
    it('clears every row', async () => {
      await store.upsertConnection({
        authorId: 'u1',
        providerId: 'composio',
        toolkit: 'gmail',
        connectionId: 'ca_1',
        label: 'Work',
      });
      await store.upsertConnection({
        authorId: 'u2',
        providerId: 'composio',
        toolkit: 'slack',
        connectionId: 'ca_2',
        label: 'Team',
      });

      await store.dangerouslyClearAll();

      expect(await store.listConnectionsByAuthor({ authorId: 'u1' })).toEqual([]);
      expect(await store.listConnectionsByAuthor({ authorId: 'u2' })).toEqual([]);
    });
  });
});
