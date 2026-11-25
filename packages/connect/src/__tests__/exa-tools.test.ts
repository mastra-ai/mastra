import { once } from 'node:events';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { RequestContext } from '@mastra/core/request-context';
import { isValidationError } from '@mastra/core/tools';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { tools } from '../tools.js';

// The Exa tools run through the public `tools()` resolver against a real HTTP
// server standing in for the Mastra platform, so each test sees the exact
// request that would reach Exa through the proxy.

interface ResolvedTool {
  execute?: (input: unknown, context: { requestContext: RequestContext }) => Promise<unknown>;
}

const connection = {
  id: 'exa_test',
  integrationId: 'exa',
  status: 'active',
  connectedByUserId: 'user_1',
  connectedAt: '2026-01-01T00:00:00Z',
  createdAt: '2026-01-01T00:00:00Z',
  accountLabel: null,
  displayName: null,
  resourceId: null,
};

const integration = {
  id: 'exa',
  provider: 'exa',
  displayName: 'Exa',
  logoUrl: '',
  authType: 'API_KEY',
  authFields: [],
  capabilities: { proxy: true, webhooks: false, mcp: false },
  surfaces: ['tools'],
  comingSoon: false,
  minConnectVersion: null,
};

const PROXY_PREFIX = `/v2/connections/${connection.id}/proxy`;

interface RecordedRequest {
  method: string | undefined;
  path: string;
  body?: Record<string, unknown>;
}

// A result as Exa sends it for a page that declares no title, date, image, or favicon.
const bareResult = {
  id: 'https://example.com/a',
  url: 'https://example.com/a',
  title: null,
  publishedDate: null,
  author: null,
  image: null,
  favicon: null,
  score: 0.5,
};

