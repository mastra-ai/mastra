/**
 * @license Mastra Enterprise License - see ee/LICENSE
 */
import { PassThrough } from 'node:stream';
import type { IFGAProvider } from '@mastra/core/auth/ee';
import { Mastra } from '@mastra/core/mastra';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MastraServer } from './index';

class TestMastraServer extends MastraServer<any, any, any> {
  stream = vi.fn();
  getParams = vi.fn();
  sendResponse = vi.fn();
  registerRoute = vi.fn();
  registerContextMiddleware = vi.fn();
  registerAuthMiddleware = vi.fn();
  registerHttpLoggingMiddleware = vi.fn();

  // Exposes the protected bridge for focused unit coverage.
  async writeResponse(response: Response, nodeRes: any, signal?: AbortSignal) {
    await this.writeCustomRouteResponse(response, nodeRes, signal);
  }

  buildCustomRouteHandlerForTest() {
    return this.buildCustomRouteHandler();
  }

  handleCustomRouteRequestForTest(
    url: string,
    method: string,
    headers: Record<string, string | string[] | undefined>,
    body: unknown,
    requestContext?: any,
    signal?: AbortSignal,
  ) {
    return this.handleCustomRouteRequest(url, method, headers, body, requestContext, signal);
  }

  validateCustomRoutePathsForTest(routes: Parameters<typeof this.validateCustomRoutePaths>[0]) {
    return this.validateCustomRoutePaths(routes);
  }
}

function createTestAdapter() {
  return new TestMastraServer({
    app: {},
    mastra: {
      getServer: () => undefined,
      setMastraServer: vi.fn(),
    } as unknown as Mastra,
  });
}

function createWritableResponse() {
  const response = new PassThrough();
  const originalEnd = response.end.bind(response);
  const originalWrite = response.write.bind(response);
  return Object.assign(response, {
    write: vi.fn((chunk: unknown, ...args: any[]) => originalWrite(chunk as any, ...args)),
    writeHead: vi.fn(),
    end: vi.fn((chunk?: string) => originalEnd(chunk)),
  });
}

function createMockFGAProvider(authorized = true): IFGAProvider {
  return {
    check: vi.fn().mockResolvedValue(authorized),
    require: vi.fn(),
    filterAccessible: vi.fn(),
  };
}

describe('custom route forwarding', () => {
  it('should forward DELETE JSON bodies to custom routes', async () => {
    const mastra = new Mastra({
      logger: false,
      server: {
        apiRoutes: [
          {
            path: '/items/:id',
            method: 'DELETE',
            handler: async c => {
              const body = await c.req.json();
              const { id } = c.req.param();

              return c.json({ deleted: id, reason: body.reason });
            },
          },
        ],
      },
    });
    const adapter = new TestMastraServer({ app: {}, mastra });

    await expect(adapter.buildCustomRouteHandlerForTest()).resolves.toBe(true);

    const response = await adapter.handleCustomRouteRequestForTest(
      'http://localhost/items/123',
      'DELETE',
      { 'content-type': 'application/json' },
      { reason: 'no longer needed' },
    );

    expect(response).not.toBeNull();
    expect(response!.status).toBe(200);
    await expect(response!.json()).resolves.toEqual({
      deleted: '123',
      reason: 'no longer needed',
    });
  });
});

