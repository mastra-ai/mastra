import { describe, expect, it } from 'vitest';
import type { MastraDBMessage } from '../state/types';
import { AIV5Adapter } from './AIV5Adapter';

describe('AIV5Adapter — suspended tool state rehydration', () => {
  it('should produce data-tool-call-suspended parts from metadata.suspendedTools on reload', () => {
    // This is how a message looks in the DB after a tool call is suspended:
    // - The tool-invocation part shows the tool call itself
    // - metadata.suspendedTools stores the suspension info (added by addToolMetadata)
    // - But NO data-tool-call-suspended part exists in content.parts (it was only streamed)
    const dbMessage: MastraDBMessage = {
      id: 'msg-1',
      role: 'assistant',
      createdAt: new Date('2024-01-01'),
      content: {
        format: 2,
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: {
              toolCallId: 'tc-1',
              toolName: 'process-data',
              args: { data: 'test-data-123' },
              state: 'call',
            },
          },
          {
            type: 'text',
            text: 'The tool is suspended.',
          },
        ],
        metadata: {
          suspendedTools: {
            'process-data': {
              toolCallId: 'tc-1',
              toolName: 'process-data',
              args: { data: 'test-data-123' },
              type: 'suspension',
              runId: 'run-1',
              suspendPayload: { reason: 'Waiting for manual approval' },
              resumeSchema: '{"type":"object","properties":{"approved":{"type":"boolean"}}}',
            },
          },
        },
      },
    };

    const uiMessage = AIV5Adapter.toUIMessage(dbMessage);

    expect(uiMessage.metadata).toMatchObject({
      suspendedTools: dbMessage.content.metadata?.suspendedTools,
    });

    // The UI message should contain the tool-invocation part
    const toolParts = uiMessage.parts.filter(p => p.type.startsWith('tool-'));
    expect(toolParts).toHaveLength(1);
    expect(toolParts[0]).toMatchObject({
      type: 'tool-process-data',
      toolCallId: 'tc-1',
      input: { data: 'test-data-123' },
      state: 'input-available',
    });

    // The UI message should also contain a data-tool-call-suspended part
    // so the client can render the suspended state after page refresh.
    const suspendedParts = uiMessage.parts.filter((p: any) => p.type === 'data-tool-call-suspended');
    expect(suspendedParts).toHaveLength(1);
    expect(uiMessage.parts[1]?.type).toBe('data-tool-call-suspended');
    expect(uiMessage.parts[2]).toMatchObject({ type: 'text', text: 'The tool is suspended.' });
    expect((suspendedParts[0] as any).data).toMatchObject({
      toolCallId: 'tc-1',
      toolName: 'process-data',
      suspendPayload: { reason: 'Waiting for manual approval' },
    });
  });

  it('should produce data-tool-call-approval parts from metadata.pendingToolApprovals on reload', () => {
    const dbMessage: MastraDBMessage = {
      id: 'msg-2',
      role: 'assistant',
      createdAt: new Date('2024-01-01'),
      content: {
        format: 2,
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: {
              toolCallId: 'tc-2',
              toolName: 'delete-file',
              args: { path: '/tmp/test.txt' },
              state: 'call',
            },
          },
          {
            type: 'text',
            text: 'Waiting for approval.',
          },
        ],
        metadata: {
          pendingToolApprovals: {
            'delete-file': {
              toolCallId: 'tc-2',
              toolName: 'delete-file',
              args: { path: '/tmp/test.txt' },
              type: 'approval',
              runId: 'run-2',
              resumeSchema: '{"type":"object","properties":{"approved":{"type":"boolean"}}}',
            },
          },
        },
      },
    };

    const uiMessage = AIV5Adapter.toUIMessage(dbMessage);

    expect(uiMessage.metadata).toMatchObject({
      pendingToolApprovals: dbMessage.content.metadata?.pendingToolApprovals,
    });

    const toolParts = uiMessage.parts.filter(p => p.type.startsWith('tool-'));
    expect(toolParts).toHaveLength(1);
    expect(toolParts[0]).toMatchObject({
      type: 'tool-delete-file',
      toolCallId: 'tc-2',
      input: { path: '/tmp/test.txt' },
      state: 'input-available',
    });

    const approvalParts = uiMessage.parts.filter((p: any) => p.type === 'data-tool-call-approval');
    expect(approvalParts).toHaveLength(1);
    expect(uiMessage.parts[1]?.type).toBe('data-tool-call-approval');
    expect(uiMessage.parts[2]).toMatchObject({ type: 'text', text: 'Waiting for approval.' });
    expect((approvalParts[0] as any).data).toMatchObject({
      toolCallId: 'tc-2',
      toolName: 'delete-file',
      type: 'approval',
    });
  });

  it('should not duplicate data-tool-call-suspended parts when already present in content.parts', () => {
    const dbMessage: MastraDBMessage = {
      id: 'msg-dedup-suspended',
      role: 'assistant',
      createdAt: new Date('2024-01-01'),
      content: {
        format: 2,
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: {
              toolCallId: 'tc-4',
              toolName: 'process-data',
              args: { data: 'test' },
              state: 'call',
            },
          },
          {
            type: 'data-tool-call-suspended',
            data: {
              toolCallId: 'tc-4',
              toolName: 'process-data',
              type: 'suspension',
            },
          } as any,
        ],
        metadata: {
          suspendedTools: {
            'process-data': {
              toolCallId: 'tc-4',
              toolName: 'process-data',
              type: 'suspension',
            },
          },
        },
      },
    };

    const uiMessage = AIV5Adapter.toUIMessage(dbMessage);

    const suspendedParts = uiMessage.parts.filter((p: any) => p.type === 'data-tool-call-suspended');
    expect(suspendedParts).toHaveLength(1);
  });

  it('should not duplicate data-tool-call-approval parts when already present in content.parts', () => {
    const dbMessage: MastraDBMessage = {
      id: 'msg-dedup-approval',
      role: 'assistant',
      createdAt: new Date('2024-01-01'),
      content: {
        format: 2,
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: {
              toolCallId: 'tc-5',
              toolName: 'delete-file',
              args: { path: '/tmp/test.txt' },
              state: 'call',
            },
          },
          {
            type: 'data-tool-call-approval',
            data: {
              toolCallId: 'tc-5',
              toolName: 'delete-file',
              type: 'approval',
            },
          } as any,
        ],
        metadata: {
          pendingToolApprovals: {
            'delete-file': {
              toolCallId: 'tc-5',
              toolName: 'delete-file',
              type: 'approval',
            },
          },
        },
      },
    };

    const uiMessage = AIV5Adapter.toUIMessage(dbMessage);

    const approvalParts = uiMessage.parts.filter((p: any) => p.type === 'data-tool-call-approval');
    expect(approvalParts).toHaveLength(1);
  });

  it('should NOT produce data-tool-call-suspended parts for already-resumed tools', () => {
    // When a tool has been resumed/completed, metadata.suspendedTools is cleared,
    // so no data-tool-call-suspended parts should be synthesized
    const dbMessage: MastraDBMessage = {
      id: 'msg-3',
      role: 'assistant',
      createdAt: new Date('2024-01-01'),
      content: {
        format: 2,
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: {
              toolCallId: 'tc-3',
              toolName: 'process-data',
              args: { data: 'test' },
              state: 'result',
              result: { success: true },
            },
          },
        ] as any,
        // Empty suspendedTools means all have been resumed/cleared
        metadata: {},
      },
    };

    const uiMessage = AIV5Adapter.toUIMessage(dbMessage);

    const suspendedParts = uiMessage.parts.filter((p: any) => p.type === 'data-tool-call-suspended');
    expect(suspendedParts).toHaveLength(0);
  });
});
