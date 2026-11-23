import { once } from 'node:events';
import { readFileSync, readdirSync } from 'node:fs';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { resolve } from 'node:path';

import { RequestContext } from '@mastra/core/request-context';
import { isValidationError } from '@mastra/core/tools';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { tools } from '../tools.js';

// The generated Confluence tools run through the public `tools()` resolver
// against a real HTTP server standing in for the Mastra platform. The platform
// proxy forwards only the origin of a `base-url-override`, so the Confluence
// site path (`/ex/confluence/{cloudId}`) must travel in the request path, and
// no override may be sent: Nango's Confluence provider already targets
// api.atlassian.com.

const CLOUD_ID = 'cloud-1';

const connection = {
  id: 'cf_test',
  integrationId: 'confluence',
  status: 'active',
  connectedByUserId: 'user_1',
  connectedAt: '2026-01-01T00:00:00Z',
  createdAt: '2026-01-01T00:00:00Z',
  accountLabel: 'acme',
  displayName: null,
  resourceId: null,
};

const integration = {
  id: 'confluence',
  provider: 'confluence',
  displayName: 'Confluence',
  logoUrl: '',
  authType: 'OAUTH2',
  authFields: [],
  capabilities: { proxy: true, webhooks: false, mcp: false },
  surfaces: ['tools'],
  comingSoon: false,
  minConnectVersion: null,
};

const PROXY_PREFIX = `/v2/connections/${connection.id}/proxy`;

interface RecordedRequest {
  method: string | undefined;
  target: string;
  baseUrlOverride: string | undefined;
}

const space = {
  id: '42',
  key: 'ENG',
  name: 'Engineering',
  type: 'global',
  status: 'current',
  authorId: 'user-1',
  createdAt: '2026-01-01T00:00:00Z',
  homepageId: '7',
  description: null,
  icon: null,
  _links: { webui: '/spaces/ENG' },
};

