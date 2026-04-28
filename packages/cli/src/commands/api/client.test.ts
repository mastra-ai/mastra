import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildUrl, fetchSchemaManifest, requestApi, splitInput } from './client';
import type { ApiCommandDescriptor } from './commands';

const getListDescriptor: ApiCommandDescriptor = {
  key: 'testList',
  name: 'test list',
  method: 'GET',
  path: '/items/:itemId/children',
  positionals: ['itemId'],
  acceptsInput: true,
  inputRequired: false,
  list: true,
  description: 'Test list command',
  responseShape: { kind: 'array' },
  queryParams: ['page', 'perPage', 'filters'],
  bodyParams: [],
};

const postDescriptor: ApiCommandDescriptor = {
  key: 'testCreate',
  name: 'test create',
  method: 'POST',
  path: '/items/:itemId',
  positionals: ['itemId'],
  acceptsInput: true,
  inputRequired: true,
  list: false,
  description: 'Test create command',
  responseShape: { kind: 'single' },
  queryParams: [],
  bodyParams: ['value'],
};

const mixedDescriptor: ApiCommandDescriptor = {
  key: 'threadCreate',
  name: 'thread create',
  method: 'POST',
  path: '/memory/threads',
  positionals: [],
  acceptsInput: true,
  inputRequired: true,
  list: false,
  description: 'Create thread',
  responseShape: { kind: 'single' },
  queryParams: ['agentId'],
  bodyParams: ['resourceId', 'threadId', 'title'],
};

const fetchMock = vi.fn();

describe('splitInput', () => {
  it('splits non-GET input into query and body fields from route schemas', () => {
    expect(
      splitInput(mixedDescriptor, {
        agentId: 'weather-agent',
        resourceId: 'user-1',
        threadId: 'thread-1',
        title: 'Test thread',
      }),
    ).toEqual({
      queryInput: { agentId: 'weather-agent' },
      bodyInput: { resourceId: 'user-1', threadId: 'thread-1', title: 'Test thread' },
    });
  });

  it('keeps fields that exist in both query and body in the body', () => {
    expect(
      splitInput(
        { ...mixedDescriptor, queryParams: ['agentId', 'resourceId'], bodyParams: ['resourceId', 'title'] },
        { agentId: 'weather-agent', resourceId: 'user-1', title: 'Test thread' },
      ),
    ).toEqual({
      queryInput: { agentId: 'weather-agent' },
      bodyInput: { resourceId: 'user-1', title: 'Test thread' },
    });
  });

  it('wraps raw tool execution input as data', () => {
    expect(
      splitInput(
        {
          ...postDescriptor,
          key: 'toolExecute',
          name: 'tool execute',
          path: '/tools/:toolId/execute',
          bodyParams: ['data'],
        },
        { location: 'Berlin' },
      ),
    ).toEqual({ bodyInput: { data: { location: 'Berlin' } } });
  });

  it('does not double-wrap tool execution input that already has data', () => {
    expect(
      splitInput(
        {
          ...postDescriptor,
          key: 'mcpToolExecute',
          name: 'mcp tool execute',
          path: '/mcp/:serverId/tools/:toolId/execute',
          bodyParams: ['data'],
        },
        { data: { location: 'Berlin' } },
      ),
    ).toEqual({ bodyInput: { data: { location: 'Berlin' } } });
  });
});

describe('buildUrl', () => {
  it('adds the /api prefix when the base URL does not include it', () => {
    expect(buildUrl('https://example.com', '/agents/:agentId', { agentId: 'agent 1' }, 'GET')).toBe(
      'https://example.com/api/agents/agent%201',
    );
  });

  it('does not duplicate the /api prefix when the base URL already includes it', () => {
    expect(buildUrl('https://example.com/api', '/agents', {}, 'GET')).toBe('https://example.com/api/agents');
  });

  it('adds extra path params as query params for routes that accept query identity', () => {
    expect(
      buildUrl(
        'https://example.com',
        '/workflows/:workflowId/resume-async',
        { workflowId: 'wf', runId: 'run' },
        'POST',
      ),
    ).toBe('https://example.com/api/workflows/wf/resume-async?runId=run');
  });

  it('encodes GET input as query params and JSON-stringifies object values', () => {
    expect(
      buildUrl('https://example.com', '/scores', {}, 'GET', {
        runId: 'run-1',
        filters: { passed: true },
        perPage: 50,
        page: 2,
        skip: undefined,
      }),
    ).toBe('https://example.com/api/scores?runId=run-1&filters=%7B%22passed%22%3Atrue%7D&perPage=50&page=2');
  });
});

