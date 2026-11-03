import type { BackgroundTaskResponse, ListMemoryThreadMessagesResponse } from '@mastra/client-js';
import type { AgentChunkType } from '@mastra/core/stream';
import { ChunkFrom } from '@mastra/core/stream';
import { BACKGROUND_TASK_ID, backgroundTask } from './background-task';
import type { McpInputRequestPayload } from '@/domains/chat/tools/mcp-input-request';

export const SUSPENDED_AT = '2026-10-27T12:00:05.000Z';
export const MCP_TASK_ID = 'mcp-task-KA3IW6mL';

/** What `@mastra/mcp` suspends `reports_slow_report` with when its server asks to confirm the report. */
export const confirmRequest: McpInputRequestPayload = {
  type: 'mcp-input-request',
  serverName: 'reports',
  toolName: 'slow_report',
  taskId: MCP_TASK_ID,
  createdAt: '2026-10-27T12:00:00.000Z',
  requests: {
    confirm: {
      method: 'elicitation/create',
      params: {
        message: 'Include the draft figures in the Q3 report?',
        requestedSchema: {
          type: 'object',
          properties: { note: { type: 'string', description: 'Note for the report' } },
        },
      },
    },
  },
};

/** The same server asking the user to finish sign-in in the browser instead. */
export const signInRequest: McpInputRequestPayload = {
  ...confirmRequest,
  requests: {
    signin: {
      method: 'elicitation/create',
      params: {
        mode: 'url',
        message: 'Sign in to the reports service to continue.',
        url: 'https://reports.example.com/oauth/start',
        elicitationId: 'el-1',
      },
    },
  },
};

/** The deferred call's background task while it waits on `request`. */
export const suspendedBackgroundTask = (request: McpInputRequestPayload = confirmRequest): BackgroundTaskResponse => ({
  ...backgroundTask('suspended'),
  suspendPayload: request,
  // JSON carries the date as a string; the generated type says `Date`.
  suspendedAt: SUSPENDED_AT,
});

type StreamEvent = Extract<AgentChunkType, { type: 'background-task-suspended' | 'background-task-resumed' }>;

const eventBase = {
  taskId: BACKGROUND_TASK_ID,
  toolName: 'reports_slow_report',
  toolCallId: 'call-1',
  runId: 'run-1',
  agentId: 'tasks-agent',
  args: { topic: 'q3' },
};

export const suspendedEvent = (request: McpInputRequestPayload = confirmRequest): StreamEvent => ({
  type: 'background-task-suspended',
  runId: 'run-1',
  from: ChunkFrom.AGENT,
  payload: { ...eventBase, suspendPayload: request, suspendedAt: new Date(SUSPENDED_AT) },
});

export const resumedEvent: StreamEvent = {
  type: 'background-task-resumed',
  runId: 'run-1',
  from: ChunkFrom.AGENT,
  payload: { ...eventBase, startedAt: new Date('2026-10-27T12:00:09.000Z') },
};

/** The suspension entry the server keeps on the tool call's message while a call waits on `request`. */
const suspensionEntry = (request: McpInputRequestPayload, extra: Record<string, unknown> = {}) => ({
  toolCallId: 'call-1',
  toolName: 'reports_slow_report',
  args: { topic: 'q3' },
  type: 'suspension',
  suspendPayload: request,
  runId: 'run-1',
  ...extra,
});

type ThreadMessage = ListMemoryThreadMessagesResponse['messages'][number];

const userMessage: ThreadMessage = {
  id: 'user-1',
  role: 'user',
  createdAt: new Date('2026-10-27T11:59:59Z'),
  threadId: 'thread-1',
  resourceId: 'resource-1',
  content: { format: 2, parts: [{ type: 'text', text: 'Make the Q3 report' }] },
};

const assistantMessage: Omit<ThreadMessage, 'content'> = {
  id: 'assistant-1',
  role: 'assistant',
  createdAt: new Date('2026-10-27T12:00:00Z'),
  threadId: 'thread-1',
  resourceId: 'resource-1',
};

/**
 * A thread as saved after a deferred `reports_slow_report` call's background task suspended: the
 * part holds the placeholder, and the message keeps the task's suspension.
 */
export const deferredSuspendedThread: ListMemoryThreadMessagesResponse = {
  messages: [
    userMessage,
    {
      ...assistantMessage,
      content: {
        format: 2,
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: {
              toolCallId: 'call-1',
              toolName: 'reports_slow_report',
              args: { topic: 'q3' },
              state: 'result',
              result: `Background task started with id ${BACKGROUND_TASK_ID}`,
            },
          },
        ],
        metadata: {
          mode: 'stream',
          suspendedTools: {
            'call-1': suspensionEntry(confirmRequest, { taskId: BACKGROUND_TASK_ID, suspendedAt: SUSPENDED_AT }),
          },
        },
      },
    },
  ],
};

/** The same call run in the foreground: the run itself is parked on the question. */
export const foregroundSuspendedThread: ListMemoryThreadMessagesResponse = {
  messages: [
    userMessage,
    {
      ...assistantMessage,
      content: {
        format: 2,
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: {
              toolCallId: 'call-1',
              toolName: 'reports_slow_report',
              args: { topic: 'q3' },
              state: 'call',
            },
          },
        ],
        metadata: { mode: 'stream', suspendedTools: { 'call-1': suspensionEntry(confirmRequest) } },
      },
    },
  ],
};

/** A foreground call's metadata while it waits on `request`. */
export const foregroundSuspendedMetadata = (request: McpInputRequestPayload = confirmRequest) => ({
  mode: 'stream' as const,
  suspendedTools: { 'call-1': suspensionEntry(request) },
});
