import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { afterEach, describe, expect, it, vi } from 'vitest';

/** Node's own errors for an import of a package that isn't installed (ESM and CommonJS). */
const notInstalled = {
  esm: () =>
    Object.assign(new Error("Cannot find package '@mastra/mcp' imported from /app/.mastra/output/index.mjs"), {
      code: 'ERR_MODULE_NOT_FOUND',
    }),
  cjs: () =>
    Object.assign(new Error("Cannot find module '@mastra/mcp'\nRequire stack:\n- /app/.mastra/output/index.cjs"), {
      code: 'MODULE_NOT_FOUND',
    }),
  // Cloudflare Workers (workerd, captured with Miniflare): no `code`.
  workerd: () => new Error('No such module "@mastra/mcp".'),
};

async function serveWithMCPImport(load: () => unknown) {
  vi.resetModules();
  vi.doMock('@mastra/mcp', load);
  const { BUILTIN_MCP_HTTP_ROUTE } = await import('./route');
  // Same module instance as the route, so its HTTPException is recognised.
  const { getCustomHTTPExceptionResponse } = await import('../server-adapter');
  const mastra = new Mastra({ logger: false });
  const error = vi.spyOn(mastra.getLogger(), 'error');
  const warn = vi.spyOn(mastra.getLogger(), 'warn');
  const request = () =>
    BUILTIN_MCP_HTTP_ROUTE.handler({
      mastra,
      requestContext: new RequestContext(),
      request: new Request('http://localhost/api/mcp', { method: 'POST' }),
    } as any);
  return { request, error, warn, getCustomHTTPExceptionResponse };
}

afterEach(() => {
  vi.doUnmock('@mastra/mcp');
  vi.unstubAllEnvs();
});

describe('built-in MCP route without @mastra/mcp installed', () => {
  for (const [kind, error] of Object.entries(notInstalled)) {
    it(`answers 501 with a JSON-RPC error and logs one install hint (${kind})`, async () => {
      vi.stubEnv('MASTRA_DEV', 'true');
      const app = await serveWithMCPImport(() => {
        throw error();
      });

      for (let attempt = 0; attempt < 2; attempt++) {
        const thrown = await app.request().catch(e => e);
        const response = app.getCustomHTTPExceptionResponse(thrown);
        expect(response?.status).toBe(501);
        expect(await response?.json()).toEqual({
          jsonrpc: '2.0',
          id: null,
          error: { code: -32000, message: 'Built-in MCP server needs @mastra/mcp: npm install @mastra/mcp' },
        });
      }
      expect(app.error).toHaveBeenCalledTimes(1);
      expect(app.error).toHaveBeenCalledWith('Built-in MCP server needs @mastra/mcp: npm install @mastra/mcp');
    });
  }

  it('rethrows other load failures, including a module missing inside @mastra/mcp', async () => {
    vi.stubEnv('MASTRA_DEV', 'true');
    const missingInside = [
      Object.assign(
        new Error(
          "Cannot find package '@modelcontextprotocol/server' imported from /app/node_modules/@mastra/mcp/dist/index.js",
        ),
        { code: 'ERR_MODULE_NOT_FOUND' },
      ),
      new Error('No such module "@mastra/mcp/dist/index.js".'),
      new Error('No such module "@mastra/mcp-docs-server".'),
    ];
    for (const broken of missingInside) {
      const app = await serveWithMCPImport(() => {
        throw broken;
      });
      const thrown = await app.request().catch(e => e);
      expect(app.getCustomHTTPExceptionResponse(thrown)).toBeUndefined();
      expect(String(thrown.cause ?? thrown)).toContain(broken.message);
      expect(app.error).not.toHaveBeenCalled();
    }
  });

  it('serves normally when @mastra/mcp is installed', async () => {
    vi.stubEnv('MASTRA_DEV', 'true');
    const app = await serveWithMCPImport(() => vi.importActual('@mastra/mcp'));
    const result = (await app.request()) as { server: { id: string } };
    expect(result.server.id).toBe('mastra');
  });
});

describe('built-in MCP route module load', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Cloudflare Workers refuses to start a Worker that generates random values in global scope, and every
  // server adapter imports this route.
  it('generates no random values until a request is served', async () => {
    vi.stubEnv('MASTRA_DEV', 'true');
    vi.resetModules();
    const getRandomValues = vi.spyOn(globalThis.crypto, 'getRandomValues');
    const { BUILTIN_MCP_HTTP_ROUTE } = await import('./route');
    await import('../server-adapter');
    expect(getRandomValues).not.toHaveBeenCalled();

    const mastra = new Mastra({ logger: false });
    const warn = vi.spyOn(mastra.getLogger(), 'warn');
    const serve = () =>
      BUILTIN_MCP_HTTP_ROUTE.handler({
        mastra,
        requestContext: new RequestContext(),
        request: new Request('http://localhost/api/mcp', { method: 'POST' }),
      } as any);
    await serve();
    await serve();
    // One signing key for the process, and MCPServer's "no requestState.key" warning stays quiet.
    expect(getRandomValues).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('requestState.key'));
  });
});