describe('generated Confluence tools', () => {
  let server: Server;
  let baseUrl: string;
  let requests: RecordedRequest[];
  let connectionConfig: Record<string, unknown> | null;
  let answer: (target: string) => { status: number; body: unknown };
  let resolutions = 0;

  beforeAll(async () => {
    server = createServer((request, response) => {
      const target = request.url ?? '/';
      const send = (status: number, body: unknown) => {
        response.writeHead(status, { 'content-type': 'application/json' });
        response.end(body === undefined ? '' : JSON.stringify(body));
      };
      if (target.endsWith('/connections')) return send(200, { connections: [connection] });
      if (target.endsWith('/integrations')) return send(200, { integrations: [integration] });
      if (target === `/v2/connections/${connection.id}/context`) {
        return send(200, { connection_config: connectionConfig, metadata: null });
      }
      if (!target.startsWith(PROXY_PREFIX)) return send(404, { error: `unexpected request ${target}` });
      const proxied = target.slice(PROXY_PREFIX.length);
      const override = request.headers['base-url-override'];
      requests.push({
        method: request.method,
        target: proxied,
        baseUrlOverride: Array.isArray(override) ? override.join(',') : override,
      });
      const { status, body } = answer(proxied);
      send(status, body);
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
    requests = [];
    connectionConfig = { cloudId: CLOUD_ID, baseUrl: 'https://acme.atlassian.net' };
    answer = () => ({ status: 204, body: undefined });
  });

  async function run(toolId: string, input: Record<string, unknown>) {
    const resolved = await tools({
      providers: { confluence: { connectionId: connection.id } },
      allowTools: [toolId],
      // A fresh project per run keeps the metadata overlay (where templates
      // cache a looked-up cloudId) from carrying over between tests.
      projectId: `proj_${++resolutions}`,
      client: { accessToken: 'test-platform-token', baseUrl },
    })();
    const tool = resolved[toolId] as
      { execute?: (input: unknown, context: { requestContext: RequestContext }) => Promise<unknown> } | undefined;
    if (!tool?.execute) throw new Error(`${toolId} was not resolved`);
    const result = await tool.execute(input, { requestContext: new RequestContext() });
    if (isValidationError(result)) throw new Error(`${toolId} failed validation: ${result.message}`);
    return result;
  }

  it.each([
    // Override written inline as a template literal.
    ['confluence_get_space', { id: 42 }, `/ex/confluence/${CLOUD_ID}/wiki/api/v2/spaces/42`],
    // Override held in a `baseUrlOverride` variable and passed as shorthand.
    [
      'confluence_delete_footer_comment',
      { comment_id: '9' },
      `/ex/confluence/${CLOUD_ID}/wiki/api/v2/footer-comments/9`,
    ],
    // Override held in a `baseUrl` variable.
    ['confluence_list_blog_posts', {}, `/ex/confluence/${CLOUD_ID}/wiki/api/v2/blogposts`],
    // Override built by string concatenation.
    ['confluence_list_pages', {}, `/ex/confluence/${CLOUD_ID}/wiki/api/v2/pages`],
    // A v1 endpoint, which lives under the same site path.
    ['confluence_search_content', { cql: 'type=page' }, `/ex/confluence/${CLOUD_ID}/wiki/rest/api/search`],
  ])('%s sends the site path in the request path, not as a base URL override', async (toolId, input, path) => {
    answer = () => ({ status: 200, body: { ...space, results: [], _links: {} } });

    // Only the request matters here; a fixture shape the output schema rejects
    // is fine, but an input the tool refuses would leave nothing to check.
    await run(toolId, input).catch((error: unknown) => {
      if (String(error).includes('failed validation')) throw error;
    });

    expect(requests[0]).toEqual({
      method: expect.any(String),
      target: expect.stringMatching(new RegExp(`^${path}(\\?|$)`)),
      baseUrlOverride: undefined,
    });
  });

  it('lists spaces', async () => {
    answer = () => ({ status: 200, body: { results: [space], _links: {} } });

    const result = (await run('confluence_list_spaces', {})) as { spaces?: unknown[] };

    expect(requests).toEqual([
      {
        method: 'GET',
        target: expect.stringMatching(`^/ex/confluence/${CLOUD_ID}/wiki/api/v2/spaces`),
        baseUrlOverride: undefined,
      },
    ]);
    expect(JSON.stringify(result)).toContain('Engineering');
  });

  it('deletes an inline comment and returns null', async () => {
    const result = await run('confluence_delete_inline_comment', { commentId: '77' });

    expect(result).toBeNull();
    expect(requests).toEqual([
      {
        method: 'DELETE',
        target: `/ex/confluence/${CLOUD_ID}/wiki/api/v2/inline-comments/77`,
        baseUrlOverride: undefined,
      },
    ]);
  });

  it('looks up the cloud id through the provider base when the connection has none', async () => {
    connectionConfig = null;
    answer = target =>
      target === '/oauth/token/accessible-resources'
        ? { status: 200, body: [{ id: 'cloud-2', url: 'https://acme.atlassian.net', name: 'acme', scopes: [] }] }
        : { status: 204, body: undefined };

    await run('confluence_delete_inline_comment', { commentId: '77' });

    expect(requests).toEqual([
      { method: 'GET', target: '/oauth/token/accessible-resources', baseUrlOverride: undefined },
      { method: 'DELETE', target: '/ex/confluence/cloud-2/wiki/api/v2/inline-comments/77', baseUrlOverride: undefined },
    ]);
  });

  it('never sets a base URL override in any generated tool', () => {
    const directory = resolve(import.meta.dirname, '../providers/confluence/tools');
    const offenders = readdirSync(directory).filter(file =>
      readFileSync(resolve(directory, file), 'utf8').includes('baseUrlOverride'),
    );
    expect(offenders).toEqual([]);
  });
});
