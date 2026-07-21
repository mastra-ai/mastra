import { LibSQLFactoryStorage } from '@mastra/libsql';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { IntegrationStorage } from './base';
import type { IntegrationStorageHandle } from './base';

interface TestConnection {
  accessToken: string;
  refreshToken: string | null;
  expiresAtMs: number | null;
}

describe('IntegrationStorage', () => {
  let backend: LibSQLFactoryStorage;
  let domain: IntegrationStorage;
  let store: IntegrationStorageHandle<TestConnection, { projectIds: string[] }, { note: string }>;

  beforeEach(async () => {
    backend = new LibSQLFactoryStorage({ id: 'integrations-test', url: ':memory:' });
    domain = backend.registerDomain(new IntegrationStorage());
    await backend.init();
    store = domain.forIntegration('incidentio');
  });

  afterEach(async () => {
    await backend.close();
  });

  it('throws before init', async () => {
    const fresh = new IntegrationStorage();
    await expect(fresh.forIntegration('x').connections.get('org-1')).rejects.toThrow(/has not been registered/);
  });

  describe('connections', () => {
    it('upserts one connection per org, preserving created_at on update', async () => {
      await store.connections.upsert('org-1', {
        userId: 'user-1',
        data: { accessToken: 'tok-1', refreshToken: null, expiresAtMs: null },
      });
      const first = await store.connections.get('org-1');
      expect(first).not.toBeNull();
      expect(first!.userId).toBe('user-1');
      expect(first!.data.accessToken).toBe('tok-1');

      await store.connections.upsert('org-1', {
        userId: 'user-2',
        data: { accessToken: 'tok-2', refreshToken: 'ref', expiresAtMs: 123 },
      });
      const second = await store.connections.get('org-1');
      expect(second!.id).toBe(first!.id);
      expect(second!.userId).toBe('user-2');
      expect(second!.data).toEqual({ accessToken: 'tok-2', refreshToken: 'ref', expiresAtMs: 123 });
      expect(second!.createdAt.getTime()).toBe(first!.createdAt.getTime());
    });

    it('scopes by integration and org', async () => {
      await store.connections.upsert('org-1', { data: { accessToken: 'a', refreshToken: null, expiresAtMs: null } });
      const other = domain.forIntegration<TestConnection>('linear');
      expect(await other.connections.get('org-1')).toBeNull();
      expect(await store.connections.get('org-2')).toBeNull();
    });

    it('updates data atomically and returns null for missing connections', async () => {
      expect(await store.connections.update('org-1', d => d)).toBeNull();
      await store.connections.upsert('org-1', {
        data: { accessToken: 'old', refreshToken: 'r1', expiresAtMs: null },
      });
      const updated = await store.connections.update('org-1', data => ({ ...data, accessToken: 'new' }));
      expect(updated!.data).toEqual({ accessToken: 'new', refreshToken: 'r1', expiresAtMs: null });
      expect((await store.connections.get('org-1'))!.data.accessToken).toBe('new');
    });

    it('deletes only the scoped connection', async () => {
      await store.connections.upsert('org-1', { data: { accessToken: 'a', refreshToken: null, expiresAtMs: null } });
      const other = domain.forIntegration<TestConnection>('linear');
      await other.connections.upsert('org-1', { data: { accessToken: 'b', refreshToken: null, expiresAtMs: null } });
      expect(await store.connections.delete('org-1')).toBe(true);
      expect(await store.connections.delete('org-1')).toBe(false);
      expect(await other.connections.get('org-1')).not.toBeNull();
    });
  });

  describe('subscriptions', () => {
    it('creates and lists by target key in creation order', async () => {
      const a = await store.subscriptions.create({
        orgId: 'org-1',
        targetKey: 'incident:1',
        sessionId: 'sess-1',
        threadId: 'thread-1',
        data: { note: 'first' },
      });
      await store.subscriptions.create({ orgId: 'org-1', targetKey: 'incident:2', sessionId: 'sess-1' });
      await store.subscriptions.create({ orgId: 'org-2', targetKey: 'incident:1', status: 'paused' });

      expect(a.status).toBe('active');
      const byTarget = await store.subscriptions.listByTarget('incident:1');
      expect(byTarget.map(s => s.orgId)).toEqual(['org-1', 'org-2']);
      const activeOnly = await store.subscriptions.listByTarget('incident:1', { status: 'active' });
      expect(activeOnly).toHaveLength(1);
      expect(activeOnly[0]!.data).toEqual({ note: 'first' });

      const bySession = await store.subscriptions.listBySession('sess-1');
      expect(bySession.map(s => s.targetKey)).toEqual(['incident:1', 'incident:2']);
    });

    it('is scoped per integration', async () => {
      await store.subscriptions.create({ orgId: 'org-1', targetKey: 'incident:1' });
      const other = domain.forIntegration('linear');
      expect(await other.subscriptions.listByTarget('incident:1')).toEqual([]);
    });

    it('updates status and deletes by id and by org-scoped where', async () => {
      const sub = await store.subscriptions.create({ orgId: 'org-1', targetKey: 'incident:1', sessionId: 'sess-1' });
      await store.subscriptions.updateStatus(sub.id, 'paused');
      const [row] = await store.subscriptions.listByTarget('incident:1');
      expect(row!.status).toBe('paused');

      expect(await store.subscriptions.delete(sub.id)).toBe(true);
      expect(await store.subscriptions.delete(sub.id)).toBe(false);

      await store.subscriptions.create({ orgId: 'org-1', targetKey: 'incident:2', sessionId: 'sess-2' });
      await store.subscriptions.create({ orgId: 'org-1', targetKey: 'incident:3', sessionId: 'sess-2' });
      expect(await store.subscriptions.deleteWhere({ orgId: 'org-1', sessionId: 'sess-2' })).toBe(2);
    });
  });

  describe('settings', () => {
    it('returns null before save and round-trips per (org, user)', async () => {
      expect(await store.settings.get('org-1', 'user-1')).toBeNull();
      await store.settings.save('org-1', 'user-1', { projectIds: ['p1'] });
      await store.settings.save('org-1', 'user-2', { projectIds: ['p2'] });
      expect(await store.settings.get('org-1', 'user-1')).toEqual({ projectIds: ['p1'] });
      expect(await store.settings.get('org-1', 'user-2')).toEqual({ projectIds: ['p2'] });

      await store.settings.save('org-1', 'user-1', { projectIds: ['p1', 'p3'] });
      expect(await store.settings.get('org-1', 'user-1')).toEqual({ projectIds: ['p1', 'p3'] });
    });

    it('is scoped per integration', async () => {
      await store.settings.save('org-1', 'user-1', { projectIds: ['p1'] });
      expect(await domain.forIntegration('linear').settings.get('org-1', 'user-1')).toBeNull();
    });
  });
});