describe('built-in MCP route without @mastra/mcp-apps-components installed', () => {
  const appsNotInstalled = {
    esm: () =>
      Object.assign(
        new Error("Cannot find package '@mastra/mcp-apps-components' imported from /app/.mastra/output/index.mjs"),
        { code: 'ERR_MODULE_NOT_FOUND' },
      ),
    cjs: () =>
      Object.assign(new Error("Cannot find module '@mastra/mcp-apps-components/trace-viewer'"), {
        code: 'MODULE_NOT_FOUND',
      }),
    // An older version without the app's subpath.
    olderVersion: () =>
      Object.assign(
        new Error(
          'Package subpath \'./trace-viewer\' is not defined by "exports" in /app/node_modules/@mastra/mcp-apps-components/package.json',
        ),
        { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' },
      ),
    workerd: () => new Error('No such module "@mastra/mcp-apps-components/trace-viewer".'),
    vite: () => new Error('Could not resolve "@mastra/mcp-apps-components/trace-viewer" imported by "@mastra/server".'),
  };

  const VIEWER = '@mastra/mcp-apps-components/trace-viewer';
  const LIST = '@mastra/mcp-apps-components/observability-explorer';
  // What each installed subpath exports. The server's workspace doesn't install the package (see the
  // override in `pnpm-workspace.yaml`); `@mastra/hono`'s MCP Apps tests serve the real apps.
  const viewerModule = () => ({ traceViewerApp: { name: 'Trace viewer', html: '<html>viewer</html>' } });
  const explorerModule = () => ({
    observabilityExplorerApp: { name: 'Observability explorer', html: '<html>explorer</html>' },
  });
  afterEach(() => {
    vi.doUnmock(VIEWER);
    vi.doUnmock(LIST);
  });

  const appWarnings = (warn: { mock: { calls: unknown[][] } }) =>
    warn.mock.calls.filter(([message]) => String(message).includes('MCP App'));

  async function serveWithAppsImport(loadViewer: () => unknown, loadList: () => unknown = loadViewer) {
    vi.stubEnv('MASTRA_DEV', 'true');
    vi.doMock(VIEWER, loadViewer);
    vi.doMock(LIST, loadList);
    const app = await serveWithMCPImport(() => vi.importActual('@mastra/mcp'));
    const serve = async () => {
      const { server } = (await app.request()) as { server: { appResourceList: { uri: string }[] } };
      return server.appResourceList.map(resource => resource.uri);
    };
    return { serve, warn: app.warn };
  }

  for (const [kind, error] of Object.entries(appsNotInstalled)) {
    it(`serves the tools without apps (${kind})`, async () => {
      const { serve, warn } = await serveWithAppsImport(() => {
        throw error();
      });
      expect(await serve()).toEqual([]);
      expect(appWarnings(warn)).toEqual([]);
    });
  }

  it('serves both apps when installed', async () => {
    const apps = await (await serveWithAppsImport(viewerModule, explorerModule)).serve();
    expect(apps.sort()).toEqual(['ui://mastra/observability-explorer', 'ui://mastra/trace-viewer']);
  });

  it('serves the trace viewer from an older version without the observability explorer', async () => {
    const { serve } = await serveWithAppsImport(viewerModule, () => {
      throw Object.assign(
        new Error(
          'Package subpath \'./observability-explorer\' is not defined by "exports" in /app/node_modules/@mastra/mcp-apps-components/package.json',
        ),
        { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' },
      );
    });
    expect(await serve()).toEqual(['ui://mastra/trace-viewer']);
  });

  // An installed package whose own import fails (a missing transitive dependency, a bundler error) must not
  // turn every MCP request into a 500: the server leaves that app out, warns once, and keeps serving.
  it('serves the tools without an app that fails to load, and warns once', async () => {
    const broken = Object.assign(
      new Error("Cannot find package 'react' imported from /app/node_modules/@mastra/mcp-apps-components/dist/x.js"),
      { code: 'ERR_MODULE_NOT_FOUND' },
    );
    const { serve, warn } = await serveWithAppsImport(() => {
      throw broken;
    }, explorerModule);
    expect(await serve()).toEqual(['ui://mastra/observability-explorer']);
    expect(await serve()).toEqual(['ui://mastra/observability-explorer']);
    expect(appWarnings(warn)).toEqual([[expect.stringContaining('trace-viewer'), { error: expect.any(String) }]]);
  });
});