describe('FGA Middleware - checkRouteFGA', () => {
  let checkRouteFGA: (
    mastra: any,
    route: any,
    requestContext: any,
    params: Record<string, unknown>,
  ) => Promise<{ status: number; error: string; message: string } | null>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('./index');
    checkRouteFGA = mod.checkRouteFGA;
  });

  it('should return null when no FGA provider is configured', async () => {
    const mastra = { getServer: () => ({}) };
    const route = { fga: { resourceType: 'agent', permission: 'agents:read', resourceIdParam: 'agentId' } } as any;
    const requestContext = new Map<string, unknown>();
    requestContext.set('user', { id: 'user-1' });

    const result = await checkRouteFGA(mastra, route, requestContext as any, { agentId: 'a1' });
    expect(result).toBeNull();
  });

  it('should return null when no FGA config on route', async () => {
    const fgaProvider = createMockFGAProvider(true);
    const mastra = { getServer: () => ({ fga: fgaProvider }) };
    const route = {} as any;
    const requestContext = new Map<string, unknown>();

    const result = await checkRouteFGA(mastra, route, requestContext as any, {});
    expect(result).toBeNull();
  });

  it('should deny protected routes without FGA metadata when requireForProtectedRoutes is enabled', async () => {
    const fgaProvider = { ...createMockFGAProvider(true), requireForProtectedRoutes: true };
    const mastra = { getServer: () => ({ fga: fgaProvider }) };
    const route = { method: 'GET', path: '/agents', requiresAuth: true } as any;
    const requestContext = new Map<string, unknown>();
    requestContext.set('user', { id: 'user-1' });

    const result = await checkRouteFGA(mastra, route, requestContext as any, {});

    expect(result).toMatchObject({
      status: 403,
      error: 'Forbidden',
      message: 'FGA authorization denied: route FGA metadata is required',
    });
    expect(fgaProvider.check).not.toHaveBeenCalled();
  });

  it('should treat routes without requiresAuth as protected for FGA coverage', async () => {
    const fgaProvider = { ...createMockFGAProvider(true), requireForProtectedRoutes: true };
    const mastra = { getServer: () => ({ fga: fgaProvider }) };
    const route = { method: 'GET', path: '/custom' } as any;
    const requestContext = new Map<string, unknown>();
    requestContext.set('user', { id: 'user-1' });

    const result = await checkRouteFGA(mastra, route, requestContext as any, {});

    expect(result).toMatchObject({
      status: 403,
      error: 'Forbidden',
      message: 'FGA authorization denied: route FGA metadata is required',
    });
    expect(fgaProvider.check).not.toHaveBeenCalled();
  });

  it('should use a global route FGA resolver when route metadata is absent', async () => {
    const resolveRouteFGA = vi.fn().mockReturnValue({
      resourceType: 'agent',
      resourceId: 'agent-1',
      permission: 'agents:read',
    });
    const fgaProvider = { ...createMockFGAProvider(true), requireForProtectedRoutes: true, resolveRouteFGA };
    const mastra = { getServer: () => ({ fga: fgaProvider }) };
    const route = { method: 'GET', path: '/agents/:agentId', requiresAuth: true } as any;
    const requestContext = new Map<string, unknown>();
    requestContext.set('user', { id: 'user-1' });

    const result = await checkRouteFGA(mastra, route, requestContext as any, { agentId: 'agent-1' });

    expect(result).toBeNull();
    expect(resolveRouteFGA).toHaveBeenCalledWith({
      route: {
        path: '/agents/:agentId',
        method: 'GET',
        requiresAuth: true,
        requiresPermission: undefined,
        fga: undefined,
      },
      params: { agentId: 'agent-1' },
      requestContext,
    });
    expect(fgaProvider.check).toHaveBeenCalledWith(
      { id: 'user-1' },
      {
        resource: { type: 'agent', id: 'agent-1' },
        permission: 'agents:read',
        context: { resourceId: 'agent-1', requestContext },
      },
    );
  });

  it('should derive built-in FGA metadata for protected workflow execution routes', async () => {
    const fgaProvider = createMockFGAProvider(true);
    const mastra = { getServer: () => ({ fga: fgaProvider }) };
    const route = {
      method: 'POST',
      path: '/workflows/:workflowId/start',
      requiresAuth: true,
    } as any;
    const requestContext = new Map<string, unknown>();
    requestContext.set('user', { id: 'user-1' });

    const result = await checkRouteFGA(mastra, route, requestContext as any, { workflowId: 'workflow-1' });

    expect(result).toBeNull();
    expect(fgaProvider.check).toHaveBeenCalledWith(
      { id: 'user-1' },
      {
        resource: { type: 'workflow', id: 'workflow-1' },
        permission: 'workflows:execute',
        context: { resourceId: 'workflow-1', requestContext },
      },
    );
  });

  it('should derive built-in FGA metadata for scoped tool routes', async () => {
    const fgaProvider = createMockFGAProvider(true);
    const mastra = { getServer: () => ({ fga: fgaProvider }) };
    const requestContext = new Map<string, unknown>();
    requestContext.set('user', { id: 'user-1' });

    await expect(
      checkRouteFGA(
        mastra,
        {
          method: 'GET',
          path: '/agents/:agentId/tools/:toolId',
          requiresAuth: true,
        } as any,
        requestContext as any,
        { agentId: 'agent-1', toolId: 'search' },
      ),
    ).resolves.toBeNull();
    await expect(
      checkRouteFGA(
        mastra,
        {
          method: 'POST',
          path: '/mcp/:serverId/tools/:toolId/execute',
          requiresAuth: true,
        } as any,
        requestContext as any,
        { serverId: 'server-1', toolId: 'fetch' },
      ),
    ).resolves.toBeNull();

    expect(fgaProvider.check).toHaveBeenNthCalledWith(
      1,
      { id: 'user-1' },
      {
        resource: { type: 'tool', id: 'agent-1:search' },
        permission: 'tools:read',
        context: { resourceId: 'agent-1:search', requestContext },
      },
    );
    expect(fgaProvider.check).toHaveBeenNthCalledWith(
      2,
      { id: 'user-1' },
      {
        resource: { type: 'tool', id: JSON.stringify(['server-1', 'fetch']) },
        permission: 'tools:execute',
        context: { resourceId: JSON.stringify(['server-1', 'fetch']), requestContext },
      },
    );
  });

  it('should derive built-in FGA metadata for response and conversation resource routes', async () => {
    const fgaProvider = createMockFGAProvider(true);
    const mastra = { getServer: () => ({ fga: fgaProvider }) };
    const requestContext = new Map<string, unknown>();
    requestContext.set('user', { id: 'user-1' });

    await expect(
      checkRouteFGA(
        mastra,
        {
          method: 'GET',
          path: '/v1/responses/:responseId',
          requiresAuth: true,
          requiresPermission: 'agents:read',
        } as any,
        requestContext as any,
        { responseId: 'resp-1' },
      ),
    ).resolves.toBeNull();
    await expect(
      checkRouteFGA(
        mastra,
        {
          method: 'DELETE',
          path: '/v1/conversations/:conversationId',
          requiresAuth: true,
          requiresPermission: 'agents:delete',
        } as any,
        requestContext as any,
        { conversationId: 'conv-1' },
      ),
    ).resolves.toBeNull();

    expect(fgaProvider.check).toHaveBeenNthCalledWith(
      1,
      { id: 'user-1' },
      {
        resource: { type: 'response', id: 'resp-1' },
        permission: 'agents:read',
        context: { resourceId: 'resp-1', requestContext },
      },
    );
    expect(fgaProvider.check).toHaveBeenNthCalledWith(
      2,
      { id: 'user-1' },
      {
        resource: { type: 'conversation', id: 'conv-1' },
        permission: 'agents:delete',
        context: { resourceId: 'conv-1', requestContext },
      },
    );
  });

  it('should derive built-in FGA metadata for stored resource item and collection routes', async () => {
    const fgaProvider = createMockFGAProvider(true);
    const mastra = { getServer: () => ({ fga: fgaProvider }) };
    const requestContext = new Map<string, unknown>();
    requestContext.set('user', { id: 'user-1' });
    requestContext.set('mastra__resourceId', 'team-1');

    await expect(
      checkRouteFGA(
        mastra,
        {
          method: 'GET',
          path: '/stored/agents/:storedAgentId',
          requiresAuth: true,
        } as any,
        requestContext as any,
        { storedAgentId: 'agent-1' },
      ),
    ).resolves.toBeNull();
    await expect(
      checkRouteFGA(
        mastra,
        {
          method: 'POST',
          path: '/stored/skills/:storedSkillId/publish',
          requiresAuth: true,
        } as any,
        requestContext as any,
        { storedSkillId: 'skill-1' },
      ),
    ).resolves.toBeNull();
    await expect(
      checkRouteFGA(
        mastra,
        {
          method: 'GET',
          path: '/stored/workspaces',
          requiresAuth: true,
        } as any,
        requestContext as any,
        {},
      ),
    ).resolves.toBeNull();

    expect(fgaProvider.check).toHaveBeenNthCalledWith(
      1,
      { id: 'user-1' },
      {
        resource: { type: 'stored-agents', id: 'agent-1' },
        permission: 'stored-agents:read',
        context: { resourceId: 'agent-1', requestContext },
      },
    );
    expect(fgaProvider.check).toHaveBeenNthCalledWith(
      2,
      { id: 'user-1' },
      {
        resource: { type: 'stored-skills', id: 'skill-1' },
        permission: 'stored-skills:publish',
        context: { resourceId: 'skill-1', requestContext },
      },
    );
    expect(fgaProvider.check).toHaveBeenNthCalledWith(
      3,
      { id: 'user-1' },
      {
        resource: { type: 'stored-workspaces', id: 'team-1' },
        permission: 'stored-workspaces:read',
        context: { resourceId: 'team-1', requestContext },
      },
    );
  });

  it('should return null when FGA check passes', async () => {
    const fgaProvider = createMockFGAProvider(true);
    const mastra = { getServer: () => ({ fga: fgaProvider }) };
    const route = { fga: { resourceType: 'agent', permission: 'agents:execute', resourceIdParam: 'agentId' } } as any;
    const requestContext = new Map<string, unknown>();
    requestContext.set('user', { id: 'user-1' });

    const result = await checkRouteFGA(mastra, route, requestContext as any, { agentId: 'agent-1' });
    expect(result).toBeNull();
    expect(fgaProvider.check).toHaveBeenCalledWith(
      { id: 'user-1' },
      {
        resource: { type: 'agent', id: 'agent-1' },
        permission: 'agents:execute',
        context: { resourceId: 'agent-1', requestContext },
      },
    );
  });

  it('should return 403 error when FGA check fails', async () => {
    const fgaProvider = createMockFGAProvider(false);
    const mastra = { getServer: () => ({ fga: fgaProvider }) };
    const route = { fga: { resourceType: 'agent', permission: 'agents:execute', resourceIdParam: 'agentId' } } as any;
    const requestContext = new Map<string, unknown>();
    requestContext.set('user', { id: 'user-1' });

    const result = await checkRouteFGA(mastra, route, requestContext as any, { agentId: 'agent-1' });
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
    expect(result!.error).toBe('Forbidden');
  });

  it('should return 403 when FGA is configured but no user is in requestContext', async () => {
    const fgaProvider = createMockFGAProvider(false);
    const mastra = { getServer: () => ({ fga: fgaProvider }) };
    const route = { fga: { resourceType: 'agent', permission: 'agents:execute' } } as any;
    const requestContext = new Map<string, unknown>();

    const result = await checkRouteFGA(mastra, route, requestContext as any, {});
    expect(result).toMatchObject({ status: 403, error: 'Forbidden' });
    expect(fgaProvider.check).not.toHaveBeenCalled();
  });

  it('should return 403 when route FGA metadata cannot resolve a resource ID', async () => {
    const fgaProvider = createMockFGAProvider(true);
    const mastra = { getServer: () => ({ fga: fgaProvider }) };
    const route = { fga: { resourceType: 'agent', permission: 'agents:read' } } as any;
    const requestContext = new Map<string, unknown>();
    requestContext.set('user', { id: 'user-1' });

    const result = await checkRouteFGA(mastra, route, requestContext as any, {});
    expect(result).toMatchObject({ status: 403, error: 'Forbidden' });
    expect(fgaProvider.check).not.toHaveBeenCalled();
  });

  it('should derive FGA permission from the route method when permission is omitted', async () => {
    const fgaProvider = createMockFGAProvider(true);
    const mastra = { getServer: () => ({ fga: fgaProvider }) };
    const route = { method: 'DELETE', fga: { resourceType: 'agent', resourceIdParam: 'agentId' } } as any;
    const requestContext = new Map<string, unknown>();
    requestContext.set('user', { id: 'user-1' });

    const result = await checkRouteFGA(mastra, route, requestContext as any, { agentId: 'agent-1' });

    expect(result).toBeNull();
    expect(fgaProvider.check).toHaveBeenCalledWith(
      { id: 'user-1' },
      {
        resource: { type: 'agent', id: 'agent-1' },
        permission: 'agents:delete',
        context: { resourceId: 'agent-1', requestContext },
      },
    );
  });

  it('should use a custom resource ID resolver when configured', async () => {
    const fgaProvider = createMockFGAProvider(true);
    const mastra = { getServer: () => ({ fga: fgaProvider }) };
    const route = {
      fga: {
        resourceType: 'tool',
        permission: 'tools:execute',
        resourceId: ({ agentId, toolId }: Record<string, unknown>) => `${String(agentId)}:${String(toolId)}`,
      },
    } as any;
    const requestContext = new Map<string, unknown>();
    requestContext.set('user', { id: 'user-1' });

    const result = await checkRouteFGA(mastra, route, requestContext as any, {
      agentId: 'agent-1',
      toolId: 'search',
    });

    expect(result).toBeNull();
    expect(fgaProvider.check).toHaveBeenCalledWith(
      { id: 'user-1' },
      {
        resource: { type: 'tool', id: 'agent-1:search' },
        permission: 'tools:execute',
        context: { resourceId: 'agent-1:search', requestContext },
      },
    );
  });

  it('should pass request context to custom resource ID resolvers', async () => {
    const fgaProvider = createMockFGAProvider(true);
    const mastra = { getServer: () => ({ fga: fgaProvider }) };
    const route = {
      fga: {
        resourceType: 'tenant-resource',
        permission: 'tenant-resource:read',
        resourceId: (
          _params: Record<string, unknown>,
          { requestContext }: { requestContext?: Map<string, unknown> },
        ) => {
          return requestContext?.get('tenantResourceId') as string | undefined;
        },
      },
    } as any;
    const requestContext = new Map<string, unknown>();
    requestContext.set('user', { id: 'user-1' });
    requestContext.set('tenantResourceId', 'tenant-1:resource-1');

    const result = await checkRouteFGA(mastra, route, requestContext as any, {});

    expect(result).toBeNull();
    expect(fgaProvider.check).toHaveBeenCalledWith(
      { id: 'user-1' },
      {
        resource: { type: 'tenant-resource', id: 'tenant-1:resource-1' },
        permission: 'tenant-resource:read',
        context: { resourceId: 'tenant-1:resource-1', requestContext },
      },
    );
  });
});

