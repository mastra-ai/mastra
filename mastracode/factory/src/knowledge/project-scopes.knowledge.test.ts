import { resolveKnowledgeScopeIdentity } from '@mastra/code-sdk/knowledge-scope';
import type { ImporterScopesContext } from '@mastra/connect';
import { Knowledge } from '@mastra/core/knowledge';
import { InMemoryStore } from '@mastra/core/storage';
import type { FactoryStorage } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';

import { factoryProjectScopes } from './project-scopes.js';

type MastraCodeState = Parameters<typeof resolveKnowledgeScopeIdentity>[0];

/**
 * End-to-end on a real Wave 2 Knowledge: the scope a connection's importer is bound to must be
 * readable by the Factory sessions of that project, and by nobody else's.
 */

const ORG = 'org-1';
const projects = [
  { id: 'p1', orgId: ORG, name: 'Payments' },
  { id: 'p2', orgId: ORG, name: 'Search' },
];

function factoryStorage(): FactoryStorage {
  const domain = { ensureReady: async () => {}, listAll: async () => projects };
  return {
    hasDomain: (name: string) => name === 'projects',
    getDomain: (name: string) => {
      if (name === 'projects') return domain;
      throw new Error(`unexpected domain ${name}`);
    },
  } as unknown as FactoryStorage;
}

const connections = {
  notion: { id: 'conn-notion', integrationId: 'notion', accountLabel: 'Acme' },
  linear: { id: 'conn-linear', integrationId: 'linear', accountLabel: 'Acme' },
};

function scopesContext(connection: (typeof connections)[keyof typeof connections]): ImporterScopesContext {
  return { connection, provider: connection.integrationId } as unknown as ImporterScopesContext;
}

/** Per-source content the fake providers return; mutate to simulate a re-sync. */
const upstream: Record<string, Array<{ address: string; name: string; text: string }>> = {};

const synced: Record<string, string[]> = {};
const bindings: Record<string, Array<{ source: string; scope: string }>> = {};

async function createKnowledge() {
  for (const state of [synced, bindings, upstream]) for (const key of Object.keys(state)) delete state[key];
  const importer = (id: string, source: string) => ({
    id,
    access: { 'project:$projectId': 'owner' as const },
    // Factory's shape: a cron trigger whose bindings come from the project-scopes resolver.
    triggers: { cron: { schedule: '0 0 1 1 *', resolveBindings: async () => bindings[source] ?? [] } },
    handler: async (ctx: { importer: () => Promise<any> }) => {
      const handle = await ctx.importer();
      const items = upstream[source] ?? [];
      for (const item of items) {
        const node = await handle.upsertNode(item.address, { name: item.name });
        if ((await node.listKnowledge()).length === 0) await node.appendKnowledge({ text: item.text });
      }
      const previous = synced[source] ?? [];
      for (const address of previous) {
        if (!items.some(item => item.address === address)) await handle.removeNode(address);
      }
      synced[source] = items.map(item => item.address);
    },
  });
  const knowledge = new Knowledge({
    id: 'factory',
    storage: new InMemoryStore(),
    importers: [importer('notion', 'notion:conn-notion'), importer('linear', 'linear:conn-linear')] as any,
  });
  await knowledge.reconcile();
  knowledge.__registerMastra({} as never);
  return knowledge;
}

/** The read set a Factory session in `projectId` carries, built from the SDK's own identity. */
async function sessionReadScopeIds(knowledge: Knowledge, projectId: string): Promise<string[]> {
  const identity = resolveKnowledgeScopeIdentity({
    factoryProjectId: projectId,
    factoryOrgId: ORG,
  } as MastraCodeState);
  if (!identity.resolved) throw new Error('identity unresolved');
  const [orgAddress, projectAddress] = identity.scopes;
  expect(identity.scopes).toEqual([`org:${ORG}`, `project:${projectId}`]);
  const threadAddress = `${projectAddress}:thread:t-${projectId}`;
  // Same materialization inputs the Subconscious read path uses for a vouched project rung.
  const org = await knowledge.materializeScope({
    address: orgAddress!,
    contextualScopeAddress: orgAddress!,
    parameters: { orgId: ORG },
  });
  const project = await knowledge.materializeScope({
    address: projectAddress!,
    parentAddresses: [orgAddress!],
    contextualScopeAddress: orgAddress!,
    parameters: { orgId: ORG, projectId },
  });
  const thread = await knowledge.materializeScope({
    address: threadAddress,
    parentAddresses: [projectAddress!],
    contextualScopeAddress: projectAddress!,
    parameters: { orgId: ORG, projectId, threadId: `t-${projectId}` },
  });
  return [org.scopes[orgAddress!]!, project.scopes[projectAddress!]!, thread.scopes[threadAddress]!];
}

