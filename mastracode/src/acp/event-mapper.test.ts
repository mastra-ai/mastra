import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AgentSideConnection } from '@agentclientprotocol/sdk';
import type { HarnessEvent, Harness } from '@mastra/core/harness';
import { handleHarnessEvent, type PromptState } from './event-mapper.js';

describe('ACP Event Mapper', () => {
  let mockConnection: AgentSideConnection;
  let mockHarness: Harness;
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

    mockHarness = {
      session: {
        respondToToolApproval: vi.fn(),
      },
      respondToToolSuspension: vi.fn(),
    } as unknown as Harness;
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

  describe('message_update - text delta computation', () => {
    it('emits agent_message_chunk with delta text', () => {
      const state = createPromptState('session-1');
      
      // First message_update with "Hello"
      const event1: Extract<HarnessEvent, { type: 'message_update' }> = {
        type: 'message_update',
        message: {
          id: 'msg-1',
          role: 'assistant',
          content: [{ type: 'text', text: 'Hello' }],
          createdAt: new Date(),
        },
      };

      handleHarnessEvent(event1, state, mockConnection, mockHarness);

      expect(sessionUpdateSpy).toHaveBeenCalledWith({
        sessionId: 'session-1',
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: 'Hello' },
        },
      });
      expect(state.lastTextLength).toBe(5);
    });

    it('emits only delta for cumulative message_update', () => {
      const state = createPromptState('session-1');
      state.lastTextLength = 5; // Already seen "Hello"

      // Second message_update with "Hello, world!"
      const event: Extract<HarnessEvent, { type: 'message_update' }> = {
        type: 'message_update',
        message: {
          id: 'msg-1',
          role: 'assistant',
          content: [{ type: 'text', text: 'Hello, world!' }],
          createdAt: new Date(),
        },
      };

      handleHarnessEvent(event, state, mockConnection, mockHarness);

      expect(sessionUpdateSpy).toHaveBeenCalledWith({
        sessionId: 'session-1',
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: ', world!' }, // Only the delta
        },
      });
      expect(state.lastTextLength).toBe(13);
    });

    it('ignores non-assistant messages', () => {
      const state = createPromptState('session-1');
      
      const event: Extract<HarnessEvent, { type: 'message_update' }> = {
        type: 'message_update',
        message: {
          id: 'msg-1',
          role: 'user',
          content: [{ type: 'text', text: 'User message' }],
          createdAt: new Date(),
        },
      };

      handleHarnessEvent(event, state, mockConnection, mockHarness);
      expect(sessionUpdateSpy).not.toHaveBeenCalled();
    });
  });

  describe('tool_start - tool_call emission', () => {
    it('emits tool_call with correct kind mapping', () => {
      const state = createPromptState('session-1');
      
      const event: Extract<HarnessEvent, { type: 'tool_start' }> = {
        type: 'tool_start',
        toolCallId: 'tool-123',
        toolName: 'edit_file',
        args: { path: '/test.js', content: 'code' },
      };

      handleHarnessEvent(event, state, mockConnection, mockHarness);

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
        const event: Extract<HarnessEvent, { type: 'tool_start' }> = {
          type: 'tool_start',
          toolCallId: `tool-${name}`,
          toolName: name,
          args: {},
        };

        handleHarnessEvent(event, state, mockConnection, mockHarness);

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
      
      const event: Extract<HarnessEvent, { type: 'tool_end' }> = {
        type: 'tool_end',
        toolCallId: 'tool-123',
        result: 'File written successfully',
        isError: false,
      };

      handleHarnessEvent(event, state, mockConnection, mockHarness);

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
      
      const event: Extract<HarnessEvent, { type: 'tool_end' }> = {
        type: 'tool_end',
        toolCallId: 'tool-123',
        result: { error: 'Permission denied' },
        isError: true,
      };

      handleHarnessEvent(event, state, mockConnection, mockHarness);

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
      
      const event: Extract<HarnessEvent, { type: 'tool_approval_required' }> = {
        type: 'tool_approval_required',
        toolCallId: 'tool-123',
        toolName: 'delete_file',
        args: { path: '/important.js' },
      };

      handleHarnessEvent(event, state, mockConnection, mockHarness);

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

      expect(mockHarness.session.respondToToolApproval).toHaveBeenCalledWith({
        decision: 'approve',
      });
    });

    it('responds with decline on reject_once', async () => {
      requestPermissionSpy.mockResolvedValueOnce({
        outcome: { outcome: 'selected', optionId: 'reject' },
      });

      const state = createPromptState('session-1');
      
      const event: Extract<HarnessEvent, { type: 'tool_approval_required' }> = {
        type: 'tool_approval_required',
        toolCallId: 'tool-123',
        toolName: 'delete_file',
        args: {},
      };

      handleHarnessEvent(event, state, mockConnection, mockHarness);

      await vi.waitFor(() => {
        expect(requestPermissionSpy).toHaveBeenCalled();
      });

      expect(mockHarness.session.respondToToolApproval).toHaveBeenCalledWith({
        decision: 'decline',
      });
    });

    it('auto-approves when MASTRACODE_ACP_AUTO_APPROVE=1', async () => {
      const originalEnv = process.env.MASTRACODE_ACP_AUTO_APPROVE;
      process.env.MASTRACODE_ACP_AUTO_APPROVE = '1';

      try {
        const state = createPromptState('session-1');
        
        const event: Extract<HarnessEvent, { type: 'tool_approval_required' }> = {
          type: 'tool_approval_required',
          toolCallId: 'tool-123',
          toolName: 'delete_file',
          args: {},
        };

        handleHarnessEvent(event, state, mockConnection, mockHarness);

        // Should not request permission
        expect(requestPermissionSpy).not.toHaveBeenCalled();
        expect(mockHarness.session.respondToToolApproval).toHaveBeenCalledWith({
          decision: 'approve',
        });
      } finally {
        process.env.MASTRACODE_ACP_AUTO_APPROVE = originalEnv;
      }
    });
  });

  describe('tool_suspended - auto-resolve and plan approval', () => {
    it('auto-resolves request_access suspension', () => {
      const state = createPromptState('session-1');
      
      const event: Extract<HarnessEvent, { type: 'tool_suspended' }> = {
        type: 'tool_suspended',
        toolCallId: 'tool-123',
        toolName: 'request_access',
        args: {},
        suspendPayload: {},
      };

      handleHarnessEvent(event, state, mockConnection, mockHarness);

      expect(mockHarness.respondToToolSuspension).toHaveBeenCalledWith({
        toolCallId: 'tool-123',
        resumeData: 'Yes',
      });
    });

    it('auto-resolves sandbox_access_request suspension', () => {
      const state = createPromptState('session-1');
      
      const event: Extract<HarnessEvent, { type: 'tool_suspended' }> = {
        type: 'tool_suspended',
        toolCallId: 'tool-123',
        toolName: 'some_tool',
        args: {},
        suspendPayload: { kind: 'sandbox_access_request' },
      };

      handleHarnessEvent(event, state, mockConnection, mockHarness);

      expect(mockHarness.respondToToolSuspension).toHaveBeenCalledWith({
        toolCallId: 'tool-123',
        resumeData: 'Yes',
      });
    });

    it('requests permission for submit_plan and approves', async () => {
      const state = createPromptState('session-1');
      
      const event: Extract<HarnessEvent, { type: 'tool_suspended' }> = {
        type: 'tool_suspended',
        toolCallId: 'tool-123',
        toolName: 'submit_plan',
        args: { title: 'My Plan' },
        suspendPayload: {},
      };

      handleHarnessEvent(event, state, mockConnection, mockHarness);

      await vi.waitFor(() => {
        expect(requestPermissionSpy).toHaveBeenCalledWith({
          sessionId: 'session-1',
          toolCall: {
            toolCallId: 'tool-123',
            title: 'submit_plan',
            rawInput: JSON.stringify({ title: 'My Plan' }),
          },
          options: [
            { optionId: 'approve', name: 'Approve Plan', kind: 'allow_once' },
            { optionId: 'reject', name: 'Reject Plan', kind: 'reject_once' },
          ],
        });
      });

      expect(mockHarness.respondToToolSuspension).toHaveBeenCalledWith({
        toolCallId: 'tool-123',
        resumeData: { action: 'approved' },
      });
    });

    it('auto-resolves ask_user with default message', () => {
      const state = createPromptState('session-1');
      
      const event: Extract<HarnessEvent, { type: 'tool_suspended' }> = {
        type: 'tool_suspended',
        toolCallId: 'tool-123',
        toolName: 'ask_user',
        args: { question: 'What do you want?' },
        suspendPayload: {},
      };

      handleHarnessEvent(event, state, mockConnection, mockHarness);

      expect(mockHarness.respondToToolSuspension).toHaveBeenCalledWith({
        toolCallId: 'tool-123',
        resumeData: 'Proceed with your best judgment. Do not ask further questions.',
      });
    });
  });

  describe('usage_update - token accumulation', () => {
    it('accumulates token usage', () => {
      const state = createPromptState('session-1');
      
      const event1: Extract<HarnessEvent, { type: 'usage_update' }> = {
        type: 'usage_update',
        usage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
          reasoningTokens: 10,
        },
      };

      handleHarnessEvent(event1, state, mockConnection, mockHarness);

      expect(state.usage).toEqual({
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        reasoningTokens: 10,
      });

      const event2: Extract<HarnessEvent, { type: 'usage_update' }> = {
        type: 'usage_update',
        usage: {
          promptTokens: 50,
          completionTokens: 25,
          totalTokens: 75,
        },
      };

      handleHarnessEvent(event2, state, mockConnection, mockHarness);

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
      
      const event: Extract<HarnessEvent, { type: 'agent_end' }> = {
        type: 'agent_end',
        reason: 'complete',
      };

      handleHarnessEvent(event, state, mockConnection, mockHarness);

      expect(state.resolve).toHaveBeenCalledWith('complete');
    });

    it('resolves with aborted reason', () => {
      const state = createPromptState('session-1');
      
      const event: Extract<HarnessEvent, { type: 'agent_end' }> = {
        type: 'agent_end',
        reason: 'aborted',
      };

      handleHarnessEvent(event, state, mockConnection, mockHarness);

      expect(state.resolve).toHaveBeenCalledWith('aborted');
    });

    it('resolves with error reason', () => {
      const state = createPromptState('session-1');
      
      const event: Extract<HarnessEvent, { type: 'agent_end' }> = {
        type: 'agent_end',
        reason: 'error',
      };

      handleHarnessEvent(event, state, mockConnection, mockHarness);

      expect(state.resolve).toHaveBeenCalledWith('error');
    });
  });

  describe('null state handling', () => {
    it('ignores events when state is null', () => {
      const event: Extract<HarnessEvent, { type: 'message_update' }> = {
        type: 'message_update',
        message: {
          id: 'msg-1',
          role: 'assistant',
          content: [{ type: 'text', text: 'Hello' }],
          createdAt: new Date(),
        },
      };

      handleHarnessEvent(event, null, mockConnection, mockHarness);

      expect(sessionUpdateSpy).not.toHaveBeenCalled();
    });
  });

  describe('ignored events', () => {
    it('ignores om_*, subagent_*, workspace_* events', () => {
      const state = createPromptState('session-1');
      
      const ignoredEvents: HarnessEvent[] = [
        { type: 'om_status', status: 'active' } as any,
        { type: 'subagent_start', agentType: 'explore' } as any,
        { type: 'workspace_ready', workspaceId: 'ws-1', workspaceName: 'test' } as any,
      ];

      ignoredEvents.forEach(event => {
        handleHarnessEvent(event, state, mockConnection, mockHarness);
      });

      expect(sessionUpdateSpy).not.toHaveBeenCalled();
    });
  });
});
