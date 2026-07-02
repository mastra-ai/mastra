import { describe, expect, it, vi } from 'vitest';

import { handleToolInputDelta, handleToolInputStart, handleToolUpdate } from '../tool.js';

function createContext(bufferText: string | undefined) {
  const updateArgs = vi.fn();
  const refresh = vi.fn();
  const requestRender = vi.fn();
  const invalidate = vi.fn();
  const component = { updateArgs, refresh };
  const toolInputBuffers = new Map<string, { text: string; toolName: string }>();

  if (bufferText !== undefined) {
    toolInputBuffers.set('call-1', { text: bufferText, toolName: 'view' });
  }

  const session = { displayState: { get: () => ({ toolInputBuffers }) } };
  const ctx = {
    state: {
      controller: { session },
      session,
      pendingTools: new Map([['call-1', component]]),
      pendingAskUserComponents: new Map(),
      pendingSubmitPlanComponents: new Map(),
      taskProgress: undefined,
      chatContainer: { children: [component], invalidate },
      ui: { requestRender },
    },
  } as any;

  return { ctx, updateArgs, refresh, requestRender };
}

describe('tool event handlers', () => {
  it('parses buffered partial tool args into the pending tool component', () => {
    const { ctx, updateArgs, refresh, requestRender } = createContext('{"path":"src/index.ts","query":"create');

    handleToolInputDelta(ctx, 'call-1', 'ignored-delta');

    expect(updateArgs).toHaveBeenCalledWith({ path: 'src/index.ts', query: 'create' }, false);
    expect(refresh).toHaveBeenCalledOnce();
    expect(requestRender).toHaveBeenCalledOnce();
  });

  it('uses the canonical display-state buffer instead of the latest delta fragment', () => {
    const { ctx, updateArgs } = createContext('{"path":"src/index.ts"}');

    handleToolInputDelta(ctx, 'call-1', '{"path":"wrong.ts"}');

    expect(updateArgs).toHaveBeenCalledWith({ path: 'src/index.ts' }, false);
  });

  it('ignores deltas for calls without a display-state buffer', () => {
    const { ctx, updateArgs, requestRender } = createContext(undefined);

    handleToolInputDelta(ctx, 'call-1', '{"path":"src/index.ts"}');

    expect(updateArgs).not.toHaveBeenCalled();
    expect(requestRender).not.toHaveBeenCalled();
  });

  it('routes subagent renderer progress into a subagent-style component', () => {
    const component = { updateResult: vi.fn() };
    const requestRender = vi.fn();
    const invalidate = vi.fn();
    const ctx = {
      addChildBeforeFollowUps: vi.fn(child => ctx.state.chatContainer.children.push(child)),
      state: {
        quietMode: false,
        pluginManager: {
          getToolRenderConfig: vi.fn(() => ({ type: 'subagent', agentType: 'alexandria' })),
        },
        pendingTools: new Map(),
        pendingSubagents: new Map(),
        allToolComponents: [],
        seenToolCallIds: new Set(),
        session: {
          displayState: {
            get: () => ({
              toolInputBuffers: new Map([
                ['call-1', { text: '{"question":"Answer from Alexandria"}', toolName: 'mastra_expert' }],
              ]),
            }),
          },
        },
        chatContainer: { children: [], invalidate },
        ui: { requestRender },
      },
    } as any;

    handleToolInputStart(ctx, 'call-1', 'mastra_expert');
    handleToolInputDelta(ctx, 'call-1', 'ignored-delta');
    handleToolUpdate(ctx, 'call-1', {
      event: 'tool_start',
      toolName: 'search_content',
      args: { query: 'plugins' },
    });
    handleToolUpdate(ctx, 'call-1', {
      event: 'text',
      text: 'Streaming answer text',
    });
    handleToolUpdate(ctx, 'call-1', {
      event: 'text',
      text: 'Updated answer text',
    });

    expect(ctx.state.pendingTools.has('call-1')).toBe(false);
    expect(ctx.state.pendingSubagents.has('call-1')).toBe(true);
    expect(ctx.state.streamingComponent).toBe(ctx.state.chatContainer.children.at(-1));
    expect(ctx.state.chatContainer.children).toHaveLength(2);
    expect(component.updateResult).not.toHaveBeenCalled();
    expect(requestRender).toHaveBeenCalled();

    const rendered = ctx.state.chatContainer.children
      .map((child: any) => child.render?.(80)?.join('\n') ?? '')
      .join('\n');
    expect(rendered).toContain('mastra_expert');
    expect(rendered).toContain('search_content');
    expect(rendered).not.toContain('Streaming answer text');
    expect(rendered).toContain('Updated answer text');
  });
});
