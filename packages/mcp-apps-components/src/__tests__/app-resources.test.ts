import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { MCPServer } from '@mastra/mcp';
// The built package, as consumers install it: the HTML artifacts only exist in dist/.
import { DASHBOARD_DATA_TOOL_NAME, dashboardRendererApp } from '@mastra/mcp-apps-components/dashboard-renderer';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { build } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

async function serveHTTP(server: MCPServer) {
  const httpServer = http.createServer(async (req, res) => {
    await server.startHTTP({ url: new URL(req.url ?? '', 'http://localhost'), httpPath: '/mcp', req, res });
  });
  await new Promise<void>(resolve => httpServer.listen(0, '127.0.0.1', resolve));
  const address = httpServer.address();
  if (!address || typeof address === 'string') throw new Error('HTTP server did not bind to a port');
  return {
    url: new URL(`http://127.0.0.1:${address.port}/mcp`),
    close: async () => {
      await server.close();
      httpServer.closeAllConnections();
      await new Promise<void>(resolve => httpServer.close(() => resolve()));
    },
  };
}

describe('dashboardRendererApp', () => {
  describe('when registered as an MCP server app resource', () => {
    let served: Awaited<ReturnType<typeof serveHTTP>>;
    let client: Client;

    beforeAll(async () => {
      const server = new MCPServer({
        name: 'Dashboards',
        version: '1.0.0',
        tools: {},
        appResources: {
          'ui://mastra/dashboard': dashboardRendererApp(),
        },
      });
      served = await serveHTTP(server);
      client = new Client(
        { name: 'test-client', version: '1.0.0' },
        { versionNegotiation: { mode: { pin: '2026-07-28' } } },
      );
      await client.connect(new StreamableHTTPClientTransport(served.url));
    });

    afterAll(async () => {
      await client.close();
      await served.close();
    });

    it('is listed as an MCP app', async () => {
      const { resources } = await client.listResources();

      expect(resources).toEqual([
        expect.objectContaining({
          uri: 'ui://mastra/dashboard',
          name: 'Mastra dashboard',
          mimeType: 'text/html;profile=mcp-app',
        }),
      ]);
    });

    it('serves the app without opening network access, since it reads data through tools', async () => {
      const { contents } = await client.readResource({ uri: 'ui://mastra/dashboard' });

      expect(contents).toEqual([expect.objectContaining({ mimeType: 'text/html;profile=mcp-app' })]);
      expect(contents[0]?._meta?.ui).toBeUndefined();
    });

    it('serves a single HTML document with every script and style inlined', async () => {
      const { contents } = await client.readResource({ uri: 'ui://mastra/dashboard' });
      const html = contents[0] && 'text' in contents[0] ? contents[0].text : '';

      // Hosts load the resource as one document: any file reference would fail to load.
      expect(html).toMatch(/^<!doctype html>/i);
      expect(html).toMatch(/<script type="module"[^>]*>[^<]/);
      expect(html).toMatch(/<style[^>]*>[^<]/);
      expect(html).not.toMatch(/<script[^>]+src=/);
      expect(html).not.toMatch(/<link[^>]+rel="(stylesheet|modulepreload)"/);
      expect(html).not.toMatch(/\bimport\(["'`]\.{0,2}\//);
    });

    it("doesn't ship the MCP SDK's unused JSON Schema validator", async () => {
      const { contents } = await client.readResource({ uri: 'ui://mastra/dashboard' });
      const html = contents[0] && 'text' in contents[0] ? contents[0].text : '';

      // The validator builds a URL from `location` at module load, which throws in the `blob:`
      // documents Studio loads apps from. The app never validates JSON Schemas, so it must be gone.
      expect(html).toContain('ui/notifications/initialized');
      expect(html).not.toContain('github.com/cfworker');
      expect(html).not.toContain('self.location.pathname');
    });
  });

  describe('when loaded from CommonJS', () => {
    it('serves the same page as the ESM entry', () => {
      const require = createRequire(import.meta.url);
      const cjs: typeof import('@mastra/mcp-apps-components/dashboard-renderer') = require('@mastra/mcp-apps-components/dashboard-renderer');

      expect(cjs.dashboardRendererApp().html).toBe(dashboardRendererApp().html);
    });
  });

  describe('when a deployer bundles the package into the server output', () => {
    // Cloud, Vercel, Netlify and Cloudflare inline npm packages into one output file, away from
    // the package's dist/. Build a consumer the same way, into a folder holding nothing else.
    let outDir: string;

    beforeAll(async () => {
      const packageDir = fileURLToPath(new URL('../..', import.meta.url));
      // Under node_modules so the externals below still resolve when the output runs.
      outDir = await mkdtemp(join(packageDir, 'node_modules', '.bundled-consumer-'));
      const entry = join(outDir, 'entry.ts');
      await writeFile(
        entry,
        "export { dashboardRendererApp } from '@mastra/mcp-apps-components/dashboard-renderer';\n",
      );
      await build({
        configFile: false,
        logLevel: 'silent',
        root: packageDir,
        ssr: { noExternal: true },
        build: {
          ssr: entry,
          outDir: join(outDir, 'out'),
          rollupOptions: { external: [/^@mastra\/core/, 'zod'] },
        },
      });
    });

    afterAll(async () => {
      await rm(outDir, { recursive: true, force: true });
    });

    it('still boots an MCP server that serves the app', async () => {
      const bundled: typeof import('@mastra/mcp-apps-components/dashboard-renderer') = await import(
        pathToFileURL(join(outDir, 'out', 'entry.js')).href
      );
      const server = new MCPServer({
        name: 'Dashboards',
        version: '1.0.0',
        tools: {},
        appResources: { 'ui://mastra/dashboard': bundled.dashboardRendererApp() },
      });
      const served = await serveHTTP(server);
      const client = new Client(
        { name: 'test-client', version: '1.0.0' },
        { versionNegotiation: { mode: { pin: '2026-07-28' } } },
      );
      await client.connect(new StreamableHTTPClientTransport(served.url));

      try {
        const { contents } = await client.readResource({ uri: 'ui://mastra/dashboard' });
        const html = contents[0] && 'text' in contents[0] ? contents[0].text : '';

        expect(html).toBe(dashboardRendererApp().html);
        expect(html).toContain('ui/notifications/initialized');
      } finally {
        await client.close();
        await served.close();
      }
    });
  });

  describe('when a host serves the dashboard without @mastra/server', () => {
    // Hosts like Mastra's platform answer `dashboardDataTool` from their own store, and standalone MCP
    // servers send its reads to a Mastra server over HTTP; neither installs @mastra/server. Bundle what
    // they import with @mastra/server unresolvable: loading it would fail the build, as it fails their server.
    let outDir: string;
    const reached: string[] = [];

    beforeAll(async () => {
      const packageDir = fileURLToPath(new URL('../..', import.meta.url));
      outDir = await mkdtemp(join(packageDir, 'node_modules', '.contract-consumer-'));
      const entry = join(outDir, 'entry.ts');
      await writeFile(
        entry,
        [
          'export {',
          '  dashboardRendererApp,',
          '  DASHBOARD_DATA_TOOL_NAME,',
          '  DASHBOARD_DATA_OPERATIONS,',
          '  dashboardDataInputSchema,',
          "} from '@mastra/mcp-apps-components/dashboard-renderer';",
          "export { createDashboardDataTool } from '@mastra/mcp-apps-components/dashboard-data-tool';\n",
        ].join('\n'),
      );
      await build({
        configFile: false,
        logLevel: 'silent',
        root: packageDir,
        ssr: { noExternal: true },
        plugins: [
          {
            name: 'no-mastra-server',
            enforce: 'pre',
            resolveId(source) {
              if (!source.startsWith('@mastra/server')) return null;
              reached.push(source);
              return { id: source, external: true };
            },
          },
        ],
        build: {
          ssr: entry,
          outDir: join(outDir, 'out'),
          rollupOptions: { external: [/^@mastra\/core/, 'zod'] },
        },
      });
    });

    afterAll(async () => {
      await rm(outDir, { recursive: true, force: true });
    });

    it('serves the app, the data contract and the data tool without loading it', async () => {
      const bundled: typeof import('@mastra/mcp-apps-components/dashboard-renderer') &
        typeof import('@mastra/mcp-apps-components/dashboard-data-tool') = await import(
        pathToFileURL(join(outDir, 'out', 'entry.js')).href
      );

      expect(reached).toEqual([]);
      expect(bundled.dashboardRendererApp().html).toBe(dashboardRendererApp().html);
      expect(bundled.dashboardDataInputSchema.parse({ operation: 'getMetricAggregate', body: {} })).toEqual({
        operation: 'getMetricAggregate',
        body: {},
      });
      expect(bundled.createDashboardDataTool({ baseUrl: 'http://localhost:4111' }).id).toBe(DASHBOARD_DATA_TOOL_NAME);
    });
  });
});
