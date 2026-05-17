import { Container } from '@mariozechner/pi-tui';
import { describe, expect, it, vi } from 'vitest';

import type { TUIState } from '../state.js';
import { handleToolEnd, handleToolInputDelta, handleToolInputStart, handleToolStart } from './tool.js';
import type { EventHandlerContext } from './types.js';

function createToolHandlerContext(): EventHandlerContext {
  const chatContainer = new Container();
  const state = {
    chatContainer,
    ui: { requestRender: vi.fn() },
    terminal: { columns: 100 },
    pendingTools: new Map(),
    pendingTaskToolIds: new Set(),
    seenToolCallIds: new Set(),
    pendingSubagents: new Map(),
    pendingAskUserComponents: new Map(),
    pendingSubmitPlanComponents: new Map(),
    allToolComponents: [],
    quietMode: false,
    toolOutputExpanded: false,
    hideThinkingBlock: false,
    taskToolInsertIndex: -1,
    harness: {
      getDisplayState: vi.fn(() => ({ toolInputBuffers: new Map() })),
    },
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

  it('renders regular tools in quiet mode without demoting previous tools', () => {
    const ctx = createToolHandlerContext();
    ctx.state.quietMode = true;

    handleToolInputStart(ctx, 'call-1', 'view');
    const first = ctx.state.pendingTools.get('call-1')!;
    handleToolInputStart(ctx, 'call-2', 'find_files');
    const second = ctx.state.pendingTools.get('call-2')!;

    expect(ctx.state.chatContainer.children).toHaveLength(4);
    expect((first as any).render(100).join('\n')).not.toContain('╭──');
    expect((second as any).render(100).join('\n')).not.toContain('╭──');
  });

  it('streams submit_plan args into a plan box instead of rendering a generic tool', () => {
    const ctx = createToolHandlerContext();
    const buffers = new Map([
      ['call-1', { toolName: 'submit_plan', text: '{"title":"Ship it","plan":"Build the feature"}' }],
    ]);
    vi.mocked(ctx.state.harness.getDisplayState).mockReturnValue({ toolInputBuffers: buffers } as any);

    handleToolInputStart(ctx, 'call-1', 'submit_plan');
    handleToolInputDelta(ctx, 'call-1', '{"title":"Ship it","plan":"Build the feature"}');

    expect(ctx.state.pendingTools.has('call-1')).toBe(false);
    expect(ctx.state.allToolComponents).toHaveLength(0);
    expect(ctx.state.pendingSubmitPlanComponents.has('call-1')).toBe(true);
    expect(ctx.state.chatContainer.children).toHaveLength(2);
    expect(ctx.state.chatContainer.render(80).join('\n')).toContain('Build the feature');
  });
});
