import { describe, expect, it, vi } from 'vitest';

vi.mock('../render-messages.js', () => ({
  clearPendingUserMessages: vi.fn(),
}));

vi.mock('../prune-chat.js', () => ({
  pruneChatContainer: vi.fn(),
}));

vi.mock('@mastra/code-sdk/utils/project', () => ({
  getCurrentGitBranch: vi.fn(() => 'main'),
  getCurrentGitBranchAsync: vi.fn(() => Promise.resolve('main')),
}));

import { handleAgentAborted, handleAgentEnd, handleAgentError } from '../handlers/agent-lifecycle.js';
import type { EventHandlerContext } from '../handlers/types.js';
import type { TUIState } from '../state.js';

function createState(overrides: Partial<TUIState> = {}): TUIState {
  return {
    goalManager: { stopActiveTimer: vi.fn(), saveToThread: vi.fn().mockResolvedValue(undefined) },
    gradientAnimator: { fadeOut: vi.fn() },
    projectInfo: { rootPath: '.', gitBranch: 'main' },
    streamingComponent: undefined,
    streamingMessage: undefined,
    followUpComponents: [],
    pendingFollowUpMessages: [],
    pendingQueuedActions: [],
    pendingSlashCommands: [],
    pendingTools: new Map(),
    chatContainer: { addChild: vi.fn() },
    ui: { requestRender: vi.fn() },
    ...overrides,
  } as unknown as TUIState;
}

function createContext(state: TUIState): EventHandlerContext {
  return {
    state,
    updateStatusLine: vi.fn(),
  } as unknown as EventHandlerContext;
}

describe('agent lifecycle goal timing', () => {
  it('stops and persists active goal timing when an agent abort ends the turn', async () => {
    const state = createState();

    await handleAgentAborted(createContext(state));

    expect(state.goalManager.stopActiveTimer).toHaveBeenCalled();
    expect(state.goalManager.saveToThread).toHaveBeenCalledWith(state);
    expect(vi.mocked(state.goalManager.stopActiveTimer).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(state.goalManager.saveToThread).mock.invocationCallOrder[0]!,
    );
  });

  it('does not render redundant interrupted errors for user aborts', async () => {
    const updateContent = vi.fn();
    const streamingMessage = { id: 'msg-1' } as any;
    const state = createState({
      userInitiatedAbort: true,
      streamingComponent: { updateContent } as any,
      streamingMessage,
    });

    await handleAgentAborted(createContext(state));

    expect(updateContent).not.toHaveBeenCalled();
    expect(streamingMessage.errorMessage).toBeUndefined();
    expect(state.streamingComponent).toBeUndefined();
    expect(state.streamingMessage).toBeUndefined();
  });

  it('stops and persists active goal timing when an agent error ends the turn', async () => {
    const state = createState();

    await handleAgentError(createContext(state));

    expect(state.goalManager.stopActiveTimer).toHaveBeenCalled();
    expect(state.goalManager.saveToThread).toHaveBeenCalledWith(state);
    expect(vi.mocked(state.goalManager.stopActiveTimer).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(state.goalManager.saveToThread).mock.invocationCallOrder[0]!,
    );
  });

  it('stops and persists active goal timing when an agent completes normally', async () => {
    const state = createState({
      pendingTaskToolIds: new Set(),
      session: { followUps: { count: vi.fn(() => 0) } },
    } as unknown as Partial<TUIState>);

    const ctx = {
      state,
      updateStatusLine: vi.fn(),
      notify: vi.fn(),
    } as unknown as EventHandlerContext;

    await handleAgentEnd(ctx);

    expect(state.goalManager.stopActiveTimer).toHaveBeenCalled();
    expect(state.goalManager.saveToThread).toHaveBeenCalledWith(state);
    expect(vi.mocked(state.goalManager.stopActiveTimer).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(state.goalManager.saveToThread).mock.invocationCallOrder[0]!,
    );
  });
});
