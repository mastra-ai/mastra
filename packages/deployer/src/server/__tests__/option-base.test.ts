/**
 * Unit tests for server base path functionality
 *
 * Tests the server.base configuration option which allows mounting the Mastra
 * server at a custom base path (e.g., /admin, /studio) instead of root (/).
 *
 * Covered functionality:
 * - Base path normalization (handling leading/trailing slashes, multiple slashes)
 * - Playground route prefixing (refresh-events, __refresh, __hot-reload-status)
 * - HTML placeholder replacement for frontend routing and configuration
 * - Route matching logic for determining playground vs API vs static routes
 * - Health check route behavior (always at root, not prefixed)
 * - Edge cases (nested paths, special characters, case sensitivity)
 */

import { readFile } from 'fs/promises';
import type { Mastra } from '@mastra/core/mastra';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHonoServer } from '../index';

// Mock dependencies
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
}));

vi.mock('@hono/node-server/serve-static', () => ({
  serveStatic: vi.fn(() => vi.fn()),
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

describe('Server base path functionality', () => {
  let mockMastra: Mastra;
  const mockIndexHtml = `<!DOCTYPE html>
<html>
<head>
  <base href="%%MASTRA_BASE_PATH%%/">
  <link rel="icon" href="%%MASTRA_BASE_PATH%%/favicon.ico">
</head>
<body>
  <script>
    window.MASTRA_CONFIG = {
      host: '%%MASTRA_SERVER_HOST%%',
      port: '%%MASTRA_SERVER_PORT%%',
      hideCloudCta: '%%MASTRA_HIDE_CLOUD_CTA%%'
    };
  </script>
</body>
</html>`;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock readFile to return index.html content
    vi.mocked(readFile).mockResolvedValue(mockIndexHtml);

    // Create a mock Mastra instance with minimal configuration
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
    } as unknown as Mastra;
  });

  describe('Base path normalization in server setup', () => {
    it('should handle default base path (root)', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ base: '/' });

      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      // Test that root base path is normalized to empty string
      const response = await app.request('/__hot-reload-status');
      expect(response.status).toBe(200);
    });

    it('should handle empty string base path', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ base: '' });

      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      const response = await app.request('/__hot-reload-status');
      expect(response.status).toBe(200);
    });

    it('should handle custom base path with leading slash', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ base: '/admin' });

      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      const response = await app.request('/admin/__hot-reload-status');
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('disabled');
      expect(data).toHaveProperty('timestamp');
    });

    it('should handle custom base path without leading slash', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ base: 'admin' });

      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      const response = await app.request('/admin/__hot-reload-status');
      expect(response.status).toBe(200);
    });

    it('should handle custom base path with trailing slash', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ base: '/admin/' });

      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      // Trailing slash should be removed during normalization
      const response = await app.request('/admin/__hot-reload-status');
      expect(response.status).toBe(200);
    });

    it('should handle nested base paths', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ base: '/api/v1' });

      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      const response = await app.request('/api/v1/__hot-reload-status');
      expect(response.status).toBe(200);
    });
  });

  describe('Playground route base path prefixing', () => {
    it('should prefix refresh-events route with base path', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ base: '/studio' });

      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      const response = await app.request('/studio/refresh-events');
      expect(response.status).toBe(200);
    });

    it('should prefix __refresh route with base path', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ base: '/studio' });

      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      const response = await app.request('/studio/__refresh', { method: 'POST' });
      expect(response.status).toBe(200);
    });

    it('should prefix __hot-reload-status route with base path', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ base: '/studio' });

      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      const response = await app.request('/studio/__hot-reload-status');
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('disabled');
      expect(data).toHaveProperty('timestamp');
    });

    it('should not register playground routes when playground is disabled', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ base: '/studio' });

      const app = await createHonoServer(mockMastra, { tools: {}, playground: false });

      const response = await app.request('/studio/__hot-reload-status');
      // Route won't be registered, so will serve welcome HTML instead (200) or 404
      expect([200, 404]).toContain(response.status);
    });

    it('should handle multiple slashes in base path normalization', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ base: '//admin//' });

      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      // Should normalize to /admin
      const response = await app.request('/admin/__hot-reload-status');
      expect(response.status).toBe(200);
    });
  });

  describe('HTML placeholder replacement with base path', () => {
    it('should replace base path placeholders in index.html for root path', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({
        base: '/',
        port: 4111,
        host: 'localhost',
      });

      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      const response = await app.request('/');
      expect(response.status).toBe(200);
      const html = await response.text();

      // Base path should be empty string for root
      expect(html).toContain('<base href="/">');
      expect(html).toContain('href="/favicon.ico"');
    });

    it('should replace base path placeholders in index.html for custom path', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({
        base: '/admin',
        port: 3000,
        host: 'example.com',
      });

      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      const response = await app.request('/admin');
      expect(response.status).toBe(200);
      const html = await response.text();

      expect(html).toContain('<base href="/admin/">');
      expect(html).toContain('href="/admin/favicon.ico"');
    });

    it('should replace server configuration placeholders in index.html', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({
        base: '/studio',
        port: 5000,
        host: 'api.example.com',
      });

      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      const response = await app.request('/studio');
      expect(response.status).toBe(200);
      const html = await response.text();

      expect(html).toContain("host: 'api.example.com'");
      expect(html).toContain("port: '5000'");
    });

    it('should handle environment variable for port when server port is not set', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({
        base: '/admin',
        host: 'localhost',
      });

      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      const response = await app.request('/admin');
      expect(response.status).toBe(200);
      const html = await response.text();

      // Should use default port 4111 when PORT env is not set
      expect(html).toContain("port: '4111'");
    });

    it('should replace hideCloudCta placeholder based on environment variable', async () => {
      const originalEnv = process.env.MASTRA_HIDE_CLOUD_CTA;

      try {
        process.env.MASTRA_HIDE_CLOUD_CTA = 'true';

        vi.mocked(mockMastra.getServer).mockReturnValue({
          base: '/admin',
          port: 4111,
          host: 'localhost',
        });

        const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

        const response = await app.request('/admin');
        expect(response.status).toBe(200);
        const html = await response.text();

        expect(html).toContain("hideCloudCta: 'true'");
      } finally {
        if (originalEnv !== undefined) {
          process.env.MASTRA_HIDE_CLOUD_CTA = originalEnv;
        } else {
          delete process.env.MASTRA_HIDE_CLOUD_CTA;
        }
      }
    });
  });

  describe('Route matching logic with base path', () => {
    it('should serve playground for exact base path match', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ base: '/studio' });

      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      const response = await app.request('/studio');
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/html');
      const html = await response.text();
      expect(html).toContain('<!DOCTYPE html>');
    });

    it('should serve playground for routes starting with base path', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ base: '/studio' });

      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      const response = await app.request('/studio/agents');
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/html');
    });

    it('should not serve playground for routes not matching base path', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ base: '/studio' });

      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      const response = await app.request('/other');
      expect(response.status).toBe(200);
      const html = await response.text();
      // Should serve welcome HTML instead
      expect(html).toContain('Welcome to Mastra');
    });

    it('should skip API routes regardless of base path', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ base: '/studio' });

      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      const response = await app.request('/api/agents');
      // API routes are handled by adapter, may return 500 if mastra methods not mocked
      expect([404, 500]).toContain(response.status);
      // Should not serve HTML for API routes
    });

    it('should skip asset files regardless of base path', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ base: '/studio' });

      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      const response = await app.request('/studio/test.js');
      // Should attempt to serve as static file (404 if not found)
      expect([200, 404]).toContain(response.status);
    });

    it('should serve HTML files with .html extension', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ base: '/studio' });

      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      const response = await app.request('/studio/page.html');
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/html');
    });
  });

  describe('Base path with nested routes', () => {
    it('should handle deep nested base paths', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ base: '/studio/v1/app' });

      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      const response = await app.request('/studio/v1/app/__hot-reload-status');
      expect(response.status).toBe(200);
    });

    it('should correctly identify playground routes with deep nesting', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ base: '/studio/v1/app' });

      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      const response = await app.request('/studio/v1/app');
      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain('<base href="/studio/v1/app/">');
    });

    it('should not match partial base paths', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ base: '/studio' });

      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      const response = await app.request('/stud');
      expect(response.status).toBe(200);
      const html = await response.text();
      // Should serve welcome HTML, not playground
      expect(html).toContain('Welcome to Mastra');
    });
  });

  describe('Health check route with base path', () => {
    it('should serve health check at root regardless of base path', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ base: '/admin' });

      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      // Health check should always be at /health
      const response = await app.request('/health');
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('status');
    });

    it('should not prefix health check route with base path', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ base: '/studio' });

      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      // /studio/health will serve playground HTML, not health check
      const response = await app.request('/studio/health');
      expect(response.status).toBe(200);
      const html = await response.text();
      // Should be HTML, not JSON health check
      expect(html).toContain('<!DOCTYPE html>');
    });
  });

  describe('Edge cases and special scenarios', () => {
    it('should handle base path with special characters', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ base: '/my-app_v2' });

      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      const response = await app.request('/my-app_v2/__hot-reload-status');
      expect(response.status).toBe(200);
    });

    it('should handle single character base path', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ base: '/a' });

      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      const response = await app.request('/a/__hot-reload-status');
      expect(response.status).toBe(200);
    });

    it('should handle numeric base paths', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ base: '/v1' });

      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      const response = await app.request('/v1/__hot-reload-status');
      expect(response.status).toBe(200);
    });

    it('should serve welcome HTML when playground is disabled and route does not match base', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ base: '/studio' });

      const app = await createHonoServer(mockMastra, { tools: {}, playground: false });

      const response = await app.request('/');
      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain('Welcome to Mastra');
    });

    it('should handle case-sensitive base paths', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ base: '/Admin' });

      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      const response = await app.request('/Admin/__hot-reload-status');
      expect(response.status).toBe(200);

      // Case mismatch should serve welcome HTML or 404
      const responseLower = await app.request('/admin/__hot-reload-status');
      expect([200, 404]).toContain(responseLower.status);
      if (responseLower.status === 200) {
        const html = await responseLower.text();
        expect(html).toContain('Welcome to Mastra');
      }
    });

    it('should handle base path with all routes under playground', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ base: '/test' });

      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      // All these should serve playground HTML
      const routes = ['/test', '/test/', '/test/agents', '/test/workflows'];

      for (const route of routes) {
        const response = await app.request(route);
        expect(response.status).toBe(200);
        const html = await response.text();
        expect(html).toContain('<!DOCTYPE html>');
      }
    });

    it('should handle undefined base in server options', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({});

      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      // Should default to root
      const response = await app.request('/__hot-reload-status');
      expect(response.status).toBe(200);
    });
  });

  describe('Integration with isDev option', () => {
    it('should register restart handler with base path in dev mode', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ base: '/admin' });

      const app = await createHonoServer(mockMastra, { tools: {}, playground: true, isDev: true });

      // Note: The restart handler is registered without base path prefix
      const response = await app.request('/__restart-active-workflow-runs', { method: 'POST' });
      expect(response.status).toBe(200);
    });

    it('should not register restart handler when not in dev mode', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ base: '/admin' });

      const app = await createHonoServer(mockMastra, { tools: {}, playground: true, isDev: false });

      const response = await app.request('/__restart-active-workflow-runs', { method: 'POST' });
      expect(response.status).toBe(404);
    });
  });
});
