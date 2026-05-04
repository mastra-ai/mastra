/**
 * @license Mastra Enterprise License - see ee/LICENSE
 */
import type { IFGAProvider } from '@mastra/core/auth/ee';
import { describe, it, expect, vi, beforeEach } from 'vitest';

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
