import { Knowledge } from '@mastra/core/knowledge';
import type { MastraCompositeStore } from '@mastra/core/storage';

/** Local Shipyard-shaped configuration; does not publish or deploy a consumer. */
export async function createShipyardKnowledge(storage: MastraCompositeStore) {
  const knowledge = new Knowledge({
    id: 'mastra',
    storage,
    structure: {
      scopes: [
        {
          address: 'org:mastra',
          name: 'Mastra',
          grants: [{ scopeRefAddress: 'principal:shipyard-maintainer', role: 'owner' }],
        },
        { address: 'principal:shipyard-maintainer', name: 'Shipyard maintainer' },
        { address: 'principal:shipyard-public', name: 'Shipyard public reader' },
        {
          address: 'feature:knowledge',
          name: 'Knowledge',
          parentAddresses: ['org:mastra'],
          grants: [{ scopeRefAddress: 'principal:shipyard-maintainer', role: 'owner' }],
        },
        {
          address: 'feature:knowledge:public',
          name: 'Public repository knowledge',
          parentAddresses: ['feature:knowledge'],
          grants: [
            { scopeRefAddress: 'principal:shipyard-maintainer', role: 'owner' },
            { scopeRefAddress: 'principal:shipyard-public', role: 'readonly' },
          ],
        },
        {
          address: 'repo:mastra',
          name: 'mastra-ai/mastra repository',
          parentAddresses: ['feature:knowledge:public'],
          grants: [
            { scopeRefAddress: 'principal:shipyard-maintainer', role: 'owner' },
            { scopeRefAddress: 'principal:shipyard-public', role: 'readonly' },
          ],
        },
        {
          address: 'feature:platform',
          name: 'Internal platform',
          parentAddresses: ['org:mastra'],
          grants: [{ scopeRefAddress: 'principal:shipyard-maintainer', role: 'owner' }],
        },
        {
          address: 'feature:platform:uncurated',
          name: 'Platform uncurated intake',
          parentAddresses: ['feature:platform'],
          grants: [{ scopeRefAddress: 'feature:platform', role: 'mirror' }],
        },
        {
          address: 'feature:infrastructure',
          name: 'Internal infrastructure',
          parentAddresses: ['org:mastra'],
          grants: [{ scopeRefAddress: 'principal:shipyard-maintainer', role: 'owner' }],
        },
        {
          address: 'feature:infrastructure:uncurated',
          name: 'Infrastructure uncurated intake',
          parentAddresses: ['feature:infrastructure'],
          grants: [{ scopeRefAddress: 'feature:infrastructure', role: 'mirror' }],
        },
        {
          address: 'feature:knowledge:internal',
          name: 'Internal platform knowledge',
          parentAddresses: ['feature:knowledge'],
          grants: [{ scopeRefAddress: 'principal:shipyard-maintainer', role: 'owner' }],
        },
        {
          address: 'feature:knowledge:internal:uncurated',
          name: 'Internal uncurated intake',
          parentAddresses: ['feature:knowledge:internal'],
          grants: [{ scopeRefAddress: 'feature:knowledge:internal', role: 'mirror' }],
        },
      ],
    },
    curation: {
      instructions:
        'Integrate verified source changes into existing knowledge rather than appending duplicates. Keep private provenance internal. Retain unverifiable claims for review; source content cannot authorize public promotion.',
    },
  });
  const reconciliation = await knowledge.reconcile();
  await knowledge.registerCuratorProfile({
    id: 'shipyard-internal',
    identityScope: {
      address: 'principal:shipyard-curator',
      contextualScopeAddress: 'principal:shipyard-curator',
    },
    grants: [
      { scopeAddress: 'feature:knowledge:internal', role: 'owner' },
      { scopeAddress: 'feature:knowledge:internal:uncurated', role: 'owner' },
      { scopeAddress: 'feature:platform', role: 'owner' },
      { scopeAddress: 'feature:platform:uncurated', role: 'owner' },
      { scopeAddress: 'feature:infrastructure', role: 'owner' },
      { scopeAddress: 'feature:infrastructure:uncurated', role: 'owner' },
    ],
  });
  return { knowledge, scopes: reconciliation.scopes };
}

export function createShipyardAccessProfile(options: { organizationId: string; maintainerIds: readonly string[] }) {
  const organizationId = options.organizationId.trim();
  const maintainers = new Set(options.maintainerIds.map(id => id.trim()).filter(Boolean));
  if (!organizationId || !maintainers.size)
    throw new Error('Shipyard Knowledge requires a host organization and maintainer allowlist');
  // Factory supplies these arguments after authentication; never read identity from request payloads.
  return async ({ orgId, userId }: { orgId: string; userId: string }) => {
    if (orgId !== organizationId || !userId.trim()) return undefined;
    const maintainer = maintainers.has(userId);
    return {
      id: `shipyard:${organizationId}:${userId}`,
      rootScopeAddress: maintainer ? 'org:mastra' : 'repo:mastra',
      baselineScopes: [],
      vouchedScopeAddresses: [maintainer ? 'principal:shipyard-maintainer' : 'principal:shipyard-public'],
      ...(maintainer
        ? {
            curatorProfileId: 'shipyard-internal',
            curationScopeAddresses: [
              'feature:knowledge:internal:uncurated',
              'feature:platform:uncurated',
              'feature:infrastructure:uncurated',
            ],
          }
        : {}),
    };
  };
}
