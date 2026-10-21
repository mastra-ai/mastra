/**
 * A customer-style custom Knowledge importer built only on the public
 * `@mastra/connect` root export. It is the reference shape for importers
 * written outside this package: list a project's connections, read through the
 * guarded platform proxy, and remove imported knowledge only when the provider
 * itself confirms the item is gone. It never touches raw credentials.
 */
import { Knowledge } from '@mastra/core/knowledge';
import type { KnowledgeImporterDefinition } from '@mastra/core/knowledge';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';

import {
  MastraConnectError,
  getConnectionContext,
  listProjectConnections,
  proxyRequestWithResponse,
  resolveClient,
} from '../index.js';
import type { ConnectClientOptions, ResolvedClient } from '../index.js';

const PROJECT_ID = 'proj_1';
const SCOPE = 'project:p1';

interface WikiPage {
  id: string;
  title: string;
  body: string;
  status?: 'current' | 'deleted';
}

/** One importer per active `acme-wiki` connection in the project. */
async function acmeWikiImporters(options: {
  client: ConnectClientOptions;
  projectId: string;
  scope: string;
}): Promise<KnowledgeImporterDefinition[]> {
  const client = resolveClient({ ...options.client, projectId: options.projectId });
  const connections = await listProjectConnections(client, options.projectId);
  return connections
    .filter(connection => connection.integrationId === 'acme-wiki' && connection.status === 'active')
    .map(connection => ({
      id: `acme-wiki:${connection.id}`,
      // Removing imported knowledge needs owner authority on the destination scope.
      access: { [options.scope]: 'owner' as const },
      triggers: { webhook: { bindings: [{ source: `acme-wiki:${connection.id}`, scope: options.scope }] } },
      handler: async ctx => {
        const context = await getConnectionContext(client, connection.id);
        const site = typeof context.connection_config?.site === 'string' ? context.connection_config.site : 'default';
        const importer = await ctx.importer();
        const listed = await proxyRequestWithResponse(client, connection.id, { method: 'GET', path: 'pages' });
        // The list omits deleted pages, so absence alone proves nothing.
        const pages = (listed.data as { pages: WikiPage[] }).pages;
        const seen = new Set<string>();
        for (const page of pages) {
          const address = `acme-wiki:${site}:page:${page.id}`;
          seen.add(page.id);
          const node = await importer.upsertNode(address, {
            name: page.title,
            metadata: { pageId: page.id },
            scopes: [options.scope],
          });
          const existing = await node.listKnowledge();
          if (existing.some(record => record.text === page.body)) continue;
          for (const record of existing) await node.removeKnowledge(record.id);
          await node.appendKnowledge({ text: page.body });
        }
        for (const node of await importer.listNodes()) {
          const pageId = String(node.node.metadata?.pageId);
          if (seen.has(pageId)) continue;
          if ((await probePage(client, connection.id, pageId)) === 'removed') {
            for (const record of await node.listKnowledge()) await node.removeKnowledge(record.id);
          }
        }
      },
    }));
}

/**
 * Positive point lookup. Only the provider returning this page with an explicit
 * deleted state removes its knowledge. A provider 404 or 403 is ambiguous (the
 * page may be gone, or just hidden from this connection), so the record stays
 * and the run goes on. Platform errors (`connection_not_found`,
 * `unauthorized`) and transport failures fail the run, removing nothing.
 */
async function probePage(
  client: ResolvedClient,
  connectionId: string,
  pageId: string,
): Promise<'removed' | 'present' | 'uncertain'> {
  let page: Partial<WikiPage>;
  try {
    const response = await proxyRequestWithResponse(client, connectionId, {
      method: 'GET',
      path: `pages/${encodeURIComponent(pageId)}`,
    });
    page = response.data as Partial<WikiPage>;
  } catch (error) {
    if (error instanceof MastraConnectError && error.code === 'proxy_error' && [403, 404].includes(error.status ?? 0)) {
      return 'uncertain';
    }
    throw error;
  }
  if (page?.id !== pageId) return 'uncertain';
  if (page.status === 'deleted') return 'removed';
  return page.status === 'current' ? 'present' : 'uncertain';
}

type LookupOutcome = 'deleted' | 'provider-404' | 'platform-404' | 'provider-403' | 'transport' | 'other-id';

