/**
 * Unit tests for Mastra Server "apiPrefix" functionality
 *
 * Tests the server.apiPrefix configuration option which allows mounting API routes at a custom prefix (e.g., /custom-api, /mastra) instead of the default /api.
 */

import { readFile } from 'node:fs/promises';
import type { Mastra } from '@mastra/core/mastra';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHonoServer } from '../index';

// Mock dependencies
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
}));

vi.mock('@hono/node-server/serve-static', () => ({
  serveStatic: vi.fn(() => async (ctx: any) => ctx.notFound()),
}));

vi.mock('@hono/swagger-ui', () => ({
  swaggerUI: vi.fn(() => vi.fn()),
}));

vi.mock('@mastra/server/a2a/store', () => ({
  InMemoryTaskStore: vi.fn(),
}));

vi.mock('../handlers/mcp', () => ({
  MCP_ROUTES: [],
  getMcpServerMessageHandler: vi.fn(),
  getMcpServerSseHandler: vi.fn(),
}));

vi.mock('../handlers/auth', () => ({
  authenticationMiddleware: vi.fn((c, next) => next()),
  authorizationMiddleware: vi.fn((c, next) => next()),
}));

vi.mock('../handlers/error', () => ({
  errorHandler: vi.fn(),
}));

vi.mock('../handlers/health', () => ({
  healthHandler: vi.fn(c => c.json({ status: 'ok' })),
}));

vi.mock('../handlers/client', () => ({
  handleClientsRefresh: vi.fn(ctx => ctx.json({ refresh: true })),
  handleTriggerClientsRefresh: vi.fn(ctx => ctx.json({ triggered: true })),
  isHotReloadDisabled: vi.fn(() => false),
}));

vi.mock('../handlers/restart-active-runs', () => ({
  restartAllActiveWorkflowRunsHandler: vi.fn(ctx => ctx.json({ restarted: true })),
}));

vi.mock('../welcome', () => ({
  html: '<html><body>Welcome to Mastra</body></html>',
}));

