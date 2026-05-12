/**
 * @license Mastra Enterprise License - see ee/LICENSE
 */
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
