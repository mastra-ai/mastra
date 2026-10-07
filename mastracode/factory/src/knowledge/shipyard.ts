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
          address: 'feature:infrastructure',
          name: 'Internal infrastructure',
          parentAddresses: ['org:mastra'],
          grants: [{ scopeRefAddress: 'principal:shipyard-maintainer', role: 'owner' }],
        },
        {
          address: 'feature:knowledge:internal',
          name: 'Internal platform knowledge',
          parentAddresses: ['feature:knowledge'],
          grants: [{ scopeRefAddress: 'principal:shipyard-maintainer', role: 'owner' }],
        },
      ],
    },
  });
  const reconciliation = await knowledge.reconcile();
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
      importOperator: maintainer,
    };
  };
}
