import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { listFactoryProjects, refreshingFetch } from './client';

const authOf = (init?: RequestInit) => new Headers(init?.headers).get('Authorization');

describe('refreshingFetch', () => {
  it('refreshes an expired Platform token and replays the request once', async () => {
    const address = { url: 'https://factory.test', session: { token: 'old', orgId: 'o' } };
    const base = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
      authOf(init) === 'Bearer new' ? new Response('ok') : new Response('{}', { status: 401 }),
    );
    const refresh = vi.fn(async () => ({ token: 'new', orgId: 'o' }));

    const res = await refreshingFetch(address, refresh, base)('https://factory.test/x', { method: 'POST', body: 'b' });

    expect(res.status).toBe(200);
    expect(base.mock.calls.map(([, init]) => authOf(init))).toEqual(['Bearer old', 'Bearer new']);
    expect(base.mock.calls[1]![1]).toMatchObject({ method: 'POST', body: 'b' });
    expect(address.session.token).toBe('new');
  });

  it('shares one refresh across concurrent 401s', async () => {
    const address = { url: 'https://factory.test', session: { token: 'old', orgId: 'o' } };
    const base = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
      authOf(init) === 'Bearer new' ? new Response('ok') : new Response('{}', { status: 401 }),
    );
    const refresh = vi.fn(async () => ({ token: 'new', orgId: 'o' }));
    const fetcher = refreshingFetch(address, refresh, base);

    const results = await Promise.all([fetcher('https://factory.test/a'), fetcher('https://factory.test/b')]);

    expect(results.map(res => res.status)).toEqual([200, 200]);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('retries with a token another request already refreshed', async () => {
    const address = { url: 'https://factory.test', session: { token: 'old', orgId: 'o' } };
    const base = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (authOf(init) === 'Bearer new') return new Response('ok');
      address.session = { token: 'new', orgId: 'o' };
      return new Response('{}', { status: 401 });
    });
    const refresh = vi.fn(async () => null);

    const res = await refreshingFetch(address, refresh, base)('https://factory.test/x');

    expect(res.status).toBe(200);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('returns the 401 when the token cannot be refreshed', async () => {
    const address = { url: 'https://factory.test', session: { token: 'old', orgId: 'o' } };
    const base = vi.fn(async () => new Response('{}', { status: 401 }));

    const res = await refreshingFetch(address, async () => null, base)('https://factory.test/x');

    expect(res.status).toBe(401);
    expect(base).toHaveBeenCalledTimes(1);
  });
});

describe('listFactoryProjects', () => {
  async function serveFactory(routes: Record<string, unknown>) {
    const requested: string[] = [];
    const server = createServer((req, res) => {
      requested.push(req.url ?? '');
      const body = routes[req.url ?? ''];
      res.writeHead(body === undefined ? 404 : 200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body ?? { error: 'not_found' }));
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    onTestFinished(() => new Promise<void>(resolve => server.close(() => resolve())));
    const { port } = server.address() as AddressInfo;
    return { address: { url: `http://127.0.0.1:${port}`, session: { token: 't', orgId: 'o' } }, requested };
  }

  it('reads the repositories from the project list in one request on a current server', async () => {
    const { address, requested } = await serveFactory({
      '/web/factory/projects': {
        projects: [
          {
            id: 'p1',
            name: 'Platform',
            repositories: [
              { projectRepositoryId: 'pr-1', slug: 'acme/api', defaultBranch: 'main', branch: 'release' },
              { projectRepositoryId: 'pr-2', slug: 'acme/web', defaultBranch: 'trunk', branch: null },
              { projectRepositoryId: 'pr-3', slug: null, defaultBranch: null, branch: null },
            ],
          },
          { id: 'p2', name: 'Empty', repositories: [] },
        ],
      },
    });

    expect(await listFactoryProjects(address)).toEqual([
      {
        id: 'p1',
        name: 'Platform',
        repositories: [
          { projectRepositoryId: 'pr-1', slug: 'acme/api', branch: 'release' },
          { projectRepositoryId: 'pr-2', slug: 'acme/web', branch: 'trunk' },
          { projectRepositoryId: 'pr-3', slug: 'Platform', branch: undefined },
        ],
      },
      { id: 'p2', name: 'Empty', repositories: [] },
    ]);
    expect(requested).toEqual(['/web/factory/projects']);
  });

  it('reads each project’s connections on an older server that lists projects without repositories', async () => {
    const { address, requested } = await serveFactory({
      '/web/factory/projects': { projects: [{ id: 'p1', name: 'Platform' }] },
      '/web/factory/projects/p1/source-control-connections': {
        connections: [
          {
            repositories: [{ id: 'pr-1', branch: null, repository: { slug: 'acme/api', defaultBranch: 'main' } }],
          },
        ],
      },
    });

    expect(await listFactoryProjects(address)).toEqual([
      { id: 'p1', name: 'Platform', repositories: [{ projectRepositoryId: 'pr-1', slug: 'acme/api', branch: 'main' }] },
    ]);
    expect(requested).toEqual(['/web/factory/projects', '/web/factory/projects/p1/source-control-connections']);
  });
});
