import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { MASTRA_USER_PERMISSIONS_KEY } from '../constants';
import { HTTPException } from '../http-exception';
import { createRoute } from './routes/route-builder';
import { invokeRoute } from './index';

const handler = vi.fn(async ({ name, requestContext }: { name: string; requestContext: RequestContext }) => ({
  greeting: `hello ${name}`,
  caller: (requestContext.get('user') as { id: string }).id,
}));

const greetRoute = createRoute({
  method: 'POST',
  path: '/observability/greet',
  responseType: 'json',
  requiresPermission: 'observability:read',
  bodySchema: z.object({ name: z.string() }),
  handler: handler as any,
});

const failingRoute = createRoute({
  method: 'POST',
  path: '/observability/fail',
  responseType: 'json',
  requiresPermission: 'observability:read',
  handler: async () => {
    throw new HTTPException(422, { message: 'Unsupported query' });
  },
});

function securedMastra() {
  return new Mastra({
    logger: false,
    server: {
      auth: { authenticateToken: async () => null, authorize: async () => true },
      rbac: { getPermissions: async () => [], getRoles: async () => [] } as any,
    },
  });
}

/** The request context Mastra server auth leaves behind for an authenticated caller. */
function callerContext(permissions: string[]) {
  const requestContext = new RequestContext();
  requestContext.set('user', { id: 'user-1' });
  requestContext.set(MASTRA_USER_PERMISSIONS_KEY, permissions);
  return requestContext;
}

describe('invokeRoute', () => {
  it('runs the route as the caller when they hold its permission', async () => {
    const result = await invokeRoute(greetRoute, {
      mastra: securedMastra(),
      requestContext: callerContext(['observability:read']),
      body: { name: 'Ada' },
    });

    expect(result).toEqual({ status: 200, body: { greeting: 'hello Ada', caller: 'user-1' } });
  });

  it('refuses a caller Mastra did not authenticate, without running the route', async () => {
    handler.mockClear();
    const result = await invokeRoute(greetRoute, {
      mastra: securedMastra(),
      requestContext: new RequestContext(),
      body: { name: 'Ada' },
    });

    expect(result.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it('refuses a caller missing the route permission, without running the route', async () => {
    handler.mockClear();
    const result = await invokeRoute(greetRoute, {
      mastra: securedMastra(),
      requestContext: callerContext(['agents:read']),
      body: { name: 'Ada' },
    });

    expect(result).toEqual({
      status: 403,
      body: { error: 'Forbidden', message: 'Missing required permission: observability:read' },
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it('rejects input the route schema rejects, as the HTTP endpoint does', async () => {
    const result = await invokeRoute(greetRoute, {
      mastra: securedMastra(),
      requestContext: callerContext(['observability:read']),
      body: { name: 42 },
    });

    expect(result.status).toBe(400);
    expect(JSON.stringify(result.body)).toContain('name');
  });

  it('answers with the status the route handler raised', async () => {
    const result = await invokeRoute(failingRoute, {
      mastra: securedMastra(),
      requestContext: callerContext(['observability:read']),
    });

    expect(result).toEqual({ status: 422, body: { error: 'Unsupported query' } });
  });

  it('runs without a user when the server has no auth configured', async () => {
    const result = await invokeRoute(failingRoute, {
      mastra: new Mastra({ logger: false }),
      requestContext: new RequestContext(),
    });

    expect(result.status).toBe(422);
  });
});
