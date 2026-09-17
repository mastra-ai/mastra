import type { AgentSideConnection } from '@agentclientprotocol/sdk';
import type { AgentControllerEvent, Session } from '@mastra/core/agent-controller';
import { createSignal } from '@mastra/core/signals';

import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { PromptState } from './event-mapper.js';
import { handleAgentControllerEvent } from './event-mapper.js';

describe('ACP Event Mapper', () => {
  let mockConnection: AgentSideConnection;
  let mockSession: Session;
  let sessionUpdateSpy: ReturnType<typeof vi.fn>;
  let requestPermissionSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sessionUpdateSpy = vi.fn().mockResolvedValue(undefined);
    requestPermissionSpy = vi.fn().mockResolvedValue({
      outcome: { outcome: 'selected', optionId: 'approve' },
    });

    mockConnection = {
      sessionUpdate: sessionUpdateSpy,
      requestPermission: requestPermissionSpy,
    } as unknown as AgentSideConnection;

    mockSession = {
      abort: vi.fn(),
      respondToToolApproval: vi.fn(),
      respondToToolSuspension: vi.fn(),
    } as unknown as Session;
  });

  function createPromptState(sessionId: string): PromptState {
    return {
      sessionId,
      lastTextLength: 0,
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      },
      resolve: vi.fn(),
    };
  }

  describe('standalone signal messages', () => {
    it('does not present user input or internal signals as assistant output', () => {
      const state = createPromptState('session-1');
      const messages = [
        createSignal({ type: 'user', tagName: 'user', contents: 'ACP_ECHO_PROBE_123' }).toDBMessage(),
        createSignal({
          id: 'reminder-1',
          type: 'system-reminder',
          tagName: 'system-reminder',
          contents: 'Follow the package instructions.',
          createdAt: new Date('2026-07-15T10:00:00.000Z'),
          attributes: { type: 'dynamic-agents-md', path: '/repo/AGENTS.md' },
        }).toDBMessage(),
        createSignal({
          id: 'summary-1',
          type: 'notification',
          tagName: 'notification-summary',
          contents: [{ type: 'text', text: 'github: 2 pending notifications' }],
          createdAt: new Date('2026-07-15T10:00:01.000Z'),
          attributes: { pending: 2 },
        }).toDBMessage(),
      ];

      for (const message of messages) {
        handleAgentControllerEvent({ type: 'message_start', message }, state, mockConnection, mockSession);
        handleAgentControllerEvent({ type: 'message_end', id: message.id }, state, mockConnection, mockSession);
      }

      expect(sessionUpdateSpy).not.toHaveBeenCalled();
    });

    it('forwards compact assistant deltas across interleaved signals', () => {
      const state = createPromptState('session-1');
      const assistant = {
        id: 'assistant-1',
        role: 'assistant' as const,
        content: { format: 2 as const, parts: [] },
        createdAt: new Date(),
      };
      const signal = createSignal({
        id: 'reminder-1',
        type: 'system-reminder',
        tagName: 'system-reminder',
        contents: 'Remember this.',
        createdAt: new Date(),
      }).toDBMessage();
      handleAgentControllerEvent({ type: 'message_start', message: assistant }, state, mockConnection, mockSession);
      handleAgentControllerEvent(
        { type: 'message_update', id: assistant.id, event: { type: 'text-delta', delta: 'Before signal' } },
        state,
        mockConnection,
        mockSession,
      );
      handleAgentControllerEvent({ type: 'message_start', message: signal }, state, mockConnection, mockSession);
      handleAgentControllerEvent({ type: 'message_end', id: signal.id }, state, mockConnection, mockSession);
      handleAgentControllerEvent(
        { type: 'message_update', id: assistant.id, event: { type: 'text-delta', delta: ' after' } },
        state,
        mockConnection,
        mockSession,
      );
      handleAgentControllerEvent({ type: 'message_end', id: assistant.id }, state, mockConnection, mockSession);
      expect(sessionUpdateSpy.mock.calls.map(([notification]) => notification.update.content.text)).toEqual([
        'Before signal',
        ' after',
      ]);
      expect(state.lastTextLength).toBe(0);
    });
  });

  describe('message_update - compact text deltas', () => {
    it('emits only matching assistant text deltas', () => {
      const state = createPromptState('session-1');
      const assistant = {
        id: 'msg-1',
        role: 'assistant' as const,
        content: { format: 2 as const, parts: [] },
        createdAt: new Date(),
      };
      handleAgentControllerEvent({ type: 'message_start', message: assistant }, state, mockConnection, mockSession);
      handleAgentControllerEvent(
        { type: 'message_update', id: assistant.id, event: { type: 'text-delta', delta: 'Hello' } },
        state,
        mockConnection,
        mockSession,
      );
      handleAgentControllerEvent(
        { type: 'message_update', id: 'other', event: { type: 'text-delta', delta: 'ignored' } },
        state,
        mockConnection,
        mockSession,
      );
      expect(sessionUpdateSpy).toHaveBeenCalledWith({
        sessionId: 'session-1',
        update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'Hello' } },
      });
      expect(sessionUpdateSpy).toHaveBeenCalledTimes(1);
      expect(state.lastTextLength).toBe(5);
    });

    it('does not emit ACP text chunks for reasoning or part updates', () => {
      const state = createPromptState('session-1');
      const assistant = {
        id: 'msg-1',
        role: 'assistant' as const,
        content: { format: 2 as const, parts: [] },
        createdAt: new Date(),
      };
      handleAgentControllerEvent({ type: 'message_start', message: assistant }, state, mockConnection, mockSession);
      handleAgentControllerEvent(
        { type: 'message_update', id: assistant.id, event: { type: 'reasoning-delta', index: 0, delta: 'Thinking' } },
        state,
        mockConnection,
        mockSession,
      );
      handleAgentControllerEvent(
        {
          type: 'message_update',
          id: assistant.id,
          event: { type: 'part', index: 0, part: { type: 'reasoning', reasoning: 'Thinking', details: [] } },
        },
        state,
        mockConnection,
        mockSession,
      );

      expect(sessionUpdateSpy).not.toHaveBeenCalled();
      expect(state.lastTextLength).toBe(0);
    });
  });

  describe('tool_start - tool_call emission', () => {
    it('emits tool_call with correct kind mapping', () => {
      const state = createPromptState('session-1');

      const event: Extract<AgentControllerEvent, { type: 'tool_start' }> = {
        type: 'tool_start',
        toolCallId: 'tool-123',
        toolName: 'edit_file',
        args: { path: '/test.js', content: 'code' },
      };

      handleAgentControllerEvent(event, state, mockConnection, mockSession);

      expect(sessionUpdateSpy).toHaveBeenCalledWith({
        sessionId: 'session-1',
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: 'tool-123',
          title: 'edit_file',
          kind: 'edit',
          status: 'in_progress',
          rawInput: JSON.stringify({ path: '/test.js', content: 'code' }),
        },
      });
    });

    it('maps tool names to correct kinds', () => {
      const state = createPromptState('session-1');
      const testCases = [
        { name: 'view_file', expectedKind: 'read' },
        { name: 'search_code', expectedKind: 'search' },
        { name: 'execute_command', expectedKind: 'execute' },
        { name: 'fetch_url', expectedKind: 'fetch' },
        { name: 'custom_tool', expectedKind: 'other' },
      ];

      testCases.forEach(({ name, expectedKind }) => {
        sessionUpdateSpy.mockClear();
        const event: Extract<AgentControllerEvent, { type: 'tool_start' }> = {
          type: 'tool_start',
          toolCallId: `tool-${name}`,
          toolName: name,
          args: {},
        };

        handleAgentControllerEvent(event, state, mockConnection, mockSession);

        expect(sessionUpdateSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            update: expect.objectContaining({
              kind: expectedKind,
            }),
          }),
        );
      });
    });
  });

  describe('tool_end - tool_call_update emission', () => {
    it('emits tool_call_update with completed status', () => {
      const state = createPromptState('session-1');

      const event: Extract<AgentControllerEvent, { type: 'tool_end' }> = {
        type: 'tool_end',
        toolCallId: 'tool-123',
        result: 'File written successfully',
        isError: false,
      };

      handleAgentControllerEvent(event, state, mockConnection, mockSession);

      expect(sessionUpdateSpy).toHaveBeenCalledWith({
        sessionId: 'session-1',
        update: {
          sessionUpdate: 'tool_call_update',
          toolCallId: 'tool-123',
          status: 'completed',
          rawOutput: 'File written successfully',
        },
      });
    });

    it('emits tool_call_update with failed status on error', () => {
      const state = createPromptState('session-1');

      const event: Extract<AgentControllerEvent, { type: 'tool_end' }> = {
        type: 'tool_end',
        toolCallId: 'tool-123',
        result: { error: 'Permission denied' },
        isError: true,
      };

      handleAgentControllerEvent(event, state, mockConnection, mockSession);

      expect(sessionUpdateSpy).toHaveBeenCalledWith({
        sessionId: 'session-1',
        update: {
          sessionUpdate: 'tool_call_update',
          toolCallId: 'tool-123',
          status: 'failed',
          rawOutput: JSON.stringify({ error: 'Permission denied' }),
        },
      });
    });
  });

  describe('tool_approval_required - permission request', () => {
    it('requests permission and responds with approve on allow_once', async () => {
      const state = createPromptState('session-1');

      const event: Extract<AgentControllerEvent, { type: 'tool_approval_required' }> = {
        type: 'tool_approval_required',
        toolCallId: 'tool-123',
        toolName: 'delete_file',
        args: { path: '/important.js' },
      };

      handleAgentControllerEvent(event, state, mockConnection, mockSession);

      // Wait for async permission handling
      await vi.waitFor(() => {
        expect(requestPermissionSpy).toHaveBeenCalledWith({
          sessionId: 'session-1',
          toolCall: {
            toolCallId: 'tool-123',
            title: 'delete_file',
            rawInput: JSON.stringify({ path: '/important.js' }),
          },
          options: [
            { optionId: 'approve', name: 'Allow', kind: 'allow_once' },
            { optionId: 'reject', name: 'Reject', kind: 'reject_once' },
          ],
        });
      });

      expect(mockSession.respondToToolApproval).toHaveBeenCalledWith({
        decision: 'approve',
        toolCallId: 'tool-123',
      });
    });

    it('responds with decline on reject_once', async () => {
      requestPermissionSpy.mockResolvedValueOnce({
        outcome: { outcome: 'selected', optionId: 'reject' },
      });

      const state = createPromptState('session-1');

      const event: Extract<AgentControllerEvent, { type: 'tool_approval_required' }> = {
        type: 'tool_approval_required',
        toolCallId: 'tool-123',
        toolName: 'delete_file',
        args: {},
      };

      handleAgentControllerEvent(event, state, mockConnection, mockSession);

      await vi.waitFor(() => {
        expect(requestPermissionSpy).toHaveBeenCalled();
      });

      expect(mockSession.respondToToolApproval).toHaveBeenCalledWith({
        decision: 'decline',
        toolCallId: 'tool-123',
      });
    });

    it('auto-approves when --dangerous-auto-approve is set', async () => {
      const { setAutoApprove } = await import('./event-mapper.js');
      setAutoApprove(true);

      try {
        const state = createPromptState('session-1');

        const event: Extract<AgentControllerEvent, { type: 'tool_approval_required' }> = {
          type: 'tool_approval_required',
          toolCallId: 'tool-123',
          toolName: 'delete_file',
          args: {},
        };

        handleAgentControllerEvent(event, state, mockConnection, mockSession);

        // Should not request permission
        expect(requestPermissionSpy).not.toHaveBeenCalled();
        expect(mockSession.respondToToolApproval).toHaveBeenCalledWith({
          decision: 'approve',
          toolCallId: 'tool-123',
        });
      } finally {
        setAutoApprove(false);
      }
    });
  });

  describe('tool_suspended - auto-resolve and plan approval', () => {
    it('requests permission before granting sandbox access', async () => {
      const state = createPromptState('session-1');

      const event: Extract<AgentControllerEvent, { type: 'tool_suspended' }> = {
        type: 'tool_suspended',
        toolCallId: 'tool-123',
        toolName: 'request_access',
        args: {},
        suspendPayload: {},
      };

      handleAgentControllerEvent(event, state, mockConnection, mockSession);

      expect(mockSession.respondToToolSuspension).not.toHaveBeenCalled();
      await vi.waitFor(() =>
        expect(mockSession.respondToToolSuspension).toHaveBeenCalledWith({
          toolCallId: 'tool-123',
          resumeData: 'Yes',
        }),
      );
      expect(requestPermissionSpy).toHaveBeenCalledTimes(1);
    });

    it('requests permission for sandbox access identified by payload kind', async () => {
      const state = createPromptState('session-1');

      const event: Extract<AgentControllerEvent, { type: 'tool_suspended' }> = {
        type: 'tool_suspended',
        toolCallId: 'tool-123',
        toolName: 'some_tool',
        args: {},
        suspendPayload: { kind: 'sandbox_access_request' },
      };

      handleAgentControllerEvent(event, state, mockConnection, mockSession);

      expect(mockSession.respondToToolSuspension).not.toHaveBeenCalled();
      await vi.waitFor(() =>
        expect(mockSession.respondToToolSuspension).toHaveBeenCalledWith({
          toolCallId: 'tool-123',
          resumeData: 'Yes',
        }),
      );
      expect(requestPermissionSpy).toHaveBeenCalledTimes(1);
    });

    it('requests permission for submit_plan and approves', async () => {
      const state = createPromptState('session-1');

      const event: Extract<AgentControllerEvent, { type: 'tool_suspended' }> = {
        type: 'tool_suspended',
        toolCallId: 'tool-123',
        toolName: 'submit_plan',
        args: { path: '.mastracode/plans/my-plan.md' },
        suspendPayload: {},
      };

      handleAgentControllerEvent(event, state, mockConnection, mockSession);

      await vi.waitFor(() => {
        expect(requestPermissionSpy).toHaveBeenCalledWith({
          sessionId: 'session-1',
          toolCall: {
            toolCallId: 'tool-123',
            title: 'submit_plan',
            rawInput: JSON.stringify({ path: '.mastracode/plans/my-plan.md' }),
          },
          options: [
            { optionId: 'approve', name: 'Approve Plan', kind: 'allow_once' },
            { optionId: 'reject', name: 'Reject Plan', kind: 'reject_once' },
          ],
        });
      });

      expect(mockSession.respondToToolSuspension).toHaveBeenCalledWith({
        toolCallId: 'tool-123',
        resumeData: { action: 'approved' },
      });
    });

    it('fails unsupported interactive tools without inventing a user answer', async () => {
      const state = createPromptState('session-1');

      const event: Extract<AgentControllerEvent, { type: 'tool_suspended' }> = {
        type: 'tool_suspended',
        toolCallId: 'tool-123',
        toolName: 'ask_user',
        args: { question: 'What do you want?' },
        suspendPayload: {},
      };

      handleAgentControllerEvent(event, state, mockConnection, mockSession);

      await vi.waitFor(() => expect(state.resolve).toHaveBeenCalledWith('error'));
      expect(mockSession.respondToToolSuspension).not.toHaveBeenCalled();
      expect(mockSession.abort).toHaveBeenCalledTimes(1);
    });
  });

  it('does not retry an approved suspension as a rejection when resume fails', async () => {
    const state = createPromptState('session-1');
    vi.mocked(mockSession.respondToToolSuspension).mockRejectedValueOnce(new Error('Resume failed'));
    handleAgentControllerEvent(
      { type: 'tool_suspended', toolCallId: 'tool-123', toolName: 'submit_plan', args: {}, suspendPayload: {} },
      state,
      mockConnection,
      mockSession,
    );
    await vi.waitFor(() => expect(state.resolve).toHaveBeenCalledWith('error'));
    expect(mockSession.respondToToolSuspension).toHaveBeenCalledTimes(1);
    expect(state.error?.message).toBe('Resume failed');
  });

  describe('permission lifecycle', () => {
    it('keeps a suspended turn open until the resumed run completes', () => {
      const state = createPromptState('session-1');
      handleAgentControllerEvent({ type: 'agent_end', reason: 'suspended' }, state, mockConnection, mockSession);
      expect(state.resolve).not.toHaveBeenCalled();
      handleAgentControllerEvent({ type: 'agent_end', reason: 'complete' }, state, mockConnection, mockSession);
      expect(state.resolve).toHaveBeenCalledWith('complete');
    });

    it('ignores a permission reply after the turn was cancelled', async () => {
      const state = createPromptState('session-1');
      const permission = Promise.withResolvers<{ outcome: { outcome: 'selected'; optionId: string } }>();
      requestPermissionSpy.mockReturnValueOnce(permission.promise);
      handleAgentControllerEvent(
        { type: 'tool_approval_required', toolCallId: 'tool-123', toolName: 'write_file', args: {} },
        state,
        mockConnection,
        mockSession,
      );
      handleAgentControllerEvent({ type: 'agent_end', reason: 'aborted' }, state, mockConnection, mockSession);
      permission.resolve({ outcome: { outcome: 'selected', optionId: 'approve' } });
      await permission.promise;
      await Promise.resolve();
      expect(mockSession.respondToToolApproval).not.toHaveBeenCalled();
    });

    it.each(['reject', 'unknown'])('denies sandbox access on %s', async optionId => {
      const state = createPromptState('session-1');
      requestPermissionSpy.mockResolvedValueOnce({ outcome: { outcome: 'selected', optionId } });
      handleAgentControllerEvent(
        { type: 'tool_suspended', toolCallId: 'tool-123', toolName: 'request_access', args: {}, suspendPayload: {} },
        state,
        mockConnection,
        mockSession,
      );
      await vi.waitFor(() =>
        expect(mockSession.respondToToolSuspension).toHaveBeenCalledWith({ toolCallId: 'tool-123', resumeData: 'No' }),
      );
    });

    it('denies sandbox access when the permission request fails', async () => {
      const state = createPromptState('session-1');
      requestPermissionSpy.mockRejectedValueOnce(new Error('Client disconnected'));
      handleAgentControllerEvent(
        { type: 'tool_suspended', toolCallId: 'tool-123', toolName: 'request_access', args: {}, suspendPayload: {} },
        state,
        mockConnection,
        mockSession,
      );
      await vi.waitFor(() =>
        expect(mockSession.respondToToolSuspension).toHaveBeenCalledWith({ toolCallId: 'tool-123', resumeData: 'No' }),
      );
    });
  });

  describe('usage_update - token accumulation', () => {
    it('accumulates token usage', () => {
      const state = createPromptState('session-1');

      const event1: Extract<AgentControllerEvent, { type: 'usage_update' }> = {
        type: 'usage_update',
        usage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
          reasoningTokens: 10,
        },
      };

      handleAgentControllerEvent(event1, state, mockConnection, mockSession);

      expect(state.usage).toEqual({
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        reasoningTokens: 10,
      });

      const event2: Extract<AgentControllerEvent, { type: 'usage_update' }> = {
        type: 'usage_update',
        usage: {
          promptTokens: 50,
          completionTokens: 25,
          totalTokens: 75,
        },
      };

      handleAgentControllerEvent(event2, state, mockConnection, mockSession);

      expect(state.usage).toEqual({
        promptTokens: 150,
        completionTokens: 75,
        totalTokens: 225,
        reasoningTokens: 10,
      });
    });
  });

  describe('agent_end - stopReason mapping', () => {
    it('resolves with complete reason', () => {
      const state = createPromptState('session-1');

      const event: Extract<AgentControllerEvent, { type: 'agent_end' }> = {
        type: 'agent_end',
        reason: 'complete',
      };

      handleAgentControllerEvent(event, state, mockConnection, mockSession);

      expect(state.resolve).toHaveBeenCalledWith('complete');
    });

    it('resolves with aborted reason', () => {
      const state = createPromptState('session-1');

      const event: Extract<AgentControllerEvent, { type: 'agent_end' }> = {
        type: 'agent_end',
        reason: 'aborted',
      };

      handleAgentControllerEvent(event, state, mockConnection, mockSession);

      expect(state.resolve).toHaveBeenCalledWith('aborted');
    });

    it('resolves with error reason', () => {
      const state = createPromptState('session-1');

      const event: Extract<AgentControllerEvent, { type: 'agent_end' }> = {
        type: 'agent_end',
        reason: 'error',
      };

      handleAgentControllerEvent(event, state, mockConnection, mockSession);

      expect(state.resolve).toHaveBeenCalledWith('error');
    });
  });

  describe('null state handling', () => {
    it('ignores events when state is null', () => {
      const event: Extract<AgentControllerEvent, { type: 'message_update' }> = {
        type: 'message_update',
        id: 'msg-1',
        event: { type: 'text-delta', delta: 'Hello' },
      };

      handleAgentControllerEvent(event, null, mockConnection, mockSession);

      expect(sessionUpdateSpy).not.toHaveBeenCalled();
    });
  });

  describe('ignored events', () => {
    it('ignores om_*, subagent_*, workspace_* events', () => {
      const state = createPromptState('session-1');

      const ignoredEvents: AgentControllerEvent[] = [
        { type: 'om_status', status: 'active' } as any,
        { type: 'subagent_start', agentType: 'explore' } as any,
        { type: 'workspace_ready', workspaceId: 'ws-1', workspaceName: 'test' } as any,
      ];

      ignoredEvents.forEach(event => {
        handleAgentControllerEvent(event, state, mockConnection, mockSession);
      });

      expect(sessionUpdateSpy).not.toHaveBeenCalled();
    });
  });
});

