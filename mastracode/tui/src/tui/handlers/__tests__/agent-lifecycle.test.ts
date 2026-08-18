import { Container } from '@earendil-works/pi-tui';
import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { describe, expect, it, vi } from 'vitest';
import { AssistantRenderRegistry, getAssistantSegmentKey } from '../../assistant-render-registry.js';
import { AssistantMessageComponent } from '../../components/assistant-message.js';
import type { TUIState } from '../../state.js';
import { handleAgentAborted, handleAgentEnd, handleAgentError } from '../agent-lifecycle.js';
import type { EventHandlerContext } from '../types.js';

vi.mock('@mastra/code-sdk/utils/project', () => ({
  getCurrentGitBranchAsync: vi.fn(async () => undefined),
}));

function assistantMessage(): MastraDBMessage {
  return {
    id: 'assistant-1',
    role: 'assistant',
    createdAt: new Date(),
    content: { format: 2, parts: [{ type: 'text', text: 'visible output' }] },
  } as MastraDBMessage;
}

function createContext(): { ctx: EventHandlerContext; state: TUIState } {
  const assistantRenderRegistry = new AssistantRenderRegistry();
  const message = assistantMessage();
  const { segment } = assistantRenderRegistry.reconcile(
    message.id,
    getAssistantSegmentKey(message.id),
    message,
    () => new AssistantMessageComponent(),
  );
  const state = {
    assistantRenderRegistry,
    streamingComponent: segment.component,
    streamingMessage: message,
    chatContainer: new Container(),
    projectInfo: { rootPath: '/repo', gitBranch: 'main' },
    ui: { requestRender: vi.fn() },
    session: {
      followUps: { count: vi.fn(() => 0) },
      displayState: { get: vi.fn(() => ({ isRunning: false })) },
    },
    gradientAnimator: undefined,
    activeGoalJudge: undefined,
    followUpComponents: [],
    pendingTools: new Map(),
    pendingTaskToolIds: new Set(),
    pendingQueuedActions: [],
    pendingFollowUpMessages: [],
    pendingSlashCommands: [],
    pendingSlashCommandMessageIds: [],
    pendingSignalMessageComponentsById: new Map(),
    allToolComponents: [],
    allSlashCommandComponents: [],
    allSystemReminderComponents: [],
    allShellComponents: [],
    userInitiatedAbort: false,
    planRejectionAbort: false,
  } as unknown as TUIState;
  state.chatContainer.addChild(segment.component);

  const ctx = {
    state,
    updateStatusLine: vi.fn(),
    addUserMessage: vi.fn(),
    fireMessage: vi.fn(),
    handleSlashCommand: vi.fn(async () => {}),
    showError: vi.fn(),
  } as unknown as EventHandlerContext;
  return { ctx, state };
}

describe('assistant render ownership at agent terminal paths', () => {
  it.each([
    ['agent_end', handleAgentEnd],
    ['agent_aborted', handleAgentAborted],
    ['agent_error', handleAgentError],
  ] as const)('finalizes active render state on %s without dropping rendered output', (_name, handler) => {
    const { ctx, state } = createContext();

    handler(ctx);

    const record = state.assistantRenderRegistry.get('assistant-1')!;
    expect(record.activeSegmentKey).toBeUndefined();
    expect([...record.segments.values()].every(segment => segment.finalized)).toBe(true);
    expect(state.streamingComponent).toBeUndefined();
    expect(state.streamingMessage).toBeUndefined();
    expect(record.segments.values().next().value?.component.render(80).join('\n')).toContain('visible output');
  });

  it('preserves queued assistant output and the interrupted marker when aborting before the next render', () => {
    const { ctx, state } = createContext();
    const pendingMessage = assistantMessage();
    pendingMessage.content = {
      format: 2,
      parts: [{ type: 'text', text: 'visible output plus pending suffix' }],
    };
    state.streamingMessage = pendingMessage;
    state.assistantRenderRegistry.queueActive(pendingMessage.id, pendingMessage);

    handleAgentAborted(ctx);

    const component = state.assistantRenderRegistry.get('assistant-1')!.segments.values().next().value!.component;
    const output = component.render(80).join('\n');
    expect(output).toContain('visible output plus pending suffix');
    expect(output).toContain('Interrupted');
  });

  it('does not duplicate pre-tool output when aborting with pending post-tool output', () => {
    const { ctx, state } = createContext();
    state.assistantRenderRegistry.finalizeActive('assistant-1');

    const postToolMessage = {
      ...assistantMessage(),
      content: {
        format: 2,
        parts: [{ type: 'text', text: 'pending post-tool output' }],
      },
    } as MastraDBMessage;
    const { segment } = state.assistantRenderRegistry.reconcile(
      postToolMessage.id,
      'assistant-1:after:tool-1',
      postToolMessage,
      () => new AssistantMessageComponent(),
    );
    state.streamingComponent = segment.component;
    state.streamingMessage = {
      ...postToolMessage,
      content: {
        format: 2,
        parts: [
          { type: 'text', text: 'visible output' },
          {
            type: 'tool-invocation',
            toolInvocation: { state: 'result', toolCallId: 'tool-1', toolName: 'view', args: {}, result: 'ok' },
          },
          { type: 'text', text: 'pending post-tool output' },
        ],
      },
    } as MastraDBMessage;

    handleAgentAborted(ctx);

    const output = segment.component.render(80).join('\n');
    expect(output).toContain('pending post-tool output');
    expect(output).toContain('Interrupted');
    expect(output).not.toContain('visible output');
  });
});
