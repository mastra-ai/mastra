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
    const broken = Object.assign(
      new Error(
        "Cannot find package '@modelcontextprotocol/server' imported from /app/node_modules/@mastra/mcp/dist/index.js",
      ),
      { code: 'ERR_MODULE_NOT_FOUND' },
    );
    const app = await serveWithMCPImport(() => {
      throw broken;
    });
    const thrown = await app.request().catch(e => e);
    expect(app.getCustomHTTPExceptionResponse(thrown)).toBeUndefined();
    expect(String(thrown.cause ?? thrown)).toContain('@modelcontextprotocol/server');
    expect(app.error).not.toHaveBeenCalled();
  });

  it('serves normally when @mastra/mcp is installed', async () => {
    vi.stubEnv('MASTRA_DEV', 'true');
    const app = await serveWithMCPImport(() => vi.importActual('@mastra/mcp'));
    const result = (await app.request()) as { server: { id: string } };
    expect(result.server.id).toBe('mastra');
  });
});
