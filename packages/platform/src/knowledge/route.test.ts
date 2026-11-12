import { createServer } from 'node:http';
import {
  InMemoryStore,
  KnowledgeConflictError,
  KnowledgeNotFoundError,
  KnowledgeUnsupportedCapabilityError,
} from '@mastra/core/storage';
import type { KnowledgeStorage } from '@mastra/core/storage';
import { afterEach, expect, it, vi } from 'vitest';
import { PlatformKnowledge } from './index';

const servers: ReturnType<typeof createServer>[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))));
});

it('uses the project-scoped operation route with bearer auth', async () => {
  const requests: { url?: string; authorization?: string; declarations?: string | string[]; body: string }[] = [];
  const server = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    requests.push({
      url: req.url,
      authorization: req.headers.authorization,
      declarations: req.headers['x-mastra-knowledge-store-declarations'],
      body,
    });
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ result: { pages: [] } }));
  });
  servers.push(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected a TCP port');
  const knowledge = new PlatformKnowledge({
    apiUrl: `http://127.0.0.1:${address.port}`,
    projectId: 'project/one',
    instanceId: 'instance two',
    accessToken: 'token',
  });
  const store = await knowledge.getStorage();
  expect(await store.listPages({ read: 'all' })).toEqual({ pages: [] });
  expect(requests).toEqual([
    {
      url: '/v1/knowledge/instance%20two/operations/listPages',
      authorization: 'Bearer token',
      // Tells the service this client reads the instance's declarations, so it doesn't widen reads.
      declarations: 'merged',
      body: JSON.stringify({ input: { read: 'all' } }),
    },
  ]);
});

it('asks the hosted store for the scope declarations its instance supplies', async () => {
  const urls: string[] = [];
  const declarations = { 'linear:$account:$connection': { access: [{ principal: 'imports:all', role: 'viewer' }] } };
  vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
    urls.push(String(input));
    return new Response(JSON.stringify({ result: declarations }));
  });
  const store = (await new PlatformKnowledge({
    apiUrl: 'http://localhost',
    instanceId: 'kn_1',
    accessToken: 'token',
  }).getStorage())!;
  try {
    expect(await store.getScopeDeclarations()).toEqual(declarations);
    expect(urls).toEqual(['http://localhost/v1/knowledge/kn_1/operations/getScopeDeclarations']);
  } finally {
    vi.restoreAllMocks();
  }
});

it.each([{}, { result: null }, { result: ['linear:$account:$connection'] }])(
  'rejects a hosted answer without a declaration record: %j',
  async body => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify(body)));
    const store = (await new PlatformKnowledge({
      apiUrl: 'http://localhost',
      instanceId: 'kn_1',
      accessToken: 'token',
    }).getStorage())!;
    try {
      await expect(store.getScopeDeclarations()).rejects.toThrow(/without a declaration record/);
    } finally {
      vi.restoreAllMocks();
    }
  },
);

it('allows the project to be derived from the instance and credential', () => {
  expect(
    () => new PlatformKnowledge({ apiUrl: 'http://localhost', instanceId: 'instance', accessToken: 'token' }),
  ).not.toThrow();
});

it('defaults to the hosted Knowledge API and accepts an env or explicit URL override', async () => {
  const urls: string[] = [];
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
    urls.push(String(input));
    return new Response(JSON.stringify({ result: { pages: [] } }), { headers: { 'content-type': 'application/json' } });
  });
  const previousUrl = process.env.MASTRA_KNOWLEDGE_API_URL;
  const previousServiceUrl = process.env.MASTRA_KNOWLEDGE_SERVICE_URL;
  try {
    delete process.env.MASTRA_KNOWLEDGE_API_URL;
    delete process.env.MASTRA_KNOWLEDGE_SERVICE_URL;
    const options = { instanceId: 'kn_1', accessToken: 'token' };
    await (await new PlatformKnowledge(options).getStorage()).listPages({ read: 'all' });
    process.env.MASTRA_KNOWLEDGE_SERVICE_URL = 'http://injected.local/';
    await (await new PlatformKnowledge(options).getStorage()).listPages({ read: 'all' });
    process.env.MASTRA_KNOWLEDGE_API_URL = 'http://localhost:3062/';
    await (await new PlatformKnowledge(options).getStorage()).listPages({ read: 'all' });
    await (
      await new PlatformKnowledge({ ...options, apiUrl: 'http://localhost:8080/' }).getStorage()
    ).listPages({ read: 'all' });
  } finally {
    if (previousUrl === undefined) delete process.env.MASTRA_KNOWLEDGE_API_URL;
    else process.env.MASTRA_KNOWLEDGE_API_URL = previousUrl;
    if (previousServiceUrl === undefined) delete process.env.MASTRA_KNOWLEDGE_SERVICE_URL;
    else process.env.MASTRA_KNOWLEDGE_SERVICE_URL = previousServiceUrl;
    fetchSpy.mockRestore();
  }
  expect(urls).toEqual([
    'https://knowledge-api.mastra.ai/v1/knowledge/kn_1/operations/listPages',
    'https://knowledge-api.mastra.ai/v1/knowledge/kn_1/operations/listPages',
    'http://localhost:3062/v1/knowledge/kn_1/operations/listPages',
    'http://localhost:8080/v1/knowledge/kn_1/operations/listPages',
  ]);
});