describe('Mastra Server "apiPrefix" functionality', () => {
  let mockMastra: Mastra;
  const mockIndexHtml = `<!DOCTYPE html>
<html>
<head>
  <base href="%%MASTRA_STUDIO_BASE_PATH%%/" />
</head>
<body>
  <script>
    window.MASTRA_TELEMETRY_DISABLED = '%%MASTRA_TELEMETRY_DISABLED%%';
    window.MASTRA_SERVER_HOST = '%%MASTRA_SERVER_HOST%%';
    window.MASTRA_SERVER_PORT = '%%MASTRA_SERVER_PORT%%';
    window.MASTRA_SERVER_PROTOCOL = '%%MASTRA_SERVER_PROTOCOL%%';
    window.MASTRA_API_PREFIX = '%%MASTRA_API_PREFIX%%';
    window.MASTRA_HIDE_CLOUD_CTA = '%%MASTRA_HIDE_CLOUD_CTA%%';
    window.MASTRA_STUDIO_BASE_PATH = '%%MASTRA_STUDIO_BASE_PATH%%';
    window.MASTRA_CLOUD_API_ENDPOINT = '%%MASTRA_CLOUD_API_ENDPOINT%%';
    window.MASTRA_EXPERIMENTAL_FEATURES = '%%MASTRA_EXPERIMENTAL_FEATURES%%';
    window.MASTRA_REQUEST_CONTEXT_PRESETS = '%%MASTRA_REQUEST_CONTEXT_PRESETS%%';
    window.MASTRA_AUTO_DETECT_URL = '%%MASTRA_AUTO_DETECT_URL%%';
  </script>
</body>
</html>`;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readFile).mockResolvedValue(mockIndexHtml);

    mockMastra = {
      getServer: vi.fn(() => ({})),
      getServerMiddleware: vi.fn(() => []),
      getLogger: vi.fn(() => ({
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      })),
      startEventEngine: vi.fn(),
      listAgents: vi.fn(() => []),
      setMastraServer: vi.fn(),
    } as unknown as Mastra;
  });

  describe('default apiPrefix', () => {
    it('should mount API routes under /api by default', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({});
      const app = await createHonoServer(mockMastra, { tools: {}, studio: true });

      const response = await app.request('/api/agents');
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('application/json');
    });

    it('should mount API routes under /api when apiPrefix is undefined', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ apiPrefix: undefined });
      const app = await createHonoServer(mockMastra, { tools: {}, studio: true });

      const response = await app.request('/api/agents');
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('application/json');
    });
  });

  describe('custom apiPrefix', () => {
    it('should mount API routes under custom prefix', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ apiPrefix: '/custom-api' });
      const app = await createHonoServer(mockMastra, { tools: {}, studio: true });

      const response = await app.request('/custom-api/agents');
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('application/json');
    });

    it('should not serve API routes at default /api when custom prefix is set', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ apiPrefix: '/custom-api' });
      const app = await createHonoServer(mockMastra, { tools: {}, studio: true });

      const response = await app.request('/api/agents');
      // Should not match API route — will fall through to welcome or 404
      expect(response.headers.get('Content-Type')).not.toContain('application/json');
    });

    it.each([
      { apiPrefix: '/mastra', desc: 'single segment' },
      { apiPrefix: '/v1/api', desc: 'nested path' },
      { apiPrefix: '/my-app/api', desc: 'hyphenated path' },
    ])('should handle $desc apiPrefix', async ({ apiPrefix }) => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ apiPrefix });
      const app = await createHonoServer(mockMastra, { tools: {}, studio: true });

      const response = await app.request(`${apiPrefix}/agents`);
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('application/json');
    });
  });

  describe('apiPrefix normalization', () => {
    it.each([
      { apiPrefix: '/custom/', expected: '/custom' },
      { apiPrefix: 'custom', expected: '/custom' },
      { apiPrefix: '//custom//', expected: '/custom' },
    ])('should normalize apiPrefix "$apiPrefix"', async ({ apiPrefix, expected }) => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ apiPrefix });
      const app = await createHonoServer(mockMastra, { tools: {}, studio: true });

      const response = await app.request(`${expected}/agents`);
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('application/json');
    });
  });

  describe('HTML placeholder replacement', () => {
    it('should inject default /api prefix into HTML when apiPrefix is not set', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ port: 4111, host: 'localhost' });
      const app = await createHonoServer(mockMastra, { tools: {}, studio: true });

      const response = await app.request('/');
      const html = await response.text();

      expect(html).toContain("window.MASTRA_API_PREFIX = '/api'");
    });

    it('should inject custom apiPrefix into HTML', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ apiPrefix: '/custom-api', port: 4111, host: 'localhost' });
      const app = await createHonoServer(mockMastra, { tools: {}, studio: true });

      const response = await app.request('/');
      const html = await response.text();

      expect(html).toContain("window.MASTRA_API_PREFIX = '/custom-api'");
    });

    it('should inject nested apiPrefix into HTML', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ apiPrefix: '/v1/api', port: 4111, host: 'localhost' });
      const app = await createHonoServer(mockMastra, { tools: {}, studio: true });

      const response = await app.request('/');
      const html = await response.text();

      expect(html).toContain("window.MASTRA_API_PREFIX = '/v1/api'");
    });
  });

  describe('apiPrefix with studioBase', () => {
    it('should work with both custom apiPrefix and studioBase', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({
        apiPrefix: '/custom-api',
        studioBase: '/studio',
        port: 4111,
        host: 'localhost',
      });
      const app = await createHonoServer(mockMastra, { tools: {}, studio: true });

      // API routes should use the custom prefix
      const apiResponse = await app.request('/custom-api/agents');
      expect(apiResponse.status).toBe(200);
      expect(apiResponse.headers.get('Content-Type')).toContain('application/json');

      // Studio routes should use the studioBase
      const studioResponse = await app.request('/studio');
      expect(studioResponse.status).toBe(200);
      expect(studioResponse.headers.get('Content-Type')).toBe('text/html');

      // HTML should contain both configured values
      const html = await studioResponse.text();
      expect(html).toContain("window.MASTRA_API_PREFIX = '/custom-api'");
      expect(html).toContain('<base href="/studio/" />');
    });

    it('should keep API and studio routes independent', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({
        apiPrefix: '/mastra',
        studioBase: '/admin',
      });
      const app = await createHonoServer(mockMastra, { tools: {}, studio: true });

      // API route at custom prefix
      const apiResponse = await app.request('/mastra/agents');
      expect(apiResponse.status).toBe(200);
      expect(apiResponse.headers.get('Content-Type')).toContain('application/json');

      // Studio hot reload at studioBase
      const studioResponse = await app.request('/admin/__hot-reload-status');
      expect(studioResponse.status).toBe(200);
    });
  });

  describe('health check independence', () => {
    it('should serve health check at /health regardless of apiPrefix', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ apiPrefix: '/custom-api' });
      const app = await createHonoServer(mockMastra, { tools: {}, studio: true });

      const response = await app.request('/health');
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('status');
    });
  });

  describe('edge cases', () => {
    it.each([
      { apiPrefix: '/a', desc: 'single character' },
      { apiPrefix: '/v2', desc: 'versioned' },
      { apiPrefix: '/my-app_v2', desc: 'special characters' },
    ])('should handle $desc apiPrefix', async ({ apiPrefix }) => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ apiPrefix });
      const app = await createHonoServer(mockMastra, { tools: {}, studio: true });

      const response = await app.request(`${apiPrefix}/agents`);
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('application/json');
    });
  });
});
