import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';

import { createDiscordTools } from '../providers/discord/tools.js';
import { createGithubTools } from '../providers/github/tools.js';
import { createHubspotTools } from '../providers/hubspot/tools.js';
import { createSlackTools } from '../providers/slack/tools.js';
import { createStripeTools } from '../providers/stripe/tools.js';

const client = (fetchMock: typeof fetch) => ({
  baseUrl: 'https://platform.example.test',
  accessToken: 'test-platform-token',
  fetch: fetchMock,
});

describe('slack_search_channels', () => {
  it('scans multiple pages and returns only channels matching the query', async () => {
    const pageOne = {
      channels: [
        { id: 'C1', name: 'general', created: 1, creator: 'U1', is_archived: false, is_general: true },
        { id: 'C2', name: 'random', created: 1, creator: 'U1', is_archived: false },
      ],
      response_metadata: { next_cursor: 'cursor-2' },
    };
    const pageTwo = {
      channels: [
        { id: 'C3', name: 'eng-platform', created: 1, creator: 'U1', is_archived: false },
        { id: 'C4', name: 'platform-alerts', created: 1, creator: 'U1', is_archived: false },
      ],
      response_metadata: { next_cursor: '' },
    };
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async input => {
      const url = new URL(String(input));
      return Response.json(url.searchParams.get('cursor') === 'cursor-2' ? pageTwo : pageOne);
    });

    const tools = createSlackTools({ connectionId: 'connection', client: client(fetchMock) });
    const result = await tools.slack_search_channels!.execute!(
      { query: '#Platform' },
      { requestContext: new RequestContext() },
    );

    expect(result.total).toBe(2);
    expect(result.conversations.map(channel => channel.id)).toEqual(['C3', 'C4']);
    expect(result.next_cursor).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('stops early mid-page and resumes from the remaining channels without skipping matches', async () => {
    const page = {
      channels: [
        { id: 'C1', name: 'team-a', created: 1, creator: 'U1', is_archived: false },
        { id: 'C2', name: 'team-b', created: 1, creator: 'U1', is_archived: false },
      ],
      response_metadata: { next_cursor: 'cursor-2' },
    };
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => Response.json(page));

    const tools = createSlackTools({ connectionId: 'connection', client: client(fetchMock) });
    const first = await tools.slack_search_channels!.execute!(
      { query: 'team', limit: 1 },
      { requestContext: new RequestContext() },
    );

    expect(first.total).toBe(1);
    expect(first.conversations[0]!.id).toBe('C1');
    // Stopped mid-page: the cursor must re-enter this page at the next
    // channel, not jump to the following Slack page and skip C2.
    expect(first.next_cursor).toBe('offset:1:');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const second = await tools.slack_search_channels!.execute!(
      { query: 'team', limit: 1, cursor: first.next_cursor },
      { requestContext: new RequestContext() },
    );

    expect(second.total).toBe(1);
    expect(second.conversations[0]!.id).toBe('C2');
    // C2 was the last channel on the page, so the continuation advances to
    // Slack's own next page cursor.
    expect(second.next_cursor).toBe('cursor-2');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('github search tools', () => {
  it('searches issues and flags pull requests', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () =>
      Response.json({
        total_count: 2,
        incomplete_results: false,
        items: [
          {
            id: 1,
            number: 10,
            title: 'Bug report',
            state: 'open',
            html_url: 'https://github.com/o/r/issues/10',
            repository_url: 'https://api.github.com/repos/o/r',
            user: { login: 'alice' },
            labels: [{ name: 'bug' }],
            comments: 3,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-02T00:00:00Z',
          },
          {
            id: 2,
            number: 11,
            title: 'Fix bug',
            state: 'open',
            html_url: 'https://github.com/o/r/pull/11',
            repository_url: 'https://api.github.com/repos/o/r',
            user: { login: 'bob' },
            labels: [],
            pull_request: { url: 'https://api.github.com/repos/o/r/pulls/11' },
            comments: 0,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-02T00:00:00Z',
          },
        ],
      }),
    );

    const tools = createGithubTools({ connectionId: 'connection', client: client(fetchMock) });
    const result = await tools.github_search_issues!.execute!(
      { q: 'repo:o/r is:open bug' },
      { requestContext: new RequestContext() },
    );

    expect(result.total_count).toBe(2);
    expect(result.items[0]).toMatchObject({ number: 10, user_login: 'alice', labels: ['bug'], is_pull_request: false });
    expect(result.items[1]).toMatchObject({ number: 11, is_pull_request: true });
    expect(result.next_cursor).toBeUndefined();
    const requestUrl = new URL(String(fetchMock.mock.calls[0]![0]));
    expect(requestUrl.pathname).toBe('/v2/connections/connection/proxy/search/issues');
    expect(requestUrl.searchParams.get('q')).toBe('repo:o/r is:open bug');
  });

  it('paginates repository search results', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () =>
      Response.json({
        total_count: 5,
        incomplete_results: false,
        items: [
          {
            id: 1,
            name: 'mastra',
            full_name: 'mastra-ai/mastra',
            owner: { login: 'mastra-ai' },
            html_url: 'https://github.com/mastra-ai/mastra',
            description: 'framework',
            private: false,
            fork: false,
            language: 'TypeScript',
            stargazers_count: 1000,
          },
        ],
      }),
    );

    const tools = createGithubTools({ connectionId: 'connection', client: client(fetchMock) });
    const result = await tools.github_search_repositories!.execute!(
      { q: 'org:mastra-ai mastra', per_page: 1 },
      { requestContext: new RequestContext() },
    );

    expect(result.items[0]).toMatchObject({ full_name: 'mastra-ai/mastra', owner_login: 'mastra-ai' });
    expect(result.next_cursor).toBe('2');
  });

  it("does not emit a cursor past GitHub's 1,000-result search window", async () => {
    const items = Array.from({ length: 10 }, (_, index) => ({
      id: index,
      number: index,
      title: `Issue ${index}`,
      state: 'open',
      html_url: `https://github.com/o/r/issues/${index}`,
      repository_url: 'https://api.github.com/repos/o/r',
      labels: [],
      comments: 0,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z',
    }));
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => Response.json({ total_count: 5000, incomplete_results: false, items }));

    const tools = createGithubTools({ connectionId: 'connection', client: client(fetchMock) });
    const result = await tools.github_search_issues!.execute!(
      // Page 100 of 10 per page is the last page GitHub will serve.
      { q: 'repo:o/r is:issue', per_page: 10, cursor: '100' },
      { requestContext: new RequestContext() },
    );

    expect(result.total_count).toBe(5000);
    expect(result.items).toHaveLength(10);
    expect(result.next_cursor).toBeUndefined();
  });

  it('searches code and surfaces the owning repository', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () =>
      Response.json({
        total_count: 1,
        incomplete_results: false,
        items: [
          {
            name: 'tools.ts',
            path: 'src/tools.ts',
            sha: 'abc123',
            html_url: 'https://github.com/o/r/blob/main/src/tools.ts',
            repository: { full_name: 'o/r' },
          },
        ],
      }),
    );

    const tools = createGithubTools({ connectionId: 'connection', client: client(fetchMock) });
    const result = await tools.github_search_code!.execute!(
      { q: 'createTool repo:o/r' },
      { requestContext: new RequestContext() },
    );

    expect(result.items).toEqual([
      {
        name: 'tools.ts',
        path: 'src/tools.ts',
        sha: 'abc123',
        html_url: 'https://github.com/o/r/blob/main/src/tools.ts',
        repository_full_name: 'o/r',
      },
    ]);
  });
});

