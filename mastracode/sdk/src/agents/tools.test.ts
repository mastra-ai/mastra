import { describe, expect, it, vi } from 'vitest';

vi.mock('../tools/index.js', () => ({
  createWebSearchTool: () => ({ description: 'web search' }),
  createWebExtractTool: () => ({ description: 'web extract' }),
  createWebFetchTool: () => ({ id: 'web-fetch', description: 'web fetch' }),
  hasTavilyKey: () => false,
  requestSandboxAccessTool: { description: 'request sandbox access' },
}));

import { createDynamicTools, createToolHooks } from './tools.js';

function createRequestContext(state: Record<string, unknown>, modeId: string = 'build', modelId?: string) {
  const getState = () => state;
  return {
    get(key: string) {
      if (key !== 'controller') return undefined;
      return {
        modeId,
        getState,
        session: { modelId, state: { get: getState } },
      };
    },
  } as any;
}

describe('createDynamicTools', () => {
  it('merges extra tools into the exposed tool map', () => {
    const customTool = {
      description: 'custom',
      async execute() {
        return { ok: true };
      },
    };

    const getDynamicTools = createDynamicTools(undefined, {
      custom_tool: customTool,
    });

    const allowedTools = getDynamicTools({
      requestContext: createRequestContext({
        projectPath: process.cwd(),
      }),
    });
    expect(allowedTools.custom_tool).toBeDefined();
  });

  it('exposes provider-hosted search and direct live fetch to Anthropic models', () => {
    const getDynamicTools = createDynamicTools();
    const tools = getDynamicTools({
      requestContext: createRequestContext({}, 'build', 'anthropic/claude-sonnet-4-6'),
    });

    expect(tools.web_search).toMatchObject({
      type: 'provider',
      id: 'anthropic.web_search_20250305',
    });
    expect(tools.web_fetch).toMatchObject({ id: 'web-fetch' });
  });
});

describe('createToolHooks', () => {
  it('maps PreToolUse and PostToolUse hook manager calls to agent tool hooks', async () => {
    const hookManager = {
      runPreToolUse: vi.fn(async () => ({ allowed: true, results: [], warnings: [] })),
      runPostToolUse: vi.fn(async () => ({ allowed: true, results: [], warnings: [] })),
    };
    const hooks = createToolHooks(hookManager as any)!;
    const input = { foo: 'bar' };
    const output = { ok: true };

    await hooks.beforeToolCall?.({ toolName: 'custom_tool', input, context: {} });
    await hooks.afterToolCall?.({ toolName: 'custom_tool', input, context: {}, output });

    expect(hookManager.runPreToolUse).toHaveBeenCalledWith('custom_tool', input);
    expect(hookManager.runPostToolUse).toHaveBeenCalledWith('custom_tool', input, output, false);
  });

  it('blocks tool execution when PreToolUse denies access', async () => {
    const hookManager = {
      runPreToolUse: vi.fn(async () => ({
        allowed: false,
        blockReason: 'blocked by policy',
        results: [],
        warnings: [],
      })),
      runPostToolUse: vi.fn(async () => ({ allowed: true, results: [], warnings: [] })),
    };
    const hooks = createToolHooks(hookManager as any)!;

    const result = await hooks.beforeToolCall?.({ toolName: 'custom_tool', input: { foo: 'bar' }, context: {} });
    expect(result).toEqual({ proceed: false, output: { error: 'blocked by policy' } });
    expect(hookManager.runPostToolUse).not.toHaveBeenCalled();
  });

  it('records errors in PostToolUse hook calls', async () => {
    const hookManager = {
      runPreToolUse: vi.fn(async () => ({ allowed: true, results: [], warnings: [] })),
      runPostToolUse: vi.fn(async () => ({ allowed: true, results: [], warnings: [] })),
    };
    const hooks = createToolHooks(hookManager as any)!;
    const input = { foo: 'bar' };

    await hooks.afterToolCall?.({
      toolName: 'custom_tool',
      input,
      context: {},
      output: undefined,
      error: new Error('boom'),
    });

    expect(hookManager.runPostToolUse).toHaveBeenCalledWith('custom_tool', input, { error: 'boom' }, true);
  });
});
