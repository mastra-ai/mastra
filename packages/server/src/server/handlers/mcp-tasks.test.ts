import type { Mastra } from '@mastra/core/mastra';
import type {
  MCPServerBase,
  MCPServerTasksInfo,
  MCPServerTasksInspector,
  MCPServerTaskSummary,
  ServerDetailInfo,
  ServerInfo,
} from '@mastra/core/mcp';
import { MASTRA_RESOURCE_ID_KEY } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';
import { HTTPException } from '../http-exception';
import { answerMcpServerTaskBodySchema, listMcpServerTasksResponseSchema } from '../schemas/mcp';
import {
  ANSWER_MCP_SERVER_TASK_ROUTE,
  CANCEL_MCP_SERVER_TASK_ROUTE,
  GET_MCP_SERVER_DETAIL_ROUTE,
  LIST_MCP_SERVERS_ROUTE,
  LIST_MCP_SERVER_TASKS_ROUTE,
} from './mcp';
import { createTestServerContext } from './test-utils';

const info: ServerInfo = {
  id: 'tasks',
  name: 'Tasks',
  version_detail: { version: '1.0.0', release_date: '2026-01-01T00:00:00Z', is_latest: true },
};

const tasksInfo: MCPServerTasksInfo = {
  enabled: true,
  required: false,
  listable: true,
  surfaces: [{ name: 'slow_report', type: 'tool', mode: 'always', recover: false, ttlMs: 60_000 }],
};

const waiting: MCPServerTaskSummary = {
  taskKey: 'key-1',
  surface: 'approve_and_send',
  status: 'input_required',
  createdAt: '2026-01-01T00:00:00.000Z',
  lastUpdatedAt: '2026-01-01T00:00:01.000Z',
  expiresAt: '2026-01-01T00:01:00.000Z',
  principalKey: 'principal-hash',
  inputRequests: { approve: { method: 'elicitation/create', params: { message: 'Approve?' } } },
};

/** An inspector that knows `key-1` and answers/cancels it once, like the stores' admin view. */
function fakeInspector() {
  const open = new Set(['key-1']);
  return {
    list: vi.fn<MCPServerTasksInspector['list']>(async () => ({ tasks: [waiting] })),
    cancel: vi.fn<MCPServerTasksInspector['cancel']>(async key => open.delete(key)),
    answer: vi.fn<MCPServerTasksInspector['answer']>(async key => open.delete(key)),
  };
}

function makeMastra(server: Partial<MCPServerBase>) {
  const logger = { error: vi.fn() };
  const mastra = {
    getMCPServerById: vi.fn((id: string) => (id === 'tasks' ? (server as MCPServerBase) : undefined)),
    listMCPServers: vi.fn(() => ({ tasks: server as MCPServerBase })),
    getLogger: vi.fn(() => logger),
  } as unknown as Mastra;
  return { mastra, logger };
}

function makeServer(inspector: MCPServerTasksInspector | undefined, taskInfo: MCPServerTasksInfo | null = tasksInfo) {
  return {
    id: 'tasks',
    getServerInfo: vi.fn(() => info),
    getServerDetail: vi.fn((): ServerDetailInfo => info),
    getTasksInfo: vi.fn(() => taskInfo ?? undefined),
    getTasksInspector: vi.fn(() => inspector),
  } satisfies Partial<MCPServerBase>;
}

/** A Studio caller; `resourceId` makes it resource-scoped, as `mapUserToResourceId` would. */
function context(mastra: Mastra, resourceId?: string) {
  const ctx = createTestServerContext({ mastra });
  if (resourceId !== undefined) ctx.requestContext.set(MASTRA_RESOURCE_ID_KEY, resourceId);
  return ctx;
}

async function status(promise: Promise<unknown>) {
  try {
    await promise;
    return 200;
  } catch (error) {
    if (error instanceof HTTPException) return error.status;
    throw error;
  }
}