async function bind(knowledge: Knowledge, connection: (typeof connections)[keyof typeof connections]) {
  const resolver = factoryProjectScopes(factoryStorage(), { knowledge: () => knowledge });
  const source = `${connection.integrationId}:${connection.id}`;
  bindings[source] = (await resolver(scopesContext(connection))).map(scope => ({ source, scope }));
  return bindings[source].find(binding => binding.scope === 'project:p1') ?? bindings[source][0]!;
}

async function readable(knowledge: Knowledge, scopeIds: string[], query: string) {
  const store = await knowledge.getStorage();
  return (await store.search({ query, scopeIds, limit: 20 })).map(hit => hit.recordId);
}

describe('Factory connection imports on a real Wave 2 Knowledge', () => {
  it('binds a connection to the project scope, readable by that project and not another', async () => {
    const knowledge = await createKnowledge();
    upstream['notion:conn-notion'] = [{ address: 'page-1', name: 'Runbook', text: 'payments runbook' }];

    const binding = await bind(knowledge, connections.notion);
    expect(binding.scope).toBe('project:p1');
    await expect(knowledge.runImporter('notion', binding, undefined, { triggerKind: 'cron' })).resolves.toMatchObject({
      status: 'succeeded',
    });

    expect(await readable(knowledge, await sessionReadScopeIds(knowledge, 'p1'), 'runbook')).not.toHaveLength(0);
    expect(await readable(knowledge, await sessionReadScopeIds(knowledge, 'p2'), 'runbook')).toHaveLength(0);
  });

  it('keeps two connections on one project independent through re-sync and removal', async () => {
    const knowledge = await createKnowledge();
    upstream['notion:conn-notion'] = [
      { address: 'page-1', name: 'Runbook', text: 'notion runbook' },
      { address: 'page-2', name: 'Oncall', text: 'notion oncall' },
    ];
    upstream['linear:conn-linear'] = [{ address: 'doc-1', name: 'Roadmap', text: 'linear roadmap' }];

    const notion = await bind(knowledge, connections.notion);
    const linear = await bind(knowledge, connections.linear);
    expect(notion.scope).toBe(linear.scope);
    await knowledge.runImporter('notion', notion, undefined, { triggerKind: 'cron' });
    await knowledge.runImporter('linear', linear, undefined, { triggerKind: 'cron' });

    const p1 = await sessionReadScopeIds(knowledge, 'p1');
    expect(await readable(knowledge, p1, 'roadmap')).not.toHaveLength(0);
    expect(await readable(knowledge, p1, 'oncall')).not.toHaveLength(0);

    // Notion re-syncs with page-2 gone: only Notion's stale page is removed.
    upstream['notion:conn-notion'] = [{ address: 'page-1', name: 'Runbook', text: 'notion runbook' }];
    await expect(knowledge.runImporter('notion', notion, undefined, { triggerKind: 'cron' })).resolves.toMatchObject({
      status: 'succeeded',
    });
    expect(await readable(knowledge, p1, 'oncall')).toHaveLength(0);
    expect(await readable(knowledge, p1, 'runbook')).not.toHaveLength(0);
    expect(await readable(knowledge, p1, 'roadmap')).not.toHaveLength(0);

    // Notion removes everything: Linear's records are untouched.
    upstream['notion:conn-notion'] = [];
    await knowledge.runImporter('notion', notion, undefined, { triggerKind: 'cron' });
    expect(await readable(knowledge, p1, 'runbook')).toHaveLength(0);
    expect(await readable(knowledge, p1, 'roadmap')).not.toHaveLength(0);
  });
});
