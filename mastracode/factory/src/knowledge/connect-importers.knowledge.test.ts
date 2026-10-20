import { resolveKnowledgeScopeIdentity } from '@mastra/code-sdk/knowledge-scope';
import { importers } from '@mastra/connect';
import { Knowledge } from '@mastra/core/knowledge';
import { InMemoryStore } from '@mastra/core/storage';
import type { FactoryStorage } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';

import { withProjectScopedIntegrations } from './project-scopes.js';

type MastraCodeState = Parameters<typeof resolveKnowledgeScopeIdentity>[0];

/**
 * Cross-layer: the real `@mastra/connect` Notion importer, wired through the same
 * `importers(withProjectScopedIntegrations(...))` call Factory makes, syncing into a
 * real Wave 2 Knowledge. Only the Platform HTTP boundary is faked.
 */

const ORG = 'org-1';
const PLATFORM_PROJECT = 'platform-project';
const BASE_URL = 'https://integrations.test';
const projects = [
  { id: 'p1', orgId: ORG, name: 'Payments' },
  { id: 'p2', orgId: ORG, name: 'Search' },
];

function factoryStorage(): FactoryStorage {
  const domains: Record<string, unknown> = {
    projects: { ensureReady: async () => {}, listAll: async () => projects },
    'importer-routing': {
      ensureReady: async () => {},
      get: async (connectionId: string) =>
        connectionId === 'conn-notion' ? { connectionId, mode: 'selected', projectIds: ['p1'] } : null,
    },
  };
  return {
    hasDomain: (name: string) => name in domains,
    getDomain: (name: string) => {
      if (name in domains) return domains[name];
      throw new Error(`unexpected domain ${name}`);
    },
  } as unknown as FactoryStorage;
}

interface Page {
  id: string;
  title: string;
  body: string;
  lastEditedTime: string;
}

function platform() {
  const state = { connected: true, pages: [] as Page[], calls: [] as string[] };
  const json = (body: unknown) =>
    new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  const fetch = (async (input: string | URL | Request) => {
    const url = new URL(String(input instanceof Request ? input.url : input));
    state.calls.push(url.pathname);
    if (url.pathname === `/v2/projects/${PLATFORM_PROJECT}/connections`) {
      return json({
        connections: state.connected
          ? [{ id: 'conn-notion', integrationId: 'notion', status: 'active', accountLabel: 'Acme' }]
          : [],
      });
    }
    const proxy = '/v2/connections/conn-notion/proxy/';
    if (url.pathname === `${proxy}v1/search`) {
      return json({
        has_more: false,
        next_cursor: null,
        results: state.pages.map(page => ({
          object: 'page',
          id: page.id,
          archived: false,
          url: `https://www.notion.so/${page.id}`,
          last_edited_time: page.lastEditedTime,
          properties: { Name: { type: 'title', title: [{ plain_text: page.title }] } },
        })),
      });
    }
    const blocks = url.pathname.match(/^\/v2\/connections\/conn-notion\/proxy\/v1\/blocks\/([^/]+)\/children$/);
    if (blocks) {
      const page = state.pages.find(candidate => candidate.id === blocks[1]);
      return json({
        has_more: false,
        next_cursor: null,
        results: page
          ? [
              {
                object: 'block',
                id: `${page.id}-b`,
                type: 'paragraph',
                has_children: false,
                paragraph: { rich_text: [{ plain_text: page.body }] },
              },
            ]
          : [],
      });
    }
    const pageLookup = url.pathname.match(/^\/v2\/connections\/conn-notion\/proxy\/v1\/pages\/([^/]+)$/);
    if (pageLookup && state.pages.some(candidate => candidate.id === pageLookup[1])) {
      return json({ object: 'page', id: pageLookup[1], archived: false, in_trash: false });
    }
    return new Response(JSON.stringify({ detail: `unexpected ${url.pathname}` }), {
      status: 404,
      headers: { 'content-type': 'application/problem+json' },
    });
  }) as typeof globalThis.fetch;
  return { state, fetch };
}

async function createFactoryKnowledge(fetch: typeof globalThis.fetch) {
  // Same composition as Factory's auto-construction (factory.ts resolveEffectiveKnowledge),
  // with the Platform transport injected instead of read from env.
  const knowledgeRef: { current?: Knowledge } = {};
  const resolver = importers({
    ...withProjectScopedIntegrations(undefined, factoryStorage(), { knowledge: () => knowledgeRef.current }),
    projectId: PLATFORM_PROJECT,
    ttlMs: 0,
    client: { accessToken: 'test-token', baseUrl: BASE_URL, fetch },
  });
  const knowledge = new Knowledge({ id: 'factory', storage: new InMemoryStore(), importers: resolver });
  knowledgeRef.current = knowledge;
  await knowledge.reconcile();
  knowledge.__registerMastra({} as never);
  // The runner's scheduling tick; fires it directly instead of waiting on the timer.
  await knowledge.reconcileImportersInternal();
  return knowledge;
}

