import { createServer } from 'node:http';
import { afterEach, expect, it } from 'vitest';
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
