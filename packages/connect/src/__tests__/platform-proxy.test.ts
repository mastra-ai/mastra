import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';

import { createPlatformProxy } from '../runtime/platform-proxy.js';

const TOKEN = 'fake-test-token';

function makeProxy(fetchMock: ReturnType<typeof vi.fn>) {
  return createPlatformProxy({
    connectionId: 'conn-1',
    client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as unknown as typeof fetch },
  });
}

describe('createPlatformProxy request context binding', () => {
  it('starts unbound and binds a per-request context without mutating the base proxy', () => {
    const base = createPlatformProxy({ connectionId: 'conn-1' });
    expect(base.requestContext).toBeUndefined();

    const requestContext = new RequestContext();
    requestContext.set('externalUserId', 'user-42');
    const bound = base.withRequestContext(requestContext);

    expect(bound).not.toBe(base);
    expect(bound.requestContext).toBe(requestContext);
    expect(base.requestContext).toBeUndefined();
  });

  it('keeps the full proxy surface on the bound copy', () => {
    const bound = createPlatformProxy({ connectionId: 'conn-1' }).withRequestContext(new RequestContext());
    expect(typeof bound.get).toBe('function');
    expect(typeof bound.post).toBe('function');
    expect(typeof bound.getConnection).toBe('function');
    expect(typeof bound.getMetadata).toBe('function');
    expect(typeof bound.log).toBe('function');
    expect(bound.ActionError).toBeDefined();
  });

  it('does not emit arbitrary template log values', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const proxy = createPlatformProxy({ connectionId: 'conn-1' });

    proxy.log('request failed', { authorization: 'Bearer secret-token', apiKey: 'secret-key' });

    expect(logSpy).not.toHaveBeenCalled();
  });

  it('validates template inputs through zodValidateInput and returns the parsed data', async () => {
    const { z } = await import('zod');
    const proxy = createPlatformProxy({ connectionId: 'conn-1' });
    const schema = z.object({ project_id: z.number(), name: z.string().optional() });

    await expect(proxy.zodValidateInput({ zodSchema: schema, input: { project_id: 42 } })).resolves.toEqual({
      data: { project_id: 42 },
    });
    await expect(proxy.zodValidateInput({ zodSchema: schema, input: { project_id: 'nope' } })).rejects.toMatchObject({
      name: 'ToolActionError',
      payload: { type: 'invalid_input' },
    });
  });

  it('relays the provider status so templates can branch on async responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ statementHandle: 'h-1' }, { status: 202 }));
    const proxy = createPlatformProxy({
      connectionId: 'conn-1',
      client: { accessToken: 'token', baseUrl: 'https://example.test', fetch: fetchMock },
    });

    const response = await proxy.post({ endpoint: '/api/v2/statements' });

    expect(response.status).toBe(202);
    expect(response.data).toEqual({ statementHandle: 'h-1' });
  });

  it('forwards template baseUrlOverride values to the platform proxy request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    const proxy = createPlatformProxy({
      connectionId: 'conn-1',
      client: { accessToken: 'token', baseUrl: 'https://example.test', fetch: fetchMock },
    });

    await proxy.get({ endpoint: '/items', baseUrlOverride: 'https://caller-controlled.example' });

    expect(fetchMock.mock.calls[0]![0]).toBe('https://example.test/v2/connections/conn-1/proxy/items');
    expect(fetchMock.mock.calls[0]![1].headers['base-url-override']).toBe('https://caller-controlled.example');
  });

  it('returns raw ArrayBuffer data when a template requests responseType arraybuffer', async () => {
    const binary = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(binary, {
        status: 200,
        headers: { 'content-type': 'application/pdf' },
      }),
    );
    const proxy = createPlatformProxy({
      connectionId: 'conn-1',
      client: { accessToken: 'token', baseUrl: 'https://example.test', fetch: fetchMock },
    });

    const response = await proxy.get({ endpoint: '/files/x/export', responseType: 'arraybuffer' });

    expect(response.data).toBeInstanceOf(ArrayBuffer);
    const roundTripped = Buffer.from(response.data as ArrayBuffer);
    expect(roundTripped.toString('base64')).toBe(Buffer.from(binary).toString('base64'));
  });

  it('exposes credentials only through getConnectionWithCredentials, mapped to the template wire shape', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation((url: string) =>
        url.endsWith('/credentials')
          ? Promise.resolve(Response.json({ type: 'oauth2', accessToken: 'tok-1', expiresAt: null }))
          : Promise.resolve(Response.json({ connection_config: {}, metadata: null })),
      );
    const proxy = createPlatformProxy({
      connectionId: 'conn-1',
      client: { accessToken: 'token', baseUrl: 'https://example.test', fetch: fetchMock },
    }).withRequestContext(new RequestContext());

    await expect(proxy.getConnection()).resolves.not.toHaveProperty('credentials');
    await expect(proxy.getConnectionWithCredentials()).resolves.toMatchObject({
      credentials: { type: 'OAUTH2', access_token: 'tok-1' },
    });
    // The plain getConnection call never hit the credential endpoint.
    const urls = fetchMock.mock.calls.map(call => call[0] as string);
    expect(urls.filter(url => url.endsWith('/credentials'))).toHaveLength(1);
  });

  it('fetches connection context once per bound execution and returns metadata', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        connection_config: { projectUrl: 'https://project.supabase.co' },
        metadata: { region: 'us-east-1' },
      }),
    );
    const proxy = createPlatformProxy({
      connectionId: 'conn-1',
      client: { accessToken: 'token', baseUrl: 'https://example.test', fetch: fetchMock },
    }).withRequestContext(new RequestContext());

    await expect(proxy.getConnection()).resolves.toEqual({
      connection_config: { projectUrl: 'https://project.supabase.co' },
      metadata: { region: 'us-east-1' },
    });
    await expect(proxy.getMetadata()).resolves.toEqual({ region: 'us-east-1' });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('merges updateMetadata writes into an overlay shared across bound copies', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(Response.json({ connection_config: {}, metadata: null })));
    const base = createPlatformProxy({
      connectionId: 'conn-1',
      client: { accessToken: 'token', baseUrl: 'https://example.test', fetch: fetchMock },
    });

    const firstCall = base.withRequestContext(new RequestContext());
    await expect(firstCall.getMetadata()).resolves.toEqual({});
    await firstCall.updateMetadata({ cloudId: 'cloud-1', baseUrl: 'https://site.atlassian.net' });
    await expect(firstCall.getMetadata()).resolves.toEqual({
      cloudId: 'cloud-1',
      baseUrl: 'https://site.atlassian.net',
    });

    // A later request-bound copy of the same toolset proxy sees the cache.
    const secondCall = base.withRequestContext(new RequestContext());
    await expect(secondCall.getMetadata()).resolves.toEqual({
      cloudId: 'cloud-1',
      baseUrl: 'https://site.atlassian.net',
    });
    // The overlay never writes back to the platform: only connection-context
    // GETs went over the wire.
    for (const call of fetchMock.mock.calls) {
      expect(call[1]?.method ?? 'GET').toBe('GET');
    }
  });

  it('layers overlay values over platform metadata without dropping existing keys', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ connection_config: {}, metadata: { region: 'us-east-1' } }));
    const proxy = createPlatformProxy({
      connectionId: 'conn-1',
      client: { accessToken: 'token', baseUrl: 'https://example.test', fetch: fetchMock },
    }).withRequestContext(new RequestContext());

    await proxy.updateMetadata({ cloudId: 'cloud-1' });
    await expect(proxy.getMetadata()).resolves.toEqual({ region: 'us-east-1', cloudId: 'cloud-1' });
  });
});

