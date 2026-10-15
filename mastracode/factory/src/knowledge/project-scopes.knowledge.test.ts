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
const nodeIds: Record<string, string> = {};
const evict: Record<string, string[]> = {};
const rejected: string[] = [];

async function createKnowledge() {
  return createKnowledgeWith([importer('notion', 'notion:conn-notion'), importer('linear', 'linear:conn-linear')]);
}

function importer(id: string, source: string) {
  return {
    id,
    access: { 'project:$projectId': 'owner' as const },
    // Factory's shape: a cron trigger whose bindings come from the project-scopes resolver.
    triggers: { cron: { schedule: '0 0 1 1 *', resolveBindings: async () => bindings[source] ?? [] } },
    handler: async (ctx: { importer: () => Promise<any> }) => {
      const handle = await ctx.importer();
      const items = upstream[source] ?? [];
      for (const item of items) {
        const node = await handle.upsertNode(item.address, { name: item.name });
        nodeIds[`${source}\u0000${item.address}`] = node.node.id;
        // Provider reconcile: drop this binding's records whose text changed upstream.
        const current = await node.listKnowledge();
        for (const record of current) if (record.text !== item.text) await node.removeKnowledge(record.id);
        if (!current.some(record => record.text === item.text)) await node.appendKnowledge({ text: item.text });
        // A provider that evicts by remembered record id.
        for (const id of evict[source] ?? []) {
          await node.removeKnowledge(id).catch((error: Error) => rejected.push(error.message));
        }
      }
      const previous = synced[source] ?? [];
      for (const address of previous) {
        if (!items.some(item => item.address === address)) await handle.removeNode(address);
      }
      synced[source] = items.map(item => item.address);
    },
  };
}

/** `importers` is a static list, or a resolver re-read on each reconcile (Factory's connection-driven shape). */
async function createKnowledgeWith(importers: unknown) {
  for (const state of [synced, bindings, upstream, nodeIds, evict])
    for (const key of Object.keys(state)) delete state[key];
  rejected.length = 0;
  const knowledge = new Knowledge({ id: 'factory', storage: new InMemoryStore(), importers: importers as any });
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

  it('never lets a Notion re-sync remove records another binding keeps on the same node', async () => {
    const knowledge = await createKnowledge();
    upstream['notion:conn-notion'] = [{ address: 'page-1', name: 'Runbook', text: 'notion runbook v1' }];
    const notion = await bind(knowledge, connections.notion);
    await knowledge.runImporter('notion', notion, undefined, { triggerKind: 'cron' });
    const shared = nodeIds['notion:conn-notion\u0000page-1']!;
    const p1Scope = (await sessionReadScopeIds(knowledge, 'p1'))[1]!;
    const p2Scope = (await sessionReadScopeIds(knowledge, 'p2'))[1]!;

    // Records on Notion's own node that Notion's binding does not own:
    // Linear's (same project scope, other source) and one of Notion's own
    // source that is also shared into another scope.
    const linearRecord = await knowledge.createRecord({
      node: shared,
      text: 'linear roadmap',
      source: 'linear:conn-linear',
      scopeIds: [p1Scope],
      contextScopeId: p1Scope,
    });
    const widened = await knowledge.createRecord({
      node: shared,
      text: 'shared runbook',
      source: 'notion:conn-notion',
      scopeIds: [p1Scope, p2Scope],
      contextScopeId: p1Scope,
    });

    // Notion re-syncs an edit and tries to evict Linear's record by id.
    upstream['notion:conn-notion'] = [{ address: 'page-1', name: 'Runbook', text: 'notion runbook v2' }];
    evict['notion:conn-notion'] = [linearRecord.id];
    await expect(knowledge.runImporter('notion', notion, undefined, { triggerKind: 'cron' })).resolves.toMatchObject({
      status: 'succeeded',
    });

    expect(rejected).toEqual([expect.stringContaining('owned by another binding')]);
    const store = await knowledge.getStorage();
    expect((await store.getRecord({ id: linearRecord.id }))?.deletedAt).toBeFalsy();
    expect((await store.getRecord({ id: widened.id }))?.deletedAt).toBeFalsy();
    const p1 = await sessionReadScopeIds(knowledge, 'p1');
    expect(await readable(knowledge, p1, 'roadmap')).toHaveLength(1);
    expect(await readable(knowledge, p1, 'v1')).toHaveLength(0);
  });

  it('picks up a connection added between fires and stops one removed between fires', async () => {
    const connected = new Set(['notion']);
    const knowledge = await createKnowledgeWith(async () =>
      [importer('notion', 'notion:conn-notion'), importer('linear', 'linear:conn-linear')].filter(definition =>
        connected.has(definition.id),
      ),
    );
    upstream['notion:conn-notion'] = [{ address: 'page-1', name: 'Runbook', text: 'notion runbook' }];
    upstream['linear:conn-linear'] = [{ address: 'doc-1', name: 'Q3 plan', text: 'linear roadmap' }];
    const p1 = await sessionReadScopeIds(knowledge, 'p1');

    const notion = await bind(knowledge, connections.notion);
    const linear = await bind(knowledge, connections.linear);
    await expect(knowledge.runImporter('notion', notion, undefined, { triggerKind: 'cron' })).resolves.toMatchObject({
      status: 'succeeded',
    });
    expect(knowledge.getImporter('linear')).toBeUndefined();

    // Linear connects between fires: the next reconcile registers it and its fire imports.
    connected.add('linear');
    await knowledge.reconcileImportersInternal();
    expect(knowledge.getImporter('linear')).toBeDefined();
    await expect(knowledge.runImporter('linear', linear, undefined, { triggerKind: 'cron' })).resolves.toMatchObject({
      status: 'succeeded',
    });
    expect(await readable(knowledge, p1, 'roadmap')).toHaveLength(1);

    // Notion disconnects between fires: it is unregistered and cannot fire again.
    connected.delete('notion');
    upstream['notion:conn-notion'] = [{ address: 'page-1', name: 'Runbook', text: 'notion runbook v2' }];
    await knowledge.reconcileImportersInternal();
    expect(knowledge.getImporter('notion')).toBeUndefined();
    await expect(
      Promise.resolve().then(() => knowledge.runImporter('notion', notion, undefined, { triggerKind: 'cron' })),
    ).rejects.toThrow('Knowledge importer notion is not registered');
    expect(await readable(knowledge, p1, 'v2')).toHaveLength(0);
    expect(await readable(knowledge, p1, 'roadmap')).toHaveLength(1);
  });
});