async function sessionReadScopeIds(knowledge: Knowledge, projectId: string): Promise<string[]> {
  const identity = resolveKnowledgeScopeIdentity({ factoryProjectId: projectId, factoryOrgId: ORG } as MastraCodeState);
  if (!identity.resolved) throw new Error('identity unresolved');
  const [orgAddress, projectAddress] = identity.scopes;
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
  return [org.scopes[orgAddress!]!, project.scopes[projectAddress!]!];
}

async function texts(knowledge: Knowledge, scopeIds: string[], query: string) {
  const store = await knowledge.getStorage();
  const hits = await store.search({ query, scopeIds, limit: 20 });
  return hits.filter(hit => hit.type === 'record').map(hit => hit.text);
}

const IMPORTER_ID = 'connect:notion:conn-notion';

describe('Factory + real @mastra/connect Notion importer on a real Wave 2 Knowledge', () => {
  it('imports into the routed project only, replays idempotently, replaces edits, and unregisters on disconnect', async () => {
    const { state, fetch } = platform();
    state.pages = [
      { id: 'page-1', title: 'Runbook', body: 'payments runbook v1', lastEditedTime: '2026-01-01T00:00:00.000Z' },
    ];
    const knowledge = await createFactoryKnowledge(fetch);

    const definition = knowledge.getImporter(IMPORTER_ID);
    expect(definition).toBeDefined();
    const bindings = await definition!.triggers.cron!.resolveBindings!();
    // Direct project binding, source = provider+connection, routing honored, no child scope.
    expect(bindings).toEqual([{ source: 'notion:conn-notion', scope: 'project:p1' }]);
    const binding = bindings[0]!;

    await expect(
      knowledge.runImporter(IMPORTER_ID, binding, undefined, { triggerKind: 'cron' }),
    ).resolves.toMatchObject({
      status: 'succeeded',
    });
    const p1 = await sessionReadScopeIds(knowledge, 'p1');
    const p2 = await sessionReadScopeIds(knowledge, 'p2');
    expect(await texts(knowledge, p1, 'runbook')).toEqual([expect.stringContaining('payments runbook v1')]);
    expect(await texts(knowledge, p2, 'runbook')).toEqual([]);

    // Replay with unchanged upstream: no duplicate record.
    await expect(
      knowledge.runImporter(IMPORTER_ID, binding, undefined, { triggerKind: 'cron' }),
    ).resolves.toMatchObject({
      status: 'succeeded',
    });
    expect(await texts(knowledge, p1, 'runbook')).toHaveLength(1);

    // Upstream edit: the stale record is replaced, not accumulated.
    state.pages = [
      { id: 'page-1', title: 'Runbook', body: 'payments runbook v2', lastEditedTime: '2026-02-01T00:00:00.000Z' },
    ];
    await expect(
      knowledge.runImporter(IMPORTER_ID, binding, undefined, { triggerKind: 'cron' }),
    ).resolves.toMatchObject({
      status: 'succeeded',
    });
    expect(await texts(knowledge, p1, 'runbook')).toEqual([expect.stringContaining('payments runbook v2')]);
    expect(await texts(knowledge, p2, 'runbook')).toEqual([]);

    // Only org + project scopes exist — no per-connection child scope was minted.
    const store = await knowledge.getStorage();
    expect(await store.getScopeAddress('project:p1:notion:conn-notion')).toBeFalsy();

    // Connection detached on the Platform. The connect resolver is stale-while-revalidate:
    // the first tick still serves the cached set while it refetches, the next tick unregisters.
    state.connected = false;
    await knowledge.reconcileImportersInternal();
    expect(knowledge.getImporter(IMPORTER_ID)).toBeDefined();
    await new Promise(resolve => setTimeout(resolve, 0));
    await knowledge.reconcileImportersInternal();
    expect(knowledge.getImporter(IMPORTER_ID)).toBeUndefined();
    await expect(
      Promise.resolve().then(() => knowledge.runImporter(IMPORTER_ID, binding, undefined, { triggerKind: 'cron' })),
    ).rejects.toThrow(`Knowledge importer ${IMPORTER_ID} is not registered`);
    expect(await texts(knowledge, p1, 'runbook')).toEqual([expect.stringContaining('payments runbook v2')]);

    expect(state.calls.every(path => path.startsWith('/v2/'))).toBe(true);
  });
});
