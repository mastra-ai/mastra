import type {
  BackgroundTaskResponse,
  KillSandboxProcessResponse,
  ListMemoryThreadMessagesResponse,
  ListSandboxProcessesResponse,
  SandboxProcess,
  SandboxProcessOutputResponse,
} from '@mastra/client-js';
import { signalToDataPartFormat, signalToMastraDBMessage } from '@mastra/core/agent';
import type { AgentChunkType } from '@mastra/core/stream';
import { ChunkFrom } from '@mastra/core/stream';
import { WORKSPACE_TOOLS } from '@/domains/chat/tools/workspace-tool-constants';

export const BACKGROUND_TASK_ID = 'bg-05a4940e';

/** A deferred `reports_slow_report` call's background task, as `GET /api/background-tasks/:taskId` returns it. */
export const backgroundTask = (status: BackgroundTaskResponse['status']): BackgroundTaskResponse => ({
  id: BACKGROUND_TASK_ID,
  status,
  toolName: 'reports_slow_report',
  toolCallId: 'call-1',
  args: { topic: 'q3' },
  agentId: 'tasks-agent',
  runId: 'run-1',
  createdAt: '2026-10-27T12:00:00.000Z',
  completedAt: status === 'completed' ? '2026-10-27T12:00:42.000Z' : undefined,
  retryCount: 0,
  maxRetries: 0,
  timeoutMs: 60_000,
});

export const THREAD_ID = 'thread-1';
const RESOURCE_ID = 'resource-1';
export const WORKSPACE_ID = 'ws-1';
export const DEV_SERVER_PID = '4242';
const DEV_SERVER_CALL_ID = 'call-dev';

/** The dev server the agent started with `execute_command` and `background: true`, as the sandbox lists it. */
export const devServer = (overrides: Partial<SandboxProcess> = {}): SandboxProcess => ({
  pid: DEV_SERVER_PID,
  command: 'npm run dev',
  running: true,
  metadata: {
    threadId: THREAD_ID,
    resourceId: RESOURCE_ID,
    toolCallId: DEV_SERVER_CALL_ID,
    startedAt: Date.parse('2026-10-27T12:00:00.000Z'),
  },
  ...overrides,
});

export const processList = (...processes: SandboxProcess[]): ListSandboxProcessesResponse => ({ processes });

/** `GET .../sandbox/processes/4242?tail=50` while the server runs: a PTY colours its output. */
export const devServerOutput: SandboxProcessOutputResponse = {
  ...devServer(),
  stdout: '\u001b[32mready\u001b[0m on http://localhost:3000\n',
  stderr: '',
  stdoutTruncated: false,
  stderrTruncated: false,
};

export const devServerKilled: KillSandboxProcessResponse = { pid: DEV_SERVER_PID, killed: true };

type ThreadMessage = ListMemoryThreadMessagesResponse['messages'][number];

interface BackgroundCommandCall {
  messageId: string;
  pid: string;
  command: string;
  toolCallId?: string;
}

/** A turn that started a background command, as memory saves it: the call returned only the PID. */
export const backgroundCommandTurn = ({
  messageId,
  pid,
  command,
  toolCallId = DEV_SERVER_CALL_ID,
}: BackgroundCommandCall): ThreadMessage => ({
  id: messageId,
  role: 'assistant',
  createdAt: new Date('2026-10-27T12:00:00Z'),
  threadId: THREAD_ID,
  resourceId: RESOURCE_ID,
  content: {
    format: 2,
    parts: [
      {
        type: 'data-workspace-metadata',
        data: {
          toolName: WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND,
          toolCallId,
          id: WORKSPACE_ID,
          name: 'Project',
          sandbox: { id: 'local', name: 'Local', provider: 'local', status: 'running' },
        },
      },
      {
        type: 'tool-invocation',
        toolInvocation: {
          toolCallId,
          toolName: WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND,
          args: { command, background: true },
          state: 'result',
          result: `Started background process (PID: ${pid})`,
        },
      },
    ],
  },
});

export const devServerTurn = backgroundCommandTurn({
  messageId: 'assistant-dev',
  pid: DEV_SERVER_PID,
  command: 'npm run dev',
});

interface ProcessExit {
  pid: string;
  exitCode: number;
  command: string;
  toolCallId?: string;
}