describe('custom route response bridge', () => {
  it('pipes custom route response streams to node responses', async () => {
    const adapter = createTestAdapter();
    const nodeRes = createWritableResponse();
    const chunks: Buffer[] = [];
    nodeRes.on('data', chunk => chunks.push(Buffer.from(chunk)));

    await adapter.writeResponse(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('hello '));
            controller.enqueue(new TextEncoder().encode('world'));
            controller.close();
          },
        }),
        { status: 201, headers: { 'x-test': 'yes' } },
      ),
      nodeRes,
    );

    expect(nodeRes.writeHead).toHaveBeenCalledWith(201, { 'x-test': 'yes' });
    expect(Buffer.concat(chunks).toString('utf8')).toBe('hello world');
    expect(nodeRes.end).toHaveBeenCalledTimes(1);
  });

  it('skips header writes and cancels response streams when the node response is already closed', async () => {
    const adapter = createTestAdapter();
    const nodeRes = createWritableResponse();
    const cancel = vi.fn();
    nodeRes.destroy();

    await adapter.writeResponse(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('late response'));
          },
          cancel,
        }),
        { status: 200 },
      ),
      nodeRes,
    );

    expect(nodeRes.writeHead).not.toHaveBeenCalled();
    expect(nodeRes.end).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalled();
  });

  it('cancels custom route response streams when the node response closes early', async () => {
    const adapter = createTestAdapter();
    const nodeRes = createWritableResponse();
    const cancel = vi.fn();

    const writePromise = adapter.writeResponse(
      new Response(
        new ReadableStream({
          async pull(controller) {
            controller.enqueue(new TextEncoder().encode('chunk\n'));
            await new Promise(resolve => setTimeout(resolve, 5));
          },
          cancel,
        }),
      ),
      nodeRes,
    );

    await vi.waitFor(() => expect(nodeRes.write).toHaveBeenCalled());

    const closeError = new Error('client closed') as Error & { code: string };
    closeError.code = 'ECONNRESET';
    nodeRes.destroy(closeError);

    await writePromise;
    expect(cancel).toHaveBeenCalledWith(closeError);
  });

  it('rethrows response body stream errors instead of treating them as client disconnects', async () => {
    const adapter = createTestAdapter();
    const nodeRes = createWritableResponse();
    const upstreamError = Object.assign(new Error('upstream reset'), { code: 'ECONNRESET' });

    nodeRes.on('error', () => {});

    await expect(
      adapter.writeResponse(
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('chunk\n'));
              queueMicrotask(() => {
                controller.error(upstreamError);
              });
            },
          }),
        ),
        nodeRes,
      ),
    ).rejects.toMatchObject({ code: 'ECONNRESET' });
  });

  it('rethrows response body abort errors when they happen before response close aborts the signal', async () => {
    const adapter = createTestAdapter();
    const nodeRes = createWritableResponse();
    const controller = new AbortController();
    const upstreamError = new DOMException('upstream aborted', 'AbortError');

    nodeRes.on('close', () => {
      if (!nodeRes.writableEnded) {
        controller.abort();
      }
    });
    nodeRes.on('error', () => {});

    await expect(
      adapter.writeResponse(
        new Response(
          new ReadableStream({
            start(streamController) {
              streamController.enqueue(new TextEncoder().encode('chunk\n'));
              queueMicrotask(() => {
                streamController.error(upstreamError);
              });
            },
          }),
        ),
        nodeRes,
        controller.signal,
      ),
    ).rejects.toBe(upstreamError);
  });
});