describe('hubspot_search_contacts', () => {
  it('sends free-text query and property filters to the CRM search endpoint', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () =>
      Response.json({
        results: [
          {
            id: '301',
            properties: {
              firstname: 'Jane',
              lastname: 'Doe',
              email: 'jane@example.com',
              createdate: '2026-01-01T00:00:00Z',
            },
          },
        ],
        paging: { next: { after: '301' } },
      }),
    );

    const tools = createHubspotTools({ connectionId: 'connection', client: client(fetchMock) });
    const result = await tools.hubspot_search_contacts!.execute!(
      { query: 'jane', lastname: 'Doe' },
      { requestContext: new RequestContext() },
    );

    expect(result.contacts).toEqual([
      {
        id: '301',
        firstname: 'Jane',
        lastname: 'Doe',
        email: 'jane@example.com',
        phone: undefined,
        company: undefined,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: undefined,
      },
    ]);
    expect(result.nextCursor).toBe('301');

    const [requestUrl, init] = fetchMock.mock.calls[0]!;
    expect(new URL(String(requestUrl)).pathname).toBe(
      '/v2/connections/connection/proxy/crm/v3/objects/contacts/search',
    );
    const body = JSON.parse(String(init?.body));
    expect(body.query).toBe('jane');
    expect(body.filterGroups).toEqual([
      { filters: [{ propertyName: 'lastname', operator: 'CONTAINS_TOKEN', value: 'Doe' }] },
    ]);
  });
});

