import type { MastraClient } from '@mastra/client-js';
import { ChunkFrom, type ChunkType, type DataChunkType } from '@mastra/core/stream';

export const emptyHistory: Awaited<ReturnType<MastraClient['listThreadMessages']>> = {
  messages: [],
};

export const staleHistory: typeof emptyHistory = {
  ...emptyHistory,
  messages: [
    {
      id: 'earlier-user',
      role: 'user',
      createdAt: new Date('2026-01-01'),
      content: { format: 2, parts: [{ type: 'text', text: 'Earlier prompt' }] },
    },
    {
      id: 'recovery-assistant',
      role: 'assistant',
      createdAt: new Date('2026-01-02'),
      content: { format: 2, parts: [{ type: 'text', text: 'Old partial output' }] },
    },
  ],
};

export const completedHistory: typeof emptyHistory = {
  messages: [
    {
      id: 'recovery-assistant',
      role: 'assistant',
      createdAt: new Date('2026-01-02'),
      content: { format: 2, parts: [{ type: 'text', text: 'Live response survives' }] },
    },
  ],
};

export const approvalHistory = (runId = 'recovery-run', toolCallId = 'approval-tool'): typeof emptyHistory => ({
  messages: [
    {
      id: `pending-${toolCallId}`,
      role: 'assistant',
      createdAt: new Date('2026-01-02'),
      content: {
        format: 2,
        parts: [
          { type: 'tool-invocation', toolInvocation: { state: 'call', toolCallId, toolName: 'weather', args: {} } },
        ],
        metadata: { pendingToolApprovals: { weather: { toolCallId, toolName: 'weather', args: {}, runId } } },
      },
    },
  ],
});
export const approvalMetadataHistory = (
  key: 'pendingToolApprovals' | 'requireApprovalMetadata' | 'suspendedTools',
  resolved: boolean,
): typeof emptyHistory => ({
  messages: [
    {
      id: 'approval-fixture',
      role: 'assistant',
      createdAt: new Date('2026-01-02'),
      content: {
        format: 2,
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: resolved
              ? { state: 'result', toolCallId: 'approval-tool', toolName: 'weather', args: {}, result: 'done' }
              : { state: 'call', toolCallId: 'approval-tool', toolName: 'weather', args: {} },
          },
        ],
        metadata: {
          mode: 'generate',
          [key]: {
            weather: {
              toolCallId: 'approval-tool',
              toolName: 'weather',
              args: {},
              runId: 'recovery-run',
              suspendPayload: {},
            },
          },
        },
      },
    },
  ],
});

export const approvalChunk: ChunkType = {
  type: 'tool-call-approval',
  runId: 'recovery-run',
  from: ChunkFrom.AGENT,
  payload: { toolCallId: 'approval-tool', toolName: 'weather', args: {}, resumeSchema: '{"type":"object"}' },
};

export const savedTasks = [{ id: 'saved-task', content: 'Saved task', status: 'pending', activeForm: 'Saving task' }];
export const taskHistory: typeof emptyHistory = {
  messages: [
    {
      id: 'task-message',
      role: 'signal',
      createdAt: new Date('2026-01-01'),
      content: {
        format: 2,
        parts: [],
        metadata: { signal: { id: 'tasks', metadata: { value: { tasks: savedTasks } } } },
      },
    },
  ],
};
export const taskChunk: DataChunkType = {
  type: 'data-task-list',
  data: { id: 'tasks', metadata: { value: { tasks: [] } } },
};

export const finishChunk: ChunkType = {
  type: 'finish',
  runId: 'recovery-run',
  from: ChunkFrom.AGENT,
  payload: {
    stepResult: { reason: 'stop' },
    output: { usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
    metadata: {},
    messages: { all: [], user: [], nonUser: [] },
  },
};

export const liveChunks: ChunkType[] = [
  { type: 'start', runId: 'recovery-run', from: ChunkFrom.AGENT, payload: { messageId: 'recovery-assistant' } },
  { type: 'text-start', runId: 'recovery-run', from: ChunkFrom.AGENT, payload: { id: 'recovery-text' } },
  {
    type: 'text-delta',
    runId: 'recovery-run',
    from: ChunkFrom.AGENT,
    payload: { id: 'recovery-text', text: 'Live response survives' },
  },
];
