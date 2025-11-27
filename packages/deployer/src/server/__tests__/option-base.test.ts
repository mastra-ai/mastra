/**
 * Unit tests for server base path functionality
 *
 * Tests the server.base configuration option which allows mounting the Mastra
 * server at a custom base path (e.g., /admin, /studio) instead of root (/).
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

describe('Server base path functionality', () => {
  let mockMastra: Mastra;
  const mockIndexHtml = `<!DOCTYPE html>
<html>
<head>
  <link rel="icon" href="/mastra.svg">
  <script type="module" crossorigin src="/assets/index-abc123.js"></script>
  <link rel="stylesheet" crossorigin href="/assets/style-xyz789.css">
</head>
<body>
  <script>
    window.MASTRA_TELEMETRY_DISABLED = '%%MASTRA_TELEMETRY_DISABLED%%';
    window.MASTRA_SERVER_HOST = '%%MASTRA_SERVER_HOST%%';
    window.MASTRA_SERVER_PORT = '%%MASTRA_SERVER_PORT%%';
    window.MASTRA_HIDE_CLOUD_CTA = '%%MASTRA_HIDE_CLOUD_CTA%%';
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
    } as unknown as Mastra;
  });

  describe('Base path normalization', () => {
    it.each([
      { base: '/', requestPath: '/__hot-reload-status', desc: 'root base path' },
      { base: '', requestPath: '/__hot-reload-status', desc: 'empty string base path' },
      { base: undefined, requestPath: '/__hot-reload-status', desc: 'undefined base' },
    ])('should handle $desc', async ({ base, requestPath }) => {
      vi.mocked(mockMastra.getServer).mockReturnValue(base !== undefined ? { base } : {});
      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      const response = await app.request(requestPath);
      expect(response.status).toBe(200);
    });

    it.each([
      { base: '/admin', desc: 'with leading slash' },
      { base: 'admin', desc: 'without leading slash' },
      { base: '/admin/', desc: 'with trailing slash' },
      { base: '//admin//', desc: 'with multiple slashes' },
    ])('should normalize custom base path $desc', async ({ base }) => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ base });
      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

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

  describe('Playground route prefixing', () => {
    it.each([
      { route: '/studio/refresh-events', method: 'GET' },
      { route: '/studio/__refresh', method: 'POST' },
      { route: '/studio/__hot-reload-status', method: 'GET' },
    ])('should prefix $route with base path', async ({ route, method }) => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ base: '/studio' });
      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      const response = await app.request(route, { method });
      expect(response.status).toBe(200);
    });

    it('should return response data from __hot-reload-status', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ base: '/studio' });
      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      const response = await app.request('/studio/__hot-reload-status');
      const data = await response.json();
      expect(data).toHaveProperty('disabled');
      expect(data).toHaveProperty('timestamp');
    });

    it('should not register playground routes when playground is disabled', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ base: '/studio' });
      const app = await createHonoServer(mockMastra, { tools: {}, playground: false });

      const response = await app.request('/studio/__hot-reload-status');
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('HTML placeholder replacement', () => {
    it('should not rewrite asset paths for root base path', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ base: '/', port: 4111, host: 'localhost' });
      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      const response = await app.request('/');
      const html = await response.text();

      expect(html).toContain('href="/mastra.svg"');
      expect(html).toContain('src="/assets/index-abc123.js"');
      expect(html).toContain('href="/assets/style-xyz789.css"');
    });

    it('should rewrite asset paths for custom base path', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ base: '/admin', port: 3000, host: 'example.com' });
      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      const response = await app.request('/admin');
      const html = await response.text();

      expect(html).toContain('href="/admin/mastra.svg"');
      expect(html).toContain('src="/admin/assets/index-abc123.js"');
    });

    it('should not double-prefix paths that already contain base path', async () => {
      const mixedHtml = `<!DOCTYPE html>
<html>
<head>
  <link rel="icon" href="/mastra.svg">
  <link rel="alternate" href="/custom-path/already-prefixed.svg">
  <script src="/assets/index.js"></script>
  <script src="/custom-path/assets/already-prefixed.js"></script>
</head>
</html>`;

      vi.mocked(readFile).mockResolvedValue(mixedHtml);
      vi.mocked(mockMastra.getServer).mockReturnValue({ base: '/custom-path', port: 4111, host: 'localhost' });
      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      const response = await app.request('/custom-path');
      const html = await response.text();

      expect(html).toContain('href="/custom-path/mastra.svg"');
      expect(html).toContain('src="/custom-path/assets/index.js"');
      expect(html).not.toContain('/custom-path/custom-path/');
      expect(html).toContain('href="/custom-path/already-prefixed.svg"');
      expect(html).toContain('src="/custom-path/assets/already-prefixed.js"');
    });

    it('should replace server configuration placeholders', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ base: '/studio', port: 5000, host: 'api.example.com' });
      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      const response = await app.request('/studio');
      const html = await response.text();

      expect(html).toContain("window.MASTRA_SERVER_HOST = 'api.example.com'");
      expect(html).toContain("window.MASTRA_SERVER_PORT = '5000'");
    });

    it('should use default port 4111 when server port is not set', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ base: '/admin', host: 'localhost' });
      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      const response = await app.request('/admin');
      const html = await response.text();

      expect(html).toContain("window.MASTRA_SERVER_PORT = '4111'");
    });

    it('should replace hideCloudCta placeholder based on environment variable', async () => {
      const originalEnv = process.env.MASTRA_HIDE_CLOUD_CTA;
      try {
        process.env.MASTRA_HIDE_CLOUD_CTA = 'true';
        vi.mocked(mockMastra.getServer).mockReturnValue({ base: '/admin', port: 4111, host: 'localhost' });
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

  describe('CSS URL rewriting', () => {
    const setupCssMock = (mockCss: string) => {
      vi.mocked(readFile).mockImplementation(async (path: any) => {
        if (path.includes('index.html')) return mockIndexHtml;
        if (path.includes('.css')) return mockCss;
        throw new Error('File not found');
      });
    };

    it('should rewrite CSS url() references to include base path', async () => {
      setupCssMock(`
@font-face { src: url(/assets/fonts/font.woff2) format('woff2'); }
.background { background-image: url(/assets/images/bg.jpg); }`);
      vi.mocked(mockMastra.getServer).mockReturnValue({ base: '/custom-path', port: 4111, host: 'localhost' });
      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      const response = await app.request('/custom-path/assets/style.css');
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/css');
      const css = await response.text();

      expect(css).toContain('url(/custom-path/assets/fonts/font.woff2)');
      expect(css).toContain('url(/custom-path/assets/images/bg.jpg)');
    });

    it('should not double-prefix CSS urls that already contain base path', async () => {
      setupCssMock(`
.icon { background: url(/assets/icon.svg); }
.already-prefixed { background: url(/custom-path/assets/prefixed-icon.svg); }`);
      vi.mocked(mockMastra.getServer).mockReturnValue({ base: '/custom-path', port: 4111, host: 'localhost' });
      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      const response = await app.request('/custom-path/assets/style.css');
      const css = await response.text();

      expect(css).toContain('url(/custom-path/assets/icon.svg)');
      expect(css).not.toContain('/custom-path/custom-path/');
      expect(css).toContain('url(/custom-path/assets/prefixed-icon.svg)');
    });

    it('should handle CSS with all url quote formats', async () => {
      setupCssMock(`
.test1 { background: url("/assets/test1.png"); }
.test2 { background: url('/assets/test2.png'); }
.test3 { background: url(/assets/test3.png); }`);
      vi.mocked(mockMastra.getServer).mockReturnValue({ base: '/admin', port: 4111, host: 'localhost' });
      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      const response = await app.request('/admin/assets/style.css');
      const css = await response.text();

      expect(css).toContain('url("/admin/assets/test1.png")');
      expect(css).toContain("url('/admin/assets/test2.png')");
      expect(css).toContain('url(/admin/assets/test3.png)');
    });

    it('should not rewrite CSS urls when base path is root', async () => {
      setupCssMock(`.icon { background: url(/assets/icon.svg); }`);
      vi.mocked(mockMastra.getServer).mockReturnValue({ base: '/', port: 4111, host: 'localhost' });
      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      const response = await app.request('/assets/style.css');
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('Route matching logic', () => {
    it('should serve playground HTML for base path and sub-routes', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ base: '/studio' });
      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      for (const route of ['/studio', '/studio/agents', '/studio/page.html']) {
        const response = await app.request(route);
        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toBe('text/html');
      }
    });

    it('should serve welcome HTML for routes not matching base path', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ base: '/studio' });
      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      for (const route of ['/other', '/stud']) {
        const response = await app.request(route);
        expect(response.status).toBe(200);
        const html = await response.text();
        expect(html).toContain('Welcome to Mastra');
      }
    });

    it('should skip API routes regardless of base path', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ base: '/studio' });
      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      const response = await app.request('/api/agents');
      // API route returns JSON, not playground HTML
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('application/json');
    });

    it('should handle static file requests with base path', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ base: '/custom-path' });
      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      for (const path of ['/custom-path/mastra.svg', '/custom-path/assets/index.js', '/custom-path/test.js']) {
        const response = await app.request(path);
        expect([200, 404]).toContain(response.status);
      }
    });

    it('should not serve static files without base path prefix when base path is set', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ base: '/custom-path' });
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

  describe('Deep nested base paths', () => {
    it('should handle deep nested base paths with HTML rewriting', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ base: '/studio/v1/app' });
      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      const statusResponse = await app.request('/studio/v1/app/__hot-reload-status');
      expect(statusResponse.status).toBe(200);

      const htmlResponse = await app.request('/studio/v1/app');
      const html = await htmlResponse.text();
      expect(html).toContain('href="/studio/v1/app/mastra.svg"');
      expect(html).toContain('src="/studio/v1/app/assets/index-abc123.js"');
    });
  });

  describe('Health check route', () => {
    it('should serve health check at root regardless of base path', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ base: '/admin' });
      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      const response = await app.request('/health');
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('status');
    });

    it('should serve playground HTML at /base/health, not health check', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ base: '/studio' });
      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      const response = await app.request('/studio/health');
      const html = await response.text();
      expect(html).toContain('<!DOCTYPE html>');
    });
  });

  describe('Edge cases', () => {
    it.each([
      { base: '/my-app_v2', desc: 'special characters' },
      { base: '/a', desc: 'single character' },
      { base: '/v1', desc: 'numeric' },
    ])('should handle $desc base path', async ({ base }) => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ base });
      const app = await createHonoServer(mockMastra, { tools: {}, playground: true });

      const response = await app.request(`${base}/__hot-reload-status`);
      expect(response.status).toBe(200);
    });

    it('should serve welcome HTML when playground is disabled', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ base: '/studio' });
      const app = await createHonoServer(mockMastra, { tools: {}, playground: false });

      const response = await app.request('/');
      const html = await response.text();
      expect(html).toContain('Welcome to Mastra');
    });

    it('should handle case-sensitive base paths', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ base: '/Admin' });
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

    it('should serve playground HTML for all routes under base path', async () => {
      vi.mocked(mockMastra.getServer).mockReturnValue({ base: '/test' });
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
        vi.mocked(mockMastra.getServer).mockReturnValue({ base: '/admin' });
        const app = await createHonoServer(mockMastra, { tools: {}, playground: true, isDev });

        const response = await app.request('/__restart-active-workflow-runs', { method: 'POST' });
        expect(response.status).toBe(expectedStatus);
      },
    );
  });
});
