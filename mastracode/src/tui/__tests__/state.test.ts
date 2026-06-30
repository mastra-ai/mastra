import { describe, expect, it, vi } from 'vitest';

vi.mock('@earendil-works/pi-tui', () => {
  class MockContainer {
    children: unknown[] = [];
  }

  class MockProcessTerminal {
    columns = 120;
  }

  class MockTUI {
    constructor(public terminal: MockProcessTerminal) {}
  }

  class MockSpacer {
    setLines() {}
  }

  return {
    Container: MockContainer,
    ProcessTerminal: MockProcessTerminal,
    TUI: MockTUI,
    Spacer: MockSpacer,
  };
});

vi.mock('../components/custom-editor.js', () => ({
  CustomEditor: class {
    getModeColor?: () => string | undefined;

    constructor(
      public ui: unknown,
      public theme: unknown,
    ) {}
  },
}));

vi.mock('../../onboarding/settings.js', async importOriginal => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    // Keep state initialization hermetic: don't read the host's real settings.
    loadSettings: vi.fn(() => ({ voice: { enabled: false } })),
  };
});

vi.mock('../../utils/project.js', async importOriginal => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    detectProject: vi.fn(() => ({ rootPath: '/tmp/mastra-code-project', gitBranch: 'main' })),
  };
});

import { createTUIState } from '../state.js';

function createSession() {
  return {
    mode: { resolve: vi.fn(() => ({ id: 'build', metadata: { color: '#7c3aed' } })) },
  };
}

function createAgentController(session: ReturnType<typeof createSession>) {
  return { session };
}

describe('createTUIState', () => {
  it('initializes the shared TUI runtime defaults used by chat handlers', () => {
    const session = createSession();
    const controller = createAgentController(session);
    const hookManager = {};
    const analytics = {};
    const authStorage = { getStoredApiKey: vi.fn(() => undefined) };
    const mcpManager = {};
    const workspace = {};

    const state = createTUIState({
      controller: controller as never,
      session: session as never,
      hookManager: hookManager as never,
      analytics: analytics as never,
      authStorage: authStorage as never,
      mcpManager: mcpManager as never,
      workspace: workspace as never,
    });

    expect(state.controller).toBe(controller);
    expect(state.hookManager).toBe(hookManager);
    expect(state.analytics).toBe(analytics);
    expect(state.authStorage).toBe(authStorage);
    expect(state.mcpManager).toBe(mcpManager);
    expect(state.workspace).toBe(workspace);

    expect(state.isInitialized).toBe(false);
    expect(state.pendingNewThread).toBe(false);
    expect(state.pendingApprovalDismiss).toBeNull();
    expect(state.lastClearedText).toBe('');
    expect(state.lastCtrlCTime).toBe(0);
    expect(state.userInitiatedAbort).toBe(false);

    expect(state.pendingTools).toBeInstanceOf(Map);
    expect(state.pendingTools.size).toBe(0);
    expect(state.pendingTaskToolIds).toBeInstanceOf(Set);
    expect(state.pendingTaskToolIds.size).toBe(0);
    expect(state.seenToolCallIds).toBeInstanceOf(Set);
    expect(state.seenToolCallIds.size).toBe(0);
    expect(state.subagentToolCallIds).toBeInstanceOf(Set);
    expect(state.subagentToolCallIds.size).toBe(0);
    expect(state.currentRunSystemReminderKeys).toBeInstanceOf(Set);
    expect(state.currentRunSystemReminderKeys.size).toBe(0);
    expect(state.pendingSubagents).toBeInstanceOf(Map);
    expect(state.pendingSubagents.size).toBe(0);

    expect(state.allToolComponents).toEqual([]);
    expect(state.allSlashCommandComponents).toEqual([]);
    expect(state.allSystemReminderComponents).toEqual([]);
    expect(state.allShellComponents).toEqual([]);
    expect(state.messageComponentsById).toBeInstanceOf(Map);
    expect(state.messageComponentsById.size).toBe(0);

    expect(state.threadPreviewCache).toBeInstanceOf(Map);
    expect(state.threadPreviewCache.size).toBe(0);
    expect(state.attemptedThreadPreviewIds).toBeInstanceOf(Set);
    expect(state.attemptedThreadPreviewIds.size).toBe(0);
    expect(state.activeGithubPrSubscriptions).toEqual([]);

    expect(state.pendingAskUserComponents).toBeInstanceOf(Map);
    expect(state.pendingAskUserComponents.size).toBe(0);
    expect(state.pendingSubmitPlanComponents).toBeInstanceOf(Map);
    expect(state.pendingSubmitPlanComponents.size).toBe(0);
    expect(state.pendingInlineQuestions).toEqual([]);
    expect(state.pendingFollowUpMessages).toEqual([]);
    expect(state.pendingQueuedActions).toEqual([]);
    expect(state.followUpComponents).toEqual([]);
    expect(state.pendingSignalMessageComponentsById).toBeInstanceOf(Map);
    expect(state.pendingSignalMessageComponentsById.size).toBe(0);
    expect(state.pendingSlashCommands).toEqual([]);
    expect(state.pendingSlashCommandMessageIds).toEqual([]);
    expect(state.pendingImages).toEqual([]);

    expect(state.toolOutputExpanded).toBe(false);
    expect(state.hideThinkingBlock).toBe(true);
    expect(state.quietMode).toBe(false);
    expect(state.quietModeMaxToolPreviewLines).toBe(2);
    expect(state.modelAuthStatus).toEqual({ hasAuth: true });
    expect(state.projectInfo).toEqual({ rootPath: '/tmp/mastra-code-project', gitBranch: 'main' });

    expect(state.editor.getModeColor?.()).toBe('#7c3aed');
    expect(controller.session.mode.resolve).toHaveBeenCalled();
  });
});
