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
import {
  answerMcpServerTaskBodySchema,
  findMcpServerTaskBodySchema,
  findMcpServerTaskResponseSchema,
  listMcpServerTasksQuerySchema,
  listMcpServerTasksResponseSchema,
} from '../schemas/mcp';
import {
  ANSWER_MCP_SERVER_TASK_ROUTE,
  CANCEL_MCP_SERVER_TASK_ROUTE,
  FIND_MCP_SERVER_TASK_ROUTE,
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
  listable: true,
  surfaces: [{ name: 'slow_report', type: 'tool', mode: 'always', recover: false, required: true, ttlMs: 60_000 }],
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
    find: vi.fn<MCPServerTasksInspector['find']>(async taskId => (taskId === 'raw-task-id' ? waiting : undefined)),
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

      expect(inspector.list).toHaveBeenCalledWith(expect.objectContaining({ limit: 10 }));
      expect(listMcpServerTasksResponseSchema.parse(result)).toEqual({
        surfaces: tasksInfo.surfaces,
        tasks: [waiting],
      });
    });

    it('lists 50 tasks by default and passes the next page cursor on', async () => {
      const inspector = fakeInspector();
      inspector.list.mockResolvedValueOnce({ tasks: [waiting], nextCursor: 'page-2' });
      const { mastra } = makeMastra(makeServer(inspector));

      const result = await LIST_MCP_SERVER_TASKS_ROUTE.handler({ ...context(mastra), serverId: 'tasks' });

      expect(inspector.list).toHaveBeenCalledWith(expect.objectContaining({ limit: 50 }));
      expect(result.nextCursor).toBe('page-2');
    });

    it('hands the filters and cursor to the store, with the client as its principal key', async () => {
      const inspector = fakeInspector();
      const { mastra } = makeMastra(makeServer(inspector));
      const query = listMcpServerTasksQuerySchema.parse({
        status: 'failed',
        surface: 'slow_report',
        client: 'principal-hash',
        key: 'key-1',
        cursor: 'page-2',
        limit: '20',
      });

      await LIST_MCP_SERVER_TASKS_ROUTE.handler({ ...context(mastra), serverId: 'tasks', ...query });

      expect(inspector.list).toHaveBeenCalledWith({
        limit: 20,
        cursor: 'page-2',
        status: 'failed',
        surface: 'slow_report',
        principalKey: 'principal-hash',
        taskKey: 'key-1',
      });
    });

    it('rejects an unknown status filter', () => {
      expect(listMcpServerTasksQuerySchema.safeParse({ status: 'running' }).success).toBe(false);
    });

    it('rejects a limit above 200', () => {
      expect(listMcpServerTasksQuerySchema.safeParse({ limit: '201' }).success).toBe(false);
      expect(listMcpServerTasksQuerySchema.parse({ limit: '200' })).toEqual({ limit: 200 });
    });

    it('lists nothing for a resource-scoped caller, without asking the store', async () => {
      const inspector = fakeInspector();
      const server = makeServer(inspector);
      const { mastra } = makeMastra(server);

      const result = await LIST_MCP_SERVER_TASKS_ROUTE.handler({ ...context(mastra, 'user-1'), serverId: 'tasks' });

      expect(result).toEqual({
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
      const parsed = listMcpServerTasksResponseSchema.parse({ surfaces: [], tasks: [leaky] });
      expect(JSON.stringify(parsed)).not.toMatch(/raw-task-id|client:sub:alice|alice-token/);
    });

    it("keeps the task's client label for operators", () => {
      const labelled = { ...waiting, clientLabel: 'studio-app:token:AbCdEfGh' };
      const parsed = listMcpServerTasksResponseSchema.parse({ surfaces: [], tasks: [labelled] });
      expect(parsed.tasks[0]?.clientLabel).toBe('studio-app:token:AbCdEfGh');
    });
  });

  describe('FIND_MCP_SERVER_TASK_ROUTE', () => {
    it('finds a task by its raw MCP task id and returns only the summary', async () => {
      const inspector = fakeInspector();
      const { mastra } = makeMastra(makeServer(inspector));

      const result = await FIND_MCP_SERVER_TASK_ROUTE.handler({
        ...context(mastra),
        serverId: 'tasks',
        taskId: 'raw-task-id',
      });

      expect(inspector.find).toHaveBeenCalledWith('raw-task-id');
      expect(findMcpServerTaskResponseSchema.parse(result)).toEqual({ task: waiting });
      expect(JSON.stringify(result)).not.toContain('raw-task-id');
    });

    it('404s for an unknown id, a scoped caller, and a store that cannot be listed', async () => {
      const inspector = fakeInspector();
      const { mastra } = makeMastra(makeServer(inspector));
      const find = (m: Mastra, taskId: string, resourceId?: string) =>
        status(FIND_MCP_SERVER_TASK_ROUTE.handler({ ...context(m, resourceId), serverId: 'tasks', taskId }));

      expect(await find(mastra, 'nope')).toBe(404);
      expect(await find(mastra, 'raw-task-id', 'user-1')).toBe(404);
      expect(inspector.find).toHaveBeenCalledTimes(1);
      expect(await find(makeMastra(makeServer(undefined)).mastra, 'raw-task-id')).toBe(404);
    });

    it('needs only mcp:read, like the list', () => {
      expect(FIND_MCP_SERVER_TASK_ROUTE.requiresPermission).toBe('mcp:read');
    });

    it('takes the task id in the body, never the URL', () => {
      expect(FIND_MCP_SERVER_TASK_ROUTE.method).toBe('POST');
      expect(FIND_MCP_SERVER_TASK_ROUTE.path).not.toContain(':taskId');
      expect(findMcpServerTaskBodySchema.safeParse({ taskId: '' }).success).toBe(false);
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

    it('needs mcp:write', () => {
      expect(CANCEL_MCP_SERVER_TASK_ROUTE.requiresAuth).toBe(true);
      expect(CANCEL_MCP_SERVER_TASK_ROUTE.requiresPermission).toBe('mcp:write');
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
      expect(ANSWER_MCP_SERVER_TASK_ROUTE.requiresPermission).toBe('mcp:write');
    });
  });
});