function callUrl(fetchMock: ReturnType<typeof vi.fn>, index: number): URL {
  const raw = fetchMock.mock.calls[index]![0] as string;
  return new URL(raw, 'https://example.test');
}

function callMethod(fetchMock: ReturnType<typeof vi.fn>, index: number): string {
  return (fetchMock.mock.calls[index]![1] as RequestInit).method ?? 'GET';
}

describe('proxy dispatch helper', () => {
  it('defaults to GET when the template omits method', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ items: [] }));
    const proxy = makeProxy(fetchMock);
    await proxy.proxy({ endpoint: 'items' });
    expect(callMethod(fetchMock, 0)).toBe('GET');
  });

  it('forwards an explicit method to the platform proxy', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ ok: true }));
    const proxy = makeProxy(fetchMock);
    await proxy.proxy({ method: 'POST', endpoint: 'items', data: { a: 1 } });
    expect(callMethod(fetchMock, 0)).toBe('POST');
    expect((fetchMock.mock.calls[0]![1] as RequestInit).body).toBe(JSON.stringify({ a: 1 }));
  });

  it('threads responseType through to return an ArrayBuffer', async () => {
    const binary = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(binary, { status: 200 }));
    const proxy = makeProxy(fetchMock);
    const response = await proxy.proxy<ArrayBuffer>({
      endpoint: 'documents/export',
      responseType: 'arraybuffer',
    });
    expect(response.data).toBeInstanceOf(ArrayBuffer);
    expect(new Uint8Array(response.data)).toEqual(binary);
  });
});