describe('requestApi', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends GET requests with page/perPage pagination', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [] }));

    await expect(
      requestApi({
        baseUrl: 'https://example.com',
        headers: { Authorization: 'Bearer token' },
        timeoutMs: 1000,
        descriptor: getListDescriptor,
        pathParams: { itemId: 'parent' },
        input: { page: 2, perPage: 25 },
      }),
    ).resolves.toEqual({ items: [] });

    expect(fetchMock).toHaveBeenCalledWith('https://example.com/api/items/parent/children?page=2&perPage=25', {
      method: 'GET',
      headers: { Authorization: 'Bearer token' },
      signal: expect.any(AbortSignal),
    });
  });

  it('sends JSON bodies for non-GET requests', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));

    await expect(
      requestApi({
        baseUrl: 'https://example.com/api',
        headers: { 'X-Test': 'yes' },
        timeoutMs: 1000,
        descriptor: postDescriptor,
        pathParams: { itemId: 'item-1' },
        input: { value: 1 },
      }),
    ).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledWith('https://example.com/api/items/item-1', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Test': 'yes' },
      signal: expect.any(AbortSignal),
      body: JSON.stringify({ value: 1 }),
    });
  });

  it('sends schema-derived query params and body for mixed non-GET requests', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));

    await expect(
      requestApi({
        baseUrl: 'https://example.com/api',
        headers: {},
        timeoutMs: 1000,
        descriptor: mixedDescriptor,
        pathParams: {},
        input: {
          agentId: 'weather-agent',
          resourceId: 'user-1',
          threadId: 'thread-1',
          title: 'Test thread',
        },
      }),
    ).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledWith('https://example.com/api/memory/threads?agentId=weather-agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: expect.any(AbortSignal),
      body: JSON.stringify({ resourceId: 'user-1', threadId: 'thread-1', title: 'Test thread' }),
    });
  });

  it('returns null for empty response bodies', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 200 }));

    await expect(
      requestApi({
        baseUrl: 'https://example.com',
        headers: {},
        timeoutMs: 1000,
        descriptor: postDescriptor,
        pathParams: { itemId: 'item-1' },
      }),
    ).resolves.toBeNull();
  });

  it('throws HTTP_ERROR with status and body details for non-2xx responses', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'nope' }, 400));

    await expect(
      requestApi({
        baseUrl: 'https://example.com',
        headers: {},
        timeoutMs: 1000,
        descriptor: getListDescriptor,
        pathParams: { itemId: 'item-1' },
      }),
    ).rejects.toMatchObject({
      code: 'HTTP_ERROR',
      message: 'Request failed with status 400',
      details: { status: 400, body: { message: 'nope' } },
    });
  });

  it('converts fetch failures to SERVER_UNREACHABLE errors', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));

    await expect(
      requestApi({
        baseUrl: 'https://example.com',
        headers: {},
        timeoutMs: 1000,
        descriptor: getListDescriptor,
        pathParams: { itemId: 'item-1' },
      }),
    ).rejects.toMatchObject({ code: 'SERVER_UNREACHABLE', details: { message: 'network down' } });
  });

  it('converts abort errors to REQUEST_TIMEOUT errors', async () => {
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    fetchMock.mockRejectedValueOnce(abortError);

    await expect(
      requestApi({
        baseUrl: 'https://example.com',
        headers: {},
        timeoutMs: 1,
        descriptor: getListDescriptor,
        pathParams: { itemId: 'item-1' },
      }),
    ).rejects.toMatchObject({
      code: 'REQUEST_TIMEOUT',
      message: 'Request timed out after 1ms',
      details: { timeoutMs: 1 },
    });
  });
});

describe('fetchSchemaManifest', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches the route-derived schema manifest endpoint', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ routes: [] }));

    await expect(fetchSchemaManifest('https://example.com', { Authorization: 'Bearer token' }, 1000)).resolves.toEqual({
      routes: [],
    });

    expect(fetchMock).toHaveBeenCalledWith('https://example.com/api/system/api-schema', {
      method: 'GET',
      headers: { Authorization: 'Bearer token' },
      signal: expect.any(AbortSignal),
    });
  });
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
