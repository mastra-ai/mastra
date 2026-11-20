import { Knowledge, knowledgeMemoryScopes } from '@mastra/core/knowledge';
import type { MastraCompositeStore } from '@mastra/core/storage';

export function createKnowledge(storage: MastraCompositeStore) {
  const memoryScopes = knowledgeMemoryScopes({ org: 'tenant:$tenantId' });
  const viewer = [{ principal: 'self', role: 'viewer' }] as const;
  return new Knowledge({
    id: 'support',
    storage,
    scopes: {
      'resource:$resourceId': { ...memoryScopes['resource:$resourceId'], access: [...viewer] },
      'thread:$threadId': { ...memoryScopes['thread:$threadId'], access: [...viewer] },
      'tenant:$tenantId': { access: [...viewer] },
      'docs:$tenantId': { belongsTo: 'tenant:$tenantId', access: [{ principal: 'tenant:$tenantId', role: 'viewer' }] },
      'customer:$tenantId:$customerId': { belongsTo: 'tenant:$tenantId', access: [...viewer] },
    },
    tools: { read: true, write: false },
  });
}