describe('paginate helper', () => {
  it('follows an absolute link cursor across pages and stops when the link is absent', async () => {
    const first = {
      value: [{ id: 1 }, { id: 2 }],
      '@odata.nextLink': 'https://graph.example.test/v1.0/items?$skiptoken=abc',
    };
    const second = { value: [{ id: 3 }] };
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json(first)).mockResolvedValueOnce(Response.json(second));
    const proxy = makeProxy(fetchMock);
    const collected: number[] = [];
    for await (const items of proxy.paginate<{ id: number }>({
      endpoint: 'items',
      paginate: {
        type: 'link',
        response_path: 'value',
        link_path_in_response_body: '@odata.nextLink',
        limit_name_in_request: '$top',
        limit: 50,
      },
    })) {
      for (const item of items) collected.push(item.id);
    }
    expect(collected).toEqual([1, 2, 3]);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstUrl = callUrl(fetchMock, 0);
    expect(firstUrl.pathname).toBe('/v2/connections/conn-1/proxy/items');
    expect(firstUrl.searchParams.get('$top')).toBe('50');

    const secondUrl = callUrl(fetchMock, 1);
    expect(secondUrl.pathname).toBe('/v2/connections/conn-1/proxy/v1.0/items');
    expect(secondUrl.searchParams.get('$skiptoken')).toBe('abc');
    const secondHeaders = new Headers((fetchMock.mock.calls[1]![1] as RequestInit).headers);
    expect(secondHeaders.get('base-url-override')).toBe('https://graph.example.test');
  });

  it('increments an offset cursor and stops when the page is short', async () => {
    const first = { value: [{ id: 1 }, { id: 2 }] };
    const second = { value: [{ id: 3 }] };
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json(first)).mockResolvedValueOnce(Response.json(second));
    const proxy = makeProxy(fetchMock);
    const collected: number[] = [];
    for await (const items of proxy.paginate<{ id: number }>({
      endpoint: 'items',
      paginate: {
        type: 'offset',
        response_path: 'value',
        offset_name_in_request: 'offset',
        offset_start_value: 0,
        limit_name_in_request: 'limit',
        limit: 2,
      },
    })) {
      for (const item of items) collected.push(item.id);
    }
    expect(collected).toEqual([1, 2, 3]);
    expect(callUrl(fetchMock, 0).searchParams.get('offset')).toBe('0');
    expect(callUrl(fetchMock, 1).searchParams.get('offset')).toBe('2');
  });

  it('follows a cursor value read from the response body', async () => {
    const first = { items: [{ id: 1 }], next: 'cur-2' };
    const second = { items: [{ id: 2 }] };
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json(first)).mockResolvedValueOnce(Response.json(second));
    const proxy = makeProxy(fetchMock);
    const collected: number[] = [];
    for await (const items of proxy.paginate<{ id: number }>({
      endpoint: 'items',
      paginate: {
        type: 'cursor',
        response_path: 'items',
        cursor_name_in_request: 'page_token',
        cursor_path_in_response_body: 'next',
        limit_name_in_request: 'limit',
        limit: 100,
      },
    })) {
      for (const item of items) collected.push(item.id);
    }
    expect(collected).toEqual([1, 2]);
    expect(callUrl(fetchMock, 1).searchParams.get('page_token')).toBe('cur-2');
  });
});

describe('callProxy retry policy', () => {
  it('retries an idempotent GET on transient network failures', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('socket hang up'))
      .mockResolvedValueOnce(Response.json({ ok: true }));
    const proxy = makeProxy(fetchMock);
    const response = await proxy.get({ endpoint: 'items', retries: 3 });
    expect(response.data).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries a POST that carries an Idempotency-Key header', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('socket hang up'))
      .mockResolvedValueOnce(Response.json({ id: 'sent' }));
    const proxy = makeProxy(fetchMock);
    const response = await proxy.post({
      endpoint: 'emails',
      data: { a: 1 },
      headers: { 'Idempotency-Key': 'send-once' },
      retries: 3,
    });
    expect(response.data).toEqual({ id: 'sent' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(new Headers(fetchMock.mock.calls[1]![1].headers).get('idempotency-key')).toBe('send-once');
  });

  it('never retries a POST without an idempotency key even when the template asks for retries', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('socket hang up'));
    const proxy = makeProxy(fetchMock);
    await expect(proxy.post({ endpoint: 'items', data: { a: 1 }, retries: 3 })).rejects.toThrow('socket hang up');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('never retries a PATCH without an idempotency key even when the template asks for retries', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('socket hang up'));
    const proxy = makeProxy(fetchMock);
    await expect(proxy.patch({ endpoint: 'items/1', data: { a: 1 }, retries: 3 })).rejects.toThrow('socket hang up');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