describe('Exa tools', () => {
  let server: Server;
  let baseUrl: string;
  let requests: RecordedRequest[];
  let answer: (request: RecordedRequest) => { status: number; body: unknown };

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
      const recorded: RecordedRequest = {
        method: request.method,
        path: new URL(target.slice(PROXY_PREFIX.length), 'http://exa.invalid').pathname,
        ...(raw && { body: JSON.parse(raw) }),
      };
      requests.push(recorded);
      const { status, body } = answer(recorded);
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
    answer = () => ({ status: 200, body: { results: [] } });
  });

  let resolutions = 0;
  async function run(toolId: string, input: Record<string, unknown>) {
    const resolved = await tools({
      providers: { exa: { connectionId: connection.id } },
      allowTools: [toolId],
      projectId: `proj_${++resolutions}`,
      client: { accessToken: 'test-platform-token', baseUrl },
    })();
    const tool = resolved[toolId] as ResolvedTool | undefined;
    if (!tool?.execute) throw new Error(`${toolId} was not resolved`);
    const result = await tool.execute(input, { requestContext: new RequestContext() });
    if (isValidationError(result)) throw new Error(`${toolId} failed validation: ${result.message}`);
    return result;
  }

  it('does not offer the deprecated find_similar tool', async () => {
    const resolved = await tools({
      providers: { exa: { connectionId: connection.id } },
      projectId: `proj_${++resolutions}`,
      client: { accessToken: 'test-platform-token', baseUrl },
    })();
    expect(Object.keys(resolved).sort()).toEqual(['exa_answer', 'exa_get_contents', 'exa_search']);
  });

  describe('search', () => {
    it('keeps a result whose title, date, image, and favicon are null', async () => {
      answer = () => ({ status: 200, body: { requestId: 'r1', results: [bareResult] } });

      const result = await run('exa_search', { query: 'agents' });

      expect(result).toMatchObject({ results: [{ id: bareResult.id, title: null, publishedDate: null }] });
    });

    it.each(['publication', 'people', 'company'])('accepts the %s category', async category => {
      await run('exa_search', { query: 'agents', category });

      expect(requests[0]).toMatchObject({ path: '/search', body: { category } });
    });

    it.each(['research paper', 'tweet', 'github', 'pdf', 'linkedin profile'])(
      'refuses the retired %s category before calling Exa',
      async category => {
        await expect(run('exa_search', { query: 'agents', category })).rejects.toThrow(/failed validation/);
        expect(requests).toEqual([]);
      },
    );

    it.each(['keyword', 'neural'])('refuses the retired %s search type', async type => {
      await expect(run('exa_search', { query: 'agents', type })).rejects.toThrow(/failed validation/);
      expect(requests).toEqual([]);
    });

    it('accepts the lite search type', async () => {
      await run('exa_search', { query: 'agents', type: 'lite' });

      expect(requests[0]!.body).toMatchObject({ type: 'lite' });
    });

    it.each(['', '   '])('refuses the blank query %j before calling Exa', async query => {
      await expect(run('exa_search', { query })).rejects.toThrow(/failed validation/);
      expect(requests).toEqual([]);
    });

    it('refuses a summary on a lite search before calling Exa', async () => {
      await expect(run('exa_search', { query: 'agents', type: 'lite', summary: {} })).rejects.toThrow(
        /failed validation/,
      );
      expect(requests).toEqual([]);
    });

    it.each([
      ['lite', { text: { maxCharacters: 200 } }],
      ['lite', { highlights: { query: 'frameworks' } }],
      ['auto', { summary: {} }],
    ])('still sends a %s search with %j', async (type, contents) => {
      await run('exa_search', { query: 'agents', type, ...contents });

      expect(requests[0]!.body).toMatchObject({ type, contents });
    });

    it.each([
      ['company', { startPublishedDate: '2026-01-01' }],
      ['people', { endPublishedDate: '2026-01-01' }],
      ['people', { excludeDomains: ['example.com'] }],
    ])('refuses a filter the %s category does not accept', async (category, filter) => {
      await expect(run('exa_search', { query: 'agents', category, ...filter })).rejects.toThrow(/failed validation/);
      expect(requests).toEqual([]);
    });

    it('still sends published-date filters with other categories', async () => {
      await run('exa_search', { query: 'agents', category: 'news', startPublishedDate: '2026-01-01' });

      expect(requests[0]!.body).toMatchObject({ category: 'news', startPublishedDate: '2026-01-01' });
    });

    it('does not offer or send the crawl-date filters Exa ignores', async () => {
      await run('exa_search', { query: 'agents', startCrawlDate: '2026-01-01', endCrawlDate: '2026-02-01' });

      expect(requests[0]!.body).not.toHaveProperty('startCrawlDate');
      expect(requests[0]!.body).not.toHaveProperty('endCrawlDate');
    });

    it('nests inline content options under contents', async () => {
      await run('exa_search', { query: 'agents', text: { maxCharacters: 200 } });

      expect(requests[0]!.body).toMatchObject({ contents: { text: { maxCharacters: 200 } } });
    });
  });

  describe('get_contents', () => {
    it('refuses a call with no content option before calling Exa', async () => {
      await expect(run('exa_get_contents', { ids: ['https://example.com'] })).rejects.toThrow(/failed validation/);
      expect(requests).toEqual([]);
    });

    it('sends maxAgeHours to control how fresh the content is', async () => {
      answer = () => ({ status: 200, body: { results: [], statuses: [] } });

      await run('exa_get_contents', { ids: ['https://example.com'], text: { maxCharacters: 100 }, maxAgeHours: 0 });

      expect(requests[0]).toMatchObject({
        path: '/contents',
        body: { ids: ['https://example.com'], text: { maxCharacters: 100 }, maxAgeHours: 0 },
      });
    });

    it('refuses a content age over 720 hours before calling Exa', async () => {
      await expect(
        run('exa_get_contents', { ids: ['https://example.com'], summary: {}, maxAgeHours: 721 }),
      ).rejects.toThrow(/failed validation/);
      expect(requests).toEqual([]);
    });

    it.each([undefined, -1, 0, 720])('sends a content age of %s', async maxAgeHours => {
      answer = () => ({ status: 200, body: { results: [], statuses: [] } });

      await run('exa_get_contents', { ids: ['https://example.com'], summary: {}, maxAgeHours });

      expect(requests).toHaveLength(1);
      if (maxAgeHours === undefined) expect(requests[0]!.body).not.toHaveProperty('maxAgeHours');
      else expect(requests[0]!.body).toMatchObject({ maxAgeHours });
    });

    it('does not offer the livecrawl option Exa replaced', async () => {
      answer = () => ({ status: 200, body: { results: [], statuses: [] } });

      await run('exa_get_contents', { ids: ['https://example.com'], summary: {}, livecrawl: 'always' });

      expect(requests[0]!.body).not.toHaveProperty('livecrawl');
    });
  });

  describe('answer', () => {
    it.each(['', '   '])('refuses the blank question %j before calling Exa', async query => {
      await expect(run('exa_answer', { query })).rejects.toThrow(/failed validation/);
      expect(requests).toEqual([]);
    });

    it('keeps a citation whose title is null', async () => {
      answer = () => ({
        status: 200,
        body: {
          answer: 'TypeScript.',
          citations: [{ id: 'https://mastra.ai', url: 'https://mastra.ai', title: null }],
        },
      });

      const result = await run('exa_answer', { query: 'What language is Mastra written in?' });

      expect(requests[0]).toMatchObject({ path: '/answer', body: { query: 'What language is Mastra written in?' } });
      expect(result).toEqual({
        answer: 'TypeScript.',
        citations: [{ id: 'https://mastra.ai', url: 'https://mastra.ai', title: null }],
      });
    });
  });
});
