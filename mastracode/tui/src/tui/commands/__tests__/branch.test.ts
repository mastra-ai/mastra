import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AssistantRenderRegistry } from '../../assistant-render-registry.js';
import { handleBranchCommand, handleBranchesCommand, handleParentCommand } from '../branch.js';

const mocks = vi.hoisted(() => ({
  askModalQuestion: vi.fn(),
  resetUIAfterClone: vi.fn(),
}));

vi.mock('../../modal-question.js', () => ({
  askModalQuestion: mocks.askModalQuestion,
}));

vi.mock('../clone.js', () => ({
  resetUIAfterClone: mocks.resetUIAfterClone,
}));

function createState(threadOverrides: Record<string, unknown> = {}) {
  return {
    assistantRenderRegistry: new AssistantRenderRegistry(),
    chatContainer: { clear: vi.fn() },
    pendingTools: new Map(),
    pendingTaskToolIds: new Set(),
    messageComponentsById: new Map(),
    allToolComponents: [] as unknown[],
    allSystemReminderComponents: [] as unknown[],
    allShellComponents: [] as unknown[],
    pendingNewThread: true,
    options: { backgroundToolsEnabled: false },
    session: {
      thread: {
        getId: vi.fn(() => 'thread-1'),
        listActiveMessages: vi.fn(async () => [{ id: 'msg-fork' }]),
        branch: vi.fn(async () => ({
          thread: { id: 'branch-1', title: 'My Branch' },
          branch: {
            parentThreadId: 'thread-1',
            branchPointMessageId: 'msg-fork',
            branchPointCreatedAt: new Date(),
            branchCreatedAt: new Date(),
          },
        })),
        getParent: vi.fn(async () => null),
        listBranches: vi.fn(async () => ({ total: 0, page: 0, perPage: false, hasMore: false, branches: [] })),
        switch: vi.fn(async () => {}),
        ...threadOverrides,
      },
    },
    ui: { requestRender: vi.fn() },
  };
}

function createCtx(state: ReturnType<typeof createState>) {
  return {
    state,
    renderExistingMessages: vi.fn(async () => {}),
    showInfo: vi.fn(),
    showError: vi.fn(),
    updateStatusLine: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('handleBranchCommand', () => {
  it('shows info when there is no active thread', async () => {
    const state = createState({ getId: vi.fn(() => null) });
    const ctx = createCtx(state);

    await handleBranchCommand(ctx as never);

    expect(ctx.showInfo).toHaveBeenCalledWith('No active thread to branch');
    expect(state.session.thread.branch).not.toHaveBeenCalled();
  });

  it('shows info when the thread has no messages to branch from', async () => {
    const state = createState({ listActiveMessages: vi.fn(async () => []) });
    const ctx = createCtx(state);

    await handleBranchCommand(ctx as never);

    expect(ctx.showInfo).toHaveBeenCalledWith('No messages to branch from yet');
    expect(state.session.thread.branch).not.toHaveBeenCalled();
  });

  it('does not branch when the user cancels confirmation', async () => {
    mocks.askModalQuestion.mockResolvedValue('No');
    const state = createState();
    const ctx = createCtx(state);

    await handleBranchCommand(ctx as never);

    expect(state.session.thread.branch).not.toHaveBeenCalled();
  });

  it('branches at the last message and resets the UI with a branch banner', async () => {
    mocks.askModalQuestion.mockResolvedValueOnce('Yes').mockResolvedValueOnce('My Branch');
    const state = createState();
    const ctx = createCtx(state);

    await handleBranchCommand(ctx as never);

    expect(state.session.thread.branch).toHaveBeenCalledWith({
      branchPointMessageId: 'msg-fork',
      title: 'My Branch',
    });
    expect(mocks.resetUIAfterClone).toHaveBeenCalledWith(ctx, 'My Branch', 'Branched thread: My Branch');
    expect(state.pendingNewThread).toBe(false);
  });

  it('maps BRANCHING_UNSUPPORTED to a friendly info message', async () => {
    mocks.askModalQuestion.mockResolvedValueOnce('Yes').mockResolvedValueOnce(null);
    const unsupported = Object.assign(new Error('not supported'), { id: 'BRANCHING_UNSUPPORTED' });
    const state = createState({ branch: vi.fn(async () => Promise.reject(unsupported)) });
    const ctx = createCtx(state);

    await handleBranchCommand(ctx as never);

    expect(ctx.showInfo).toHaveBeenCalledWith('Thread branching is not supported by this memory configuration');
    expect(ctx.showError).not.toHaveBeenCalled();
  });

  it('surfaces other branch failures as errors', async () => {
    mocks.askModalQuestion.mockResolvedValueOnce('Yes').mockResolvedValueOnce(null);
    const state = createState({ branch: vi.fn(async () => Promise.reject(new Error('boom'))) });
    const ctx = createCtx(state);

    await handleBranchCommand(ctx as never);

    expect(ctx.showError).toHaveBeenCalledWith('Failed to branch thread: boom');
  });
});

describe('handleParentCommand', () => {
  it('shows info when the current thread is not a branch', async () => {
    const state = createState();
    const ctx = createCtx(state);

    await handleParentCommand(ctx as never);

    expect(ctx.showInfo).toHaveBeenCalledWith('Current thread is not a branch');
    expect(state.session.thread.switch).not.toHaveBeenCalled();
  });

  it('switches to the parent thread and re-renders it', async () => {
    const state = createState({
      getParent: vi.fn(async () => ({ id: 'parent-1', title: 'Root Thread' })),
    });
    const ctx = createCtx(state);

    await handleParentCommand(ctx as never);

    expect(state.session.thread.switch).toHaveBeenCalledWith({ threadId: 'parent-1' });
    expect(ctx.renderExistingMessages).toHaveBeenCalledOnce();
    expect(ctx.showInfo).toHaveBeenCalledWith('Switched to parent: Root Thread');
    expect(state.chatContainer.clear).toHaveBeenCalled();
  });
});

describe('handleBranchesCommand', () => {
  it('shows info when the thread has no branches', async () => {
    const state = createState();
    const ctx = createCtx(state);

    await handleBranchesCommand(ctx as never);

    expect(ctx.showInfo).toHaveBeenCalledWith('No branches forked from this thread');
  });

  it('switches to the branch selected from the list', async () => {
    const branches = [
      {
        thread: { id: 'branch-1', title: 'First Branch' },
        branch: { branchCreatedAt: new Date('2026-09-19T00:00:00Z') },
      },
    ];
    const state = createState({
      listBranches: vi.fn(async () => ({ total: 1, page: 0, perPage: false, hasMore: false, branches })),
    });
    mocks.askModalQuestion.mockResolvedValue('First Branch');
    const ctx = createCtx(state);

    await handleBranchesCommand(ctx as never);

    expect(state.session.thread.switch).toHaveBeenCalledWith({ threadId: 'branch-1' });
    expect(ctx.showInfo).toHaveBeenCalledWith('Switched to branch: First Branch');
  });

  it('does not switch when the user cancels the branch list', async () => {
    const branches = [
      {
        thread: { id: 'branch-1', title: 'First Branch' },
        branch: { branchCreatedAt: new Date('2026-09-19T00:00:00Z') },
      },
    ];
    const state = createState({
      listBranches: vi.fn(async () => ({ total: 1, page: 0, perPage: false, hasMore: false, branches })),
    });
    mocks.askModalQuestion.mockResolvedValue('Cancel');
    const ctx = createCtx(state);

    await handleBranchesCommand(ctx as never);

    expect(state.session.thread.switch).not.toHaveBeenCalled();
  });
});
