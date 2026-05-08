import { Container } from '@mariozechner/pi-tui';
import { describe, expect, it, vi } from 'vitest';

import type { TUIState } from '../state.js';
import { handleToolEnd, handleToolInputStart, handleToolStart } from './tool.js';
import type { EventHandlerContext } from './types.js';

function createToolHandlerContext(): EventHandlerContext {
  const chatContainer = new Container();
  const state = {
    chatContainer,
    ui: { requestRender: vi.fn() },
    pendingTools: new Map(),
    pendingTaskToolIds: new Set(),
    seenToolCallIds: new Set(),
    pendingSubagents: new Map(),
    pendingAskUserComponents: new Map(),
    allToolComponents: [],
    toolOutputExpanded: false,
    hideThinkingBlock: false,
    taskToolInsertIndex: -1,
  } as unknown as TUIState;

  return {
    state,
    addChildBeforeFollowUps: (child: any) => {
      state.chatContainer.addChild(child);
    },
  } as EventHandlerContext;
}

describe('task tool rendering', () => {
  it('keeps successful task tools out of the chat tool list', () => {
    const ctx = createToolHandlerContext();

    handleToolInputStart(ctx, 'call-1', 'task_update');
    handleToolEnd(ctx, 'call-1', { content: 'Tasks updated', isError: false }, false);

    expect(ctx.state.pendingTools.has('call-1')).toBe(false);
    expect(ctx.state.pendingTaskToolIds.has('call-1')).toBe(false);
    expect(ctx.state.allToolComponents).toHaveLength(0);
    expect(ctx.state.chatContainer.children).toHaveLength(1);
  });

  it('renders task tool failures as normal tool results', () => {
    const ctx = createToolHandlerContext();

    handleToolInputStart(ctx, 'call-1', 'task_update');
    handleToolEnd(ctx, 'call-1', { content: 'Task not found: missing', isError: true }, true);

    expect(ctx.state.pendingTools.has('call-1')).toBe(false);
    expect(ctx.state.pendingTaskToolIds.has('call-1')).toBe(false);
    expect(ctx.state.allToolComponents).toHaveLength(1);
    expect(ctx.state.chatContainer.children).toHaveLength(2);
    expect(ctx.state.chatContainer.children[0]).toBe(ctx.state.allToolComponents[0]);
  });

  it('does not recreate task tool state when input streaming starts after tool start', () => {
    const ctx = createToolHandlerContext();

    handleToolStart(ctx, 'call-1', 'task_update', { id: 'tests', status: 'in_progress' });
    const component = ctx.state.pendingTools.get('call-1');
    const childCount = ctx.state.chatContainer.children.length;

    handleToolInputStart(ctx, 'call-1', 'task_update');

    expect(ctx.state.pendingTools.get('call-1')).toBe(component);
    expect(ctx.state.pendingTaskToolIds.has('call-1')).toBe(true);
    expect(ctx.state.chatContainer.children).toHaveLength(childCount);
  });
});
