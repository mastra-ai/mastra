import type { ListMemoryThreadMessagesResponse, MastraClient } from '@mastra/client-js';
import { ChunkFrom } from '@mastra/core/stream';
import type { ChunkType } from '@mastra/core/stream';

export const emptyApprovalHistory: ListMemoryThreadMessagesResponse = { messages: [] };

type ClientAgent = ReturnType<MastraClient['getAgent']>;
export const generatedApprovalResponse: Awaited<ReturnType<ClientAgent['approveToolCallGenerate']>> = {
  response: { uiMessages: [] },
};

export const approvalHistory = (
  kind: 'nested' | 'ordinary',
  mode: 'stream' | 'generate',
): ListMemoryThreadMessagesResponse => {
  const approvals = Object.fromEntries(
    ['first', 'second'].map(id => [
      id,
      {
        toolCallId: id,
        toolName: 'approvedLookup',
        args: { company: id },
        runId: 'parent-run',
      },
    ]),
  );
  return {
    messages: [
      {
        id: 'pending-response',
        role: 'assistant',
        threadId: 'thread-1',
        resourceId: 'agent-1',
        createdAt: new Date('2026-09-15T12:00:00Z'),
        content: {
          format: 2,
          parts: ['first', 'second'].map(id => ({
            type: 'tool-invocation',
            toolInvocation: {
              state: 'call',
              toolCallId: id,
              toolName: kind === 'nested' ? 'agent-child' : 'approvedLookup',
              args: { company: id },
            },
          })),
          metadata: {
            runId: 'parent-run',
            mode,
            ...(mode === 'stream' ? { pendingToolApprovals: approvals } : { requireApprovalMetadata: approvals }),
          },
        },
      },
    ],
  };
};

export const approvalChunks = (kind: 'nested' | 'ordinary'): ChunkType[] => {
  const chunks: ChunkType[] = [
    { type: 'start', runId: 'parent-run', from: ChunkFrom.AGENT, payload: { messageId: 'pending-response' } },
  ];
  for (const id of ['first', 'second']) {
    chunks.push({
      type: 'tool-call',
      runId: 'parent-run',
      from: ChunkFrom.AGENT,
      payload: {
        toolCallId: id,
        toolName: kind === 'nested' ? 'agent-child' : 'approvedLookup',
        args: {},
      },
    });
    if (kind === 'nested') {
      chunks.push({
        type: 'tool-output',
        runId: 'parent-run',
        from: ChunkFrom.AGENT,
        payload: {
          toolCallId: id,
          output: {
            type: 'tool-call',
            runId: `child-${id}`,
            from: ChunkFrom.AGENT,
            payload: {
              toolCallId: `inner-${id}`,
              toolName: 'approvedLookup',
              args: { company: id },
            },
          },
        },
      });
    }
    chunks.push({
      type: 'tool-call-approval',
      runId: 'parent-run',
      from: ChunkFrom.AGENT,
      payload: {
        toolCallId: id,
        toolName: 'approvedLookup',
        args: { company: id },
        resumeSchema: '{}',
      },
    });
  }
  return chunks;
};
