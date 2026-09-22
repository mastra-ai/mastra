import type { AuthInfo } from '@modelcontextprotocol/server';
import { describe, expect, it, vi } from 'vitest';
import { MCPServer } from '../server';
import { connectClient, serveHTTP } from './harness.mock';

vi.setConfig({ testTimeout: 20_000, hookTimeout: 20_000 });

/**
 * Resource and prompt providers are evaluated with the current request on every
 * call. Nothing is cached on the shared server, so one caller's index can never
 * be served to another (https://github.com/mastra-ai/mastra/issues/17609).
 */
describe('MCPServer dynamic providers are scoped per request', () => {
  const tenantOf = ({ requestContext }: { requestContext: { get(key: string): unknown } }) =>
    (requestContext.get('authInfo') as AuthInfo | undefined)?.clientId ?? 'anonymous';

  const createTenantServer = () => {
    const listResources = vi.fn(async (params: Parameters<typeof tenantOf>[0]) => [
      { uri: `app://${tenantOf(params)}/doc`, name: `Doc for ${tenantOf(params)}`, mimeType: 'text/plain' },
    ]);
    const getResourceContent = vi.fn(async ({ uri }: { uri: string }) => ({ text: uri }));
    const resourceTemplates = vi.fn(async (params: Parameters<typeof tenantOf>[0]) => [
      { uriTemplate: `app://${tenantOf(params)}/{id}`, name: `Template for ${tenantOf(params)}` },
    ]);
    const listPrompts = vi.fn(async (params: Parameters<typeof tenantOf>[0]) => [
      { name: `${tenantOf(params)}-prompt`, description: `Prompt for ${tenantOf(params)}` },
    ]);
    const getPromptMessages = vi.fn(async ({ name }: { name: string }) => [
      { role: 'user' as const, content: { type: 'text' as const, text: `messages for ${name}` } },
    ]);
    const server = new MCPServer({
      name: 'tenant-server',
      version: '1.0.0',
      tools: {},
      resources: { listResources, getResourceContent, resourceTemplates },
      prompts: { listPrompts, getPromptMessages },
    });
    return { server, listResources, getResourceContent, resourceTemplates, listPrompts };
  };

  const withTenants = async (
    run: (clients: {
      a: Awaited<ReturnType<typeof connectClient>>;
      b: Awaited<ReturnType<typeof connectClient>>;
    }) => Promise<void>,
    fixture = createTenantServer(),
  ) => {
    const served = await serveHTTP(fixture.server, {
      auth: req => ({ token: 't', clientId: String(req.headers['x-tenant']), scopes: [] }),
    });
    try {
      const a = await connectClient(served.url, {}, { 'x-tenant': 'tenant-A' });
      const b = await connectClient(served.url, {}, { 'x-tenant': 'tenant-B' });
      try {
        await run({ a, b });
      } finally {
        await a.close();
        await b.close();
      }
    } finally {
      await served.close();
    }
    return fixture;
  };

  it('serves each caller their own resources, templates and prompts', async () => {
    const fixture = await withTenants(async ({ a, b }) => {
      expect((await a.listResources()).resources[0]?.name).toBe('Doc for tenant-A');
      expect((await b.listResources()).resources[0]?.name).toBe('Doc for tenant-B');
      expect((await a.listResourceTemplates()).resourceTemplates[0]?.name).toBe('Template for tenant-A');
      expect((await b.listResourceTemplates()).resourceTemplates[0]?.name).toBe('Template for tenant-B');
      expect((await a.listPrompts()).prompts[0]?.name).toBe('tenant-A-prompt');
      expect((await b.listPrompts()).prompts[0]?.name).toBe('tenant-B-prompt');
    });
    expect(fixture.listResources).toHaveBeenCalledTimes(2);
    expect(fixture.resourceTemplates).toHaveBeenCalledTimes(2);
    expect(fixture.listPrompts).toHaveBeenCalledTimes(2);
  });

  it('resolves reads and prompt gets against the current caller, never a cached list', async () => {
    const fixture = await withTenants(async ({ a, b }) => {
      await a.listResources();
      await a.listPrompts();
      const read = await b.readResource({ uri: 'app://tenant-B/doc' });
      expect(read.contents[0]?.uri).toBe('app://tenant-B/doc');
      await expect(b.readResource({ uri: 'app://tenant-A/doc' })).rejects.toThrow('Resource not found');
      const prompt = await b.getPrompt({ name: 'tenant-B-prompt' });
      expect(prompt.messages[0]?.content).toEqual({ type: 'text', text: 'messages for tenant-B-prompt' });
      await expect(b.getPrompt({ name: 'tenant-A-prompt' })).rejects.toThrow('not found');
    });
    expect(fixture.getResourceContent).toHaveBeenCalledWith(expect.objectContaining({ uri: 'app://tenant-B/doc' }));
    expect(fixture.getResourceContent).not.toHaveBeenCalledWith(expect.objectContaining({ uri: 'app://tenant-A/doc' }));
  });
});
