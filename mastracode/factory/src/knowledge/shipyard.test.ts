import { InMemoryStore } from '@mastra/core/storage';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import type { KnowledgeAccessProfileResolver, KnowledgeSearchPayload } from '../routes/knowledge.js';
import { KnowledgeRoutes } from '../routes/knowledge.js';
import { fakeRouteAuth, mountApiRoutes } from '../routes/test-utils.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { registerShipyardMaintenanceImporter, shipyardImportBinding } from './shipyard-importer.js';
import { createShipyardKnowledge, createShipyardAccessProfile } from './shipyard.js';

describe('Shipyard-shaped Knowledge configuration', () => {
  it('maps only authenticated host identities to explicit grants and fails closed without configuration', async () => {
    expect(() => createShipyardAccessProfile({ organizationId: '', maintainerIds: ['owner'] })).toThrow();
    expect(() => createShipyardAccessProfile({ organizationId: 'org', maintainerIds: [] })).toThrow();
    const profile = createShipyardAccessProfile({ organizationId: 'org', maintainerIds: ['owner'] });
    const compatible: KnowledgeAccessProfileResolver = profile;
    expect(compatible).toBe(profile);
    expect(await profile({ orgId: 'other-org', userId: 'owner' })).toBeUndefined();
    expect(await profile({ orgId: 'org', userId: '' })).toBeUndefined();
    expect(await profile({ orgId: 'org', userId: ' \t\n' })).toBeUndefined();
    expect(await profile({ orgId: 'org', userId: 'owner' })).toMatchObject({
      rootScopeAddress: 'org:mastra',
      vouchedScopeAddresses: ['principal:shipyard-maintainer'],
    });
    const reader = await profile({ orgId: 'org', userId: 'reader' });
    expect(reader).toMatchObject({
      rootScopeAddress: 'repo:mastra',
      vouchedScopeAddresses: ['principal:shipyard-public'],
    });
  });
  it('integrates verified revisions without duplicates and leaves the watermark unchanged on failed verification', async () => {
    const { knowledge, scopes } = await createShipyardKnowledge(new InMemoryStore());
    let revision = 'one';
    let verified = true;
    const observedWatermarks: (string | undefined)[] = [];
    const importer = registerShipyardMaintenanceImporter(knowledge, {
      readWindow: async watermark => {
        observedWatermarks.push(watermark);
        return {
          watermark: revision,
          entries: [
            {
              address: 'knowledge:curator',
              name: 'Curator behavior',
              revision,
              text: `Verified behavior ${revision}`,
              citation: 'https://github.com/mastra-ai/mastra/pull/22850',
            },
          ],
        };
      },
      verify: async () => verified,
    });
    expect(await importer.run(shipyardImportBinding)).toMatchObject({ status: 'succeeded' });
    expect(await importer.run(shipyardImportBinding)).toMatchObject({ status: 'succeeded' });
    const query = {
      source: shipyardImportBinding.source,
      scopeIds: [scopes['principal:shipyard-maintainer']!],
      limit: 100,
    };
    const before = await knowledge.listRecordsBySource(query);
    expect(before.records).toHaveLength(1);
    revision = 'two';
    verified = false;
    expect(await importer.run(shipyardImportBinding)).toMatchObject({ status: 'failed' });
    expect(await knowledge.listRecordsBySource(query)).toEqual(before);
    verified = true;
    expect(await importer.run(shipyardImportBinding)).toMatchObject({ status: 'succeeded' });
    const after = await knowledge.listRecordsBySource(query);
    expect(after.records).toHaveLength(1);
    expect(after.records[0]).toMatchObject({ nodeId: before.records[0]!.nodeId, text: 'Verified behavior two' });
    expect(observedWatermarks).toEqual([undefined, 'one', 'one', 'one']);
    expect(
      await knowledge.listRecordsBySource({ ...query, scopeIds: [scopes['principal:shipyard-public']!] }),
    ).toMatchObject({ records: [] });
  });

  it('covers repository, platform and infrastructure scopes without exposing internal scopes', async () => {
    const { knowledge, scopes } = await createShipyardKnowledge(new InMemoryStore());
    const maintainer = [scopes['principal:shipyard-maintainer']!];
    const publicReader = [scopes['principal:shipyard-public']!];
    expect(await knowledge.getScope({ id: scopes['org:mastra']!, scopeIds: maintainer })).toMatchObject({
      id: scopes['org:mastra'],
    });
    expect(await knowledge.getScope({ id: scopes['org:mastra']!, scopeIds: publicReader })).toBeNull();
    for (const address of ['repo:mastra', 'feature:platform', 'feature:infrastructure']) {
      const scopeId = scopes[address]!;
      expect(await knowledge.getScope({ id: scopeId, scopeIds: maintainer })).toMatchObject({ id: scopeId });
      const node = await knowledge.createNode({
        name: `${address} evidence`,
        scopeIds: [scopeId],
        vouchedScopeIds: maintainer,
      });
      if (address === 'repo:mastra') {
        expect(await knowledge.getNode({ id: node.id, scopeIds: publicReader })).toMatchObject({ id: node.id });
      } else {
        expect(await knowledge.getNode({ id: node.id, scopeIds: publicReader })).toBeNull();
      }
    }
  });

  it('reconciles stable feature-first scopes and keeps internal provenance out of public reads', async () => {
    const provider = new InMemoryStore();
    const { knowledge, scopes } = await createShipyardKnowledge(provider);
    const maintainer = [scopes['principal:shipyard-maintainer']!];
    const publicReader = [scopes['principal:shipyard-public']!];
    const publicNode = await knowledge.createNode({
      name: 'Public release behavior',
      scopeIds: [scopes['feature:knowledge:public']!],
      vouchedScopeIds: maintainer,
    });
    const privateNode = await knowledge.createNode({
      name: 'Internal deployment evidence',
      scopeIds: [scopes['feature:knowledge:internal']!],
      vouchedScopeIds: maintainer,
    });
    expect(await knowledge.getNode({ id: publicNode.id, scopeIds: publicReader })).toMatchObject({ id: publicNode.id });
    expect(await knowledge.getNode({ id: privateNode.id, scopeIds: publicReader })).toBeNull();
    expect(await knowledge.getNode({ id: privateNode.id, scopeIds: maintainer })).toMatchObject({ id: privateNode.id });

    const reopened = await createShipyardKnowledge(provider);
    expect(reopened.scopes).toEqual(scopes);
    expect(await reopened.knowledge.getNode({ id: privateNode.id, scopeIds: maintainer })).toMatchObject({
      id: privateNode.id,
    });
  });

  it('serves Factory Knowledge routes through the Shipyard profile without exposing maintainer-only scopes', async () => {
    const seed = await createFactoryStorageForTests();
    const project = await seed.projects.create({ orgId: 'org', userId: 'owner', input: { name: 'Shipyard' } });
    const { knowledge, scopes } = await createShipyardKnowledge(new InMemoryStore());
    const store = await knowledge.getStorageInternal();
    await store.createNode({ name: 'Heron repo note', kind: 'note', scopeIds: [scopes['repo:mastra']!] });
    await store.createNode({ name: 'Heron platform secret', kind: 'note', scopeIds: [scopes['feature:platform']!] });
    const routes = new KnowledgeRoutes({
      auth: fakeRouteAuth({}),
      projects: seed.projects,
      knowledge: async () => knowledge,
      accessProfile: createShipyardAccessProfile({ organizationId: 'org', maintainerIds: ['owner'] }),
    }).routes();
    const request = async (userId: string, organizationId: string) => {
      const app = new Hono();
      app.use('*', async (context, next) => {
        context.set('factoryAuthUser' as never, { workosId: userId, organizationId } as never);
        await next();
      });
      mountApiRoutes(app as never, routes);
      return app.request(`/web/factory/projects/${project.id}/knowledge/search?q=Heron`);
    };
    const names = async (response: Response) => {
      expect(response.status).toBe(200);
      return ((await response.json()) as KnowledgeSearchPayload).results.map(result => result.name).toSorted();
    };

    expect(await names(await request('owner', 'org'))).toEqual(['Heron platform secret', 'Heron repo note']);
    expect(await names(await request('reader', 'org'))).toEqual(['Heron repo note']);
  });
});
