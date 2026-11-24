import { once } from 'node:events';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { RequestContext } from '@mastra/core/request-context';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { tools } from '../tools.js';
import type { ToolsOptions } from '../tools.js';

// Connections on the platform's `gitlab-self-hosted` catalog entry (a token
// plus the instance hostname) get the same GitLab toolset as `gitlab`. The
// shipped GitLab tools resolve through the public `tools()` resolver against a
// real HTTP server standing in for the platform.

function gitlabConnection(id: string, integrationId: string, accountLabel: string) {
  return {
    id,
    integrationId,
    status: 'active',
    connectedByUserId: 'user_1',
    connectedAt: '2026-01-01T00:00:00Z',
    createdAt: '2026-01-01T00:00:00Z',
    accountLabel,
    displayName: null,
    resourceId: null,
  };
}

const cloud = gitlabConnection('gl_cloud', 'gitlab', 'acme');
const selfHosted = gitlabConnection('gl_self', 'gitlab-self-hosted', 'platform-team');

const catalog = [
  { id: 'gitlab', authType: 'OAUTH2' },
  { id: 'gitlab-self-hosted', authType: 'API_KEY' },
].map(entry => ({
  ...entry,
  provider: entry.id,
  displayName: 'GitLab',
  logoUrl: '',
  authFields: [],
  capabilities: { proxy: true, webhooks: false, mcp: false },
  surfaces: ['tools'],
  comingSoon: false,
  minConnectVersion: null,
}));

const project = {
  id: 42,
  name: 'app',
  path: 'app',
  path_with_namespace: 'team/app',
  web_url: 'https://gitlab.acme.internal/team/app',
};

describe('self-hosted GitLab connections', () => {
  let server: Server;
  let baseUrl: string;
  let connections: unknown[];
  let proxied: string[];
  let resolutions = 0;

  beforeAll(async () => {
    server = createServer((request, response) => {
      const target = request.url ?? '/';
      const send = (status: number, body: unknown) => {
        response.writeHead(status, { 'content-type': 'application/json' });
        response.end(JSON.stringify(body));
      };
      if (target.endsWith('/connections')) return send(200, { connections });
      if (target.endsWith('/integrations')) return send(200, { integrations: catalog });
      if (target.includes('/proxy/')) {
        proxied.push(target);
        return send(200, project);
      }
      send(404, { error: `unexpected request ${target}` });
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    server.close();
    await once(server, 'close');
  });

  beforeEach(() => {
    proxied = [];
  });

  function resolve(providers?: ToolsOptions['providers']) {
    return tools({
      providers,
      // Resolvers share a cached snapshot per project; each test swaps the
      // platform's connection list, so each resolution gets its own project.
      projectId: `proj_${++resolutions}`,
      client: { accessToken: 'test-platform-token', baseUrl },
    })();
  }

  type Executable = { execute: (input: unknown, context: { requestContext: RequestContext }) => Promise<unknown> };

  it('gives a self-hosted connection the GitLab toolset, proxied through that connection', async () => {
    connections = [selfHosted];
    const resolved = await resolve();
    expect(Object.keys(resolved).filter(key => key.startsWith('gitlab_')).length).toBe(44);

    const result = await (resolved['gitlab_get_project'] as unknown as Executable).execute(
      { project_id: 'team/app' },
      { requestContext: new RequestContext() },
    );
    expect(result).toMatchObject({ id: 42, path_with_namespace: 'team/app' });
    expect(proxied).toEqual(['/v2/connections/gl_self/proxy/api/v4/projects/team%2Fapp']);
  });

  it('lets the agent choose between a gitlab.com and a self-hosted connection', async () => {
    connections = [cloud, selfHosted];
    const resolved = await resolve();

    const listed = await (resolved['gitlab__list_connections'] as unknown as Executable).execute(
      {},
      { requestContext: new RequestContext() },
    );
    expect(JSON.stringify(listed)).toContain('acme');
    expect(JSON.stringify(listed)).toContain('platform-team');

    await (resolved['gitlab_get_project'] as unknown as Executable).execute(
      { project_id: 42, connection_name: 'platform-team' },
      { requestContext: new RequestContext() },
    );
    await (resolved['gitlab_get_project'] as unknown as Executable).execute(
      { project_id: 42, connection_name: 'acme' },
      { requestContext: new RequestContext() },
    );
    expect(proxied).toEqual([
      '/v2/connections/gl_self/proxy/api/v4/projects/42',
      '/v2/connections/gl_cloud/proxy/api/v4/projects/42',
    ]);
  });

  it('pins a self-hosted connection through the gitlab provider options', async () => {
    connections = [cloud, selfHosted];
    const resolved = await resolve({ gitlab: { connectionId: selfHosted.id } });
    expect(resolved['gitlab__list_connections']).toBeUndefined();

    await (resolved['gitlab_get_project'] as unknown as Executable).execute(
      { project_id: 42 },
      { requestContext: new RequestContext() },
    );
    expect(proxied).toEqual(['/v2/connections/gl_self/proxy/api/v4/projects/42']);
  });

  it('keeps self-hosted connections when providers lists only gitlab', async () => {
    connections = [selfHosted];
    const resolved = await resolve(['gitlab']);
    expect(resolved['gitlab_get_project']).toBeDefined();
  });

  it('rejects provider options keyed by gitlab-self-hosted, pointing at gitlab', async () => {
    connections = [selfHosted];
    await expect(resolve({ 'gitlab-self-hosted': { allowTools: ['gitlab_get_project'] } })).rejects.toThrow(
      "'gitlab-self-hosted' connections use the 'gitlab' toolset; configure them under providers.gitlab.",
    );
    await expect(resolve(['gitlab-self-hosted'])).rejects.toThrow('configure them under providers.gitlab');
  });

  it('resolves self-hosted connections when the catalog is unavailable', async () => {
    connections = [selfHosted];
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const resolved = await tools({
        projectId: `proj_${++resolutions}`,
        client: {
          accessToken: 'test-platform-token',
          baseUrl,
          fetch: (async (input: RequestInfo | URL, init?: RequestInit) =>
            String(input).endsWith('/integrations')
              ? new Response('down', { status: 503 })
              : fetch(input, init)) as typeof fetch,
        },
      })();
      expect(resolved['gitlab_get_project']).toBeDefined();
    } finally {
      warn.mockRestore();
    }
  });
});
