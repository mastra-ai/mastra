import { afterEach, describe, expect, it, vi } from 'vitest';

import { clearToolInputParsers, handleToolInputDelta, handleToolInputStart, handleToolUpdate } from '../tool.js';

async function flushParser(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise(resolve => setTimeout(resolve, 100));
}

function createContext(bufferText: string | undefined, toolName = 'view') {
  const updateArgs = vi.fn();
  const refresh = vi.fn();
  const requestRender = vi.fn();
  const invalidate = vi.fn();
  const component = { updateArgs, refresh };
  const toolInputBuffers = new Map<string, { text: string; toolName: string }>();

  if (bufferText !== undefined) {
    toolInputBuffers.set('call-1', { text: bufferText, toolName });
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

  return { ctx, toolInputBuffers, updateArgs, refresh, requestRender };
}

describe('tool event handlers', () => {
  afterEach(() => {
    clearToolInputParsers();
  });

  it('feeds streamed delta fragments into the pending tool component incrementally', async () => {
    const { ctx, updateArgs, refresh, requestRender } = createContext('');

    handleToolInputDelta(ctx, 'call-1', '{"path":"src/index.ts","query":"create');
    await flushParser();

    expect(updateArgs).toHaveBeenCalledWith({ path: 'src/index.ts', query: 'create' }, false);
    expect(refresh).toHaveBeenCalledOnce();
    expect(requestRender).toHaveBeenCalledOnce();

    handleToolInputDelta(ctx, 'call-1', ' parser"}');
    await flushParser();

    expect(updateArgs).toHaveBeenLastCalledWith({ path: 'src/index.ts', query: 'create parser' }, false);
    expect(requestRender).toHaveBeenCalledTimes(2);
  });

  it('does not reparse the canonical display-state buffer on every delta', async () => {
    const { ctx, updateArgs } = createContext('{"path":"canonical.ts"}');

    handleToolInputDelta(ctx, 'call-1', '{"path":"delta.ts"}');
    await flushParser();

    expect(updateArgs).toHaveBeenCalledWith({ path: 'delta.ts' }, false);
    expect(updateArgs).not.toHaveBeenCalledWith({ path: 'canonical.ts' }, false);
  });

  it('streams partial ask_user args into the inline question component', async () => {
    const { ctx, requestRender } = createContext('', 'ask_user');
    const updateAskArgs = vi.fn();
    ctx.state.pendingAskUserComponents.set('call-1', { updateArgs: updateAskArgs });

    handleToolInputDelta(ctx, 'call-1', '{"question":"Pick a color","options":[{"label":"Red"');
    await flushParser();

    expect(updateAskArgs).toHaveBeenCalledWith({ question: 'Pick a color', options: [{ label: 'Red' }] });
    expect(requestRender).toHaveBeenCalledOnce();
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
    const toolInputBuffers = new Map([['call-1', { text: '', toolName: 'mastra_expert' }]]);
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
            get: () => ({ toolInputBuffers }),
          },
        },
        chatContainer: { children: [], invalidate },
        ui: { requestRender },
      },
    } as any;

    handleToolInputStart(ctx, 'call-1', 'mastra_expert');
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
