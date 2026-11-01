/**
 * Studio's MCP task routes under the default roles. Listing and finding a task is a read; cancelling or
 * answering one acts on another client's task, so it needs `mcp:write` (admin), not `mcp:execute`
 * (member).
 */

import { DEFAULT_ROLES } from '@mastra/core/auth/ee';
import type { MCPServerBase, MCPServerTasksInspector, MCPServerTaskSummary } from '@mastra/core/mcp';
import {
  ANSWER_MCP_SERVER_TASK_ROUTE,
  CANCEL_MCP_SERVER_TASK_ROUTE,
  FIND_MCP_SERVER_TASK_ROUTE,
  LIST_MCP_SERVER_TASKS_ROUTE,
} from '@mastra/server/handlers/mcp';
import { createDefaultTestContext } from '@mastra/server-adapters-test-suite';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MastraServer } from '../index';

const permissionsOf = (role: string) => DEFAULT_ROLES.find(r => r.id === role)?.permissions ?? [];

const waiting: MCPServerTaskSummary = {
  taskKey: 'key-1',
  surface: 'approve_and_send',
  status: 'input_required',
  createdAt: '2026-01-01T00:00:00.000Z',
  lastUpdatedAt: '2026-01-01T00:00:01.000Z',
  principalKey: 'principal-hash',
  inputRequests: { approve: { method: 'elicitation/create', params: { message: 'Approve?' } } },
};

/** Bearer token = role id; the RBAC provider grants that default role's permissions. */
async function setup() {
  const context = await createDefaultTestContext();
  const inspector = {
    list: vi.fn<MCPServerTasksInspector['list']>(async () => ({ tasks: [waiting] })),
    find: vi.fn<MCPServerTasksInspector['find']>(async () => waiting),
    cancel: vi.fn<MCPServerTasksInspector['cancel']>(async () => true),
    answer: vi.fn<MCPServerTasksInspector['answer']>(async () => true),
  };
  const mcpServer = {
    id: 'tasks',
    getTasksInfo: () => ({ enabled: true, listable: true, surfaces: [] }),
    getTasksInspector: () => inspector,
  } satisfies Partial<MCPServerBase>;
  vi.spyOn(context.mastra, 'getMCPServerById').mockImplementation(((id: string) =>
    id === 'tasks' ? mcpServer : undefined) as never);

  const originalGetServer = context.mastra.getServer.bind(context.mastra);
  context.mastra.getServer = () => ({
    ...originalGetServer(),
    auth: {
      authenticateToken: async (token: string) =>
        DEFAULT_ROLES.some(r => r.id === token) ? { id: `user_${token}`, role: token } : null,
      authorize: async () => true,
    },
    rbac: {
      getPermissions: async (user: { role: string }) => permissionsOf(user.role),
      getRoles: async (user: { role: string }) => [user.role],
    },
  });

  const app = new Hono();
  const adapter = new MastraServer({ app, mastra: context.mastra });
  adapter.registerContextMiddleware();
  adapter.registerAuthMiddleware();
  for (const route of [
    LIST_MCP_SERVER_TASKS_ROUTE,
    FIND_MCP_SERVER_TASK_ROUTE,
    CANCEL_MCP_SERVER_TASK_ROUTE,
    ANSWER_MCP_SERVER_TASK_ROUTE,
  ]) {
    await adapter.registerRoute(app, route, { prefix: '/api' });
  }

  const request = (role: string, method: 'GET' | 'POST', path: string, body?: unknown) =>
    app.request(
      new Request(`http://localhost/api/mcp/tasks${path}`, {
        method,
        headers: { Authorization: `Bearer ${role}`, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
  return {
    inspector,
    list: (role: string) => request(role, 'GET', '/tasks'),
    find: (role: string) => request(role, 'POST', '/tasks/find', { taskId: 'raw-task-id' }),
    cancel: (role: string) => request(role, 'POST', '/tasks/key-1/cancel'),
    answer: (role: string) =>
      request(role, 'POST', '/tasks/key-1/input', { inputResponses: { approve: { action: 'decline' } } }),
  };
}

describe('MCP task routes under the default roles', () => {
  let routes: Awaited<ReturnType<typeof setup>>;

  beforeEach(async () => {
    routes = await setup();
  });

  describe.each(['member', 'viewer'])('when the caller is a %s', role => {
    it('can list and find tasks', async () => {
      expect((await routes.list(role)).status).toBe(200);
      expect((await routes.find(role)).status).toBe(200);
    });

    it('is refused cancelling a task, and the store is never asked', async () => {
      const response = await routes.cancel(role);

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({
        error: 'Forbidden',
        message: 'Missing required permission: mcp:write',
      });
      expect(routes.inspector.cancel).not.toHaveBeenCalled();
    });

    it('is refused answering a task, and the store is never asked', async () => {
      const response = await routes.answer(role);

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({
        error: 'Forbidden',
        message: 'Missing required permission: mcp:write',
      });
      expect(routes.inspector.answer).not.toHaveBeenCalled();
    });
  });

  describe('when the caller is an admin', () => {
    it('cancels the task', async () => {
      expect((await routes.cancel('admin')).status).toBe(200);
      expect(routes.inspector.cancel.mock.calls[0]?.[0]).toBe('key-1');
    });

    it('answers the task', async () => {
      expect((await routes.answer('admin')).status).toBe(200);
      expect(routes.inspector.answer.mock.calls[0]?.slice(0, 2)).toEqual(['key-1', { approve: { action: 'decline' } }]);
    });
  });
});
