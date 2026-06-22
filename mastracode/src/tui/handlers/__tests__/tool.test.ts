import { describe, expect, it, vi } from 'vitest';

import { handleToolInputDelta } from '../tool';

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

  const ctx = {
    state: {
      harness: { session: { displayState: { get: () => ({ toolInputBuffers }) } } },
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
});