describe('cancellation while a turn starts', () => {
  it('reapplies cancellation once the controller starts the run', () => {
    const completeDeferredAbort = vi.fn();
    const state: PromptState = {
      sessionId: 'cancelled-start',
      lastTextLength: 0,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      resolve: vi.fn(),
    };
    state.cancelled = true;
    handleAgentControllerEvent(
      { type: 'agent_start' },
      state,
      {} as AgentSideConnection,
      { completeDeferredAbort } as unknown as Session,
    );
    expect(completeDeferredAbort).toHaveBeenCalledOnce();
  });

  it('denies an approval encountered after cancellation without asking the client', () => {
    const respondToToolApproval = vi.fn();
    const requestPermission = vi.fn();
    const state: PromptState = {
      sessionId: 'cancelled-approval',
      lastTextLength: 0,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      resolve: vi.fn(),
    };
    state.cancelled = true;
    handleAgentControllerEvent(
      { type: 'tool_approval_required', toolCallId: 'late', toolName: 'write_file', args: {} },
      state,
      { requestPermission } as unknown as AgentSideConnection,
      { respondToToolApproval } as unknown as Session,
    );
    expect(requestPermission).not.toHaveBeenCalled();
    expect(respondToToolApproval).toHaveBeenCalledWith({ toolCallId: 'late', decision: 'decline' });
  });
});
