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
    pendingSubagents: new Map([['subagent', {}]]),
    pendingSignalMessageComponentsById: new Map([['signal', {}]]),
    followUpComponents: [{}],
    allToolComponents: [{}],
    allSlashCommandComponents: [{}],
    allSystemReminderComponents: [{}],
    messageComponentsById: new Map([['a', {}]]),
    allShellComponents: [{}],
    globalBackgroundNotice: { setActivities: vi.fn() },
    taskProgress: { updateTasks: vi.fn() },
    taskToolInsertIndex: 5,
    session: {
      state: { set: vi.fn(async () => {}) },
      thread: { detachFromCurrent: vi.fn() },
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
  it('detaches from current thread before setting pendingNewThread', async () => {
    const state = createMockState();
    const ctx = createCtx(state);
    const callOrder: string[] = [];

    state.session.thread.detachFromCurrent.mockImplementation(() => {
      callOrder.push('detach');
    });
    const origPendingNewThread = Object.getOwnPropertyDescriptor(state, 'pendingNewThread');
    Object.defineProperty(state, 'pendingNewThread', {
      set(v: boolean) {
        if (v) callOrder.push('pendingNewThread');
        Object.defineProperty(state, 'pendingNewThread', { value: v, writable: true, configurable: true });
      },
      get() {
        return origPendingNewThread?.value ?? false;
      },
      configurable: true,
    });

    await handleNewCommand(ctx);

    expect(state.session.thread.detachFromCurrent).toHaveBeenCalledOnce();
    expect(callOrder).toEqual(['detach', 'pendingNewThread']);
  });

  it('clears UI state and ephemeral thread state', async () => {
    const state = createMockState();
    const ctx = createCtx(state);

    await handleNewCommand(ctx);

    expect(state.chatContainer.clear).toHaveBeenCalled();
    expect(state.pendingTools.clear).toHaveBeenCalled();
    expect(state.pendingTaskToolIds.clear).toHaveBeenCalled();
    expect(state.pendingSubagents.size).toBe(0);
    expect(state.pendingSignalMessageComponentsById.size).toBe(0);
    expect(state.followUpComponents).toEqual([]);
    expect(state.allToolComponents).toEqual([]);
    expect(state.allSlashCommandComponents).toEqual([]);
    expect(state.allSystemReminderComponents).toEqual([]);
    expect(state.messageComponentsById.size).toBe(0);
    expect(state.assistantRenderRegistry.size).toBe(0);
    expect(state.assistantSegment.component.disposeRenderState).toHaveBeenCalledOnce();
    expect(state.allShellComponents).toEqual([]);
    expect(state.globalBackgroundNotice.setActivities).toHaveBeenCalledWith([]);
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