it('forwards the page-link and child-scope operations instead of rejecting them locally', async () => {
  const operations: { operation: string; body: string }[] = [];
  const server = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    operations.push({ operation: req.url!.split('/').pop()!, body });
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ result: [] }));
  });
  servers.push(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected a TCP port');
  const store = await new PlatformKnowledge({
    apiUrl: `http://127.0.0.1:${address.port}`,
    instanceId: 'instance',
    accessToken: 'token',
  }).getStorage();
  await store.countChildScopes({ parentIds: ['a'], read: 'all' });
  await store.countPageLinks({ pageIds: ['a'], read: 'all' });
  await store.listPageLinks({ pageIds: ['a'], read: 'all' });
  await store.replacePageBodyLinks({ pageId: 'a', links: [] });
  await store.listPageBodyLinkSources({ refs: ['b'], toPageIds: ['a'] });
  expect(operations).toEqual([
    { operation: 'countChildScopes', body: JSON.stringify({ input: { parentIds: ['a'], read: 'all' } }) },
    { operation: 'countPageLinks', body: JSON.stringify({ input: { pageIds: ['a'], read: 'all' } }) },
    { operation: 'listPageLinks', body: JSON.stringify({ input: { pageIds: ['a'], read: 'all' } }) },
    { operation: 'replacePageBodyLinks', body: JSON.stringify({ input: { pageId: 'a', links: [] } }) },
    { operation: 'listPageBodyLinkSources', body: JSON.stringify({ input: { refs: ['b'], toPageIds: ['a'] } }) },
  ]);
});

it('rejects scope declaration renames locally because the rename check cannot cross the wire', async () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch');
  try {
    const knowledge = new PlatformKnowledge({
      apiUrl: 'http://localhost',
      instanceId: 'instance',
      accessToken: 'token',
    });
    const store = await knowledge.getStorage();
    const check = vi.fn();
    await expect(store.renameScopeDeclaration({ from: 'a', to: 'b', check })).rejects.toBeInstanceOf(
      KnowledgeUnsupportedCapabilityError,
    );
    expect(check).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  } finally {
    fetchSpy.mockRestore();
  }
});

it('keeps page and listing pins apart on the same page through the hosted operation route', async () => {
  // A stand-in for the Knowledge service: each operation runs on a real in-memory store.
  const backing = (await new InMemoryStore().getStore('knowledge')) as KnowledgeStorage;
  const revive = (_key: string, value: unknown) =>
    value && typeof value === 'object' && '__knowledgeDate' in value
      ? new Date((value as { __knowledgeDate: string }).__knowledgeDate)
      : value;
  const server = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    const operation = req.url!.split('/').pop()!;
    const { input } = JSON.parse(body, revive) as { input: unknown };
    const result = await (backing as unknown as Record<string, (input: unknown) => Promise<unknown>>)[operation]!(
      input,
    );
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ result: result ?? null }));
  });
  servers.push(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected a TCP port');
  const store = await new PlatformKnowledge({
    apiUrl: `http://127.0.0.1:${address.port}`,
    instanceId: 'instance',
    accessToken: 'token',
  }).getStorage();

  // knowledge_pin refuses `kind: 'list'` before writing unless the store says it keeps pin kinds.
  expect(store.getCapabilities().supportsPinKinds).toBe(true);

  const provenance = { author: 'host' };
  const { scope } = await store.materializeScope({
    address: 'org:acme',
    declaration: 'org:$orgId',
    name: 'Acme',
    provenance,
  });
  const page = await store.createPage({
    parentId: scope.id,
    key: 'handbook',
    name: 'Handbook',
    body: 'Hi.',
    provenance,
  });
  await store.addPinAudience({ pageId: page.id, audience: ['org:acme'], createdBy: 'agent' });
  await store.addPinAudience({ pageId: page.id, kind: 'list', depth: 2, audience: ['org:acme'], createdBy: 'agent' });

  const pins = async (kind?: 'page' | 'list') =>
    (await store.listPins({ audience: 'all', read: 'all', kind })).pins.map(pin => ({
      kind: pin.kind,
      depth: pin.depth,
    }));
  expect(await pins('page')).toEqual([{ kind: 'page', depth: undefined }]);
  expect(await pins('list')).toEqual([{ kind: 'list', depth: 2 }]);

  await store.removePinAudience({ pageId: page.id, kind: 'list', audience: ['org:acme'], removedBy: 'agent' });
  expect(await pins()).toEqual([{ kind: 'page', depth: undefined }]);
});
