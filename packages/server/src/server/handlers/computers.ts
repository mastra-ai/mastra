import { MastraFGAPermissions } from '@mastra/core/auth/ee';
import { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY } from '@mastra/core/request-context';
import { getComputerServerState } from '../computer-stream';
import { HTTPException } from '../http-exception';
import {
  changeComputerControlBodySchema,
  changeComputerControlResponseSchema,
  computerControlSchema,
  computerIdPathParams,
  computerSessionNotFoundResponseSchema,
  createComputerSessionBodySchema,
  createComputerSessionResponseSchema,
  getComputerControlQuerySchema,
} from '../schemas/computers';
import { createRoute } from '../server-adapter/routes/route-builder';
import { getPublicOrigin } from './auth';
import { enforceThreadAccess } from './utils';

const notFound = () => new HTTPException(404, { message: 'Computer not found' });

function scopeOf(
  requestContext: { get(key: string): unknown },
  input: { threadId?: string; resourceId?: string },
): { threadId: string; resourceId: string } {
  const contextThreadId = requestContext.get(MASTRA_THREAD_ID_KEY);
  const contextResourceId = requestContext.get(MASTRA_RESOURCE_ID_KEY);
  if (typeof contextResourceId === 'string' && input.resourceId && input.resourceId !== contextResourceId) throw notFound();
  const threadId = typeof contextThreadId === 'string' ? contextThreadId : input.threadId;
  const resourceId = typeof contextResourceId === 'string' ? contextResourceId : input.resourceId;
  if (!threadId || !resourceId) throw notFound();
  return { threadId, resourceId };
}

async function authorize(
  mastra: any,
  requestContext: any,
  scope: { threadId: string; resourceId: string },
  permission: 'memory:read' | 'memory:write',
): Promise<void> {
  try {
    const memory = await mastra.getStorage()?.getStore('memory');
    const thread = await memory?.getThreadById({ threadId: scope.threadId });
    if (!thread) throw notFound();
    await enforceThreadAccess({
      mastra,
      requestContext,
      threadId: scope.threadId,
      thread,
      effectiveResourceId: scope.resourceId,
      permission:
        permission === 'memory:write' ? MastraFGAPermissions.MEMORY_WRITE : MastraFGAPermissions.MEMORY_READ,
    });
  } catch {
    throw notFound();
  }
}

function callerOrigin(request: Request | undefined, allowedOrigins?: string | string[]): string {
  if (!request) return 'http://localhost';
  const serverOrigin = getPublicOrigin(request);
  const raw = request.headers.get('origin');
  if (!raw) return serverOrigin;
  let origin: URL;
  try {
    origin = new URL(raw);
  } catch {
    throw notFound();
  }
  if (origin.protocol !== 'http:' && origin.protocol !== 'https:') throw notFound();
  const allowed = Array.isArray(allowedOrigins) ? allowedOrigins : allowedOrigins ? [allowedOrigins] : [];
  if (
    origin.origin.toLowerCase() !== serverOrigin.toLowerCase() &&
    !allowed.includes('*') &&
    !allowed.includes(origin.origin)
  ) {
    throw notFound();
  }
  return origin.origin;
}

export const CREATE_COMPUTER_SESSION_ROUTE = createRoute({
  method: 'POST',
  path: '/computers/:computerId/session',
  responseType: 'json',
  pathParamSchema: computerIdPathParams,
  bodySchema: createComputerSessionBodySchema,
  responseSchema: createComputerSessionResponseSchema,
  summary: 'Create computer viewer session',
  description: 'Creates a short-lived, single-use viewer ticket for an attached computer.',
  tags: ['Computers'],
  requiresAuth: true,
  handler: async ({ mastra, requestContext, request, computerId, ...body }) => {
    const computers = mastra.getComputers?.();
    const server = getComputerServerState(mastra);
    if (!computers?.viewer || !server) throw notFound();
    const scope = scopeOf(requestContext, body);
    await authorize(mastra, requestContext, scope, 'memory:write');
    const origin = callerOrigin(request, server.allowedOrigins);
    let viewer;
    try {
      viewer = await computers.viewer(computerId, scope);
    } catch {
      throw notFound();
    }
    if (!viewer) return { state: 'not-running' as const };
    const issued = await server.ticketStore.issue({ computerId, ...scope, mode: body.mode, studioOrigin: origin });
    if (!issued.ok) throw new HTTPException(429, { message: 'Too many computer viewer tickets' });
    return {
      state: 'ready' as const,
      socketUrl: `/computer/${encodeURIComponent(computerId)}/websockify?ticket=${encodeURIComponent(issued.ticket)}`,
    };
  },
});

CREATE_COMPUTER_SESSION_ROUTE.openapi!.responses[404] = {
  description: 'The computer is missing, unattached, or concealed from the authenticated caller.',
  content: { 'application/json': { schema: computerSessionNotFoundResponseSchema } },
};

export const GET_COMPUTER_CONTROL_ROUTE = createRoute({
  method: 'GET',
  path: '/computers/:computerId/control',
  responseType: 'json',
  pathParamSchema: computerIdPathParams,
  queryParamSchema: getComputerControlQuerySchema,
  responseSchema: computerControlSchema,
  summary: 'Get computer control state',
  description: 'Returns the revisioned control state for an attached computer.',
  tags: ['Computers'],
  requiresAuth: true,
  handler: async ({ mastra, requestContext, request, computerId, ...query }) => {
    const computers = mastra.getComputers?.();
    const server = getComputerServerState(mastra);
    if (!server || !computers?.controlState) throw notFound();
    callerOrigin(request, server.allowedOrigins);
    const scope = scopeOf(requestContext, query);
    await authorize(mastra, requestContext, scope, 'memory:read');
    try {
      return await computers.controlState(computerId, scope);
    } catch {
      throw notFound();
    }
  },
});

export const CHANGE_COMPUTER_CONTROL_ROUTE = createRoute({
  method: 'POST',
  path: '/computers/:computerId/control',
  responseType: 'json',
  pathParamSchema: computerIdPathParams,
  bodySchema: changeComputerControlBodySchema,
  responseSchema: changeComputerControlResponseSchema,
  summary: 'Change computer control state',
  description: 'Takes or releases control of an attached computer.',
  tags: ['Computers'],
  requiresAuth: true,
  handler: async ({ mastra, requestContext, request, computerId, action, note, ...body }) => {
    const computers = mastra.getComputers?.();
    const server = getComputerServerState(mastra);
    if (!server || !computers?.control) throw notFound();
    callerOrigin(request, server.allowedOrigins);
    const scope = scopeOf(requestContext, body);
    await authorize(mastra, requestContext, scope, 'memory:write');
    try {
      return await computers.control(computerId, scope, { action, ...(note ? { note } : {}) });
    } catch {
      throw notFound();
    }
  },
});
