import { setCurrentSpanResolver } from '@mastra/core/observability';
import type { AnySpan } from '@mastra/core/observability';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { proxyRequest, resolveClient } from '../client.js';
import { describePlatformCall } from '../instrumentation.js';

const TOKEN = 'fake-test-token';

interface RecordedChild {
  options: Record<string, unknown>;
  end: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
}

function installFakeSpan(): { children: RecordedChild[] } {
  const children: RecordedChild[] = [];
  const parent = {
    createChildSpan(options: Record<string, unknown>) {
      const child: RecordedChild = { options, end: vi.fn(), error: vi.fn() };
      children.push(child);
      return child;
    },
  } as unknown as AnySpan;
  setCurrentSpanResolver(() => parent);
  return { children };
}

afterEach(() => {
  setCurrentSpanResolver(undefined);
});

describe('describePlatformCall', () => {
  it('strips query strings so query params never reach span metadata', () => {
    const descriptor = describePlatformCall('GET', '/v2/projects/p1/connections?secret=value');
    expect(descriptor.route).toBe('/v2/projects/{projectId}/connections');
    expect(descriptor.projectId).toBe('p1');
    expect(JSON.stringify(descriptor)).not.toContain('secret');
  });

  it('collapses vendor path segments after /proxy/ so credential-bearing paths never reach spans', () => {
    const descriptor = describePlatformCall(
      'GET',
      '/v2/connections/conn%2F1/proxy/oauth/v1/access-tokens/secret-vendor-token',
    );
    expect(descriptor.route).toBe('/v2/connections/{connectionId}/proxy/*');
    expect(descriptor.isProxy).toBe(true);
    expect(descriptor.connectionId).toBe('conn/1');
    expect(JSON.stringify(descriptor)).not.toContain('secret-vendor-token');
  });

  it('keeps platform route templates for non-proxy paths', () => {
    const descriptor = describePlatformCall('GET', '/v2/connections/conn-1/credential');
    expect(descriptor.route).toBe('/v2/connections/{connectionId}/credential');
    expect(descriptor.isProxy).toBe(false);
  });

  it('leaves unknown paths untouched', () => {
    const descriptor = describePlatformCall('GET', '/v2/integrations');
    expect(descriptor.route).toBe('/v2/integrations');
    expect(descriptor.connectionId).toBeUndefined();
    expect(descriptor.projectId).toBeUndefined();
  });
});

describe('platformFetch instrumentation', () => {
  it('creates a child span per proxy call and records the status on end', async () => {
    const { children } = installFakeSpan();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } }),
      );
    const client = resolveClient({ accessToken: TOKEN, fetch: fetchMock as unknown as typeof fetch });

    await proxyRequest(client, 'conn-1', { method: 'GET', path: 'issues', query: { apiKey: 'should-not-leak' } });

    expect(children).toHaveLength(1);
    const child = children[0]!;
    expect(child.options.name).toBe('connect.proxy GET /v2/connections/{connectionId}/proxy/*');
    const metadata = child.options.metadata as Record<string, unknown>;
    expect(metadata).toEqual({
      method: 'GET',
      route: '/v2/connections/{connectionId}/proxy/*',
      connectionId: 'conn-1',
    });
    expect(JSON.stringify(child.options)).not.toContain('issues');
    expect(JSON.stringify(child.options)).not.toContain('should-not-leak');
    expect(child.end).toHaveBeenCalledWith({ metadata: { status: 200 } });
    expect(child.error).not.toHaveBeenCalled();
  });

  it('records the vendor status even when the proxy call fails', async () => {
    const { children } = installFakeSpan();
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'nope' }), { status: 503 }));
    const client = resolveClient({ accessToken: TOKEN, fetch: fetchMock as unknown as typeof fetch });

    await expect(proxyRequest(client, 'conn-1', { method: 'GET', path: 'issues' })).rejects.toThrow();

    expect(children[0]!.end).toHaveBeenCalledWith({ metadata: { status: 503 } });
  });

  it('records only a fixed safe message on transport failure, never the original error message', async () => {
    const { children } = installFakeSpan();
    const transportError = new TypeError(`fetch failed for https://api.example.com/x?apiKey=query-secret ${TOKEN}`);
    const fetchMock = vi.fn().mockRejectedValue(transportError);
    const client = resolveClient({ accessToken: TOKEN, fetch: fetchMock as unknown as typeof fetch });

    await expect(proxyRequest(client, 'conn-1', { method: 'GET', path: 'issues' })).rejects.toThrow('[REDACTED]');

    const child = children[0]!;
    expect(child.error).toHaveBeenCalledTimes(1);
    const recorded = child.error.mock.calls[0]![0] as { error: Error; endSpan: boolean };
    expect(recorded.error.message).toBe('connect request failed (TypeError)');
    expect(recorded.error.name).toBe('TypeError');
    expect(recorded.error.message).not.toContain(TOKEN);
    expect(recorded.error.message).not.toContain('query-secret');
    expect(recorded.endSpan).toBe(true);
    expect(child.end).not.toHaveBeenCalled();
  });

  it('is a no-op without an ambient span', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } }),
      );
    const client = resolveClient({ accessToken: TOKEN, fetch: fetchMock as unknown as typeof fetch });

    await expect(proxyRequest(client, 'conn-1', { method: 'GET', path: 'issues' })).resolves.toEqual({ ok: true });
  });

  it('never breaks the request when span creation throws', async () => {
    setCurrentSpanResolver(() => {
      throw new Error('resolver exploded');
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } }),
      );
    const client = resolveClient({ accessToken: TOKEN, fetch: fetchMock as unknown as typeof fetch });

    await expect(proxyRequest(client, 'conn-1', { method: 'GET', path: 'issues' })).resolves.toEqual({ ok: true });
  });
});
