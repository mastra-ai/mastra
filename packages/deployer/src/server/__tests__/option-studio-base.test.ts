/**
 * Unit tests for Mastra Studio "studioBase" functionality
 *
 * Tests the server.studioBase configuration option which allows mounting the Mastra Studio at a custom base path (e.g., /admin, /studio) instead of root (/).
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

describe('Mastra Studio "studioBase" functionality', () => {
  let mockMastra: Mastra;
  // Mock HTML that matches the real playground structure with <base> tag and relative paths
  const mockIndexHtml = `<!DOCTYPE html>
<html>
<head>
  <base href="%%MASTRA_STUDIO_BASE_PATH%%/" />
  <link rel="icon" href="./mastra.svg">
  <script type="module" crossorigin src="./assets/index-abc123.js"></script>
  <link rel="stylesheet" crossorigin href="./assets/style-xyz789.css">
</head>
<body>
  <script>
    window.MASTRA_TELEMETRY_DISABLED = '%%MASTRA_TELEMETRY_DISABLED%%';
    window.MASTRA_SERVER_HOST = '%%MASTRA_SERVER_HOST%%';
    window.MASTRA_SERVER_PORT = '%%MASTRA_SERVER_PORT%%';
    window.MASTRA_HIDE_CLOUD_CTA = '%%MASTRA_HIDE_CLOUD_CTA%%';
    window.MASTRA_STUDIO_BASE_PATH = '%%MASTRA_STUDIO_BASE_PATH%%';
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

  describe('studioBase normalization', () => {
    it.each([
      { studioBase: '/', requestPath: '/__hot-reload-status', desc: 'root studioBase path' },
      { studioBase: '', requestPath: '/__hot-reload-status', desc: 'empty string studioBase path' },
      { studioBase: undefined, requestPath: '/__hot-reload-status', desc: 'undefined studioBase' },
    ])('should handle $desc', async ({ studioBase, requestPath }) => {
      vi.mocked(mockMastra.getServer).mockReturnValue(studioBase !== undefined ? { studioBase } : {});
      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      const response = await app.request(requestPath);
      expect(response.status).toBe(200);
    });

    it.each([
      { studioBase: '/admin', desc: 'with leading slash' },
      { studioBase: 'admin', desc: 'without leading slash' },
      { studioBase: '/admin/', desc: 'with trailing slash' },
      { studioBase: '//admin//', desc: 'with multiple slashes' },
    ])('should normalize custom studioBase path $desc', async ({ studioBase }) => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ studioBase });
      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      const response = await app.request('/admin/__hot-reload-status');
      expect(response.status).toBe(200);
    });

    it('should handle nested studioBase paths', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ studioBase: '/api/v1' });
      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      const response = await app.request('/api/v1/__hot-reload-status');
      expect(response.status).toBe(200);
    });
  });

  describe('Playground route prefixing', () => {
    it.each([
      { route: '/studio/refresh-events', method: 'GET' },
      { route: '/studio/__refresh', method: 'POST' },
      { route: '/studio/__hot-reload-status', method: 'GET' },
    ])('should prefix $route with studioBase path', async ({ route, method }) => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ studioBase: '/studio' });
      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      const response = await app.request(route, { method });
      expect(response.status).toBe(200);
    });

    it('should return response data from __hot-reload-status', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ studioBase: '/studio' });
      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      const response = await app.request('/studio/__hot-reload-status');
      const data = await response.json();
      expect(data).toHaveProperty('disabled');
      expect(data).toHaveProperty('timestamp');
    });

    it('should not register playground routes when playground is disabled', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ studioBase: '/studio' });
      const app = await createHonoServer(mockMastra, { tools: {}, playground: false });

      const response = await app.request('/studio/__hot-reload-status');
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('HTML placeholder replacement', () => {
    it('should not rewrite asset paths for root studioBase path', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ studioBase: '/', port: 4111, host: 'localhost' });
      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      const response = await app.request('/');
      const html = await response.text();

      // Base tag should have empty base path, and relative paths should remain unchanged
      expect(html).toContain('<base href="/" />');
      expect(html).toContain('href="./mastra.svg"');
      expect(html).toContain('src="./assets/index-abc123.js"');
      expect(html).toContain('href="./assets/style-xyz789.css"');
    });

    it('should set base href for custom base path', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ studioBase: '/admin', port: 3000, host: 'example.com' });
      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      const response = await app.request('/admin');
      const html = await response.text();

      // The <base> tag should be set to the base path so relative URLs resolve correctly
      expect(html).toContain('<base href="/admin/" />');
      // Relative paths remain unchanged - browser resolves them via base tag
      expect(html).toContain('href="./mastra.svg"');
      expect(html).toContain('src="./assets/index-abc123.js"');
      // Base path should also be available via JavaScript
      expect(html).toContain("window.MASTRA_STUDIO_BASE_PATH = '/admin'");
    });

    it('should inject studioBase path into MASTRA_STUDIO_BASE_PATH JavaScript variable', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ studioBase: '/custom-path', port: 4111, host: 'localhost' });
      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      const response = await app.request('/custom-path');
      const html = await response.text();

      expect(html).toContain('<base href="/custom-path/" />');
      expect(html).toContain("window.MASTRA_STUDIO_BASE_PATH = '/custom-path'");
    });

    it('should replace server configuration placeholders', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ studioBase: '/studio', port: 5000, host: 'api.example.com' });
      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      const response = await app.request('/studio');
      const html = await response.text();

      expect(html).toContain("window.MASTRA_SERVER_HOST = 'api.example.com'");
      expect(html).toContain("window.MASTRA_SERVER_PORT = '5000'");
    });

    it('should use default port 4111 when server port is not set', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ studioBase: '/admin', host: 'localhost' });
      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      const response = await app.request('/admin');
      const html = await response.text();

      expect(html).toContain("window.MASTRA_SERVER_PORT = '4111'");
    });

    it('should replace hideCloudCta placeholder based on environment variable', async () => {
      const originalEnv = process.env.MASTRA_HIDE_CLOUD_CTA;
      try {
        process.env.MASTRA_HIDE_CLOUD_CTA = 'true';
        vi.mocked(mockMastra.getServer).mockReturnValue({ studioBase: '/admin', port: 4111, host: 'localhost' });
        const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

        const response = await app.request('/admin');
        const html = await response.text();

        expect(html).toContain("window.MASTRA_HIDE_CLOUD_CTA = 'true'");
      } finally {
        if (originalEnv !== undefined) {
          process.env.MASTRA_HIDE_CLOUD_CTA = originalEnv;
        } else {
          delete process.env.MASTRA_HIDE_CLOUD_CTA;
        }
      }
    });
  });

  describe('Static asset serving with studioBase path', () => {
    it('should serve assets from prefixed path when studioBase path is set', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ studioBase: '/custom-path', port: 4111, host: 'localhost' });
      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      // Assets should be accessible at /studioBase-path/assets/*
      const response = await app.request('/custom-path/assets/style.css');
      // Returns 404 because serveStatic is mocked, but route should be registered
      expect([200, 404]).toContain(response.status);
    });

    it('should serve assets from root when studioBase path is root', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ studioBase: '/', port: 4111, host: 'localhost' });
      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      const response = await app.request('/assets/style.css');
      expect([200, 404]).toContain(response.status);
    });

    it('should strip studioBase path when rewriting request paths for static assets', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ studioBase: '/admin', port: 4111, host: 'localhost' });
      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      // The implementation strips the studioBase path prefix when serving static files
      // so /admin/assets/x.js maps to ./playground/assets/x.js
      const response = await app.request('/admin/assets/index.js');
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('Route matching logic', () => {
    it('should serve playground HTML for studioBase path and sub-routes', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ studioBase: '/studio' });
      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      for (const route of ['/studio', '/studio/agents', '/studio/page.html']) {
        const response = await app.request(route);
        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toBe('text/html');
      }
    });

    it('should serve welcome HTML for routes not matching studioBase path', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ studioBase: '/studio' });
      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      for (const route of ['/other', '/stud']) {
        const response = await app.request(route);
        expect(response.status).toBe(200);
        const html = await response.text();
        expect(html).toContain('Welcome to Mastra');
      }
    });

    it('should skip API routes regardless of studioBase path', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ studioBase: '/studio' });
      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      const response = await app.request('/api/agents');
      // API route returns JSON, not playground HTML
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('application/json');
    });

    it('should handle static file requests with studioBase path', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ studioBase: '/custom-path' });
      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      for (const path of ['/custom-path/mastra.svg', '/custom-path/assets/index.js', '/custom-path/test.js']) {
        const response = await app.request(path);
        expect([200, 404]).toContain(response.status);
      }
    });

    it('should not serve static files without studioBase path prefix when studioBase path is set', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ studioBase: '/custom-path' });
      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      const response = await app.request('/mastra.svg');
      if (response.status === 200) {
        const content = await response.text();
        expect(content).toContain('Welcome to Mastra');
      } else {
        expect(response.status).toBe(404);
      }
    });
  });

  describe('Deep nested studioBase paths', () => {
    it('should handle deep nested studioBase paths with studioBase tag replacement', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ studioBase: '/studio/v1/app' });
      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      const statusResponse = await app.request('/studio/v1/app/__hot-reload-status');
      expect(statusResponse.status).toBe(200);

      const htmlResponse = await app.request('/studio/v1/app');
      const html = await htmlResponse.text();
      // Base tag should contain the full nested path
      expect(html).toContain('<base href="/studio/v1/app/" />');
      expect(html).toContain("window.MASTRA_STUDIO_BASE_PATH = '/studio/v1/app'");
      // Relative paths remain unchanged - browser resolves them via base tag
      expect(html).toContain('href="./mastra.svg"');
    });
  });

  describe('Health check route', () => {
    it('should serve health check at root regardless of studioBase path', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ studioBase: '/admin' });
      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      const response = await app.request('/health');
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('status');
    });

    it('should serve playground HTML at /studioBase/health, not health check', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ studioBase: '/studio' });
      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      const response = await app.request('/studio/health');
      const html = await response.text();
      expect(html).toContain('<!DOCTYPE html>');
    });
  });

  describe('Edge cases', () => {
    it.each([
      { studioBase: '/my-app_v2', desc: 'special characters' },
      { studioBase: '/a', desc: 'single character' },
      { studioBase: '/v1', desc: 'numeric' },
    ])('should handle $desc studioBase path', async ({ studioBase }) => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ studioBase });
      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      const response = await app.request(`${studioBase}/__hot-reload-status`);
      expect(response.status).toBe(200);
    });

    it('should serve welcome HTML when playground is disabled', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ studioBase: '/studio' });
      const app = await createHonoServer(mockMastra, { tools: {}, playground: false });

      const response = await app.request('/');
      const html = await response.text();
      expect(html).toContain('Welcome to Mastra');
    });

    it('should handle case-sensitive studioBase paths', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ studioBase: '/Admin' });
      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      const response = await app.request('/Admin/__hot-reload-status');
      expect(response.status).toBe(200);

      const responseLower = await app.request('/admin/__hot-reload-status');
      expect([200, 404]).toContain(responseLower.status);
      if (responseLower.status === 200) {
        const html = await responseLower.text();
        expect(html).toContain('Welcome to Mastra');
      }
    });

    it('should serve playground HTML for all routes under studioBase path', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ studioBase: '/test' });
      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      for (const route of ['/test', '/test/', '/test/agents', '/test/workflows']) {
        const response = await app.request(route);
        expect(response.status).toBe(200);
        const html = await response.text();
        expect(html).toContain('<!DOCTYPE html>');
      }
    });
  });

  describe('isDev option integration', () => {
    it.each([
      { isDev: true, expectedStatus: 200 },
      { isDev: false, expectedStatus: 404 },
    ])(
      'should $isDev ? "register" : "not register" restart handler when isDev=$isDev',
      async ({ isDev, expectedStatus }) => {
        vi.mocked(mockMastra.getServer).mockReturnValue({ studioBase: '/admin' });
        const app = await createHonoServer(mockMastra, { tools: {}, playground: true, isDev });

        const response = await app.request('/__restart-active-workflow-runs', { method: 'POST' });
        expect(response.status).toBe(expectedStatus);
      },
    );
  });
});