describe('EE license validation', () => {
  let originalNodeEnv: string | undefined;
  let originalMastraDev: string | undefined;
  let originalLicense: string | undefined;

  beforeEach(() => {
    originalNodeEnv = process.env['NODE_ENV'];
    originalMastraDev = process.env['MASTRA_DEV'];
    originalLicense = process.env['MASTRA_EE_LICENSE'];
    delete process.env['MASTRA_DEV'];
    vi.resetModules();
  });

  afterEach(() => {
    if (originalNodeEnv !== undefined) process.env['NODE_ENV'] = originalNodeEnv;
    else delete process.env['NODE_ENV'];
    if (originalMastraDev !== undefined) process.env['MASTRA_DEV'] = originalMastraDev;
    else delete process.env['MASTRA_DEV'];
    if (originalLicense !== undefined) process.env['MASTRA_EE_LICENSE'] = originalLicense;
    else delete process.env['MASTRA_EE_LICENSE'];
    vi.resetModules();
  });

  it('should reject FGA in production without a valid EE license', async () => {
    process.env['NODE_ENV'] = 'production';
    delete process.env['MASTRA_EE_LICENSE'];

    const mastra = new Mastra({
      server: {
        fga: createMockFGAProvider(),
      },
    });
    const adapter = new TestMastraServer({ app: {}, mastra });

    await expect(adapter.validateEELicense()).rejects.toThrow('FGA is configured but no valid EE license was found');
  });

  it('should allow FGA in production with a valid EE license', async () => {
    process.env['NODE_ENV'] = 'production';
    process.env['MASTRA_EE_LICENSE'] = 'a'.repeat(32);

    const mastra = new Mastra({
      server: {
        fga: createMockFGAProvider(),
      },
    });
    const adapter = new TestMastraServer({ app: {}, mastra });

    await expect(adapter.validateEELicense()).resolves.toBeUndefined();
  });

  it('should mention both configured EE authorization features when both are unlicensed', async () => {
    process.env['NODE_ENV'] = 'production';
    delete process.env['MASTRA_EE_LICENSE'];

    const mastra = new Mastra({
      server: {
        rbac: {
          getRoles: vi.fn(),
          getPermissions: vi.fn(),
          hasPermission: vi.fn(),
          hasAllPermissions: vi.fn(),
          hasAnyPermission: vi.fn(),
        },
        fga: createMockFGAProvider(),
      },
    });
    const adapter = new TestMastraServer({ app: {}, mastra });

    await expect(adapter.validateEELicense()).rejects.toThrow(
      'RBAC and FGA are configured but no valid EE license was found',
    );
  });
});

