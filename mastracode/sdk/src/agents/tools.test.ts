import { describe, expect, it, vi } from 'vitest';

vi.mock('../tools/index.js', () => ({
  createWebSearchTool: () => ({ description: 'web search' }),
  createWebExtractTool: () => ({ description: 'web extract' }),
  hasTavilyKey: () => false,
  requestSandboxAccessTool: { description: 'request sandbox access' },
}));

import { createDynamicTools, createToolHooks } from './tools.js';

function createRequestContext(state: Record<string, unknown>, modeId: string = 'build') {
  const getState = () => state;
  return {
    get(key: string) {
      if (key !== 'controller') return undefined;
      return {
        modeId,
        getState,
        session: { state: { get: getState } },
      };
    },
  } as any;
}

describe('createDynamicTools', () => {
  it('merges extra tools into the exposed tool map', async () => {
    const customTool = {
      description: 'custom',
      async execute() {
        return { ok: true };
      },
    };

    const getDynamicTools = createDynamicTools(undefined, {
      custom_tool: customTool,
    });

    const allowedTools = await getDynamicTools({
      requestContext: createRequestContext({
        projectPath: process.cwd(),
      }),
    });
    expect(allowedTools.custom_tool).toBeDefined();
  });

  it('does not let extra tools replace a tool already supplied by the runtime', () => {
    const requestAccessReplacement = { description: 'replacement' };
    const getDynamicTools = createDynamicTools(undefined, { request_access: requestAccessReplacement });

    const allowedTools = getDynamicTools({ requestContext: createRequestContext({}) });

    expect(allowedTools.request_access).not.toBe(requestAccessReplacement);
    expect(allowedTools.request_access.description).toBe('request sandbox access');
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

  it('composes a post-tool observer with hook-manager behavior and forwards execution context', async () => {
    const hookManager = {
      runPreToolUse: vi.fn(async () => ({ allowed: true, results: [], warnings: [] })),
      runPostToolUse: vi.fn(async () => ({ allowed: true, results: [], warnings: [] })),
    };
    const observer = vi.fn();
    const hooks = createToolHooks(hookManager as any, observer)!;
    const requestContext = createRequestContext({ projectPath: '/worktrees/a' });
    const context = { requestContext };

    await hooks.afterToolCall?.({ toolName: 'execute_command', input: { command: 'true' }, context, output: 'ok' });

    expect(hookManager.runPostToolUse).toHaveBeenCalled();
    expect(observer).toHaveBeenCalledWith({
      toolName: 'execute_command',
      input: { command: 'true' },
      context,
      output: 'ok',
    });
  });

  it('forwards the original error object to the observer', async () => {
    const observer = vi.fn();
    const hooks = createToolHooks(undefined, observer)!;
    const error = new Error('boom');

    await hooks.afterToolCall?.({ toolName: 'custom_tool', input: {}, context: {}, output: undefined, error });

    expect(observer).toHaveBeenCalledWith(expect.objectContaining({ error }));
  });

  it.each([0, false, ''])('treats a falsey error value (%j) as a failed tool call', async error => {
    const hookManager = {
      runPreToolUse: vi.fn(async () => ({ allowed: true, results: [], warnings: [] })),
      runPostToolUse: vi.fn(async () => ({ allowed: true, results: [], warnings: [] })),
    };
    const hooks = createToolHooks(hookManager as any)!;

    await hooks.afterToolCall?.({ toolName: 'custom_tool', input: {}, context: {}, output: 'success', error } as any);

    expect(hookManager.runPostToolUse).toHaveBeenCalledWith('custom_tool', {}, { error: String(error) }, true);
  });

  it.each([
    vi.fn(() => {
      throw new Error('observer failed');
    }),
    vi.fn(async () => {
      throw new Error('observer failed');
    }),
  ])('supports an observer without a hook manager and isolates observer failures', async observer => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const hooks = createToolHooks(undefined, observer)!;

    await expect(
      hooks.afterToolCall?.({ toolName: 'custom_tool', input: {}, context: {}, output: { ok: true } }),
    ).resolves.toBeUndefined();
    expect(observer).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith('[MastraCode] Post-tool observer failed for custom_tool.', expect.any(Error));
    warn.mockRestore();
  });
});
