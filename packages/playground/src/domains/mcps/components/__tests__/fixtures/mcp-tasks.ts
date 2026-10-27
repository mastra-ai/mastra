import type {
  McpServerInfo,
  McpServerTask,
  McpServerTaskListResponse,
  McpServerTaskSurface,
  McpServerToolListResponse,
} from '@mastra/client-js';

const versionDetail: McpServerInfo['version_detail'] = {
  version: '1.0.0',
  release_date: '2026-07-28T00:00:00Z',
  is_latest: true,
};

/** A server that runs some of its tools as MCP tasks. */
export const tasksServer: McpServerInfo = {
  id: 'reports',
  name: 'Reports',
  version_detail: versionDetail,
  transports: ['streamable-http'],
  tasks_capability: true,
};

export const reportTools: McpServerToolListResponse = {
  tools: [
    { id: 'slow_report', name: 'slow_report', description: 'Builds a slow report', inputSchema: '{}' },
    { id: 'approve_and_send', name: 'approve_and_send', description: 'Asks, then sends', inputSchema: '{}' },
    { id: 'quick_echo', name: 'quick_echo', description: 'Echoes right away', inputSchema: '{}' },
  ],
};

export const surfaces: McpServerTaskSurface[] = [
  { name: 'slow_report', type: 'tool', mode: 'always', recover: true, ttlMs: 60_000 },
  { name: 'approve_and_send', type: 'tool', mode: 'auto', recover: false, ttlMs: null },
];

const createdAt = '2026-10-27T12:00:00.000Z';

const base = (
  taskKey: string,
  surface: string,
): Pick<McpServerTask, 'taskKey' | 'surface' | 'createdAt' | 'lastUpdatedAt' | 'expiresAt' | 'principalKey'> => ({
  taskKey,
  surface,
  createdAt,
  lastUpdatedAt: createdAt,
  expiresAt: '2026-10-27T12:01:00.000Z',
  principalKey: 'cHJpbmNpcGFsLWFsaWNl',
});

export const workingTask: McpServerTask = { ...base('workingKey0001', 'slow_report'), status: 'working' };

export const inputTask: McpServerTask = {
  ...base('inputKey000001', 'approve_and_send'),
  status: 'input_required',
  inputRequests: {
    approve: {
      method: 'elicitation/create',
      params: {
        message: 'Send "hello"?',
        requestedSchema: {
          type: 'object',
          properties: { note: { type: 'string', title: 'Note' } },
        },
      },
    },
  },
};

export const samplingTask: McpServerTask = {
  ...base('samplingKey001', 'approve_and_send'),
  status: 'input_required',
  inputRequests: { draft: { method: 'sampling/createMessage', params: { maxTokens: 10 } } },
};

export const completedTask: McpServerTask = {
  ...base('completedKey01', 'slow_report'),
  status: 'completed',
  result: { content: [{ type: 'text', text: 'Report done' }] },
};

export const failedTask: McpServerTask = {
  ...base('failedKey00001', 'slow_report'),
  status: 'failed',
  statusMessage: 'tool exploded',
  error: { code: -32603, message: 'tool exploded' },
};

export const cancelledTask: McpServerTask = { ...base('cancelledKey01', 'slow_report'), status: 'cancelled' };

export const taskList = (tasks: McpServerTask[]): McpServerTaskListResponse => ({
  required: false,
  surfaces,
  tasks,
});

export const unavailableTaskList = (
  unavailable: NonNullable<McpServerTaskListResponse['unavailable']>,
): McpServerTaskListResponse => ({ required: false, surfaces, unavailable, tasks: [] });
