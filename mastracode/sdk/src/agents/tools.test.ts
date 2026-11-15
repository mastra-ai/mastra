import { afterEach, describe, expect, it, vi } from 'vitest';

const webToolMocks = vi.hoisted(() => ({
  configuredTools: undefined as
    | {
        web_search: { description: string };
        web_extract: { description: string };
      }
    | undefined,
}));

vi.mock('../tools/index.js', () => ({
  createWebSearchTool: () => ({ description: 'web search' }),
  createWebExtractTool: () => ({ description: 'web extract' }),
  createConfiguredWebTools: () =>
    webToolMocks.configuredTools ? Promise.resolve(webToolMocks.configuredTools) : undefined,
  hasParallelKey: () => false,
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
  afterEach(() => {
    webToolMocks.configuredTools = undefined;
  });

  it('exposes the configured model-independent web provider', async () => {
    const parallelSearch = { description: 'parallel search' };
    const parallelExtract = { description: 'parallel extract' };
    webToolMocks.configuredTools = {
      web_search: parallelSearch,
      web_extract: parallelExtract,
    };

    const getDynamicTools = createDynamicTools();
    const tools = await getDynamicTools({ requestContext: createRequestContext({}) });

    expect(tools.web_search).toBe(parallelSearch);
    expect(tools.web_extract).toBe(parallelExtract);
  });

  it('exposes opt-in built-in tools, still subject to disabledTools', () => {
    const scheduleList = { description: 'list schedules' };
    const scheduleCreate = { description: 'create schedule' };
    const getDynamicTools = createDynamicTools(undefined, undefined, ['schedule_create'], undefined, undefined, false, {
      schedule_list: scheduleList,
      schedule_create: scheduleCreate,
    } as any);
    const tools = getDynamicTools({ requestContext: createRequestContext({}) }) as Record<string, unknown>;

    expect(tools.schedule_list).toBe(scheduleList);
    expect(tools.schedule_create).toBeUndefined();
  });

  it.each([
    ['openai/gpt-5.5', 'openai.web_search'],
    ['anthropic/claude-sonnet-4-5', 'anthropic.web_search_20250305'],
  ])('offers the same provider search for %s and its gateway alias', async (modelId, toolId) => {
    const build = createDynamicTools();
    const canonical = await build({ requestContext: createRequestContext({}, 'build', modelId) });
    const alias = await build({ requestContext: createRequestContext({}, 'build', `mastra/${modelId}`) });
    expect(canonical.web_search?.id).toBe(toolId);
    expect(alias.web_search?.id).toBe(toolId);

    const disabled = await createDynamicTools(undefined, undefined, ['web_search'])({
      requestContext: createRequestContext({}, 'build', `mastra/${modelId}`),
    });
    expect(disabled.web_search).toBeUndefined();
  });

  it('keeps explicit search backends for gateway aliases and unsupported providers', async () => {
    const search = { description: 'external search' };
    webToolMocks.configuredTools = { web_search: search, web_extract: { description: 'external extract' } };
    for (const modelId of ['mastra/openai/gpt-5.5', 'mastra/anthropic/claude-sonnet-4-5', 'google/gemini-2.5-flash']) {
      const tools = await createDynamicTools()({ requestContext: createRequestContext({}, 'build', modelId) });
      expect(tools.web_search).toBe(search);
    }
  });

  it('does not add provider search for an unsupported model', async () => {
    const tools = await createDynamicTools()({
      requestContext: createRequestContext({}, 'build', 'mastra/google/gemini-2.5-flash'),
    });
    expect(tools.web_search).toBeUndefined();
  });

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
