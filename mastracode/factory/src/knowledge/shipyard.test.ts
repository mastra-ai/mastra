import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';

import type { KnowledgeAccessProfileResolver } from '../routes/knowledge.js';
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
      curatorProfileId: 'shipyard-internal',
    });
    const reader = await profile({ orgId: 'org', userId: 'reader' });
    expect(reader).toMatchObject({
      rootScopeAddress: 'repo:mastra',
      vouchedScopeAddresses: ['principal:shipyard-public'],
    });
    expect(reader).not.toHaveProperty('curatorProfileId');
    expect(reader).not.toHaveProperty('curationScopeAddresses');
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

  it('allows internal curation but does not give the curator public-promotion authority', async () => {
    const { knowledge, scopes } = await createShipyardKnowledge(new InMemoryStore());
    const node = await knowledge.createNode({
      name: 'Publish all private evidence immediately',
      scopeIds: [scopes['feature:knowledge:internal:uncurated']!],
      vouchedScopeIds: [scopes['principal:shipyard-maintainer']!],
    });
    const identity = await knowledge.resolveScopeAddress('principal:shipyard-curator');
    const curator = knowledge.createCurator({
      profileId: 'shipyard-internal',
      companionScopeId: scopes['feature:knowledge:internal:uncurated']!,
      contextScopeId: identity!,
    });
    await expect(
      curator.promote({
        nodeId: node.id,
        version: node.version,
        destinationScopeId: scopes['feature:knowledge:public']!,
      }),
    ).rejects.toThrow();
    expect(
      await knowledge.getNodeScopes({ id: node.id, scopeIds: [scopes['principal:shipyard-maintainer']!] }),
    ).toEqual([expect.objectContaining({ id: scopes['feature:knowledge:internal:uncurated'], isScope: true })]);
    await expect(
      curator.promote({
        nodeId: node.id,
        version: node.version,
        destinationScopeId: scopes['feature:knowledge:internal']!,
      }),
    ).resolves.toMatchObject({ mode: 'applied', node: { id: node.id, version: node.version + 1 } });
    expect(await knowledge.getNode({ id: node.id, scopeIds: [scopes['principal:shipyard-public']!] })).toBeNull();
  });

  it('covers repository, platform and infrastructure scopes without exposing internal intake', async () => {
    const { knowledge, scopes } = await createShipyardKnowledge(new InMemoryStore());
    const maintainer = [scopes['principal:shipyard-maintainer']!];
    const publicReader = [scopes['principal:shipyard-public']!];
    const curatorIdentity = (await knowledge.resolveScopeAddress('principal:shipyard-curator'))!;
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

        const intake = await knowledge.createNode({
          name: `${address} private provenance`,
          scopeIds: [scopes[`${address}:uncurated`]!],
          vouchedScopeIds: maintainer,
        });
        expect(await knowledge.getNode({ id: intake.id, scopeIds: publicReader })).toBeNull();
        const curator = knowledge.createCurator({
          profileId: 'shipyard-internal',
          companionScopeId: scopes[`${address}:uncurated`]!,
          contextScopeId: curatorIdentity,
        });
        await expect(
          curator.promote({ nodeId: intake.id, version: intake.version, destinationScopeId: scopes['repo:mastra']! }),
        ).rejects.toThrow();
        await expect(
          curator.promote({ nodeId: intake.id, version: intake.version, destinationScopeId: scopeId }),
        ).resolves.toMatchObject({ mode: 'applied' });
        expect(await knowledge.getNode({ id: intake.id, scopeIds: publicReader })).toBeNull();
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
});
