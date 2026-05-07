import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildUrl, fetchSchemaManifest, requestApi, splitInput } from './client';
import type { ApiCommandDescriptor } from './commands';

const fetchMock = vi.fn();

const descriptor = (overrides: Partial<ApiCommandDescriptor> = {}): ApiCommandDescriptor => ({
  key: 'testCommand',
  name: 'test command',
  method: 'GET',
  path: '/items/:itemId',
  positionals: ['itemId'],
  acceptsInput: true,
  inputRequired: false,
  list: false,
  description: 'Test command',
  responseShape: { kind: 'single' },
  queryParams: [],
  bodyParams: [],
  ...overrides,
});

describe('splitInput', () => {
  it('uses all input as query params for GET commands', () => {
    expect(splitInput(descriptor({ method: 'GET' }), { page: 1, filters: { passed: true } })).toEqual({
      queryInput: { page: 1, filters: { passed: true } },
    });
  });

  it('uses all input as body for non-GET commands without query params', () => {
    expect(splitInput(descriptor({ method: 'POST', bodyParams: ['value'] }), { value: 1 })).toEqual({
      bodyInput: { value: 1 },
    });
  });

  it('splits non-GET input by route schema params and prefers body when a key exists in both', () => {
    expect(
      splitInput(
        descriptor({
          method: 'POST',
          queryParams: ['agentId', 'resourceId'],
          bodyParams: ['resourceId', 'threadId', 'title'],
        }),
        {
          agentId: 'weather-agent',
          resourceId: 'user-1',
          threadId: 'thread-1',
          title: 'Test thread',
        },
      ),
    ).toEqual({
      queryInput: { agentId: 'weather-agent' },
      bodyInput: { resourceId: 'user-1', threadId: 'thread-1', title: 'Test thread' },
    });
  });

  it('wraps raw tool execution input as data without double-wrapping explicit data input', () => {
    const toolDescriptor = descriptor({ method: 'POST', key: 'toolExecute', bodyParams: ['data'] });

    expect(splitInput(toolDescriptor, { location: 'Berlin' })).toEqual({
      bodyInput: { data: { location: 'Berlin' } },
    });
    expect(splitInput(toolDescriptor, { data: { location: 'Berlin' } })).toEqual({
      bodyInput: { data: { location: 'Berlin' } },
    });
  });
});

describe('buildUrl', () => {
  it('normalizes /api prefix and encodes path params', () => {
    expect(buildUrl('https://example.com', '/agents/:agentId', { agentId: 'agent 1' })).toBe(
      'https://example.com/api/agents/agent%201',
    );
    expect(buildUrl('https://example.com/api', '/agents', {})).toBe('https://example.com/api/agents');
  });

  it('adds extra path params and input as query params', () => {
    expect(
      buildUrl(
        'https://example.com',
        '/workflows/:workflowId/resume-async',
        { workflowId: 'wf', runId: 'run' },
        {
          filters: { passed: true },
          perPage: 50,
          skip: undefined,
        },
      ),
    ).toBe('https://example.com/api/workflows/wf/resume-async?runId=run&filters=%7B%22passed%22%3Atrue%7D&perPage=50');
  });

  it('fails before making malformed URLs when path params are missing', () => {
    expect(() => buildUrl('https://example.com', '/agents/:agentId', {})).toThrow(
      expect.objectContaining({ code: 'MISSING_ARGUMENT', details: { argument: 'agentId' } }),
    );
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

  it('sends GET requests with query input and custom headers', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [] }));

    await expect(
      requestApi({
        baseUrl: 'https://example.com',
        headers: { Authorization: 'Bearer token' },
        timeoutMs: 1000,
        descriptor: descriptor({ method: 'GET', path: '/items/:itemId/children' }),
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

  it('sends non-GET query/body split input with JSON content type', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));

    await expect(
      requestApi({
        baseUrl: 'https://example.com/api',
        headers: { 'X-Test': 'yes' },
        timeoutMs: 1000,
        descriptor: descriptor({
          method: 'POST',
          path: '/memory/threads',
          queryParams: ['agentId'],
          bodyParams: ['resourceId', 'threadId'],
        }),
        pathParams: {},
        input: { agentId: 'weather-agent', resourceId: 'user-1', threadId: 'thread-1' },
      }),
    ).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledWith('https://example.com/api/memory/threads?agentId=weather-agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Test': 'yes' },
      signal: expect.any(AbortSignal),
      body: JSON.stringify({ resourceId: 'user-1', threadId: 'thread-1' }),
    });
  });

  it('returns null for empty response bodies', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 200 }));

    await expect(
      requestApi({
        baseUrl: 'https://example.com',
        headers: {},
        timeoutMs: 1000,
        descriptor: descriptor({ method: 'POST' }),
        pathParams: { itemId: 'item-1' },
      }),
    ).resolves.toBeNull();
  });

  it('throws HTTP_ERROR with status and parsed body details for non-2xx responses', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'nope' }, 400));

    await expect(
      requestApi({
        baseUrl: 'https://example.com',
        headers: {},
        timeoutMs: 1000,
        descriptor: descriptor(),
        pathParams: { itemId: 'item-1' },
      }),
    ).rejects.toMatchObject({
      code: 'HTTP_ERROR',
      message: 'Request failed with status 400',
      details: { status: 400, body: { message: 'nope' } },
    });
  });

  it('converts fetch failures and aborts to API CLI errors', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));

    await expect(
      requestApi({
        baseUrl: 'https://example.com',
        headers: {},
        timeoutMs: 1000,
        descriptor: descriptor(),
        pathParams: { itemId: 'item-1' },
      }),
    ).rejects.toMatchObject({ code: 'SERVER_UNREACHABLE', details: { message: 'network down' } });

    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    fetchMock.mockRejectedValueOnce(abortError);

    await expect(
      requestApi({
        baseUrl: 'https://example.com',
        headers: {},
        timeoutMs: 1,
        descriptor: descriptor(),
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
