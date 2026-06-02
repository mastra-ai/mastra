import type { MastraStorage, ToolProviderConnectionsStorage } from '@mastra/core/storage';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createSampleConnection } from './data';

export function createToolProviderConnectionsTests({ storage }: { storage: MastraStorage }) {
  const describeTPC = storage.stores?.toolProviderConnections ? describe : describe.skip;

  let tpcStorage: ToolProviderConnectionsStorage;

  describeTPC('Tool Provider Connections Storage', () => {
    beforeAll(async () => {
      const tpc = await storage.getStore('toolProviderConnections');
      if (!tpc) throw new Error('Tool provider connections storage not found');
      tpcStorage = tpc;
    });

    beforeEach(async () => {
      await tpcStorage.dangerouslyClearAll();
    });

    describe('upsertConnection + getConnectionById', () => {
      it('inserts a new connection and retrieves it', async () => {
        const input = createSampleConnection({
          authorId: 'user1',
          providerId: 'composio',
          toolkit: 'gmail',
          connectionId: 'conn_1',
          label: 'Work Email',
        });

        const created = await tpcStorage.upsertConnection(input);
        expect(created.authorId).toBe('user1');
        expect(created.providerId).toBe('composio');
        expect(created.toolkit).toBe('gmail');
        expect(created.connectionId).toBe('conn_1');
        expect(created.label).toBe('Work Email');
        expect(created.scope).toBe('per-author');
        expect(created.createdAt).toBeInstanceOf(Date);
        expect(created.updatedAt).toBeInstanceOf(Date);

        const fetched = await tpcStorage.getConnectionById({
          authorId: 'user1',
          providerId: 'composio',
          connectionId: 'conn_1',
        });
        expect(fetched).not.toBeNull();
        expect(fetched!.authorId).toBe('user1');
        expect(fetched!.label).toBe('Work Email');
      });

      it('returns null for non-existent connection', async () => {
        const fetched = await tpcStorage.getConnectionById({
          authorId: 'missing',
          providerId: 'missing',
          connectionId: 'missing',
        });
        expect(fetched).toBeNull();
      });

      it('updates label on second upsert and preserves createdAt', async () => {
        const first = await tpcStorage.upsertConnection(
          createSampleConnection({
            authorId: 'user1',
            providerId: 'composio',
            connectionId: 'conn_1',
            label: 'First Label',
          }),
        );

        await new Promise(resolve => setTimeout(resolve, 10));

        const second = await tpcStorage.upsertConnection(
          createSampleConnection({
            authorId: 'user1',
            providerId: 'composio',
            connectionId: 'conn_1',
            label: 'Updated Label',
          }),
        );

        expect(second.label).toBe('Updated Label');
        expect(second.createdAt.toISOString()).toBe(first.createdAt.toISOString());
        expect(second.updatedAt.getTime()).toBeGreaterThanOrEqual(first.updatedAt.getTime());
      });

      it('stores label as null when not provided', async () => {
        const input = createSampleConnection({
          authorId: 'user1',
          providerId: 'composio',
          connectionId: 'conn_1',
          label: null,
        });

        const created = await tpcStorage.upsertConnection(input);
        expect(created.label).toBeNull();

        const fetched = await tpcStorage.getConnectionById({
          authorId: 'user1',
          providerId: 'composio',
          connectionId: 'conn_1',
        });
        expect(fetched!.label).toBeNull();
      });
    });

    describe('listConnectionsByAuthor', () => {
      it('lists connections for a specific author', async () => {
        await tpcStorage.upsertConnection(createSampleConnection({ authorId: 'user1', connectionId: 'c1' }));
        await tpcStorage.upsertConnection(createSampleConnection({ authorId: 'user1', connectionId: 'c2' }));
        await tpcStorage.upsertConnection(createSampleConnection({ authorId: 'user2', connectionId: 'c3' }));

        const user1Connections = await tpcStorage.listConnectionsByAuthor({ authorId: 'user1' });
        expect(user1Connections).toHaveLength(2);
        expect(user1Connections.map(c => c.connectionId).sort()).toEqual(['c1', 'c2']);

        const user2Connections = await tpcStorage.listConnectionsByAuthor({ authorId: 'user2' });
        expect(user2Connections).toHaveLength(1);
        expect(user2Connections[0]!.connectionId).toBe('c3');
      });

      it('filters by providerId', async () => {
        await tpcStorage.upsertConnection(
          createSampleConnection({ authorId: 'user1', providerId: 'composio', connectionId: 'c1' }),
        );
        await tpcStorage.upsertConnection(
          createSampleConnection({ authorId: 'user1', providerId: 'zapier', connectionId: 'c2' }),
        );

        const composioOnly = await tpcStorage.listConnectionsByAuthor({
          authorId: 'user1',
          providerId: 'composio',
        });
        expect(composioOnly).toHaveLength(1);
        expect(composioOnly[0]!.providerId).toBe('composio');
      });

      it('filters by toolkit', async () => {
        await tpcStorage.upsertConnection(
          createSampleConnection({ authorId: 'user1', toolkit: 'gmail', connectionId: 'c1' }),
        );
        await tpcStorage.upsertConnection(
          createSampleConnection({ authorId: 'user1', toolkit: 'sheets', connectionId: 'c2' }),
        );

        const gmailOnly = await tpcStorage.listConnectionsByAuthor({
          authorId: 'user1',
          toolkit: 'gmail',
        });
        expect(gmailOnly).toHaveLength(1);
        expect(gmailOnly[0]!.toolkit).toBe('gmail');
      });

      it('returns empty array when no connections match', async () => {
        const connections = await tpcStorage.listConnectionsByAuthor({ authorId: 'nobody' });
        expect(connections).toEqual([]);
      });
    });

    describe('deleteConnection', () => {
      it('deletes a connection', async () => {
        await tpcStorage.upsertConnection(
          createSampleConnection({
            authorId: 'user1',
            providerId: 'composio',
            connectionId: 'conn_1',
          }),
        );

        await tpcStorage.deleteConnection({
          authorId: 'user1',
          providerId: 'composio',
          connectionId: 'conn_1',
        });

        const fetched = await tpcStorage.getConnectionById({
          authorId: 'user1',
          providerId: 'composio',
          connectionId: 'conn_1',
        });
        expect(fetched).toBeNull();
      });

      it('is idempotent (does not throw when deleting non-existent)', async () => {
        await expect(
          tpcStorage.deleteConnection({
            authorId: 'missing',
            providerId: 'missing',
            connectionId: 'missing',
          }),
        ).resolves.not.toThrow();
      });
    });

    describe('scope field', () => {
      it('defaults to per-author when scope is not provided', async () => {
        const input = createSampleConnection({
          authorId: 'user1',
          providerId: 'composio',
          connectionId: 'conn_1',
          label: 'Test',
        });
        delete input.scope;

        const created = await tpcStorage.upsertConnection(input);
        expect(created.scope).toBe('per-author');
      });

      it('respects explicitly provided scope', async () => {
        const input = createSampleConnection({
          authorId: 'user1',
          providerId: 'composio',
          connectionId: 'conn_1',
          scope: 'shared',
        });

        const created = await tpcStorage.upsertConnection(input);
        expect(created.scope).toBe('shared');
      });

      it('filters by scope in listConnectionsByAuthor', async () => {
        await tpcStorage.upsertConnection(
          createSampleConnection({ authorId: 'user1', connectionId: 'c1', scope: 'per-author' }),
        );
        await tpcStorage.upsertConnection(
          createSampleConnection({ authorId: 'user1', connectionId: 'c2', scope: 'shared' }),
        );

        const sharedOnly = await tpcStorage.listConnectionsByAuthor({
          authorId: 'user1',
          scope: 'shared',
        });
        expect(sharedOnly).toHaveLength(1);
        expect(sharedOnly[0]!.scope).toBe('shared');
      });
    });

    describe('dangerouslyClearAll', () => {
      it('removes all connections', async () => {
        await tpcStorage.upsertConnection(createSampleConnection({ connectionId: 'c1' }));
        await tpcStorage.upsertConnection(createSampleConnection({ connectionId: 'c2' }));

        await tpcStorage.dangerouslyClearAll();

        const remaining = await tpcStorage.listConnectionsByAuthor({});
        expect(remaining).toEqual([]);
      });
    });
  });
}
