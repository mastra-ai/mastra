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
  const request = () =>
    BUILTIN_MCP_HTTP_ROUTE.handler({
      mastra,
      requestContext: new RequestContext(),
      request: new Request('http://localhost/api/mcp', { method: 'POST' }),
    } as any);
  return { request, error, getCustomHTTPExceptionResponse };
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