describe('FGA policy coverage validation', () => {
  it('should call provider permission validation with permissions Mastra can emit', async () => {
    const validatePermissions = vi.fn();
    const mastra = new Mastra({
      server: {
        fga: {
          ...createMockFGAProvider(),
          validatePermissions,
        },
      },
    });
    const adapter = new TestMastraServer({ app: {}, mastra });

    await adapter.validateFGAPolicyCoverage();

    expect(validatePermissions).toHaveBeenCalledTimes(1);
    expect(validatePermissions.mock.calls[0]?.[0]).toContain('agents:create');
    expect(validatePermissions.mock.calls[0]?.[0]).toContain('agents:read');
    expect(validatePermissions.mock.calls[0]?.[0]).toContain('workflows:execute');
  });

  it('should warn about protected routes without FGA metadata when fail-closed mode is enabled', async () => {
    const mastra = new Mastra({
      server: {
        fga: {
          ...createMockFGAProvider(),
          requireForProtectedRoutes: true,
        },
      },
    });
    const warn = vi.spyOn(mastra.getLogger(), 'warn').mockImplementation(() => {});
    const adapter = new TestMastraServer({ app: {}, mastra });

    await adapter.validateFGAPolicyCoverage();

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('FGA is configured but'),
      expect.objectContaining({
        routes: expect.arrayContaining(['GET /agents']),
      }),
    );
  });

  it('should throw on missing FGA metadata when auditProtectedRoutes is error', async () => {
    const mastra = new Mastra({
      server: {
        fga: {
          ...createMockFGAProvider(),
          auditProtectedRoutes: 'error',
        },
      },
    });
    const adapter = new TestMastraServer({ app: {}, mastra });

    await expect(adapter.validateFGAPolicyCoverage()).rejects.toThrow('protected routes are missing FGA metadata');
  });
});

