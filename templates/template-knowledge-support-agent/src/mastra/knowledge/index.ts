import { Knowledge, knowledgeMemoryScopes, type KnowledgeStorage } from '@mastra/core/knowledge';
import { supportConfiguration } from '../../examples/support.ts';
import { MastraCompositeStore } from '@mastra/core/storage';
import { KnowledgePG, type DbClient } from '@mastra/pg';
import { withoutMarkdownCode } from './seed-manifest.ts';

class SupportKnowledge extends Knowledge {
  override async reindexLinks() {
    const storage = await this.getStorage();
    const indexing = new Knowledge({ id: 'support-link-index', scopes: {} });
    // Only the native indexer sees the projection. Keep stored page bodies and normal reads intact.
    const project = <T extends Awaited<ReturnType<KnowledgeStorage['listPages']>>>(result: T): T => ({
      ...result,
      pages: result.pages.map(page => ({ ...page, body: page.body && withoutMarkdownCode(page.body) })),
    });
    indexing.getStorage = async () =>
      new Proxy(storage, {
        get(target, property) {
          if (property === 'listPages')
            return async (input: Parameters<KnowledgeStorage['listPages']>[0]) =>
              project(await target.listPages(input));
          if (property === 'listChildScopes')
            return async (input: Parameters<KnowledgeStorage['listChildScopes']>[0]) =>
              project(await target.listChildScopes(input));
          const value = Reflect.get(target, property, target);
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
    return indexing.reindexLinks();
  }
}

export function createKnowledge(storage: MastraCompositeStore) {
  const memoryScopes = knowledgeMemoryScopes({ org: 'tenant:$tenantId' });
  const viewer = [{ principal: 'self', role: 'viewer' }] as const;
  return new SupportKnowledge({
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
    // The native renderer can split this budget evenly between both configured pins.
    // Leave room for the 800-character policy, including its name and scoped reference.
    pinnedContext: { maxPins: 2, maxTokens: 4000 },
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
