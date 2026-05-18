/**
 * @license Mastra Enterprise License - see ee/LICENSE
 */
import type { IFGAProvider } from '@mastra/core/auth/ee';
import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MASTRA_AUTH_TOKEN_KEY, MASTRA_RESOURCE_ID_KEY } from '../constants';
import { MastraServer } from './index';

class TestMastraServer extends MastraServer<any, any, any> {
  stream = vi.fn();
  getParams = vi.fn();
  sendResponse = vi.fn();
  registerRoute = vi.fn();
  registerContextMiddleware = vi.fn();
  registerAuthMiddleware = vi.fn();
  registerHttpLoggingMiddleware = vi.fn();

  checkAuthForTest(route: any, context: any) {
    return this.checkRouteAuth(route, context);
  }
}

function createMockFGAProvider(authorized = true): IFGAProvider {
  return {
    check: vi.fn().mockResolvedValue(authorized),
    require: vi.fn(),
    filterAccessible: vi.fn(),
  };
}

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

describe('Harness route auth boundary', () => {
  function makeRoute(path: string, extra: Record<string, unknown> = {}) {
    return {
      method: 'GET',
      path,
      responseType: 'json',
      handler: async () => ({}),
      ...extra,
    } as any;
  }

  function makeContext({
    path,
    query = {},
    headers = {},
    request = new Request(`http://localhost${path}`),
    requestContext = new RequestContext(),
  }: {
    path: string;
    query?: Record<string, unknown>;
    headers?: Record<string, string | undefined>;
    request?: Request;
    requestContext?: RequestContext;
  }) {
    return {
      path,
      method: 'GET',
      getHeader: (name: string) => headers[name.toLowerCase()],
      getQuery: (name: string) => query[name],
      requestContext,
      request,
      buildAuthorizeContext: () => null,
    };
  }

  it('rejects bearer-equivalent query credentials on Harness routes before principal resolution', async () => {
    const authenticateToken = vi.fn(async () => ({ id: 'user-1' }));
    const mastra = new Mastra({
      server: {
        auth: {
          protected: ['/api/*'],
          authenticateToken,
          mapUserToResourceId: () => 'resource-1',
        },
      },
    });
    const adapter = new TestMastraServer({ app: {}, mastra });
    const requestContext = new RequestContext();

    const result = await adapter.checkAuthForTest(
      makeRoute('/harness/:harnessName/sessions'),
      makeContext({
        path: '/api/harness/default/sessions',
        query: { apiKey: 'secret' },
        requestContext,
      }),
    );

    expect(result).toEqual({
      status: 400,
      error: 'Bearer-equivalent query credentials are not accepted on Harness routes: apiKey',
    });
    expect(authenticateToken).not.toHaveBeenCalled();
    expect(requestContext.get(MASTRA_AUTH_TOKEN_KEY)).toBeUndefined();
    expect(requestContext.get(MASTRA_RESOURCE_ID_KEY)).toBeUndefined();
  });

  it('rejects Harness query credentials even when an Authorization header is present', async () => {
    const authenticateToken = vi.fn(async () => ({ id: 'user-1' }));
    const mastra = new Mastra({
      server: {
        auth: {
          protected: ['/api/*'],
          authenticateToken,
        },
      },
    });
    const adapter = new TestMastraServer({ app: {}, mastra });

    const result = await adapter.checkAuthForTest(
      makeRoute('/harness/:harnessName/sessions'),
      makeContext({
        path: '/api/harness/default/sessions',
        query: { apiKey: 'secret' },
        headers: { authorization: 'Bearer header-secret' },
      }),
    );

    expect(result).toEqual({
      status: 400,
      error: 'Bearer-equivalent query credentials are not accepted on Harness routes: apiKey',
    });
    expect(authenticateToken).not.toHaveBeenCalled();
  });

  it('forces auth for Harness routes outside the protected API prefix', async () => {
    const authenticateToken = vi.fn(async (token: string) => (token === 'header-secret' ? { id: 'user-1' } : null));
    const mastra = new Mastra({
      server: {
        auth: {
          protected: ['/api/*'],
          public: ['/harness/*'],
          authenticateToken,
          mapUserToResourceId: () => 'resource-1',
        },
      },
    });
    const adapter = new TestMastraServer({ app: {}, mastra });
    const requestContext = new RequestContext();
    const request = new Request('http://localhost/harness/default/sessions', {
      headers: { authorization: 'Bearer header-secret' },
    });

    const result = await adapter.checkAuthForTest(
      makeRoute('/harness/:harnessName/sessions'),
      makeContext({
        path: '/harness/default/sessions',
        headers: { authorization: 'Bearer header-secret' },
        request,
        requestContext,
      }),
    );

    expect(result).toBeNull();
    expect(authenticateToken).toHaveBeenCalledWith('header-secret', request);
    expect(requestContext.get(MASTRA_AUTH_TOKEN_KEY)).toBe('header-secret');
    expect(requestContext.get(MASTRA_RESOURCE_ID_KEY)).toBe('resource-1');
  });

  it('preserves the legacy apiKey query fallback for non-Harness routes', async () => {
    const authenticateToken = vi.fn(async (token: string) => (token === 'secret' ? { id: 'user-1' } : null));
    const mastra = new Mastra({
      server: {
        auth: {
          protected: ['/api/*'],
          authenticateToken,
          mapUserToResourceId: () => 'resource-1',
        },
      },
    });
    const adapter = new TestMastraServer({ app: {}, mastra });
    const requestContext = new RequestContext();

    const result = await adapter.checkAuthForTest(
      makeRoute('/agents/:agentId'),
      makeContext({
        path: '/api/agents/agent-1',
        query: { apiKey: 'secret' },
        requestContext,
      }),
    );

    expect(result).toBeNull();
    expect(authenticateToken).toHaveBeenCalledWith('secret', expect.any(Request));
    expect(requestContext.get(MASTRA_AUTH_TOKEN_KEY)).toBe('secret');
    expect(requestContext.get(MASTRA_RESOURCE_ID_KEY)).toBe('resource-1');
  });

  it('allows scoped SSE subscription tokens only when route metadata opts in', async () => {
    const authenticateToken = vi.fn(async (token: string, request: Request) => {
      const url = new URL(request.url);
      return !token && url.searchParams.get('subscriptionToken') === 'scoped' ? { id: 'user-1' } : null;
    });
    const mastra = new Mastra({
      server: {
        auth: {
          protected: ['/api/*'],
          authenticateToken,
          mapUserToResourceId: () => 'resource-1',
        },
      },
    });
    const adapter = new TestMastraServer({ app: {}, mastra });
    const requestContext = new RequestContext();
    const request = new Request('http://localhost/api/harness/default/sessions/session-1/events?subscriptionToken=scoped');

    const result = await adapter.checkAuthForTest(
      makeRoute('/harness/:harnessName/sessions/:sessionId/events', {
        harnessAuth: { allowSseSubscriptionToken: true },
      }),
      makeContext({
        path: '/api/harness/default/sessions/session-1/events',
        query: { subscriptionToken: 'scoped' },
        request,
        requestContext,
      }),
    );

    expect(result).toBeNull();
    expect(authenticateToken).toHaveBeenCalledWith('', request);
    expect(requestContext.get(MASTRA_AUTH_TOKEN_KEY)).toBeUndefined();
    expect(requestContext.get(MASTRA_RESOURCE_ID_KEY)).toBe('resource-1');
  });

  it('rejects scoped SSE subscription tokens on other Harness routes', async () => {
    const authenticateToken = vi.fn(async () => ({ id: 'user-1' }));
    const mastra = new Mastra({
      server: {
        auth: {
          protected: ['/api/*'],
          authenticateToken,
        },
      },
    });
    const adapter = new TestMastraServer({ app: {}, mastra });

    const result = await adapter.checkAuthForTest(
      makeRoute('/harness/:harnessName/sessions/:sessionId'),
      makeContext({
        path: '/api/harness/default/sessions/session-1',
        query: { subscriptionToken: 'scoped' },
      }),
    );

    expect(result).toEqual({
      status: 400,
      error: 'Scoped Harness SSE subscription tokens are only accepted on the session events route',
    });
    expect(authenticateToken).not.toHaveBeenCalled();
  });

  it('fails closed when a Harness route has no server auth configuration', async () => {
    const mastra = new Mastra({});
    const adapter = new TestMastraServer({ app: {}, mastra });

    const result = await adapter.checkAuthForTest(
      makeRoute('/harness/:harnessName/sessions'),
      makeContext({ path: '/api/harness/default/sessions' }),
    );

    expect(result).toEqual({
      status: 500,
      error: 'Harness routes require server auth configuration',
    });
  });

  it('fails closed when a Harness route opts out of auth', async () => {
    const authenticateToken = vi.fn(async () => ({ id: 'user-1' }));
    const mastra = new Mastra({
      server: {
        auth: {
          protected: ['/api/*'],
          authenticateToken,
        },
      },
    });
    const adapter = new TestMastraServer({ app: {}, mastra });

    const result = await adapter.checkAuthForTest(
      makeRoute('/harness/:harnessName/sessions', { requiresAuth: false }),
      makeContext({ path: '/api/harness/default/sessions' }),
    );

    expect(result).toEqual({
      status: 500,
      error: 'Harness routes require authentication',
    });
    expect(authenticateToken).not.toHaveBeenCalled();
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
