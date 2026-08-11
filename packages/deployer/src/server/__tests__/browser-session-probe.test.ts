import { Mastra } from '@mastra/core/mastra';
import type * as MastraHono from '@mastra/hono';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('deployer browser session probe', () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock('@mastra/hono');
  });

  it('registers a fallback /api/agents/:agentId/browser/session route that reports screencast unavailable when setupBrowserStream is unavailable', async () => {
    vi.doMock('@mastra/hono', async () => {
      const actual = await vi.importActual<typeof MastraHono>('@mastra/hono');
      return {
        ...actual,
        // Simulate `@hono/node-ws` / `ws` not being installed
        setupBrowserStream: vi.fn().mockResolvedValue(null),
      };
    });

    const { createHonoServer } = await import('../index');
    const mastra = new Mastra({ logger: false });
    const app = await createHonoServer(mastra, { tools: {} });

    const response = await app.request('http://localhost/api/agents/some-agent/browser/session');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ hasSession: false, screencastAvailable: false });
  });

  it('does not register the fallback route when setupBrowserStream succeeds (the hono adapter owns the route in that case)', async () => {
    vi.doMock('@mastra/hono', async () => {
      const actual = await vi.importActual<typeof MastraHono>('@mastra/hono');
      const registeredRoutes: Array<{ method: string; path: string }> = [];

      return {
        ...actual,
        setupBrowserStream: vi.fn().mockImplementation(async (app: any) => {
          // Mimic the real adapter: register the probe route ourselves so we can prove
          // the fallback path doesn't double-register.
          app.get('/api/agents/:agentId/browser/session', (c: any) =>
            c.json({ hasSession: false, screencastAvailable: true }),
          );
          registeredRoutes.push({ method: 'GET', path: '/api/agents/:agentId/browser/session' });
          return { injectWebSocket: () => {}, registry: {} };
        }),
      };
    });

    const { createHonoServer } = await import('../index');
    const mastra = new Mastra({ logger: false });
    const app = await createHonoServer(mastra, { tools: {} });

    const response = await app.request('http://localhost/api/agents/some-agent/browser/session');

    expect(response.status).toBe(200);
    // Comes from the mocked setupBrowserStream, proving the fallback didn't overwrite it.
    await expect(response.json()).resolves.toEqual({ hasSession: false, screencastAvailable: true });
  });

  it('skips setupBrowserStream and registers fallback when browser streaming is disabled', async () => {
    const setupBrowserStreamMock = vi.fn().mockResolvedValue({ injectWebSocket: () => {}, registry: {} });
    vi.doMock('@mastra/hono', async () => {
      const actual = await vi.importActual<typeof MastraHono>('@mastra/hono');
      return {
        ...actual,
        setupBrowserStream: setupBrowserStreamMock,
      };
    });

    const { createHonoServer } = await import('../index');
    const mastra = new Mastra({ logger: false });
    const app = await createHonoServer(mastra, { tools: {}, browserStream: false });

    expect(setupBrowserStreamMock).not.toHaveBeenCalled();

    const response = await app.request('http://localhost/api/agents/some-agent/browser/session');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ hasSession: false, screencastAvailable: false });
  });

  it('mounts the fallback under a custom apiPrefix and forwards it to setupBrowserStream', async () => {
    const setupBrowserStreamMock = vi.fn().mockResolvedValue(null);
    vi.doMock('@mastra/hono', async () => {
      const actual = await vi.importActual<typeof MastraHono>('@mastra/hono');
      return {
        ...actual,
        setupBrowserStream: setupBrowserStreamMock,
      };
    });

    const { createHonoServer } = await import('../index');
    const mastra = new Mastra({ logger: false, server: { apiPrefix: '/custom/v1' } });
    const app = await createHonoServer(mastra, { tools: {} });

    // setupBrowserStream is called with the same apiPrefix
    expect(setupBrowserStreamMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ apiPrefix: '/custom/v1' }),
    );

    const response = await app.request('http://localhost/custom/v1/agents/some-agent/browser/session');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ hasSession: false, screencastAvailable: false });

    // Default-prefix probe path should NOT be served by the fallback when a custom prefix is configured.
    // Other unrelated handlers may respond with non-JSON or different status; we only assert that the
    // fallback shape is not returned at the default prefix.
    const defaultResponse = await app.request('http://localhost/api/agents/some-agent/browser/session');
    const defaultBody = defaultResponse.status === 200 ? await defaultResponse.json().catch(() => null) : null;
    expect(defaultBody).not.toEqual({ hasSession: false, screencastAvailable: false });
  });
});
