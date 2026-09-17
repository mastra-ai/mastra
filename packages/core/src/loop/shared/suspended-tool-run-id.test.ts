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
    expect(resolve({ messages, modelSuppliedSuspendedToolRunId: 'inner-run' })).toBeUndefined();
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

  it('accepts a model claim only when it matches an active suspension for the same tool', () => {
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

    expect(resolve({ messages, modelSuppliedSuspendedToolRunId: 'inner-run' })).toBe('inner-run');
    expect(resolve({ messages, modelSuppliedSuspendedToolRunId: 'foreign-run' })).toBeUndefined();
    expect(
      resolve({
        toolName: 'agent-writer',
        messages,
        modelSuppliedSuspendedToolRunId: 'inner-run',
      }),
    ).toBeUndefined();
  });

  it('falls back to an unresumed suspension part', () => {
    expect(
      resolve({
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

  it('rejects ambiguous same-tool suspensions', () => {
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
    expect(resolve({ messages, modelSuppliedSuspendedToolRunId: 'inner-a' })).toBe('inner-a');
  });

  it('rejects a repeated id shared by ambiguous sibling suspensions', () => {
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

    expect(resolve({ messages, modelSuppliedSuspendedToolRunId: 'repeated-run' })).toBeUndefined();
  });
});
