import { once } from 'node:events';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { RequestContext } from '@mastra/core/request-context';
import { isValidationError } from '@mastra/core/tools';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { tools } from '../tools.js';

// The Zendesk tools run through the public `tools()` resolver against a real
// HTTP server standing in for the Mastra platform, so each test sees the exact
// request that would reach Zendesk through the proxy.

const connection = {
  id: 'zd_test',
  integrationId: 'zendesk',
  status: 'active',
  connectedByUserId: 'user_1',
  connectedAt: '2026-01-01T00:00:00Z',
  createdAt: '2026-01-01T00:00:00Z',
  accountLabel: 'acme',
  displayName: null,
  resourceId: null,
};

const integration = {
  id: 'zendesk',
  provider: 'zendesk',
  displayName: 'Zendesk',
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
  body?: unknown;
}

const article = {
  id: 901,
  title: 'Restart the printer',
  body: '<p>Turn it off and on.</p>',
  locale: 'en-us',
  section_id: 77,
  author_id: 5,
  permission_group_id: 3,
  user_segment_id: null,
  draft: true,
  promoted: false,
  position: 0,
  comments_disabled: false,
  label_names: [],
  html_url: 'https://acme.zendesk.com/hc/en-us/articles/901',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('Zendesk tools', () => {
  let server: Server;
  let baseUrl: string;
  let requests: RecordedRequest[];
  let answer: (target: string) => { status: number; body: unknown };
  let resolutions = 0;

  beforeAll(async () => {
    server = createServer(async (request, response) => {
      const target = request.url ?? '/';
      const send = (status: number, body: unknown) => {
        response.writeHead(status, { 'content-type': 'application/json' });
        response.end(body === undefined ? '' : JSON.stringify(body));
      };
      if (target.endsWith('/connections')) return send(200, { connections: [connection] });
      if (target.endsWith('/integrations')) return send(200, { integrations: [integration] });
      if (!target.startsWith(PROXY_PREFIX)) return send(404, { error: `unexpected request ${target}` });
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(chunk as Buffer);
      const raw = Buffer.concat(chunks).toString('utf8');
      requests.push({
        method: request.method,
        target: target.slice(PROXY_PREFIX.length),
        ...(raw && { body: JSON.parse(raw) }),
      });
      const { status, body } = answer(target.slice(PROXY_PREFIX.length));
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
    answer = () => ({ status: 204, body: undefined });
  });

  async function run(toolId: string, input: Record<string, unknown>) {
    const resolved = await tools({
      providers: { zendesk: { connectionId: connection.id } },
      allowTools: [toolId],
      projectId: `proj_${++resolutions}`,
      client: { accessToken: 'test-platform-token', baseUrl },
    })();
    const tool = resolved[toolId] as
      | { execute?: (input: unknown, context: { requestContext: RequestContext }) => Promise<unknown> }
      | undefined;
    if (!tool?.execute) throw new Error(`${toolId} was not resolved`);
    const result = await tool.execute(input, { requestContext: new RequestContext() });
    if (isValidationError(result)) throw new Error(`${toolId} failed validation: ${result.message}`);
    return result;
  }

  async function expectRefused(toolId: string, input: Record<string, unknown>) {
    await expect(run(toolId, input)).rejects.toThrow(/failed validation/);
    expect(requests).toEqual([]);
  }

  describe('retries', () => {
    it.each([
      ['zendesk_create_ticket', { subject: 'Printer', comment: 'It is on fire' }, 'POST', '/api/v2/tickets.json'],
      ['zendesk_update_ticket', { ticket_id: 12, status: 'solved' }, 'PUT', '/api/v2/tickets/12.json'],
      ['zendesk_delete_user', { userId: '34' }, 'DELETE', '/api/v2/users/34.json'],
    ])('%s does not replay a write after a transient 5xx', async (toolId, input, method, target) => {
      answer = () => ({ status: 502, body: { error: 'bad gateway' } });

      await expect(run(toolId, input)).rejects.toThrow();

      expect(requests).toEqual([expect.objectContaining({ method, target })]);
    });

    it('still retries reads after a transient 5xx', async () => {
      answer = () => ({ status: 502, body: { error: 'bad gateway' } });

      await expect(run('zendesk_get_ticket', { ticket_id: 12 })).rejects.toThrow();

      expect(requests).toEqual(
        Array.from({ length: 3 }, () => expect.objectContaining({ method: 'GET', target: '/api/v2/tickets/12.json' })),
      );
    });
  });

  describe('deletes', () => {
    it.each([
      ['zendesk_delete_ticket', { ticket_id: 12 }, '/api/v2/tickets/12.json', { ticket_id: 12 }],
      ['zendesk_delete_organization', { organization_id: 8 }, '/api/v2/organizations/8.json', { organization_id: 8 }],
      ['zendesk_archive_article', { article_id: 901 }, '/api/v2/help_center/articles/901', { article_id: 901 }],
      ['zendesk_delete_section', { section_id: 77 }, '/api/v2/help_center/sections/77', { section_id: 77 }],
      ['zendesk_delete_category', { category_id: 6 }, '/api/v2/help_center/categories/6', { category_id: 6 }],
    ])('%s deletes once and reports the id', async (toolId, input, target, reported) => {
      await expect(run(toolId, input)).resolves.toEqual({ success: true, ...reported });

      expect(requests).toEqual([{ method: 'DELETE', target }]);
    });

    it('reports a failed delete instead of success', async () => {
      answer = () => ({ status: 404, body: { error: 'RecordNotFound' } });

      await expect(run('zendesk_delete_ticket', { ticket_id: 12 })).rejects.toThrow();
    });

    it('refuses an id that is not a positive integer', async () => {
      await expectRefused('zendesk_delete_ticket', { ticket_id: 1.5 });
      await expectRefused('zendesk_delete_category', { category_id: -6 });
    });
  });

  describe('articles', () => {
    it('creates an article visible to everyone without emailing subscribers', async () => {
      answer = () => ({ status: 201, body: { article } });

      const result = await run('zendesk_create_article', {
        section_id: 77,
        title: 'Restart the printer',
        body: '<p>Turn it off and on.</p>',
        locale: 'en-us',
        permission_group_id: 3,
        user_segment_id: null,
        draft: true,
      });

      expect(requests).toEqual([
        {
          method: 'POST',
          target: '/api/v2/help_center/sections/77/articles',
          body: {
            article: {
              title: 'Restart the printer',
              body: '<p>Turn it off and on.</p>',
              locale: 'en-us',
              permission_group_id: 3,
              user_segment_id: null,
              draft: true,
            },
            notify_subscribers: false,
          },
        },
      ]);
      expect(result).toMatchObject({ id: 901, section_id: 77, user_segment_id: null, draft: true });
    });

    it.each([
      [{ user_segment_id: null, user_segment_ids: [] }, null, []],
      [{ user_segment_id: 41 }, 41, [41]],
      [{ user_segment_id: null, user_segment_ids: [41, 42] }, null, [41, 42]],
    ])('reports who can see an article (%o)', async (audience, user_segment_id, user_segment_ids) => {
      answer = () => ({ status: 200, body: { article: { ...article, ...audience } } });

      const result = await run('zendesk_update_article', { article_id: 901, promoted: true });

      expect(result).toMatchObject({ user_segment_id, user_segment_ids });
    });

    it('sends only the article settings it was given', async () => {
      answer = () => ({ status: 200, body: { article: { ...article, label_names: ['printer'] } } });

      const result = await run('zendesk_update_article', { article_id: 901, label_names: ['printer'] });

      expect(requests).toEqual([
        { method: 'PUT', target: '/api/v2/help_center/articles/901', body: { article: { label_names: ['printer'] } } },
      ]);
      expect(result).toMatchObject({ id: 901, label_names: ['printer'] });
    });

    it('refuses an article update with nothing to change', async () => {
      await expectRefused('zendesk_update_article', { article_id: 901 });
    });

    it("edits one language's title and body", async () => {
      answer = () => ({
        status: 200,
        body: {
          translation: {
            id: 4401,
            source_id: 901,
            locale: 'fr',
            title: 'Redémarrer',
            body: '<p>Éteindre.</p>',
            draft: false,
            outdated: false,
            html_url: null,
          },
        },
      });

      const result = await run('zendesk_update_article_translation', {
        article_id: 901,
        locale: 'fr',
        title: 'Redémarrer',
        body: '<p>Éteindre.</p>',
      });

      expect(requests).toEqual([
        {
          method: 'PUT',
          target: '/api/v2/help_center/articles/901/translations/fr',
          body: { translation: { title: 'Redémarrer', body: '<p>Éteindre.</p>' } },
        },
      ]);
      expect(result).toEqual({
        id: 4401,
        article_id: 901,
        locale: 'fr',
        title: 'Redémarrer',
        body: '<p>Éteindre.</p>',
        draft: false,
        outdated: false,
      });
    });

    it('refuses a translation update with nothing to change', async () => {
      await expectRefused('zendesk_update_article_translation', { article_id: 901, locale: 'en-us' });
    });

    it('refuses a locale that would change the request path', async () => {
      await expectRefused('zendesk_update_article_translation', { article_id: 901, locale: '../901', title: 'x' });
    });
  });

  describe('permission groups', () => {
    it('pages with Zendesk cursors', async () => {
      answer = () => ({
        status: 200,
        body: {
          permission_groups: [{ id: 3, name: 'Admins', built_in: true, publish: [1], edit: [1] }],
          meta: { has_more: true, after_cursor: 'abc' },
        },
      });

      const result = await run('zendesk_list_permission_groups', { cursor: 'xyz', page_size: 10 });

      expect(requests).toEqual([
        { method: 'GET', target: '/api/v2/guide/permission_groups?page%5Bsize%5D=10&page%5Bafter%5D=xyz' },
      ]);
      expect(result).toEqual({
        permission_groups: [{ id: 3, name: 'Admins', built_in: true, publish: [1], edit: [1] }],
        next_cursor: 'abc',
      });
    });

    it('stops paging on the last page', async () => {
      answer = () => ({
        status: 200,
        body: { permission_groups: [], meta: { has_more: false, after_cursor: 'abc' } },
      });

      await expect(run('zendesk_list_permission_groups', {})).resolves.toEqual({ permission_groups: [] });
    });
  });
  describe('custom fields', () => {
    const ticket = {
      id: 12,
      url: 'https://acme.zendesk.com/api/v2/tickets/12.json',
      status: 'open',
      requester_id: 5,
      submitter_id: 5,
      has_incidents: false,
      is_public: true,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z',
    };

    it('sets a multi-select field and clears another', async () => {
      const custom_fields = [
        { id: 301, value: ['hardware', 'printer'] },
        { id: 302, value: null },
      ];
      answer = () => ({ status: 200, body: { ticket: { ...ticket, custom_fields, fields: custom_fields } } });

      const result = await run('zendesk_update_ticket', { ticket_id: 12, custom_fields });

      expect(requests).toEqual([
        { method: 'PUT', target: '/api/v2/tickets/12.json', body: { ticket: { custom_fields } } },
      ]);
      expect(result).toMatchObject({ id: 12, custom_fields });
    });
  });

  describe('content tags', () => {
    const tagged = {
      id: 901,
      title: 'Restart the printer',
      locale: 'en-us',
      content_tag_ids: ['01GT23D51Y', '01GT23FWWN'],
    };

    it('reads an article with content tags', async () => {
      answer = () => ({ status: 200, body: { article: tagged } });

      await expect(run('zendesk_get_article', { article_id: 901 })).resolves.toMatchObject({
        content_tag_ids: ['01GT23D51Y', '01GT23FWWN'],
      });
    });

    it('lists articles with content tags', async () => {
      answer = () => ({ status: 200, body: { articles: [tagged], next_page: null } });

      const result = (await run('zendesk_list_articles', { locale: 'en-us' })) as { articles: unknown[] };

      expect(result.articles).toEqual([expect.objectContaining({ content_tag_ids: ['01GT23D51Y', '01GT23FWWN'] })]);
    });
  });

  describe('cursor pages', () => {
    const pages = [
      ['zendesk_get_ticket_comments', { ticket_id: 12, per_page: 1 }, 'comments', { id: 1 }],
      [
        'zendesk_list_groups',
        {},
        'groups',
        {
          id: 1,
          name: 'Support',
          url: 'https://acme.zendesk.com/api/v2/groups/1.json',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ],
      [
        'zendesk_list_tickets',
        {},
        'tickets',
        { id: 1, url: 'https://acme.zendesk.com/api/v2/tickets/1.json', status: 'open' },
      ],
      ['zendesk_list_users', {}, 'users', { id: 1 }],
      ['zendesk_list_views', {}, 'views', { id: 1, title: 'Unsolved' }],
    ] as const;

    it.each(pages)('%s reads the last page, where Zendesk sends null cursors', async (toolId, input, key, record) => {
      answer = () => ({
        status: 200,
        body: {
          [key]: [record],
          meta: { has_more: false, after_cursor: null, before_cursor: null },
          links: { next: null, prev: null },
        },
      });

      const result = (await run(toolId, input)) as Record<string, unknown>;

      expect(result[key] ?? result.items).toHaveLength(1);
      expect(result.next_cursor).toBeUndefined();
    });

    it.each(pages)('%s offers no cursor once Zendesk has nothing more', async (toolId, input, key, record) => {
      answer = () => ({
        status: 200,
        body: { [key]: [record], meta: { has_more: false, after_cursor: 'end', before_cursor: 'start' } },
      });

      const result = (await run(toolId, input)) as Record<string, unknown>;

      expect(result.next_cursor).toBeUndefined();
    });

    it.each(pages)('%s hands back the cursor while more remain', async (toolId, input, key, record) => {
      answer = () => ({
        status: 200,
        body: { [key]: [record], meta: { has_more: true, after_cursor: 'next', before_cursor: null } },
      });

      const result = (await run(toolId, input)) as Record<string, unknown>;

      expect(result.next_cursor).toBe('next');
    });
  });

  it("warns that setting a user's organization replaces their others", async () => {
    const resolved = await tools({
      providers: { zendesk: { connectionId: connection.id } },
      allowTools: ['zendesk_update_user'],
      projectId: `proj_${++resolutions}`,
      client: { accessToken: 'test-platform-token', baseUrl },
    })();
    const schema = (
      resolved.zendesk_update_user as { inputSchema: { shape: Record<string, { description?: string }> } }
    ).inputSchema;

    expect(schema.shape.organizationId?.description).toMatch(/removes the user from every other organization/i);
  });
  describe('paging comments and macros', () => {
    it('reads a long comment thread page by page without a page size', async () => {
      answer = () => ({
        status: 200,
        body: { comments: [{ id: 1 }], meta: { has_more: true, after_cursor: 'c2' } },
      });

      const result = await run('zendesk_get_ticket_comments', { ticket_id: 12 });

      expect(requests).toEqual([{ method: 'GET', target: '/api/v2/tickets/12/comments.json?page%5Bsize%5D=100' }]);
      expect(result).toMatchObject({ next_cursor: 'c2' });
    });

    it.each(['usage_1h', 'usage_24h', 'usage_7d', 'usage_30d'])(
      'refuses a %s macro sort, which Zendesk cannot cursor-page',
      async sort_by => {
        await expectRefused('zendesk_list_macros', { sort_by });
      },
    );

    it.each([{}, { per_page: 5 }])('pages macros with the cursor Zendesk answers (%o)', async input => {
      answer = () => ({
        status: 200,
        body: {
          macros: [{ id: 1, title: 'Close' }],
          links: { next: 'https://acme.zendesk.com/api/v2/macros.json?page%5Bafter%5D=m2&page%5Bsize%5D=5' },
          meta: { has_more: true, after_cursor: 'm2' },
        },
      });

      const result = await run('zendesk_list_macros', input);

      expect(requests[0]?.target).toBe(`/api/v2/macros.json?page%5Bsize%5D=${'per_page' in input ? 5 : 100}`);
      expect(result).toMatchObject({ next_cursor: 'm2' });
    });

    it('stops paging macros on the last page', async () => {
      answer = () => ({
        status: 200,
        body: { macros: [{ id: 1, title: 'Close' }], meta: { has_more: false, after_cursor: 'm2' } },
      });

      const result = (await run('zendesk_list_macros', { cursor: 'm1' })) as Record<string, unknown>;

      expect(requests[0]?.target).toBe('/api/v2/macros.json?page%5Bafter%5D=m1&page%5Bsize%5D=100');
      expect(result.next_cursor).toBeUndefined();
    });

    it.each([
      [{ sort_by: 'alphabetical' }, 'alphabetical'],
      [{ sort_by: 'alphabetical', sort_order: 'desc' }, '-alphabetical'],
      [{ sort_by: 'created_at' }, '-created_at'],
      [{ sort_by: 'updated_at', sort_order: 'asc' }, 'updated_at'],
      [{ sort_order: 'desc' }, '-alphabetical'],
    ])('sends macro sort %o as the cursor sort %s', async (input, sort) => {
      answer = () => ({ status: 200, body: { macros: [], meta: { has_more: false } } });

      await run('zendesk_list_macros', input);

      const params = new URLSearchParams(requests[0]!.target.split('?')[1]);
      expect(params.get('sort')).toBe(sort);
      expect(params.has('sort_by')).toBe(false);
      expect(params.has('sort_order')).toBe(false);
    });

    it('leaves the macro sort to Zendesk when none is asked for', async () => {
      answer = () => ({ status: 200, body: { macros: [], meta: { has_more: false } } });

      await run('zendesk_list_macros', {});

      expect(new URLSearchParams(requests[0]!.target.split('?')[1]).has('sort')).toBe(false);
    });
  });

  describe('article listings', () => {
    it.each([
      [{ section_id: '77', locale: 'fr' }, '/api/v2/help_center/fr/sections/77/articles'],
      [{ category_id: '6', locale: 'fr' }, '/api/v2/help_center/fr/categories/6/articles'],
      [{ section_id: '77' }, '/api/v2/help_center/sections/77/articles'],
    ])('lists %o in the requested language', async (input, target) => {
      answer = () => ({ status: 200, body: { articles: [], next_page: null } });

      await run('zendesk_list_articles', input);

      expect(requests).toEqual([{ method: 'GET', target }]);
    });
  });

  describe('tickets', () => {
    const ticket = {
      id: 12,
      url: 'https://acme.zendesk.com/api/v2/tickets/12.json',
      subject: 'Printer jam',
      status: 'open',
      group_id: null,
    };

    it('returns the sideloads it asks Zendesk for', async () => {
      const users = [{ id: 5, name: 'Ada' }];
      const groups = [{ id: 9, name: 'Support' }];
      answer = () => ({ status: 200, body: { ticket, users, groups } });

      const result = await run('zendesk_get_ticket', { ticket_id: 12, include: 'users,groups' });

      expect(requests).toEqual([{ method: 'GET', target: '/api/v2/tickets/12.json?include=users%2Cgroups' }]);
      expect(result).toEqual({
        id: 12,
        url: ticket.url,
        subject: 'Printer jam',
        status: 'open',
        sideloads: { users, groups },
      });
    });

    it('reads a ticket with no sideloads requested', async () => {
      answer = () => ({ status: 200, body: { ticket } });

      await expect(run('zendesk_get_ticket', { ticket_id: 12 })).resolves.toEqual({
        id: 12,
        url: ticket.url,
        subject: 'Printer jam',
        status: 'open',
      });
    });

    it('searches only tickets, so counts and pages describe tickets', async () => {
      answer = () => ({
        status: 200,
        body: {
          count: 1,
          next_page: null,
          previous_page: null,
          results: [
            {
              ...ticket,
              result_type: 'ticket',
              requester_id: 5,
              submitter_id: 5,
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z',
            },
          ],
        },
      });

      const result = await run('zendesk_search_tickets', { query: 'printer status:open' });

      expect(requests).toEqual([
        { method: 'GET', target: '/api/v2/search.json?query=type%3Aticket+printer+status%3Aopen' },
      ]);
      expect(result).toMatchObject({ count: 1, tickets: [expect.objectContaining({ id: 12 })] });
    });

    it('reports a ticket it cannot read instead of leaving it out of a counted page', async () => {
      answer = () => ({ status: 200, body: { count: 1, results: [{ id: 12, result_type: 'ticket' }] } });

      await expect(run('zendesk_search_tickets', { query: 'printer' })).rejects.toThrow();
    });

    it('keeps a query that already names tickets', async () => {
      answer = () => ({ status: 200, body: { count: 0, results: [] } });

      await run('zendesk_search_tickets', { query: 'type:ticket status:open' });

      expect(requests[0]?.target).toBe('/api/v2/search.json?query=type%3Aticket+status%3Aopen');
    });

    it('refuses a search for another record type', async () => {
      await expectRefused('zendesk_search_tickets', { query: 'type:user ada' });
    });

    it.each(['"example type:user note"', '"example type:ticket note"'])(
      'treats type: inside quoted text as text, not a filter (%s)',
      async query => {
        answer = () => ({ status: 200, body: { count: 0, results: [] } });

        await run('zendesk_search_tickets', { query });

        expect(new URL(requests[0]!.target, 'https://zendesk.test').searchParams.get('query')).toBe(
          `type:ticket ${query}`,
        );
      },
    );
  });
});
