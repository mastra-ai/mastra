import { basename } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { AssistantRenderRegistry, getAssistantSegmentKey } from '../../assistant-render-registry.js';
import { AssistantMessageComponent } from '../../components/assistant-message.js';
import { handleNewCommand } from '../new.js';
import type { SlashCommandContext } from '../types.js';

function createMockState() {
  const assistantRenderRegistry = new AssistantRenderRegistry();
  const assistantSegment = assistantRenderRegistry.start(
    'assistant-1',
    getAssistantSegmentKey('assistant-1'),
    () => new AssistantMessageComponent(),
  ).segment;
  vi.spyOn(assistantSegment.component, 'disposeRenderState');

  return {
    assistantRenderRegistry,
    assistantSegment,
    pendingNewThread: false,
    currentThreadTitle: 'Current thread',
    options: { appName: 'Mastra Code' },
    chatContainer: { clear: vi.fn() },
    pendingTools: { clear: vi.fn() },
    pendingTaskToolIds: { clear: vi.fn() },
    allToolComponents: [{}],
    allSlashCommandComponents: [{}],
    allSystemReminderComponents: [{}],
    messageComponentsById: new Map([['a', {}]]),
    allShellComponents: [{}],
    taskProgress: { updateTasks: vi.fn() },
    taskToolInsertIndex: 5,
    session: {
      state: { set: vi.fn(async () => {}) },
      thread: {
        getId: vi.fn(() => 'old-thread'),
        detachFromCurrent: vi.fn(),
        create: vi.fn(async () => ({ id: 'new-thread' })),
        switch: vi.fn(async () => {}),
        clearAndReleaseLock: vi.fn(async () => {}),
        ensureCurrentSubscription: vi.fn(async () => {}),
      },
      displayState: { get: vi.fn(() => ({ modifiedFiles: new Map([['f', true]]) })) },
    },
    controller: {
      abort: vi.fn(),
      session: {
        thread: { detachFromCurrent: vi.fn() },
        displayState: { get: vi.fn(() => ({ modifiedFiles: new Map([['f', true]]) })) },
      },
      setState: vi.fn(async () => {}),
    },
    ui: { requestRender: vi.fn(), terminal: { setTitle: vi.fn() } },
  } as any;
}

function createCtx(state: ReturnType<typeof createMockState>): SlashCommandContext {
  return {
    state,
    updateStatusLine: vi.fn(),
    showInfo: vi.fn(),
  } as unknown as SlashCommandContext;
}

describe('handleNewCommand', () => {
  it('creates and marks a durable thread before reporting the new conversation ready', async () => {
    const state = createMockState();
    const ctx = createCtx(state);
    const callOrder: string[] = [];

    state.session.thread.detachFromCurrent.mockImplementation(() => {
      callOrder.push('detach');
    });
    state.session.thread.create.mockImplementation(async () => {
      callOrder.push('create');
      return { id: 'new-thread' };
    });
    ctx.showInfo = vi.fn(() => callOrder.push('ready'));

    await handleNewCommand(ctx);

    expect(state.session.thread.detachFromCurrent).toHaveBeenCalledOnce();
    expect(state.session.thread.create).toHaveBeenCalledWith({ metadata: { explicitNewThread: true } });
    expect(state.pendingNewThread).toBe(false);
    expect(callOrder).toEqual(['detach', 'create', 'ready']);
  });

  it('restores the previous thread subscription when durable thread creation fails', async () => {
    const state = createMockState();
    const ctx = createCtx(state);
    const error = new Error('create failed');
    state.session.thread.create.mockRejectedValue(error);

    await expect(handleNewCommand(ctx)).rejects.toBe(error);

    expect(state.session.thread.detachFromCurrent).toHaveBeenCalledOnce();
    expect(state.session.thread.ensureCurrentSubscription).toHaveBeenCalledOnce();
    expect(ctx.showInfo).not.toHaveBeenCalled();
  });

  it('restores the previous thread binding when creation fails after rebinding', async () => {
    const state = createMockState();
    const ctx = createCtx(state);
    const error = new Error('subscription failed');
    state.session.thread.create.mockImplementation(async () => {
      state.session.thread.getId.mockReturnValue('new-thread');
      throw error;
    });

    await expect(handleNewCommand(ctx)).rejects.toBe(error);

    expect(state.session.thread.switch).toHaveBeenCalledWith({ threadId: 'old-thread' });
    expect(state.session.thread.ensureCurrentSubscription).not.toHaveBeenCalled();
    expect(ctx.showInfo).not.toHaveBeenCalled();
  });

  it('clears UI state and ephemeral thread state', async () => {
    const state = createMockState();
    const ctx = createCtx(state);

    await handleNewCommand(ctx);

    expect(state.chatContainer.clear).toHaveBeenCalled();
    expect(state.pendingTools.clear).toHaveBeenCalled();
    expect(state.allToolComponents).toEqual([]);
    expect(state.allSlashCommandComponents).toEqual([]);
    expect(state.allSystemReminderComponents).toEqual([]);
    expect(state.messageComponentsById.size).toBe(0);
    expect(state.assistantRenderRegistry.size).toBe(0);
    expect(state.assistantSegment.component.disposeRenderState).toHaveBeenCalledOnce();
    expect(state.allShellComponents).toEqual([]);
    expect(state.session.state.set).toHaveBeenCalledWith({
      tasks: [],
      activePlan: null,
      sandboxAllowedPaths: [],
    });
    expect(state.taskProgress.updateTasks).toHaveBeenCalledWith([]);
    expect(state.taskToolInsertIndex).toBe(-1);
    expect(state.currentThreadTitle).toBeUndefined();
    expect(state.ui.terminal.setTitle).toHaveBeenCalledWith(`Mastra Code - ${basename(process.cwd())}`);
    expect(ctx.updateStatusLine).toHaveBeenCalled();
    expect(state.ui.requestRender).toHaveBeenCalled();
  });
});