describe('MCP task routes', () => {
  describe('server list and detail', () => {
    it('flags servers that run tools as tasks, and only those', async () => {
      const { mastra } = makeMastra(makeServer(fakeInspector()));
      const list = await LIST_MCP_SERVERS_ROUTE.handler(context(mastra));
      const detail = await GET_MCP_SERVER_DETAIL_ROUTE.handler({ ...context(mastra), id: 'tasks' });
      expect(list.servers[0]).toMatchObject({ tasks_capability: true });
      expect(detail).toMatchObject({ tasks_capability: true });

      const off = makeMastra(makeServer(undefined, null)).mastra;
      const legacy = makeMastra({ id: 'tasks', getServerInfo: () => info, getServerDetail: () => info }).mastra;
      for (const m of [off, legacy]) {
        expect(await GET_MCP_SERVER_DETAIL_ROUTE.handler({ ...context(m), id: 'tasks' })).not.toHaveProperty(
          'tasks_capability',
        );
      }
    });
  });

  describe('LIST_MCP_SERVER_TASKS_ROUTE', () => {
    it("shows an unscoped caller the surfaces and every principal's tasks", async () => {
      const inspector = fakeInspector();
      const { mastra } = makeMastra(makeServer(inspector));

      const result = await LIST_MCP_SERVER_TASKS_ROUTE.handler({ ...context(mastra), serverId: 'tasks', limit: 10 });

      expect(inspector.list).toHaveBeenCalledWith({ limit: 10 });
      expect(listMcpServerTasksResponseSchema.parse(result)).toEqual({
        required: false,
        surfaces: tasksInfo.surfaces,
        tasks: [waiting],
      });
    });

    it('lists nothing for a resource-scoped caller, without asking the store', async () => {
      const inspector = fakeInspector();
      const server = makeServer(inspector);
      const { mastra } = makeMastra(server);

      const result = await LIST_MCP_SERVER_TASKS_ROUTE.handler({ ...context(mastra, 'user-1'), serverId: 'tasks' });

      expect(result).toEqual({
        required: false,
        surfaces: tasksInfo.surfaces,
        unavailable: 'resource_scoped',
        tasks: [],
      });
      expect(inspector.list).not.toHaveBeenCalled();
      expect(server.getTasksInspector).not.toHaveBeenCalled();
    });

    it('treats an empty resource id as scoped, not as a privileged caller', async () => {
      const inspector = fakeInspector();
      const { mastra } = makeMastra(makeServer(inspector));
      const result = await LIST_MCP_SERVER_TASKS_ROUTE.handler({ ...context(mastra, ''), serverId: 'tasks' });
      expect(result).toMatchObject({ unavailable: 'resource_scoped', tasks: [] });
      expect(inspector.list).not.toHaveBeenCalled();
    });

    it('says when the task store cannot be listed', async () => {
      const { mastra } = makeMastra(makeServer(undefined, { ...tasksInfo, listable: false }));
      const result = await LIST_MCP_SERVER_TASKS_ROUTE.handler({ ...context(mastra), serverId: 'tasks' });
      expect(result).toMatchObject({ unavailable: 'not_listable', tasks: [], surfaces: tasksInfo.surfaces });
    });

    it('answers empty for a server without tasks and 404 for an unknown server', async () => {
      const { mastra } = makeMastra(makeServer(undefined, null));
      expect(await LIST_MCP_SERVER_TASKS_ROUTE.handler({ ...context(mastra), serverId: 'tasks' })).toEqual({
        required: false,
        surfaces: [],
        tasks: [],
      });
      expect(await status(LIST_MCP_SERVER_TASKS_ROUTE.handler({ ...context(mastra), serverId: 'nope' }))).toBe(404);
    });

    it('logs store failures and returns a generic error', async () => {
      const inspector = fakeInspector();
      inspector.list.mockRejectedValueOnce(new Error('db password is hunter2'));
      const { mastra, logger } = makeMastra(makeServer(inspector));
      const failure = await LIST_MCP_SERVER_TASKS_ROUTE.handler({ ...context(mastra), serverId: 'tasks' }).catch(
        (error: HTTPException) => error,
      );
      expect(failure).toMatchObject({ status: 500, message: 'Task request failed' });
      expect(logger.error).toHaveBeenCalled();
    });

    it('drops fields outside the summary shape, so a raw task id or principal never leaves', () => {
      const leaky = { ...waiting, taskId: 'raw-task-id', principal: 'client:sub:alice', token: 'alice-token' };
      const parsed = listMcpServerTasksResponseSchema.parse({ required: false, surfaces: [], tasks: [leaky] });
      expect(JSON.stringify(parsed)).not.toMatch(/raw-task-id|client:sub:alice|alice-token/);
    });
  });

  describe('CANCEL_MCP_SERVER_TASK_ROUTE', () => {
    it('cancels by key for an unscoped caller, and 404s once the task is no longer running', async () => {
      const inspector = fakeInspector();
      const { mastra } = makeMastra(makeServer(inspector));
      const cancel = () =>
        CANCEL_MCP_SERVER_TASK_ROUTE.handler({ ...context(mastra), serverId: 'tasks', taskKey: 'key-1' });

      expect(await cancel()).toEqual({ success: true });
      expect(inspector.cancel).toHaveBeenCalledWith('key-1');
      expect(await status(cancel())).toBe(404);
    });

    it('404s for an unknown key, a scoped caller, and a store that cannot be listed', async () => {
      const inspector = fakeInspector();
      const { mastra } = makeMastra(makeServer(inspector));
      expect(
        await status(CANCEL_MCP_SERVER_TASK_ROUTE.handler({ ...context(mastra), serverId: 'tasks', taskKey: 'nope' })),
      ).toBe(404);
      expect(
        await status(
          CANCEL_MCP_SERVER_TASK_ROUTE.handler({ ...context(mastra, 'user-1'), serverId: 'tasks', taskKey: 'key-1' }),
        ),
      ).toBe(404);
      expect(inspector.cancel).toHaveBeenCalledTimes(1);

      const unlisted = makeMastra(makeServer(undefined, { ...tasksInfo, listable: false })).mastra;
      expect(
        await status(
          CANCEL_MCP_SERVER_TASK_ROUTE.handler({ ...context(unlisted), serverId: 'tasks', taskKey: 'key-1' }),
        ),
      ).toBe(404);
    });

    it('needs mcp:execute', () => {
      expect(CANCEL_MCP_SERVER_TASK_ROUTE.requiresAuth).toBe(true);
      expect(CANCEL_MCP_SERVER_TASK_ROUTE.requiresPermission).toBe('mcp:execute');
    });
  });

  describe('ANSWER_MCP_SERVER_TASK_ROUTE', () => {
    const inputResponses = { approve: { action: 'accept', content: { ok: true } } };

    it('answers by key for an unscoped caller, and 404s for a second answer', async () => {
      const inspector = fakeInspector();
      const { mastra } = makeMastra(makeServer(inspector));
      const answer = () =>
        ANSWER_MCP_SERVER_TASK_ROUTE.handler({
          ...context(mastra),
          serverId: 'tasks',
          taskKey: 'key-1',
          inputResponses,
        });

      expect(await answer()).toEqual({ success: true });
      expect(inspector.answer).toHaveBeenCalledWith('key-1', inputResponses);
      expect(await status(answer())).toBe(404);
    });

    it('404s for a scoped caller without touching the task', async () => {
      const inspector = fakeInspector();
      const { mastra } = makeMastra(makeServer(inspector));
      expect(
        await status(
          ANSWER_MCP_SERVER_TASK_ROUTE.handler({
            ...context(mastra, 'user-1'),
            serverId: 'tasks',
            taskKey: 'key-1',
            inputResponses,
          }),
        ),
      ).toBe(404);
      expect(inspector.answer).not.toHaveBeenCalled();
    });

    it('validates the body as input responses keyed by request', () => {
      expect(answerMcpServerTaskBodySchema.safeParse({ inputResponses }).success).toBe(true);
      expect(answerMcpServerTaskBodySchema.safeParse({}).success).toBe(false);
      expect(answerMcpServerTaskBodySchema.safeParse({ inputResponses: { approve: 'yes' } }).success).toBe(false);
      expect(ANSWER_MCP_SERVER_TASK_ROUTE.requiresPermission).toBe('mcp:execute');
    });
  });
});
