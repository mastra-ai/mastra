import { once } from 'node:events';
import { readFileSync, readdirSync } from 'node:fs';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { resolve } from 'node:path';

import { RequestContext } from '@mastra/core/request-context';
import { isValidationError } from '@mastra/core/tools';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { dropConfluenceBaseUrlOverrides } from '../../scripts/generate-provider.js';
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
  body?: unknown;
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
  let connectionMetadata: Record<string, unknown> | null;
  let answer: (target: string) => { status: number; body: unknown };
  let resolutions = 0;

  beforeAll(async () => {
    server = createServer(async (request, response) => {
      const target = request.url ?? '/';
      let raw = '';
      for await (const chunk of request) raw += chunk;
      const send = (status: number, body: unknown) => {
        response.writeHead(status, { 'content-type': 'application/json' });
        response.end(body === undefined ? '' : JSON.stringify(body));
      };
      if (target.endsWith('/connections')) return send(200, { connections: [connection] });
      if (target.endsWith('/integrations')) return send(200, { integrations: [integration] });
      if (target === `/v2/connections/${connection.id}/context`) {
        return send(200, { connection_config: connectionConfig, metadata: connectionMetadata });
      }
      if (!target.startsWith(PROXY_PREFIX)) return send(404, { error: `unexpected request ${target}` });
      const proxied = target.slice(PROXY_PREFIX.length);
      const override = request.headers['base-url-override'];
      requests.push({
        method: request.method,
        target: proxied,
        baseUrlOverride: Array.isArray(override) ? override.join(',') : override,
        ...(raw && { body: JSON.parse(raw) }),
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
    connectionMetadata = null;
    answer = () => ({ status: 204, body: undefined });
  });

  // One toolset shares one metadata overlay, where templates cache the cloudId
  // they looked up, so calls through the same toolset see each other's writes.
  async function toolset(toolIds: string[]) {
    const resolved = await tools({
      providers: { confluence: { connectionId: connection.id } },
      allowTools: toolIds,
      // A fresh project per toolset keeps the overlay from carrying over
      // between tests.
      projectId: `proj_${++resolutions}`,
      client: { accessToken: 'test-platform-token', baseUrl },
    })();
    return async (toolId: string, input: Record<string, unknown>) => {
      const tool = resolved[toolId] as
        | { execute?: (input: unknown, context: { requestContext: RequestContext }) => Promise<unknown> }
        | undefined;
      if (!tool?.execute) throw new Error(`${toolId} was not resolved`);
      const result = await tool.execute(input, { requestContext: new RequestContext() });
      if (isValidationError(result)) throw new Error(`${toolId} failed validation: ${result.message}`);
      return result;
    };
  }

  async function run(toolId: string, input: Record<string, unknown>) {
    return (await toolset([toolId]))(toolId, input);
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

  it.each([
    ['confluence_delete_blog_post', { id: '123?purge=true' }, '/blogposts/123%3Fpurge%3Dtrue'],
    ['confluence_delete_page', { id: '123?purge=true' }, '/pages/123%3Fpurge%3Dtrue'],
    ['confluence_delete_footer_comment', { comment_id: '..\\pages/123' }, '/footer-comments/..%5Cpages%2F123'],
    ['confluence_delete_inline_comment', { commentId: '9#x' }, '/inline-comments/9%23x'],
  ])('%s keeps an id inside its own path segment', async (toolId, input, path) => {
    await run(toolId, input).catch(() => undefined);

    expect(requests.map(request => `${request.method} ${request.target}`)).toEqual([
      `DELETE /ex/confluence/${CLOUD_ID}/wiki/api/v2${path}`,
    ]);
  });

  it('never puts a raw input value into a generated endpoint path', () => {
    const dir = resolve(import.meta.dirname, '../providers/confluence/tools');
    for (const file of readdirSync(dir)) {
      for (const endpoint of readFileSync(resolve(dir, file), 'utf8').match(/endpoint: `[^`]*`/g) ?? []) {
        expect(endpoint, file).not.toMatch(/\$\{input\./);
      }
    }
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

  describe('on a token that can see several Confluence sites', () => {
    const sites = [
      { id: 'site-a', url: 'https://a.atlassian.net', name: 'a', scopes: [] },
      { id: 'site-b', url: 'https://b.atlassian.net', name: 'b', scopes: [] },
    ];

    beforeEach(() => {
      connectionConfig = {};
      answer = target =>
        target === '/oauth/token/accessible-resources'
          ? { status: 200, body: sites }
          : { status: 200, body: { id: '7', title: 'Page', status: 'current', version: { number: 1 } } };
    });

    it('deletes a page property on the site the connection metadata names, and later tools stay there', async () => {
      connectionMetadata = { cloudId: 'site-b' };
      const call = await toolset(['confluence_delete_page_property', 'confluence_get_page']);

      await call('confluence_delete_page_property', { pageId: '7', propertyId: '9' });
      await call('confluence_get_page', { id: '7' }).catch(() => undefined);

      expect(requests.map(request => `${request.method} ${request.target.split('?')[0]}`)).toEqual([
        'DELETE /ex/confluence/site-b/wiki/api/v2/pages/7/properties/9',
        'GET /ex/confluence/site-b/wiki/api/v2/pages/7',
      ]);
    });

    it('deletes a page property on a site chosen in metadata after an earlier call looked one up', async () => {
      answer = target =>
        target === '/oauth/token/accessible-resources'
          ? { status: 200, body: [sites[0]] }
          : { status: 200, body: { id: '7', title: 'Page', status: 'current', version: { number: 1 } } };
      const call = await toolset(['confluence_get_page', 'confluence_delete_page_property']);

      await call('confluence_get_page', { id: '7' }).catch(() => undefined);
      connectionMetadata = { cloudId: 'site-b' };
      await call('confluence_delete_page_property', { pageId: '7', propertyId: '9' });

      expect(requests.map(request => `${request.method} ${request.target.split('?')[0]}`)).toEqual([
        'GET /oauth/token/accessible-resources',
        'GET /ex/confluence/site-a/wiki/api/v2/pages/7',
        'DELETE /ex/confluence/site-b/wiki/api/v2/pages/7/properties/9',
      ]);
    });

    it('reads and updates a footer comment on the site the connection config names, even when metadata disagrees', async () => {
      connectionConfig = { cloudId: 'site-a' };
      connectionMetadata = { cloudId: 'site-b' };
      const call = await toolset(['confluence_get_footer_comment', 'confluence_update_footer_comment']);

      await call('confluence_get_footer_comment', { commentId: '9' }).catch(() => undefined);
      await call('confluence_update_footer_comment', { comment_id: '9', version_number: 2, body: '<p>hi</p>' }).catch(
        () => undefined,
      );

      expect(requests.map(request => `${request.method} ${request.target.split('?')[0]}`)).toEqual([
        'GET /ex/confluence/site-a/wiki/api/v2/footer-comments/9',
        'PUT /ex/confluence/site-a/wiki/api/v2/footer-comments/9',
      ]);
    });

    it('updates a footer comment on the site the metadata names when the connection config has none', async () => {
      connectionMetadata = { cloudId: 'site-b' };
      const call = await toolset(['confluence_update_footer_comment']);

      await call('confluence_update_footer_comment', { comment_id: '9', version_number: 2, body: '<p>hi</p>' }).catch(
        () => undefined,
      );

      expect(requests.map(request => `${request.method} ${request.target}`)).toEqual([
        'PUT /ex/confluence/site-b/wiki/api/v2/footer-comments/9',
      ]);
    });

    it.each([
      ['confluence_delete_page_property', { pageId: '7', propertyId: '9' }],
      ['confluence_create_page', { spaceId: '42', title: 'Page' }],
      ['confluence_update_footer_comment', { comment_id: '9', version_number: 2, body: '<p>hi</p>' }],
      ['confluence_get_space', { id: 42 }],
    ])('%s refuses to guess a site when none is chosen', async (toolId, input) => {
      const call = await toolset([toolId]);

      for (let attempt = 0; attempt < 2; attempt++) {
        await expect(call(toolId, input)).rejects.toThrow(/Multiple Confluence sites/);
      }

      // Only site lookups went out, and the refusal left no site cached for the
      // second call to pick up.
      expect(requests.map(request => request.target)).toEqual([
        '/oauth/token/accessible-resources',
        '/oauth/token/accessible-resources',
      ]);
    });
  });

  describe('reading what Confluence actually returns', () => {
    const page = {
      id: '7',
      spaceId: '42',
      status: 'current',
      title: 'Runbook',
      authorId: 'user-1',
      createdAt: '2026-01-01T00:00:00Z',
      parentId: null,
      parentType: null,
      lastOwnerId: null,
      version: { number: 3, message: '', minorEdit: false, authorId: 'user-1', createdAt: '2026-01-02T00:00:00Z' },
    };

    it('returns the id of a page it created even when Confluence sends null owner and position', async () => {
      answer = () => ({ status: 200, body: { ...page, ownerId: null, position: null } });

      const result = (await run('confluence_create_page', { spaceId: '42', title: 'Runbook' })) as Record<
        string,
        unknown
      >;

      expect(result.id).toBe('7');
      expect(result).not.toHaveProperty('ownerId');
      expect(result).not.toHaveProperty('position');
    });

    it('lists space pages whose owner and position are null', async () => {
      answer = () => ({ status: 200, body: { results: [{ ...page, ownerId: null, position: null }], _links: {} } });

      const result = (await run('confluence_list_space_pages', { space_id: '42' })) as { pages?: unknown[] };

      expect(JSON.stringify(result)).toContain('"id":"7"');
    });

    it('lists root pages for a label whose parent, owner, position, and subtype are null', async () => {
      answer = () => ({
        status: 200,
        body: { results: [{ ...page, ownerId: null, position: null, subtype: null }], _links: {} },
      });

      const result = await run('confluence_list_pages_for_label', { label_id: '5' });

      expect(JSON.stringify(result)).toContain('"id":"7"');
      expect(JSON.stringify(result)).not.toContain('null');
    });

    it('asks for each included collection with its own v2 parameter', async () => {
      answer = () => ({
        status: 200,
        body: {
          id: '8',
          status: 'current',
          title: 'News',
          spaceId: '42',
          labels: { results: [{ id: '1', name: 'release' }], meta: { hasMore: false }, _links: {} },
          likes: { results: [], meta: { hasMore: false }, _links: {} },
        },
      });

      const result = (await run('confluence_get_blog_post', {
        id: '8',
        include_labels: true,
        include_likes: true,
      })) as Record<string, unknown>;

      const query = new URL(requests[0]!.target, 'http://x').searchParams;
      expect(query.get('include-labels')).toBe('true');
      expect(query.get('include-likes')).toBe('true');
      expect(query.has('include')).toBe(false);
      expect(result.labels).toMatchObject({ results: [{ name: 'release' }] });
    });
  });

  describe('reading included content', () => {
    const unresolved = {
      id: '31',
      status: 'current',
      pageId: '7',
      resolutionStatus: 'open',
      resolutionLastModifierId: null,
      resolutionLastModifiedAt: null,
    };

    it.each([
      ['unresolved', unresolved],
      [
        'resolved',
        {
          ...unresolved,
          resolutionStatus: 'resolved',
          resolutionLastModifierId: 'acct-1',
          resolutionLastModifiedAt: '2026-11-23T00:00:00Z',
        },
      ],
    ])('reads back an %s inline comment it just created', async (_state, comment) => {
      answer = () => ({ status: 200, body: comment });
      const call = await toolset(['confluence_create_inline_comment', 'confluence_get_inline_comment']);

      const created = (await call('confluence_create_inline_comment', {
        pageId: '7',
        body: { representation: 'storage', value: '<p>hi</p>' },
        inlineCommentProperties: { textSelection: 'hi', textSelectionMatchCount: 1, textSelectionMatchIndex: 0 },
      })) as { id: string };
      const read = (await call('confluence_get_inline_comment', { commentId: created.id })) as Record<string, unknown>;

      expect(read).toMatchObject({ id: '31', resolutionStatus: comment.resolutionStatus });
    });

    it('returns the values of the attachment properties it was asked to include', async () => {
      answer = () => ({
        status: 200,
        body: {
          id: 'att1',
          title: 'file.txt',
          properties: { results: [{ id: 'p1', key: 'reviewed', value: { by: 'ada', at: 3 } }], meta: {}, _links: {} },
        },
      });

      const result = (await run('confluence_get_attachment', { id: 'att1', includeProperties: true })) as {
        properties?: { results?: Array<{ key: string; value?: unknown }> };
      };

      expect(new URLSearchParams(requests[0]!.target.split('?')[1]).get('include-properties')).toBe('true');
      expect(result.properties?.results).toEqual([{ id: 'p1', key: 'reviewed', value: { by: 'ada', at: 3 } }]);
    });

    it.each([
      ['a null value', null],
      ['nulls nested in objects and arrays', { owner: null, reviewers: ['ada', null], meta: { due: null, tags: [] } }],
    ])('returns page properties holding %s as stored', async (_shape, value) => {
      answer = () => ({
        status: 200,
        body: {
          id: '7',
          title: 'Runbook',
          // Confluence sends null for a root page's parent; the page itself still drops it.
          parentId: null,
          properties: { results: [{ id: 'p1', key: 'review', value }], meta: { cursor: null }, _links: {} },
        },
      });

      const result = (await run('confluence_get_page', { id: '7', includeProperties: true })) as Record<
        string,
        unknown
      > & {
        properties?: { results?: Array<{ key: string; value?: unknown }>; meta?: Record<string, unknown> };
      };

      expect(result.properties?.results).toEqual([{ id: 'p1', key: 'review', value }]);
      expect(result).not.toHaveProperty('parentId', null);
      expect(result.properties?.meta).not.toHaveProperty('cursor', null);
    });
  });

  describe('updating drafts', () => {
    it.each([
      ['confluence_update_page', { id: '7', title: 'Runbook', status: 'draft', body: '<p>x</p>' }, '/pages/7'],
      ['confluence_update_blog_post', { id: '8', status: 'draft' }, '/blogposts/8'],
    ])('%s sends version 1 for a draft', async (toolId, input, path) => {
      answer = () => ({
        status: 200,
        body: { id: path.split('/')[2], status: 'draft', title: 'T', version: { number: 4 } },
      });

      await run(toolId, input);

      const put = requests.find(request => request.method === 'PUT');
      expect(put?.target).toContain(path);
      expect(put?.body).toMatchObject({ version: { number: 1 } });
    });

    it('still increments the version of a published page', async () => {
      answer = () => ({ status: 200, body: { id: '7', status: 'current', title: 'T', version: { number: 4 } } });

      await run('confluence_update_page', { id: '7', title: 'T', status: 'current', body: '<p>x</p>' });

      expect(requests.find(request => request.method === 'PUT')?.body).toMatchObject({ version: { number: 5 } });
    });
  });

  describe('refusing inputs Confluence would reject', () => {
    it.each([
      ['confluence_create_footer_comment', { bodyValue: '<p>hi</p>' }],
      ['confluence_create_footer_comment', { pageId: '7', blogPostId: '8', bodyValue: '<p>hi</p>' }],
      ['confluence_create_inline_comment', { body: '<p>hi</p>' }],
      ['confluence_update_inline_comment', { commentId: '9' }],
      ['confluence_list_pages', { subType: 'blogpost' }],
      ['confluence_list_pages', { sort: 'title asc' }],
      ['confluence_list_pages', { bodyFormat: 'view' }],
      ['confluence_list_blog_posts', { sort: 'created-date desc' }],
      ['confluence_list_page_footer_comments', { pageId: '7?x=1' }],
      ['confluence_list_space_pages', { space_id: '42', sort: 'createdAt' }],
      ['confluence_list_space_pages', { space_id: '42', sort: '-position' }],
      ['confluence_delete_page_property', { pageId: 7, propertyId: '9' }],
      ['confluence_delete_page_property', { pageId: '7', propertyId: '9/../1' }],
    ])('%s refuses %j before calling Confluence', async (toolId, input) => {
      await expect(run(toolId, input)).rejects.toThrow(/failed validation/);
      expect(requests.filter(request => request.target.includes('/wiki/'))).toEqual([]);
    });

    it.each(['created-date', '-created-date', 'modified-date', '-modified-date', 'title', '-id'])(
      'lists space pages sorted by %s',
      async sort => {
        answer = () => ({ status: 200, body: { results: [], _links: {} } });

        await run('confluence_list_space_pages', { space_id: '42', sort });

        expect(new URLSearchParams(requests[0]!.target.split('?')[1]).get('sort')).toBe(sort);
      },
    );

    it('deletes a page property by ids too large for a JavaScript number', async () => {
      const pageId = '9007199254740993';
      const propertyId = '18446744073709551615';

      await run('confluence_delete_page_property', { pageId, propertyId });

      expect(requests.map(request => `${request.method} ${request.target}`)).toEqual([
        `DELETE /ex/confluence/${CLOUD_ID}/wiki/api/v2/pages/${pageId}/properties/${propertyId}`,
      ]);
    });

    it.each([
      [{ pageId: '7' }, 'pageId'],
      [{ blogPostId: '8' }, 'blogPostId'],
      [{ parentCommentId: '9' }, 'parentCommentId'],
    ])('creates a footer comment on the one target %o', async (target, key) => {
      answer = () => ({ status: 200, body: { id: '21', ...target } });

      await run('confluence_create_footer_comment', { ...target, bodyValue: '<p>hi</p>' }).catch(() => undefined);

      const post = requests.find(request => request.method === 'POST');
      expect(post?.body).toMatchObject({ [key]: Object.values(target)[0] });
    });

    it('keeps the target checks in the input schemas, not in execute', () => {
      const dir = resolve(import.meta.dirname, '../providers/confluence/tools');
      const read = (file: string) => readFileSync(resolve(dir, file), 'utf8');
      expect(read('create-footer-comment.ts')).not.toMatch(/multiple_targets|missing_target/);
      expect(read('create-inline-comment.ts')).not.toMatch(/if \(!input\.pageId && !input\.blogPostId/);
      expect(read('update-inline-comment.ts')).not.toMatch(
        /if \(input\.body === undefined && input\.resolved === undefined\)/,
      );
    });

    it('lists footer comments of a page id given as a numeric string', async () => {
      answer = () => ({ status: 200, body: { results: [], _links: {} } });

      await run('confluence_list_page_footer_comments', { pageId: '123456' });

      expect(requests[0]?.target).toContain('/pages/123456/footer-comments');
    });
  });

  it('keeps a sibling declaration when it drops an unused site base', () => {
    const rewritten = dropConfluenceBaseUrlOverrides(
      `async function exec() {
  const limit = 25, baseUrl = \`https://api.atlassian.com/ex/confluence/\${cloudId}\`;
  return nango.get({ baseUrlOverride: baseUrl, endpoint: '/wiki/api/v2/pages', params: { limit } });
}`,
      'list-pages',
    );

    expect(rewritten).toContain('const limit = 25;');
    expect(rewritten).not.toContain('baseUrl');
    expect(rewritten).toContain('`/ex/confluence/${cloudId}/wiki/api/v2/pages`');
  });

  it('never sets a base URL override in any generated tool', () => {
    const directory = resolve(import.meta.dirname, '../providers/confluence/tools');
    const offenders = readdirSync(directory).filter(file =>
      readFileSync(resolve(directory, file), 'utf8').includes('baseUrlOverride'),
    );
    expect(offenders).toEqual([]);
  });
});