function fakePlatform() {
  const state = {
    pages: [
      { id: 'p1', title: 'Onboarding', body: 'Start with the handbook.' },
      { id: 'p2', title: 'Retired runbook', body: 'Restart the legacy queue.' },
    ] as WikiPage[],
    lookup: 'deleted' as LookupOutcome,
    calls: [] as string[],
  };
  const fetch = (async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    state.calls.push(`${init?.method ?? 'GET'} ${url.pathname}`);
    const path = url.pathname;
    if (path === `/v2/projects/${PROJECT_ID}/connections`) {
      return Response.json({
        connections: [
          { id: 'con_wiki', integrationId: 'acme-wiki', status: 'active' },
          { id: 'con_old', integrationId: 'acme-wiki', status: 'revoked' },
          { id: 'con_crm', integrationId: 'acme-crm', status: 'active' },
        ],
      });
    }
    if (path === '/v2/connections/con_wiki/context') {
      return Response.json({ connection_config: { site: 'acme' }, metadata: null });
    }
    if (path === '/v2/connections/con_wiki/proxy/pages') return Response.json({ pages: state.pages });
    const match = /^\/v2\/connections\/con_wiki\/proxy\/pages\/(.+)$/.exec(path);
    if (match) {
      const page = state.pages.find(candidate => candidate.id === match[1]);
      if (page) return Response.json({ ...page, status: 'current' });
      switch (state.lookup) {
        case 'deleted':
          return Response.json({ id: match[1], title: 'Retired runbook', status: 'deleted' });
        case 'other-id':
          return Response.json({ id: 'p9', title: 'Something else', status: 'deleted' });
        case 'provider-404':
          return Response.json({ message: 'Page not found' }, { status: 404 });
        case 'platform-404':
          return Response.json(
            { title: 'Not Found', status: 404, detail: 'connection not found' },
            { status: 404, headers: { 'content-type': 'application/problem+json' } },
          );
        case 'provider-403':
          return Response.json({ message: 'Forbidden' }, { status: 403 });
        case 'transport':
          throw new TypeError('fetch failed');
      }
    }
    return Response.json({ title: 'Unexpected', status: 500 }, { status: 500 });
  }) as typeof globalThis.fetch;
  return { state, fetch };
}

async function setup() {
  const platform = fakePlatform();
  const importers = await acmeWikiImporters({
    client: { accessToken: 'fake-token', baseUrl: 'https://platform.test', fetch: platform.fetch },
    projectId: PROJECT_ID,
    scope: SCOPE,
  });
  const knowledge = new Knowledge({
    storage: new InMemoryStore({ id: 'custom-connect-importer' }),
    structure: {
      scopes: [
        { address: 'org:acme', name: 'Acme' },
        { address: SCOPE, name: 'Project', parentAddresses: ['org:acme'] },
      ],
    },
    importers,
  });
  await knowledge.reconcile();
  const storage = await knowledge.getStorage();
  const scope = (await storage.getScopeAddress(SCOPE))!;
  const run = () => knowledge.getImporter('acme-wiki:con_wiki')!.run({ source: 'acme-wiki:con_wiki', scope: SCOPE });
  const snapshot = async () => {
    const nodes = await knowledge.listNodes({ scopeIds: [scope.scopeNodeId], isScope: false });
    const { records } = await storage.listRecordsBySource({
      source: 'acme-wiki:con_wiki',
      scopeIds: [scope.scopeNodeId],
      limit: 50,
    });
    return { nodes: nodes.map(node => node.name).sort(), records: records.map(record => record.text).sort() };
  };
  return { platform, importers, run, snapshot };
}

describe('custom Knowledge importer on the public @mastra/connect surface', () => {
  it('registers one importer per active connection of its integration', async () => {
    const { importers } = await setup();
    expect(importers.map(importer => importer.id)).toEqual(['acme-wiki:con_wiki']);
  });

  it('imports through the guarded proxy and never fetches raw credentials', async () => {
    const { platform, run, snapshot } = await setup();
    expect((await run()).status).toBe('succeeded');
    expect(await snapshot()).toEqual({
      nodes: ['Onboarding', 'Retired runbook'],
      records: ['Restart the legacy queue.', 'Start with the handbook.'],
    });
    expect(platform.state.calls.some(call => call.includes('/credentials'))).toBe(false);
    for (const call of platform.state.calls) {
      expect(call).toMatch(/^GET \/v2\/(projects\/proj_1\/connections|connections\/con_wiki\/(context|proxy\/))/);
    }
  });

  it('removes records, but keeps the node, when the provider reports the page deleted', async () => {
    const { platform, run, snapshot } = await setup();
    await run();
    platform.state.pages = platform.state.pages.filter(page => page.id !== 'p2');
    platform.state.calls = [];
    const second = await run();
    expect(second.error ?? null).toBeNull();
    expect(second.status).toBe('succeeded');
    // Only the page missing from the list is looked up; listed pages are never probed.
    expect(platform.state.calls.filter(call => /\/proxy\/pages\/./.test(call))).toEqual([
      'GET /v2/connections/con_wiki/proxy/pages/p2',
    ]);
    expect(await snapshot()).toEqual({
      nodes: ['Onboarding', 'Retired runbook'],
      records: ['Start with the handbook.'],
    });
  });

  it.each<LookupOutcome>(['provider-404', 'provider-403', 'other-id'])(
    'keeps records when the lookup is ambiguous (%s) and the run goes on',
    async outcome => {
      const { platform, run, snapshot } = await setup();
      await run();
      const before = await snapshot();
      platform.state.pages = platform.state.pages.filter(page => page.id !== 'p2');
      platform.state.lookup = outcome;
      const second = await run();
      expect(second.error ?? null).toBeNull();
      expect(second.status).toBe('succeeded');
      expect(await snapshot()).toEqual(before);
    },
  );

  it.each<[LookupOutcome, string]>([
    ['platform-404', 'Connection con_wiki not found'],
    ['transport', 'fetch failed'],
  ])('fails the run and removes nothing on a platform or transport error (%s)', async (outcome, reason) => {
    const { platform, run, snapshot } = await setup();
    await run();
    const before = await snapshot();
    platform.state.pages = platform.state.pages.filter(page => page.id !== 'p2');
    platform.state.lookup = outcome;
    const failed = await run();
    expect(failed.status).toBe('failed');
    expect(failed.error).toContain(reason);
    expect(await snapshot()).toEqual(before);
  });
});