/** What core sends the thread when a background process exits, with `backgroundProcesses.notifyAgent` on. */
const exitNoticeSignal = ({ pid, exitCode, command, toolCallId = DEV_SERVER_CALL_ID }: ProcessExit) => ({
  type: 'notification' as const,
  tagName: 'background-process',
  contents: [
    `Background process ${pid} exited with code ${exitCode}: ${command}`,
    'Error: listen EADDRINUSE: address already in use :::3000',
    `Read the full output with ${WORKSPACE_TOOLS.SANDBOX.GET_PROCESS_OUTPUT} (PID ${pid}). Tell the user the outcome if it matters to them.`,
  ].join('\n\n'),
  attributes: { pid, exitCode, toolCallId },
});

/** The exit notice as memory saves it: its own signal message. */
export const devServerExitNotice = (exitCode: number): ThreadMessage =>
  signalToMastraDBMessage(exitNoticeSignal({ pid: DEV_SERVER_PID, exitCode, command: 'npm run dev' }), {
    threadId: THREAD_ID,
    resourceId: RESOURCE_ID,
  });

/** The exit notice as a live chat holds it: a `data-signal` part streamed onto the assistant turn. */
export const liveDevServerExitNotice = (exitCode: number): ThreadMessage => ({
  id: 'assistant-live',
  role: 'assistant',
  createdAt: new Date('2026-10-27T12:05:00Z'),
  threadId: THREAD_ID,
  resourceId: RESOURCE_ID,
  content: {
    format: 2,
    parts: [signalToDataPartFormat(exitNoticeSignal({ pid: DEV_SERVER_PID, exitCode, command: 'npm run dev' }))],
  },
});

/** What core sends the thread when the deferred `reports_slow_report` call's task ends. */
export const reportTaskNotice = (status: 'completed' | 'failed'): ThreadMessage =>
  signalToMastraDBMessage(
    {
      type: 'notification',
      tagName: 'background-task',
      contents: `Background task ${BACKGROUND_TASK_ID} for tool call call-1 (reports_slow_report) has ${status}.`,
      attributes: { taskId: BACKGROUND_TASK_ID, toolCallId: 'call-1', toolName: 'reports_slow_report', status },
    },
    { threadId: THREAD_ID, resourceId: RESOURCE_ID },
  );

/** The turn whose `reports_slow_report` call was deferred: the part holds the placeholder until the task ends. */
export const deferredReportTurn: ThreadMessage = {
  id: 'assistant-report',
  role: 'assistant',
  createdAt: new Date('2026-10-27T12:00:00Z'),
  threadId: THREAD_ID,
  resourceId: RESOURCE_ID,
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
        providerMetadata: { mastra: { backgroundTask: { taskId: BACKGROUND_TASK_ID, status: 'running' } } },
      },
    ],
  },
};

type TaskStreamEvent = Extract<AgentChunkType, { type: 'background-task-running' | 'background-task-output' }>;

const taskIds = {
  taskId: BACKGROUND_TASK_ID,
  toolName: 'reports_slow_report',
  toolCallId: 'call-1',
  runId: 'run-1',
  agentId: 'tasks-agent',
};

/** What `GET /api/background-tasks/stream?threadId=thread-1` sends for the running report task. */
export const reportTaskStream: TaskStreamEvent[] = [
  {
    type: 'background-task-running',
    runId: 'run-1',
    from: ChunkFrom.AGENT,
    payload: { ...taskIds, args: { topic: 'q3' }, startedAt: new Date('2026-10-27T12:00:00.000Z') },
  },
  {
    type: 'background-task-output',
    runId: 'run-1',
    from: ChunkFrom.AGENT,
    payload: {
      ...taskIds,
      payload: {
        type: 'tool-output',
        runId: 'run-1',
        from: ChunkFrom.AGENT,
        payload: { output: { type: 'text-delta', payload: { id: 't1', text: 'Pulled Q3 revenue' } } },
      },
    },
  },
];

/** The same stream once the report task finished: the replay sends its end. */
export const reportTaskCompletedStream: Extract<AgentChunkType, { type: 'background-task-completed' }>[] = [
  {
    type: 'background-task-completed',
    runId: 'run-1',
    from: ChunkFrom.AGENT,
    payload: { ...taskIds, result: 'Q3 report ready', completedAt: new Date('2026-10-27T12:00:42.000Z') },
  },
];

export const eventStream = (events: readonly unknown[]) =>
  events.map(event => `data: ${JSON.stringify(event)}\n\n`).join('');
