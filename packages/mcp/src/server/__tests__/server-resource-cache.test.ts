import { describe, it, expect, vi } from 'vitest';

import { MCPServer } from '../server';
import { makeMockExtra } from './mock-extra';

/**
 * Regression tests for cross-tenant resource leakage.
 *
 * MCPServer used to cache the result of the first `resources/list` call on the
 * shared, long-lived instance and replay it to every subsequent caller, ignoring
 * per-request auth (`extra.authInfo`). For dynamic providers that scope resources
 * per user/tenant this leaked one caller's resource index to the next caller.
 *
 * The provider must be invoked per request with the current `extra`, never served
 * from a shared cache.
 *
 * @see https://github.com/mastra-ai/mastra/issues/17609
 */
describe('MCPServer dynamic resource provider does not leak across callers', () => {
  const makeExtra = (subject: string) => makeMockExtra({ authInfo: { subject } });

  /**
   * A tenant-scoped provider: the resource list and content depend entirely on
   * `extra.authInfo.subject`, so each caller must see only their own resources.
   */
  const createTenantServer = () => {
    const listResources = vi.fn(async ({ extra }: { extra: any }) => {
      const tenant = extra?.authInfo?.subject ?? 'anonymous';
      return [{ uri: `app://${tenant}/doc`, name: `Doc for ${tenant}`, mimeType: 'text/plain' }];
    });
    const getResourceContent = vi.fn(async ({ uri }: { uri: string }) => ({ text: uri }));
    const resourceTemplates = vi.fn(async ({ extra }: { extra: any }) => {
      const tenant = extra?.authInfo?.subject ?? 'anonymous';
      return [{ uriTemplate: `app://${tenant}/{id}`, name: `Template for ${tenant}` }];
    });

    const server = new MCPServer({
      name: 'tenant-server',
      version: '1.0.0',
      tools: {},
      resources: { listResources, getResourceContent, resourceTemplates },
    });

    return { server, listResources, getResourceContent, resourceTemplates };
  };

  it('serves each caller their own resources from resources/list', async () => {
    const { server, listResources } = createTenantServer();
    const handlers = (server.getServer() as any)._requestHandlers;
    const listHandler = handlers.get('resources/list');

    const tenantA = await listHandler({ method: 'resources/list' }, makeExtra('tenant-A'));
    const tenantB = await listHandler({ method: 'resources/list' }, makeExtra('tenant-B'));

    expect(tenantA.resources[0].name).toBe('Doc for tenant-A');
    expect(tenantB.resources[0].name).toBe('Doc for tenant-B');
    // Provider must be re-evaluated for each caller, not served from a shared cache.
    expect(listResources).toHaveBeenCalledTimes(2);
  });

  it('resolves resources/read against the current caller, not a cached list', async () => {
    const { server, getResourceContent } = createTenantServer();
    const handlers = (server.getServer() as any)._requestHandlers;
    const listHandler = handlers.get('resources/list');
    const readHandler = handlers.get('resources/read');

    // Tenant A populates any would-be cache via list, then tenant B reads its own resource.
    await listHandler({ method: 'resources/list' }, makeExtra('tenant-A'));

    const result = await readHandler(
      { method: 'resources/read', params: { uri: 'app://tenant-B/doc' } },
      makeExtra('tenant-B'),
    );

    expect(result.contents[0].uri).toBe('app://tenant-B/doc');
    expect(getResourceContent).toHaveBeenCalledWith(expect.objectContaining({ uri: 'app://tenant-B/doc' }));
  });

  it('serves each caller their own resource templates from resources/templates/list', async () => {
    const { server, resourceTemplates } = createTenantServer();
    const handlers = (server.getServer() as any)._requestHandlers;
    const templatesHandler = handlers.get('resources/templates/list');

    const tenantA = await templatesHandler({ method: 'resources/templates/list' }, makeExtra('tenant-A'));
    const tenantB = await templatesHandler({ method: 'resources/templates/list' }, makeExtra('tenant-B'));

    expect(tenantA.resourceTemplates[0].name).toBe('Template for tenant-A');
    expect(tenantB.resourceTemplates[0].name).toBe('Template for tenant-B');
    // Provider must be re-evaluated for each caller, not served from a shared cache.
    expect(resourceTemplates).toHaveBeenCalledTimes(2);
  });

  it('does not cache the dynamic list on the public listResources() method', async () => {
    // Mirrors the minimal reproduction from the issue.
    let tenant = 'tenant-A';
    const server = new MCPServer({
      name: 'repro',
      version: '1.0.0',
      tools: {},
      resources: {
        listResources: async () => [{ uri: `app://${tenant}/doc`, name: `Doc for ${tenant}`, mimeType: 'text/plain' }],
        getResourceContent: async ({ uri }) => ({ text: uri }),
      },
    });

    expect((await server.listResources()).resources[0].name).toBe('Doc for tenant-A');
    tenant = 'tenant-B';
    expect((await server.listResources()).resources[0].name).toBe('Doc for tenant-B');
  });

  it('invokes the listResources provider on every public listResources() call', async () => {
    // Regression guard: the public method must re-run the provider each call rather than
    // serving a cached result, otherwise the dynamic provider stops being consulted and
    // stale/cross-tenant data is returned. Asserting the call count catches a silent
    // reintroduction of the cache even if the returned shape happens to look correct.
    const listResources = vi.fn(async () => [{ uri: 'app://doc', name: 'Doc', mimeType: 'text/plain' }]);
    const server = new MCPServer({
      name: 'regression',
      version: '1.0.0',
      tools: {},
      resources: { listResources, getResourceContent: async ({ uri }) => ({ text: uri }) },
    });

    await server.listResources();
    await server.listResources();

    expect(listResources).toHaveBeenCalledTimes(2);
  });
});
