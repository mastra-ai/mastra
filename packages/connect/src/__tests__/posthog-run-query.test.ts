import { once } from 'node:events';
import { createServer } from 'node:http';
import type { IncomingMessage, Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { RequestContext } from '@mastra/core/request-context';
import { isValidationError } from '@mastra/core/tools';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { runQueryTool } from '../providers/posthog/tools/run-query.js';
import { tools } from '../tools.js';

// Regression coverage for #30528: PostHog's query API returns `types` as
// `[columnName, clickhouseType]` pairs (ClickHouse `with_column_types`, and
// `list[tuple[str, str]]` on the direct SQL adapters), but the generated
// `posthog_run_query` schema declared `types` as `string[]`, so every query,
// even `select 1`, failed validation after PostHog answered 200. The tool runs
// through the public `tools()` resolver against a real HTTP server standing in
// for the Mastra platform; only the PostHog response body is scripted.

interface RecordedRequest {
  method: string | undefined;
  path: string;
  body: unknown;
}

const connection = {
  id: 'pho_test',
  integrationId: 'posthog',
  status: 'active',
  connectedByUserId: 'user_1',
  connectedAt: '2026-01-01T00:00:00Z',
  createdAt: '2026-01-01T00:00:00Z',
  accountLabel: 'test',
  displayName: null,
  resourceId: null,
};

const integration = {
  id: 'posthog',
  provider: 'posthog',
  displayName: 'PostHog',
  logoUrl: '',
  authType: 'API_KEY',
  authFields: [],
  capabilities: { proxy: true, webhooks: false, mcp: false },
  surfaces: ['tools'],
  comingSoon: false,
  minConnectVersion: null,
};

/** A HogQLQueryResponse in the shape PostHog returns for `select 1` (#30528). */
const selectOneResponse = {
  results: [[1]],
  columns: ['1'],
  types: [['1', 'UInt8']],
  hogql: 'SELECT 1 LIMIT 100',
  clickhouse: 'SELECT 1 LIMIT 100 SETTINGS readonly=2',
  hasMore: false,
  limit: 100,
  offset: 0,
  timings: [{ k: './hogql', t: 0.004 }],
  modifiers: { personsOnEventsMode: 'person_id_override_properties_joined' },
  is_cached: false,
};

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : undefined;
}

describe('posthog_run_query with live PostHog response shapes (#30528)', () => {
  let server: Server;
  let baseUrl: string;
  let queryResponse: unknown;
  let requests: RecordedRequest[];

  beforeAll(async () => {
    server = createServer(async (request, response) => {
      const path = new URL(request.url ?? '/', 'http://localhost').pathname;
      requests.push({ method: request.method, path, body: await readJson(request) });
      const send = (status: number, body: unknown) => {
        response.writeHead(status, { 'content-type': 'application/json' });
        response.end(JSON.stringify(body));
      };
      if (path.endsWith('/connections')) return send(200, { connections: [connection] });
      if (path.endsWith('/integrations')) return send(200, { integrations: [integration] });
      if (path === `/v2/connections/${connection.id}/proxy/api/projects/309484/query/`) return send(200, queryResponse);
      return send(404, { error: `unexpected request ${request.method} ${path}` });
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
  });

  async function runQuery(query: string) {
    const resolve = tools({
      providers: ['posthog'],
      allowTools: ['posthog_run_query'],
      projectId: 'proj_test',
      client: { accessToken: 'test-platform-token', baseUrl },
    });
    // The resolver types its record loosely; narrow to the generated tool it registers.
    const tool = (await resolve()).posthog_run_query as ReturnType<typeof runQueryTool> | undefined;
    if (!tool?.execute) throw new Error('posthog_run_query was not resolved');
    const result = await tool.execute({ project_id: 309484, query }, { requestContext: new RequestContext() });
    // A result that fails the tool's own output schema comes back as a ValidationError, not a throw.
    if (isValidationError(result)) throw new Error(`output failed validation: ${result.message}`);
    if (!result) throw new Error('posthog_run_query returned nothing');
    return result;
  }

  it('returns the rows and column types for select 1', async () => {
    queryResponse = selectOneResponse;

    const result = await runQuery('select 1');

    expect(result).toEqual({
      results: [[1]],
      columns: ['1'],
      types: [['1', 'UInt8']],
      hogql: 'SELECT 1 LIMIT 100',
      clickhouse: 'SELECT 1 LIMIT 100 SETTINGS readonly=2',
      hasMore: false,
      limit: 100,
      offset: 0,
    });

    // The request that crossed the platform proxy is the documented HogQL query.
    const queryRequest = requests.find(request => request.path.endsWith('/query/'));
    expect(queryRequest).toMatchObject({
      method: 'POST',
      body: { query: { kind: 'HogQLQuery', query: 'select 1' } },
    });
  });

  it('returns a type pair per column for a grouped query', async () => {
    queryResponse = {
      ...selectOneResponse,
      results: [
        ['$pageview', 42],
        ['$autocapture', 7],
      ],
      columns: ['event', 'count()'],
      types: [
        ['event', 'String'],
        ['count()', 'UInt64'],
      ],
    };

    const result = await runQuery('select event, count() from events group by event');

    expect(result.columns).toEqual(['event', 'count()']);
    expect(result.types).toEqual([
      ['event', 'String'],
      ['count()', 'UInt64'],
    ]);
    expect(result.results).toEqual([
      ['$pageview', 42],
      ['$autocapture', 7],
    ]);
  });

  it('keeps column types for a query that returns no rows', async () => {
    queryResponse = { ...selectOneResponse, results: [], columns: ['1'], types: [['1', 'UInt8']] };

    const result = await runQuery('select 1 where 0');

    expect(result).toMatchObject({ results: [], columns: ['1'], types: [['1', 'UInt8']] });
  });

  it('keeps types null when PostHog sends null', async () => {
    queryResponse = { ...selectOneResponse, types: null };

    const result = await runQuery('select 1');

    expect(result.types).toBeNull();
    expect(result.results).toEqual([[1]]);
  });

  it('accepts a response that omits types', async () => {
    const { types: _types, ...withoutTypes } = selectOneResponse;
    queryResponse = withoutTypes;

    const result = await runQuery('select 1');

    expect(result.types).toBeUndefined();
    expect(result.columns).toEqual(['1']);
    expect(result.results).toEqual([[1]]);
  });

  it('accepts an empty types list', async () => {
    queryResponse = { ...selectOneResponse, types: [] };

    const result = await runQuery('select 1');

    expect(result.types).toEqual([]);
    expect(result.columns).toEqual(['1']);
    expect(result.results).toEqual([[1]]);
  });

  it('rejects flat string types, which PostHog does not send', async () => {
    queryResponse = { ...selectOneResponse, types: ['UInt8'] };

    await expect(runQuery('select 1')).rejects.toThrow(/types/);
  });

  it('rejects a types entry with more than a name and a type', async () => {
    queryResponse = { ...selectOneResponse, types: [['1', 'UInt8', 'extra']] };

    await expect(runQuery('select 1')).rejects.toThrow(/types/);
  });

  it('still rejects types that are not column name and type pairs', async () => {
    queryResponse = { ...selectOneResponse, types: [['1']] };

    await expect(runQuery('select 1')).rejects.toThrow(/types/);
  });
});
