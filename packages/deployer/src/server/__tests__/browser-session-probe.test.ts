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
});
