import { describe, expect, it, vi } from 'vitest';

vi.mock('../tools/index.js', () => ({
  createWebSearchTool: () => ({ description: 'web search' }),
  createWebExtractTool: () => ({ description: 'web extract' }),
  hasTavilyKey: () => false,
  requestSandboxAccessTool: { description: 'request sandbox access' },
}));

import { createDynamicTools } from './tools.js';

function createRequestContext(state: Record<string, unknown>, modeId: string = 'build') {
  return {
    get(key: string) {
      if (key !== 'harness') return undefined;
      return {
        modeId,
        getState: () => state,
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

  it('runs pre/post hooks around tool execution', async () => {
    const execute = vi.fn(async () => ({ ok: true }));
    const hookManager = {
      runPreToolUse: vi.fn(async () => ({ allowed: true, results: [], warnings: [] })),
      runPostToolUse: vi.fn(async () => ({ allowed: true, results: [], warnings: [] })),
    };

    const getDynamicTools = createDynamicTools(
      undefined,
      {
        custom_tool: {
          description: 'custom',
          execute,
        },
      },
      hookManager as any,
    );

    const tools = getDynamicTools({
      requestContext: createRequestContext({
        projectPath: process.cwd(),
      }),
    });

    const input = { foo: 'bar' };
    const output = await tools.custom_tool.execute(input, {});

    expect(output).toEqual({ ok: true });
    expect(execute).toHaveBeenCalledWith(input, {});
    expect(hookManager.runPreToolUse).toHaveBeenCalledWith('custom_tool', input);
    expect(hookManager.runPostToolUse).toHaveBeenCalledWith('custom_tool', input, { ok: true }, false);
  });

  it('blocks tool execution when PreToolUse denies access', async () => {
    const execute = vi.fn(async () => ({ ok: true }));
    const hookManager = {
      runPreToolUse: vi.fn(async () => ({
        allowed: false,
        blockReason: 'blocked by policy',
        results: [],
        warnings: [],
      })),
      runPostToolUse: vi.fn(async () => ({ allowed: true, results: [], warnings: [] })),
    };

    const getDynamicTools = createDynamicTools(
      undefined,
      {
        custom_tool: {
          description: 'custom',
          execute,
        },
      },
      hookManager as any,
    );

    const tools = getDynamicTools({
      requestContext: createRequestContext({
        projectPath: process.cwd(),
      }),
    });

    const result = await tools.custom_tool.execute({ foo: 'bar' }, {});
    expect(result).toEqual({ error: 'blocked by policy' });
    expect(execute).not.toHaveBeenCalled();
    expect(hookManager.runPostToolUse).not.toHaveBeenCalled();
  });

  it('still runs PostToolUse when tool execution throws', async () => {
    const execute = vi.fn(async () => {
      throw new Error('boom');
    });
    const hookManager = {
      runPreToolUse: vi.fn(async () => ({ allowed: true, results: [], warnings: [] })),
      runPostToolUse: vi.fn(async () => ({ allowed: true, results: [], warnings: [] })),
    };

    const getDynamicTools = createDynamicTools(
      undefined,
      {
        custom_tool: {
          description: 'custom',
          execute,
        },
      },
      hookManager as any,
    );

    const tools = getDynamicTools({
      requestContext: createRequestContext({
        projectPath: process.cwd(),
      }),
    });

    await expect(tools.custom_tool.execute({ foo: 'bar' }, {})).rejects.toThrow('boom');
    expect(hookManager.runPostToolUse).toHaveBeenCalledWith('custom_tool', { foo: 'bar' }, { error: 'boom' }, true);
  });
});
