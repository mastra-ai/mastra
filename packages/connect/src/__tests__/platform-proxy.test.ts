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

  it('never retries a POST even when the template asks for retries', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('socket hang up'));
    const proxy = makeProxy(fetchMock);
    await expect(proxy.post({ endpoint: 'items', data: { a: 1 }, retries: 3 })).rejects.toThrow('socket hang up');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('never retries a PATCH even when the template asks for retries', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('socket hang up'));
    const proxy = makeProxy(fetchMock);
    await expect(proxy.patch({ endpoint: 'items/1', data: { a: 1 }, retries: 3 })).rejects.toThrow('socket hang up');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
