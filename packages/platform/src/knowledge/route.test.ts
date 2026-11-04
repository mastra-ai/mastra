import { createServer } from 'node:http';
import { KnowledgeConflictError, KnowledgeNotFoundError } from '@mastra/core/storage';
import { afterEach, expect, it, vi } from 'vitest';
import { PlatformKnowledge } from './index';

const servers: ReturnType<typeof createServer>[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))));
});

it('uses the project-scoped operation route with bearer auth', async () => {
  const requests: { url?: string; authorization?: string; body: string }[] = [];
  const server = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    requests.push({ url: req.url, authorization: req.headers.authorization, body });
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
      body: JSON.stringify({ input: { read: 'all' } }),
    },
  ]);
});

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
  const operations: string[] = [];
  const server = createServer(async (req, res) => {
    for await (const _chunk of req);
    operations.push(req.url!.split('/').pop()!);
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
  await store.listPageLinks({ pageId: 'a', read: 'all' } as never);
  await store.replacePageBodyLinks({ pageId: 'a', targets: [] } as never);
  await store.listPageBodyLinkSources({ targetPageId: 'a', read: 'all' } as never);
  expect(operations).toEqual([
    'countChildScopes',
    'countPageLinks',
    'listPageLinks',
    'replacePageBodyLinks',
    'listPageBodyLinkSources',
  ]);
});
