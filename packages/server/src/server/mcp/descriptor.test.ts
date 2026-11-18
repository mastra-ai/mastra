import { Mastra } from '@mastra/core/mastra';
import { SimpleAuth } from '@mastra/core/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.doUnmock('@mastra/mcp');
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function describeWith(mastra: Mastra, routePrefix = '/api') {
  const { BUILTIN_MCP_DESCRIPTOR_ROUTE } = await import('./descriptor');
  return BUILTIN_MCP_DESCRIPTOR_ROUTE.handler({ mastra, routePrefix } as any);
}

describe('built-in MCP descriptor', () => {
  describe('when @mastra/mcp is not installed', () => {
    it('reports the package as missing (Node ESM error)', async () => {
      vi.stubEnv('MASTRA_DEV', 'true');
      vi.resetModules();
      vi.doMock('@mastra/mcp', () => {
        throw Object.assign(
          new Error("Cannot find package '@mastra/mcp' imported from /app/.mastra/output/index.mjs"),
          { code: 'ERR_MODULE_NOT_FOUND' },
        );
      });
      expect(await describeWith(new Mastra({ logger: false }))).toMatchObject({
        enabled: true,
        mcpPackageInstalled: false,
      });
    });
  });

  describe('when @mastra/mcp is installed', () => {
    it('reports it', async () => {
      vi.stubEnv('MASTRA_DEV', 'true');
      expect(await describeWith(new Mastra({ logger: false }))).toMatchObject({ mcpPackageInstalled: true });
    });
  });

  describe('when loading @mastra/mcp fails for another reason', () => {
    it('fails the request, then recovers once the package loads', async () => {
      vi.stubEnv('MASTRA_DEV', 'true');
      vi.resetModules();
      vi.doMock('@mastra/mcp', () => {
        throw new Error('SyntaxError in @mastra/mcp');
      });
      const { describeBuiltinMCP } = await import('./descriptor');
      const mastra = new Mastra({ logger: false });
      await expect(describeBuiltinMCP(mastra, '/api')).rejects.toThrow();

      vi.doUnmock('@mastra/mcp');
      expect(await describeBuiltinMCP(mastra, '/api')).toMatchObject({ mcpPackageInstalled: true });
    });
  });

  describe('when server.auth is a named provider', () => {
    it("reports only the provider's name", async () => {
      const auth = new SimpleAuth({ name: 'acme-sso', tokens: { 'secret-token': { id: 'u' } } });
      const result = await describeWith(new Mastra({ logger: false, server: { auth } }));
      expect(result).toMatchObject({ enabled: true, auth: { type: 'protected', provider: 'acme-sso' } });
      expect(JSON.stringify(result)).not.toContain('secret-token');
    });
  });

  describe('when the API prefix is custom', () => {
    it('includes it in the path', async () => {
      vi.stubEnv('MASTRA_DEV', 'true');
      const mastra = new Mastra({ logger: false, server: { mcp: { path: '/tools-mcp' } } });
      expect(await describeWith(mastra, '/mastra')).toMatchObject({ path: '/mastra/tools-mcp' });
    });
  });

  describe('when the configured toolsets exclude primitives', () => {
    it('reports only the configured ones', async () => {
      vi.stubEnv('MASTRA_DEV', 'true');
      const mastra = new Mastra({ logger: false, server: { mcp: { toolsets: ['workflows'] } } });
      expect(await describeWith(mastra)).toMatchObject({ toolsets: ['workflows'] });
    });
  });
});
