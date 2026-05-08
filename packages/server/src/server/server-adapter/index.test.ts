/**
 * @license Mastra Enterprise License - see ee/LICENSE
 */
import { PassThrough } from 'node:stream';
import type { IFGAProvider } from '@mastra/core/auth/ee';
import type { Mastra } from '@mastra/core/mastra';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MastraServer } from './index';

class TestServerAdapter extends MastraServer<Record<string, never>, unknown, unknown> {
  async stream() {}
  async getParams() {
    return { urlParams: {}, queryParams: {}, body: undefined };
  }
  async sendResponse() {}
  async registerRoute() {}
  registerContextMiddleware() {}
  registerAuthMiddleware() {}
  registerHttpLoggingMiddleware() {}

  // Exposes the protected bridge for focused unit coverage.
  async writeResponse(response: Response, nodeRes: any) {
    await this.writeCustomRouteResponse(response, nodeRes);
  }
}

function createTestAdapter() {
  return new TestServerAdapter({
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

async function waitFor(assertion: () => boolean, timeout = 500): Promise<void> {
  const start = Date.now();
  while (!assertion()) {
    if (Date.now() - start > timeout) {
      throw new Error('Timed out waiting for assertion');
    }
    await new Promise(resolve => setTimeout(resolve, 1));
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

    await waitFor(() => nodeRes.write.mock.calls.length > 0);

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
});
