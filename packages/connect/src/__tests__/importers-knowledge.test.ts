import { Knowledge } from '@mastra/core/knowledge';
import { InMemoryStore, knowledgeImportNodeAddress } from '@mastra/core/storage';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { importers } from '../importers.js';

const PROJECT_SCOPE = 'resource:project-1';
const CONNECTION_ID = 'c_lin1';

const linearDocument = {
  id: 'doc-1',
  title: 'Launch plan',
  content: '# Launch plan\n\nShip importers to Knowledge.',
  url: 'https://linear.app/acme/document/launch-plan-abc123',
  slugId: 'abc123',
  updatedAt: '2026-10-01T00:00:00.000Z',
  archivedAt: null,
  trashed: false,
  project: null,
  initiative: null,
};

/** One Platform fetch for both the project's connections and the Linear GraphQL proxy, as in a deployed app. */
function platformFetch() {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    if (url.pathname === '/v2/projects/proj_1/connections') {
      return Response.json({
        connections: [
          {
            id: CONNECTION_ID,
            integrationId: 'linear',
            status: 'active',
            connectedByUserId: 'user_1',
            connectedAt: '2026-09-01T00:00:00Z',
            createdAt: '2026-09-01T00:00:00Z',
            accountLabel: 'Acme',
          },
        ],
      });
    }
    if (url.pathname === `/v2/connections/${CONNECTION_ID}/proxy/graphql`) {
      const { query } = JSON.parse(String(init?.body)) as { query: string };
      if (query.includes('documents(')) {
        return Response.json({
          data: { documents: { nodes: [linearDocument], pageInfo: { hasNextPage: false, endCursor: null } } },
        });
      }
      return Response.json({ data: { document: { id: linearDocument.id, archivedAt: null, trashed: false } } });
    }
    return new Response('not found', { status: 404 });
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('importers() with Knowledge', () => {
  it("imports a connected provider's content into the bound scope", async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const resolver = importers({
      projectId: 'proj_1',
      client: { accessToken: 'token', baseUrl: 'https://platform.test', fetch: platformFetch() as typeof fetch },
      integrations: { linear: { scope: PROJECT_SCOPE } },
    });
    const knowledge = new Knowledge({
      storage: new InMemoryStore({ id: 'connect-importers-e2e' }),
      structure: { scopes: [{ address: PROJECT_SCOPE, name: 'Project 1' }] },
      importers: resolver,
    });
    const { scopes } = await knowledge.reconcile();
    await knowledge.reconcileImportersInternal();

    const importerId = `connect:linear:${CONNECTION_ID}`;
    const importer = knowledge.getImporter(importerId);
    expect(importer).toBeDefined();
    const source = `linear:${CONNECTION_ID}`;
    await expect(importer!.run({ source, scope: PROJECT_SCOPE })).resolves.toMatchObject({ status: 'succeeded' });

    const storage = await knowledge.getStorage();
    const binding = await storage.getNodeAddress({
      source,
      address: knowledgeImportNodeAddress(PROJECT_SCOPE, `linear:document:${linearDocument.id}`),
    });
    expect(binding).not.toBeNull();
    const node = await knowledge.getNode(binding!.nodeId);
    expect(node?.name).toBe('Launch plan');
    const { records } = await storage.listRecords({ node: node!, scopeIds: [scopes[PROJECT_SCOPE]!] });
    expect(records.map(record => record.text).join('\n')).toContain('Ship importers to Knowledge.');
  });
});
