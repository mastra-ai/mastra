import { Container } from '@mariozechner/pi-tui';
import { describe, expect, it, vi } from 'vitest';
import { reconcileChatBoundarySpacers } from '../chat-boundary-reconciliation.js';
import { isChatBoundarySpacer } from '../components/chat-boundary-spacer.js';

import type { TUIState } from '../state.js';
import { handleToolEnd, handleToolInputDelta, handleToolInputStart, handleToolStart } from './tool.js';
import type { EventHandlerContext } from './types.js';

function visibleChildren(ctx: EventHandlerContext) {
  return ctx.state.chatContainer.children.filter(child => !isChatBoundarySpacer(child));
}

function stripAnsi(text: string): string {
  return text.replace(/\u001b\[[0-9;]*m/g, '');
}

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
      reconcileChatBoundarySpacers(state.chatContainer);
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
    expect(visibleChildren(ctx)).toHaveLength(2);
    expect(visibleChildren(ctx)[0]).toBe(ctx.state.allToolComponents[0]);
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

    expect(visibleChildren(ctx)).toHaveLength(4);
    expect(ctx.state.chatContainer.children.some(child => isChatBoundarySpacer(child))).toBe(true);
    expect((first as any).render(100).join('\n')).not.toContain('╭──');
    expect((second as any).render(100).join('\n')).not.toContain('╭──');
  });

  it('marks quiet tool result objects with isError true as failed even when the event flag is false', () => {
    const ctx = createToolHandlerContext();
    ctx.state.quietMode = true;

    handleToolInputStart(ctx, 'call-1', 'string_replace_lsp');
    handleToolInputDelta(ctx, 'call-1', '{"path":"src/example.ts","old_string":"missing","new_string":"replacement"}');
    handleToolEnd(ctx, 'call-1', { content: 'The specified text was not found.', isError: true }, false);

    const output = stripAnsi(ctx.state.chatContainer.render(100).join('\n'));
    expect(output).toContain('The specified text was not found.');
    expect(output).toContain('▐edit▌ ✗');
  });

  it('regroups quiet tools as streamed args arrive', () => {
    const ctx = createToolHandlerContext();
    ctx.state.quietMode = true;
    const buffers = new Map([
      ['call-1', { toolName: 'view', text: '{"path":"src/example.ts","offset":80,"limit":90}' }],
      ['call-2', { toolName: 'view', text: '{"path":"src/example.ts","offset":1,"limit":25}' }],
    ]);
    vi.mocked(ctx.state.harness.getDisplayState).mockReturnValue({ toolInputBuffers: buffers } as any);

    handleToolInputStart(ctx, 'call-1', 'view');
    handleToolInputDelta(ctx, 'call-1', '');
    handleToolInputStart(ctx, 'call-2', 'view');
    handleToolInputDelta(ctx, 'call-2', '');

    const output = stripAnsi(ctx.state.chatContainer.render(120).join('\n'));
    expect(output).toContain('view');
    expect(output).toContain('src/example.ts:80-169');
    expect(output).toContain('●───── /example.ts:1-25▌');
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
    expect(visibleChildren(ctx)).toHaveLength(2);
    expect(ctx.state.chatContainer.render(80).join('\n')).toContain('Build the feature');
  });
});