describe('discord_search_members', () => {
  it('searches guild members by name prefix with the bot token', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async input => {
      const url = new URL(String(input));
      if (url.pathname === '/v2/connections/connection/context') {
        return Response.json({ connection_config: {}, metadata: null });
      }
      if (url.pathname === '/v2/connections/connection/credentials') {
        return Response.json({ type: 'api_key', apiKey: 'bot-token-1' });
      }
      return Response.json([
        {
          user: { id: 'U1', username: 'jane', discriminator: '0' },
          roles: ['R1'],
          joined_at: '2026-01-01T00:00:00Z',
          deaf: false,
          mute: false,
          flags: 0,
        },
      ]);
    });

    const tools = createDiscordTools({ connectionId: 'connection', client: client(fetchMock) });
    const result = await tools.discord_search_members!.execute!(
      { guild_id: 'G1', query: 'jan' },
      { requestContext: new RequestContext() },
    );

    expect(result.items).toEqual([
      {
        user: { id: 'U1', username: 'jane', discriminator: '0' },
        roles: ['R1'],
        joined_at: '2026-01-01T00:00:00Z',
        deaf: false,
        mute: false,
        flags: 0,
      },
    ]);

    const searchCall = fetchMock.mock.calls.find(call => String(call[0]).includes('/members/search'));
    expect(searchCall).toBeDefined();
    const searchUrl = new URL(String(searchCall![0]));
    expect(searchUrl.pathname).toBe('/v2/connections/connection/proxy/api/v10/guilds/G1/members/search');
    expect(searchUrl.searchParams.get('query')).toBe('jan');
    expect(searchUrl.searchParams.get('limit')).toBe('25');
  });
});

describe('stripe_search_customers', () => {
  it('searches customers with the Stripe search query language', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () =>
      Response.json({
        object: 'search_result',
        data: [{ id: 'cus_1', object: 'customer', email: 'jane@example.com', name: 'Jane', created: 1700000000 }],
        has_more: true,
        next_page: 'page-token',
      }),
    );

    const tools = createStripeTools({ connectionId: 'connection', client: client(fetchMock) });
    const result = await tools.stripe_search_customers!.execute!(
      { query: 'email:"jane@example.com"', limit: 1 },
      { requestContext: new RequestContext() },
    );

    expect(result.customers).toEqual([
      {
        id: 'cus_1',
        email: 'jane@example.com',
        name: 'Jane',
        description: undefined,
        created: 1700000000,
        currency: undefined,
        delinquent: undefined,
        livemode: undefined,
        metadata: undefined,
      },
    ]);
    expect(result.next_cursor).toBe('page-token');

    const requestUrl = new URL(String(fetchMock.mock.calls[0]![0]));
    expect(requestUrl.pathname).toBe('/v2/connections/connection/proxy/v1/customers/search');
    expect(requestUrl.searchParams.get('query')).toBe('email:"jane@example.com"');
    expect(requestUrl.searchParams.get('page')).toBeNull();
  });
});
