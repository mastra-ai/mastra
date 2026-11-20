import { Knowledge, knowledgeMemoryScopes } from '@mastra/core/knowledge';
import { supportConfiguration } from '../../examples/support.ts';
import { MastraCompositeStore } from '@mastra/core/storage';
import { KnowledgePG, type DbClient } from '@mastra/pg';

export function createKnowledge(storage: MastraCompositeStore) {
  const memoryScopes = knowledgeMemoryScopes({ org: 'tenant:$tenantId' });
  const viewer = [{ principal: 'self', role: 'viewer' }] as const;
  return new Knowledge({
    id: 'support',
    storage,
    scopes: {
      'resource:$resourceId': { ...memoryScopes['resource:$resourceId'], access: [...viewer] },
      'thread:$threadId': { ...memoryScopes['thread:$threadId'], access: [...viewer] },
      'tenant:$tenantId': {
        access: [...viewer],
        pinnedContext: [
          `${supportConfiguration.policy.kind}:$tenantId#${supportConfiguration.policy.path}`,
          supportConfiguration.optionalListing,
        ],
      },
      'docs:$tenantId': { belongsTo: 'tenant:$tenantId', access: [{ principal: 'tenant:$tenantId', role: 'viewer' }] },
      'customer:$tenantId:$customerId': { belongsTo: 'tenant:$tenantId', access: [...viewer] },
    },
    tools: { read: true, write: false },
    pinnedContext: { maxPins: 2, maxTokens: 500 },
  });
}

export function createPostgresWriterKnowledge(client: DbClient, initialize = false) {
  const storage = new MastraCompositeStore({
    id: 'support-writer',
    disableInit: !initialize,
    domains: { knowledge: new KnowledgePG({ client, schemaName: 'public', storageIsolationKey: client }) },
  });
  return createKnowledge(storage);
}
