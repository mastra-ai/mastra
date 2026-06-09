import { describe, expect, it, vi } from 'vitest';

vi.mock('../render-messages.js', () => ({
  clearPendingUserMessages: vi.fn(),
}));

vi.mock('../prune-chat.js', () => ({
  pruneChatContainer: vi.fn(),
}));

vi.mock('../../utils/project.js', () => ({
  getCurrentGitBranch: vi.fn(() => 'main'),
  getCurrentGitBranchAsync: vi.fn(() => Promise.resolve('main')),
}));

import { handleAgentAborted, handleAgentError } from '../handlers/agent-lifecycle.js';
import type { EventHandlerContext } from '../handlers/types.js';
import type { TUIState } from '../state.js';

function createState(overrides: Partial<TUIState> = {}): TUIState {
  return {
    goalManager: { stopActiveTimer: vi.fn() },
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
  it('stops active goal timing when an agent abort ends the turn', () => {
    const state = createState();

    handleAgentAborted(createContext(state));

    expect(state.goalManager.stopActiveTimer).toHaveBeenCalled();
  });

  it('stops active goal timing when an agent error ends the turn', () => {
    const state = createState();

    handleAgentError(createContext(state));

    expect(state.goalManager.stopActiveTimer).toHaveBeenCalled();
  });
});
