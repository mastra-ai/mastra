import { describe, expect, it } from 'vitest';
import type { MastraDBMessage } from '../../agent/message-list';
import { resolveFrameworkSuspendedToolRunId } from './suspended-tool-run-id';

function assistantMessage({
  suspendedTools,
  pendingToolApprovals,
  parts = [],
}: {
  suspendedTools?: Record<string, unknown>;
  pendingToolApprovals?: Record<string, unknown>;
  parts?: Array<{ type: string; data: Record<string, unknown> }>;
}): MastraDBMessage {
  return {
    id: 'assistant-message',
    role: 'assistant',
    createdAt: new Date(0),
    content: {
      format: 2,
      metadata: { suspendedTools, pendingToolApprovals },
      parts,
    },
  } as unknown as MastraDBMessage;
}

const resolve = (overrides: Partial<Parameters<typeof resolveFrameworkSuspendedToolRunId>[0]> = {}) =>
  resolveFrameworkSuspendedToolRunId({
    toolCallId: 'call-1',
    toolName: 'agent-researcher',
    resumeSource: 'model',
    messages: [],
    ...overrides,
  });

describe('resolveFrameworkSuspendedToolRunId', () => {
  it('prefers the framework suspend payload and preserves custom id formats', () => {
    expect(
      resolve({
        resumeSource: 'framework',
        suspendData: { suspendedToolRunId: ' custom/run:id ' },
        modelSuppliedSuspendedToolRunId: 'foreign-run',
      }),
    ).toBe(' custom/run:id ');
  });

  it.each(['null', ' undefined ', 'NONE', '', 42, null])('rejects an unverified model claim %j', claim => {
    expect(resolve({ modelSuppliedSuspendedToolRunId: claim })).toBeUndefined();
  });

  it('resolves an exact persisted tool call for a framework-driven resume', () => {
    expect(
      resolve({
        resumeSource: 'framework',
        messages: [
          assistantMessage({
            suspendedTools: {
              'call-1': {
                toolCallId: 'call-1',
                toolName: 'agent-researcher',
                runId: 'outer-run',
                delegatedRunId: 'inner-run',
                type: 'suspension',
              },
            },
          }),
        ],
      }),
    ).toBe('inner-run');
  });

  it('uses a delegated approval id only for a framework-driven resume', () => {
    const messages = [
      assistantMessage({
        pendingToolApprovals: {
          'call-1': {
            toolCallId: 'call-1',
            toolName: 'charge-card',
            parentToolName: 'agent-researcher',
            runId: 'outer-run',
            delegatedRunId: 'inner-run',
            type: 'approval',
          },
        },
      }),
    ];

    expect(resolve({ resumeSource: 'framework', messages })).toBe('inner-run');
    expect(
      resolve({
        messages,
        modelSuppliedSuspendedToolCallId: 'call-1',
        modelSuppliedSuspendedToolRunId: 'inner-run',
      }),
    ).toBeUndefined();
  });

  it('does not treat an outer approval run as delegated identity', () => {
    expect(
      resolve({
        resumeSource: 'framework',
        messages: [
          assistantMessage({
            pendingToolApprovals: {
              'call-1': {
                toolCallId: 'call-1',
                toolName: 'agent-researcher',
                runId: 'outer-run',
                type: 'approval',
              },
            },
          }),
        ],
      }),
    ).toBeUndefined();
  });

  it('derives the run id from the exact suspended tool call selected by the model', () => {
    const messages = [
      assistantMessage({
        suspendedTools: {
          'old-call': {
            toolCallId: 'old-call',
            toolName: 'agent-researcher',
            runId: 'outer-run',
            delegatedRunId: 'inner-run',
            type: 'suspension',
          },
        },
      }),
    ];

    expect(resolve({ messages, modelSuppliedSuspendedToolCallId: 'old-call' })).toBe('inner-run');
    expect(
      resolve({
        messages,
        modelSuppliedSuspendedToolCallId: 'old-call',
        modelSuppliedSuspendedToolRunId: 'foreign-run',
      }),
    ).toBeUndefined();
    expect(
      resolve({
        toolName: 'agent-writer',
        messages,
        modelSuppliedSuspendedToolCallId: 'old-call',
      }),
    ).toBeUndefined();
  });

  it('falls back to an unresumed suspension part', () => {
    expect(
      resolve({
        modelSuppliedSuspendedToolCallId: 'old-call',
        modelSuppliedSuspendedToolRunId: 'part-run',
        messages: [
          assistantMessage({
            parts: [
              {
                type: 'data-tool-call-suspended',
                data: {
                  toolCallId: 'old-call',
                  toolName: 'agent-researcher',
                  runId: 'part-run',
                },
              },
              {
                type: 'data-tool-call-suspended',
                data: {
                  toolCallId: 'resumed-call',
                  toolName: 'agent-researcher',
                  runId: 'resumed-run',
                  resumed: true,
                },
              },
            ],
          }),
        ],
      }),
    ).toBe('part-run');
  });

  it('uses a unique same-tool suspension when a legacy resume omitted the id', () => {
    expect(
      resolve({
        resumeSource: 'framework',
        messages: [
          assistantMessage({
            suspendedTools: {
              'legacy-call': {
                toolName: 'agent-researcher',
                runId: 'legacy-inner-run',
              },
            },
          }),
        ],
      }),
    ).toBe('legacy-inner-run');
  });

  it('rejects a sibling run id that does not belong to the claimed suspended call', () => {
    const messages = [
      assistantMessage({
        suspendedTools: {
          'call-a': {
            toolCallId: 'call-a',
            toolName: 'agent-researcher',
            runId: 'outer-run',
            delegatedRunId: 'inner-a',
          },
          'call-b': {
            toolCallId: 'call-b',
            toolName: 'agent-researcher',
            runId: 'outer-run',
            delegatedRunId: 'inner-b',
          },
        },
      }),
    ];

    expect(resolve({ messages })).toBeUndefined();
    expect(
      resolve({
        messages,
        modelSuppliedSuspendedToolCallId: 'call-b',
        modelSuppliedSuspendedToolRunId: 'inner-a',
      }),
    ).toBeUndefined();
    expect(
      resolve({
        messages,
        modelSuppliedSuspendedToolCallId: 'call-b',
        modelSuppliedSuspendedToolRunId: 'inner-b',
      }),
    ).toBe('inner-b');
  });

  it('uses the claimed tool call to disambiguate repeated run ids', () => {
    const messages = [
      assistantMessage({
        suspendedTools: {
          'call-a': {
            toolCallId: 'call-a',
            toolName: 'agent-researcher',
            delegatedRunId: 'repeated-run',
          },
          'call-b': {
            toolCallId: 'call-b',
            toolName: 'agent-researcher',
            delegatedRunId: 'repeated-run',
          },
        },
      }),
    ];

    expect(resolve({ messages, modelSuppliedSuspendedToolCallId: 'call-b' })).toBe('repeated-run');
    expect(resolve({ messages, modelSuppliedSuspendedToolCallId: 'unknown-call' })).toBeUndefined();
  });
});
