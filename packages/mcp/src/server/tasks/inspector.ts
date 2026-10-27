import type {
  MCPServerTaskSummary,
  MCPServerTaskSurfaceInfo,
  MCPServerTasksInfo,
  MCPServerTasksInspector,
} from '@mastra/core/mcp';
import type { MCPToolType } from '@mastra/core/tools';
import type { ResolvedTasksConfig } from './config';
import { isMCPTaskStoreAdmin } from './store';
import type { MCPTaskListing, MCPTaskStoreAdmin } from './store';

/** The tools served as tasks, as Studio shows them. */
export function listTaskSurfaces(
  tasks: ResolvedTasksConfig,
  tools: Array<[name: string, toolType: MCPToolType | undefined]>,
): MCPServerTaskSurfaceInfo[] {
  const surfaces: MCPServerTaskSurfaceInfo[] = [];
  for (const [name, toolType] of tools) {
    const { mode, recover, ttlMs } = tasks.modeFor(name, toolType);
    if (mode === 'off') continue;
    surfaces.push({
      name,
      type: toolType === 'workflow' ? 'workflow' : toolType === 'agent' ? 'agent' : 'tool',
      mode,
      recover,
      ttlMs,
    });
  }
  return surfaces;
}

export function tasksInfo(
  tasks: ResolvedTasksConfig,
  tools: Array<[name: string, toolType: MCPToolType | undefined]>,
): MCPServerTasksInfo {
  return {
    enabled: tasks.enabled,
    required: tasks.required.size > 0,
    // The default stores (in-memory, background tasks) can list; a custom store only if it has the admin view.
    listable: !tasks.store || isMCPTaskStoreAdmin(tasks.store),
    surfaces: listTaskSurfaces(tasks, tools),
  };
}

/**
 * Studio's view of the task store. Cancel and answer go through the store's `cancelByKey` and
 * `updateByKey`, the same code as `tasks/cancel` and `tasks/update`.
 */
export function createTasksInspector(admin: () => Promise<MCPTaskStoreAdmin | undefined>): MCPServerTasksInspector {
  const required = async () => {
    const store = await admin();
    if (!store) throw new Error('This MCP task store cannot be listed');
    return store;
  };
  return {
    async list(params = {}) {
      const listings = await (await required()).list({ limit: params.limit });
      return { tasks: listings.map(toSummary) };
    },
    async cancel(taskKey) {
      return (await (await required()).cancelByKey(taskKey)) === 'done';
    },
    async answer(taskKey, inputResponses) {
      return (await (await required()).updateByKey(taskKey, inputResponses)) === 'done';
    },
  };
}

function toSummary(listing: MCPTaskListing): MCPServerTaskSummary {
  const toolName = listing.context?.toolName;
  return {
    taskKey: listing.taskKey,
    surface: typeof toolName === 'string' ? toolName : '',
    status: listing.status,
    ...(listing.statusMessage !== undefined && { statusMessage: listing.statusMessage }),
    createdAt: listing.createdAt,
    lastUpdatedAt: listing.lastUpdatedAt,
    ...(listing.ttlMs !== null && {
      expiresAt: new Date(new Date(listing.createdAt).getTime() + listing.ttlMs).toISOString(),
    }),
    principalKey: listing.principalKey,
    ...(listing.inputRequests && { inputRequests: listing.inputRequests }),
    ...(listing.result && { result: listing.result }),
    ...(listing.error && { error: listing.error }),
  };
}
