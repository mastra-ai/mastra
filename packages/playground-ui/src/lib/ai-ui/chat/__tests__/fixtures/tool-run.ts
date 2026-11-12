import type { MastraClient, McpServerListResponse } from '@mastra/client-js';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import type { ChunkType } from '@mastra/core/stream';

type ClientAgent = ReturnType<MastraClient['getAgent']>;
export const acceptedToolRun = (runId: string): Awaited<ReturnType<ClientAgent['sendMessage']>> => ({
  accepted: true,
  runId,
});
export const emptyMcpServers: McpServerListResponse = { servers: [], next: null, total_count: 0 };

export const unfinishedToolHistory: MastraDBMessage[] = [
  {
    id: 'first-response',
    role: 'assistant',
    createdAt: new Date('2026-09-10T12:00:00Z'),
    content: {
      format: 2,
      parts: [1, 2, 3].map(index => ({
        type: 'tool-invocation',
        toolInvocation: {
          state: 'call',
          toolName: 'lookup',
          toolCallId: `first-response-${index}`,
          args: { index },
        },
      })),
    },
  },
];

export const toolRunChunks = (runId: string, messageId: string): ChunkType[] => [
  { type: 'start', runId, from: 'AGENT', payload: { messageId } },
  ...[1, 2, 3].map(index => ({
    type: 'tool-call' as const,
    runId,
    from: 'AGENT' as const,
    payload: { toolCallId: `${messageId}-${index}`, toolName: 'lookup', args: { index } },
  })),
];

export const toolRunFinish = (runId: string): ChunkType => ({
  type: 'abort',
  runId,
  from: 'AGENT',
  payload: {},
});