describe('validateCustomRoutePaths', () => {
  const mockHandler = vi.fn();

  it('should throw when a custom route collides with the default /api prefix', () => {
    const mastra = new Mastra({ logger: false });
    const adapter = new TestMastraServer({ app: {}, mastra });

    expect(() =>
      adapter.validateCustomRoutePathsForTest([{ path: '/api/foo', method: 'GET', handler: mockHandler }]),
    ).toThrow(/must not start with "\/api"/);
  });

  it('should throw when a custom route exactly matches the prefix', () => {
    const mastra = new Mastra({ logger: false });
    const adapter = new TestMastraServer({ app: {}, mastra });

    expect(() =>
      adapter.validateCustomRoutePathsForTest([{ path: '/api', method: 'GET', handler: mockHandler }]),
    ).toThrow(/must not start with "\/api"/);
  });

  it('should allow routes outside the default /api prefix', () => {
    const mastra = new Mastra({ logger: false });
    const adapter = new TestMastraServer({ app: {}, mastra });

    expect(() =>
      adapter.validateCustomRoutePathsForTest([{ path: '/webhooks/stripe', method: 'POST', handler: mockHandler }]),
    ).not.toThrow();
  });

  it('should allow /api/ routes when a custom prefix is configured', () => {
    const mastra = new Mastra({ logger: false });
    const adapter = new TestMastraServer({ app: {}, mastra, prefix: '/mastra/api' });

    expect(() =>
      adapter.validateCustomRoutePathsForTest([{ path: '/api/my-endpoint', method: 'GET', handler: mockHandler }]),
    ).not.toThrow();
  });

  it('should throw when a custom route collides with a custom prefix', () => {
    const mastra = new Mastra({ logger: false });
    const adapter = new TestMastraServer({ app: {}, mastra, prefix: '/mastra/api' });

    expect(() =>
      adapter.validateCustomRoutePathsForTest([{ path: '/mastra/api/agents', method: 'GET', handler: mockHandler }]),
    ).toThrow(/must not start with "\/mastra\/api"/);
  });

  it('should skip internal routes marked with _mastraInternal', () => {
    const mastra = new Mastra({ logger: false });
    const adapter = new TestMastraServer({ app: {}, mastra });

    expect(() =>
      adapter.validateCustomRoutePathsForTest([
        { path: '/api/agents', method: 'GET', handler: mockHandler, _mastraInternal: true },
      ]),
    ).not.toThrow();
  });

  it('should not throw when prefix is empty', () => {
    const mastra = new Mastra({ logger: false });
    const adapter = new TestMastraServer({ app: {}, mastra, prefix: '' });

    expect(() =>
      adapter.validateCustomRoutePathsForTest([{ path: '/api/anything', method: 'GET', handler: mockHandler }]),
    ).not.toThrow();
  });
});
