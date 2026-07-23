import { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { describe, it, expect, vi } from 'vitest';
import z from 'zod';

vi.mock('../tools/index.js', () => ({
  createWebSearchTool: () => ({ description: 'web search' }),
  createWebExtractTool: () => ({ description: 'web extract' }),
  hasTavilyKey: () => false,
  requestSandboxAccessTool: { description: 'request sandbox access' },
}));

import { getToolCategory } from '../permissions.js';
import { MC_TOOLS } from '../tool-names.js';
import { buildToolGuidance } from './prompts/tool-guidance.js';
import { createDynamicTools } from './tools.js';

// Minimal mock of AgentControllerRequestContext shape that createDynamicTools reads
function makeRequestContext(
  overrides: {
    modeId?: string;
    projectPath?: string;
    permissionRules?: { categories?: Record<string, string>; tools?: Record<string, string> };
  } = {},
) {
  const ctx = new RequestContext();
  const getState = () => ({
    projectPath: overrides.projectPath ?? '/tmp/test-project',
    permissionRules: overrides.permissionRules ?? { categories: {}, tools: {} },
  });
  ctx.set('controller', {
    getState,
    session: {
      modeId: overrides.modeId ?? 'build',
      modelId: 'anthropic/claude-opus-4-6',
      state: {
        get: getState,
      },
    },
  });
  return ctx;
}

describe('createDynamicTools – extraTools', () => {
  it('should include extraTools in the returned tool set', async () => {
    const myCustomTool = createTool({
      id: 'my_custom_tool',
      description: 'A custom tool provided via extraTools',
      inputSchema: z.object({ query: z.string() }),
      execute: async () => ({ result: 'custom' }),
    });

    const getDynamicTools = createDynamicTools(undefined, { my_custom_tool: myCustomTool });
    const tools = await getDynamicTools({ requestContext: makeRequestContext() });

    // The extra tool must be present alongside the built-in tools
    expect(tools).toHaveProperty('my_custom_tool');
    expect(tools.my_custom_tool).toBe(myCustomTool);

    // Built-in non-workspace tools should still be present
    expect(tools).toHaveProperty('request_access');
  });

  it('should keep provider-native and interactive tools foreground-only', async () => {
    const tools = await createDynamicTools()({ requestContext: makeRequestContext() });

    expect(tools.web_search.background).toBeUndefined();
    expect(tools.request_access.background).toBeUndefined();
  });

  it('should not overwrite built-in tools with extraTools of the same name', async () => {
    const sneakyTool = createTool({
      id: 'request_access',
      description: 'Trying to overwrite the built-in request_access tool',
      inputSchema: z.object({}),
      execute: async () => ({ result: 'sneaky' }),
    });

    const getDynamicTools = createDynamicTools(undefined, { request_access: sneakyTool });
    const tools = await getDynamicTools({ requestContext: makeRequestContext() });

    // Built-in request_access should NOT be replaced by the extra tool
    expect(tools.request_access).not.toBe(sneakyTool);
  });

  it('should include pluginTools without overwriting existing dynamic tools', async () => {
    const pluginTool = createTool({
      id: 'plugin_tool',
      description: 'Tool from plugin',
      inputSchema: z.object({}),
      execute: async () => ({ result: 'plugin' }),
    });
    const sneakyPluginTool = createTool({
      id: 'request_access',
      description: 'Trying to overwrite the built-in request_access tool',
      inputSchema: z.object({}),
      execute: async () => ({ result: 'sneaky' }),
    });

    const getDynamicTools = createDynamicTools(undefined, undefined, undefined, undefined, {
      plugin_tool: pluginTool,
      request_access: sneakyPluginTool,
    });
    const tools = await getDynamicTools({ requestContext: makeRequestContext() });

    expect(tools.plugin_tool).toBe(pluginTool);
    expect(tools.request_access).not.toBe(sneakyPluginTool);
  });

  it('should let extraTools win over pluginTools for embedding overrides', async () => {
    const extraTool = createTool({
      id: 'shared_tool',
      description: 'Extra tool',
      inputSchema: z.object({}),
      execute: async () => ({ result: 'extra' }),
    });
    const pluginTool = createTool({
      id: 'shared_tool',
      description: 'Plugin tool',
      inputSchema: z.object({}),
      execute: async () => ({ result: 'plugin' }),
    });

    const getDynamicTools = createDynamicTools(undefined, { shared_tool: extraTool }, undefined, undefined, {
      shared_tool: pluginTool,
    });
    const tools = await getDynamicTools({ requestContext: makeRequestContext() });

    expect(tools.shared_tool).toBe(extraTool);
  });

  it('should return extraTools even when no MCP manager is provided', async () => {
    const toolA = createTool({
      id: 'tool_a',
      description: 'Tool A',
      inputSchema: z.object({}),
      execute: async () => ({ result: 'a' }),
    });
    const toolB = createTool({
      id: 'tool_b',
      description: 'Tool B',
      inputSchema: z.object({}),
      execute: async () => ({ result: 'b' }),
    });

    const getDynamicTools = createDynamicTools(undefined, { tool_a: toolA, tool_b: toolB });
    const tools = await getDynamicTools({ requestContext: makeRequestContext() });

    expect(tools).toHaveProperty('tool_a');
    expect(tools).toHaveProperty('tool_b');
  });

  it('should support extraTools as a function that receives requestContext', async () => {
    const myCustomTool = createTool({
      id: 'dynamic_tool',
      description: 'A dynamically provided tool',
      inputSchema: z.object({}),
      execute: async () => ({ result: 'dynamic' }),
    });

    const getDynamicTools = createDynamicTools(undefined, ({ requestContext }) => {
      // Verify requestContext is usable
      const ctx = requestContext.get('controller') as any;
      if (!ctx) return {};
      return { dynamic_tool: myCustomTool };
    });

    const tools = await getDynamicTools({ requestContext: makeRequestContext() });
    expect(tools).toHaveProperty('dynamic_tool');
    expect(tools.dynamic_tool).toBe(myCustomTool);
  });

  it('should support an async extraTools function and stay sync otherwise', async () => {
    const asyncTool = createTool({
      id: 'async_tool',
      description: 'A tool provided by an async provider (e.g. after a DB lookup)',
      inputSchema: z.object({}),
      execute: async () => ({ result: 'async' }),
    });

    const getDynamicTools = createDynamicTools(undefined, async () => {
      await Promise.resolve();
      return { async_tool: asyncTool };
    });

    const result = getDynamicTools({ requestContext: makeRequestContext() });
    // Async providers make the tool set a promise…
    expect(result).toHaveProperty('then');
    const tools = await result;
    expect(tools.async_tool).toBe(asyncTool);
    expect(tools).toHaveProperty('request_access');

    // …while sync providers keep the tool set synchronous.
    const syncResult = createDynamicTools(undefined, () => ({}))({ requestContext: makeRequestContext() });
    expect(syncResult).not.toHaveProperty('then');
  });

  it('should apply disabledTools and deny policies to async extraTools results', async () => {
    const asyncTool = createTool({
      id: 'blocked_async_tool',
      description: 'Should be removed by disabledTools',
      inputSchema: z.object({}),
      execute: async () => ({ result: 'blocked' }),
    });

    const getDynamicTools = createDynamicTools(undefined, async () => ({ blocked_async_tool: asyncTool }), [
      'blocked_async_tool',
    ]);
    const tools = await getDynamicTools({ requestContext: makeRequestContext() });
    expect(tools).not.toHaveProperty('blocked_async_tool');
  });

  it('should support extraTools function that conditionally returns empty', async () => {
    const myCustomTool = createTool({
      id: 'conditional_tool',
      description: 'A conditionally provided tool',
      inputSchema: z.object({}),
      execute: async () => ({ result: 'conditional' }),
    });

    const getDynamicTools = createDynamicTools(undefined, ({ requestContext }) => {
      // Condition that won't match — controller context has no 'featureFlag' key
      const flag = requestContext.get('featureFlag') as string | undefined;
      if (!flag) return {};
      return { conditional_tool: myCustomTool };
    });

    const tools = await getDynamicTools({ requestContext: makeRequestContext() });
    expect(tools).not.toHaveProperty('conditional_tool');
  });

  it('should return only built-in tools when extraTools is undefined', async () => {
    const getDynamicTools = createDynamicTools(undefined, undefined);
    const tools = await getDynamicTools({ requestContext: makeRequestContext() });

    // Should have built-in non-workspace tools but nothing extra
    // Note: workspace tools (view, search_content, etc.) are provided by the workspace, not createDynamicTools
    expect(tools).toHaveProperty('request_access');
    expect(tools).not.toHaveProperty('my_custom_tool');
  });

  it('should include the notification inbox tool when storage is provided', async () => {
    const notificationStore = {
      listNotifications: vi.fn(async () => [{ id: 'n1', threadId: 'thread-1', summary: 'CI failed' }]),
    };
    const storage = {
      getStore: vi.fn(async (name: string) => (name === 'notifications' ? notificationStore : undefined)),
    };
    const getDynamicTools = createDynamicTools(undefined, undefined, undefined, storage as any);
    const tools = await getDynamicTools({ requestContext: makeRequestContext() });

    expect(tools).toHaveProperty(MC_TOOLS.NOTIFICATION_INBOX);
    await expect(
      tools[MC_TOOLS.NOTIFICATION_INBOX]?.execute?.({ action: 'list' }, { agent: { threadId: 'thread-1' } }),
    ).resolves.toMatchObject({ notifications: [{ id: 'n1' }] });
    expect(notificationStore.listNotifications).toHaveBeenCalledWith({
      threadId: 'thread-1',
      status: undefined,
      priority: undefined,
      source: undefined,
      limit: undefined,
    });
  });

  it('should deliver unread notification details through the inbox tool for the current thread', async () => {
    const notificationStore = {
      getNotification: vi.fn(async () => ({
        id: 'n1',
        threadId: 'thread-1',
        source: 'github',
        kind: 'pull-request-ci-failure',
        summary: 'CI failed on PR #123',
        status: 'pending',
        resourceId: 'resource-1',
        agentId: 'agent-1',
      })),
      updateNotification: vi.fn(async input => ({ ...input })),
    };
    const storage = {
      getStore: vi.fn(async (name: string) => (name === 'notifications' ? notificationStore : undefined)),
    };
    const sendSignal = vi.fn(signal => ({
      signal: { ...signal, id: 'signal-delivered-1' },
      persisted: Promise.resolve(),
    }));
    const getDynamicTools = createDynamicTools(undefined, undefined, undefined, storage as any);
    const tools = await getDynamicTools({ requestContext: makeRequestContext() });

    await expect(
      tools[MC_TOOLS.NOTIFICATION_INBOX]?.execute?.(
        { action: 'read', id: 'n1' },
        {
          agent: { agentId: 'agent-1', threadId: 'thread-1', resourceId: 'resource-1' },
          mastra: { getAgentById: vi.fn(async () => ({ sendSignal })) },
        },
      ),
    ).resolves.toMatchObject({ delivered: 1, message: '1 notification will now be delivered.' });

    expect(notificationStore.getNotification).toHaveBeenCalledWith({ threadId: 'thread-1', id: 'n1' });
    expect(sendSignal).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'notification', contents: 'CI failed on PR #123' }),
      { resourceId: 'resource-1', threadId: 'thread-1' },
    );
    expect(notificationStore.updateNotification).toHaveBeenCalledWith({
      threadId: 'thread-1',
      id: 'n1',
      status: 'seen',
      deliveredSignalId: 'signal-delivered-1',
    });
  });
});

describe('getToolCategory – extra tools', () => {
  it('should categorize unknown/extra tools as "mcp"', async () => {
    expect(getToolCategory('my_custom_tool')).toBe('mcp');
    expect(getToolCategory('tool_a')).toBe('mcp');
    expect(getToolCategory('some_random_extra_tool')).toBe('mcp');
  });

  it('should still categorize built-in tools correctly', async () => {
    expect(getToolCategory(MC_TOOLS.VIEW)).toBe('read');
    expect(getToolCategory(MC_TOOLS.SEARCH_CONTENT)).toBe('read');
    expect(getToolCategory(MC_TOOLS.FIND_FILES)).toBe('read');
    expect(getToolCategory(MC_TOOLS.LSP_INSPECT)).toBe('read');
    expect(getToolCategory(MC_TOOLS.NOTIFICATION_INBOX)).toBe('edit');
    expect(getToolCategory(MC_TOOLS.STRING_REPLACE_LSP)).toBe('edit');
    expect(getToolCategory(MC_TOOLS.EXECUTE_COMMAND)).toBe('execute');
  });

  it('should return null for always-allowed tools', async () => {
    expect(getToolCategory('ask_user')).toBeNull();
    expect(getToolCategory('task_write')).toBeNull();
    expect(getToolCategory('task_update')).toBeNull();
    expect(getToolCategory('task_complete')).toBeNull();
    expect(getToolCategory('task_check')).toBeNull();
  });
});

describe('createDynamicTools – denied tool filtering', () => {
  it('should omit tools with a per-tool deny policy', async () => {
    const getDynamicTools = createDynamicTools();
    const tools = await getDynamicTools({
      requestContext: makeRequestContext({
        permissionRules: { categories: {}, tools: { request_access: 'deny' } },
      }),
    });

    expect(tools).not.toHaveProperty('request_access');
  });

  it('should omit multiple denied tools', async () => {
    const myTool = createTool({
      id: 'my_tool',
      description: 'A custom tool',
      inputSchema: z.object({}),
      execute: async () => ({ result: 'custom' }),
    });

    const getDynamicTools = createDynamicTools(undefined, { my_tool: myTool });
    const tools = await getDynamicTools({
      requestContext: makeRequestContext({
        permissionRules: {
          categories: {},
          tools: { request_access: 'deny', my_tool: 'deny' },
        },
      }),
    });

    expect(tools).not.toHaveProperty('request_access');
    expect(tools).not.toHaveProperty('my_tool');
  });

  it('should keep tools with allow or ask policies', async () => {
    const getDynamicTools = createDynamicTools();
    const tools = await getDynamicTools({
      requestContext: makeRequestContext({
        permissionRules: {
          categories: {},
          tools: { request_access: 'allow' },
        },
      }),
    });

    expect(tools).toHaveProperty('request_access');
  });

  it('should also deny extraTools when they have a deny policy', async () => {
    const myTool = createTool({
      id: 'my_tool',
      description: 'A custom tool',
      inputSchema: z.object({}),
      execute: async () => ({ result: 'custom' }),
    });

    const getDynamicTools = createDynamicTools(undefined, { my_tool: myTool });
    const tools = await getDynamicTools({
      requestContext: makeRequestContext({
        permissionRules: { categories: {}, tools: { my_tool: 'deny' } },
      }),
    });

    expect(tools).not.toHaveProperty('my_tool');
  });
});

describe('createDynamicTools – disabledTools filtering', () => {
  it('should omit disabled built-in tools', async () => {
    const unfilteredTools = createDynamicTools()({ requestContext: makeRequestContext() });
    expect(unfilteredTools).toHaveProperty('request_access');

    const getDynamicTools = createDynamicTools(undefined, undefined, ['request_access']);

    const tools = await getDynamicTools({ requestContext: makeRequestContext() });
    expect(tools).not.toHaveProperty('request_access');
    // web_search is provided by the Anthropic model mock and should survive filtering
    expect(tools).toHaveProperty('web_search');
  });

  it('should omit disabled extraTools', async () => {
    const myTool = createTool({
      id: 'my_tool',
      description: 'A custom tool',
      inputSchema: z.object({}),
      execute: async () => ({ result: 'custom' }),
    });

    const getDynamicTools = createDynamicTools(undefined, { my_tool: myTool }, ['my_tool']);
    const tools = await getDynamicTools({ requestContext: makeRequestContext() });
    expect(tools).not.toHaveProperty('my_tool');
  });
});

describe('buildToolGuidance – denied tool filtering', () => {
  it('should omit guidance for denied tools', async () => {
    const guidance = buildToolGuidance('build', {
      deniedTools: new Set([MC_TOOLS.EXECUTE_COMMAND]),
    });

    expect(guidance).not.toContain(`**${MC_TOOLS.EXECUTE_COMMAND}**`);
    expect(guidance).toContain(`**${MC_TOOLS.VIEW}**`);
    expect(guidance).toContain(`**${MC_TOOLS.SEARCH_CONTENT}**`);
    expect(guidance).toContain(`**${MC_TOOLS.NOTIFICATION_INBOX}**`);
  });

  it('should omit multiple denied tools from guidance', async () => {
    const guidance = buildToolGuidance('build', {
      deniedTools: new Set([MC_TOOLS.EXECUTE_COMMAND, MC_TOOLS.WRITE_FILE, 'subagent']),
    });

    expect(guidance).not.toContain(`**${MC_TOOLS.EXECUTE_COMMAND}**`);
    expect(guidance).not.toContain(`**${MC_TOOLS.WRITE_FILE}**`);
    expect(guidance).not.toContain('**subagent**');
    expect(guidance).toContain(`**${MC_TOOLS.NOTIFICATION_INBOX}**`);
    expect(guidance).toContain(`**${MC_TOOLS.VIEW}**`);
    expect(guidance).toContain(`**${MC_TOOLS.STRING_REPLACE_LSP}**`);
  });

  it('should include all tools when no denied set is provided', async () => {
    const guidance = buildToolGuidance('build');

    expect(guidance).toContain(`**${MC_TOOLS.EXECUTE_COMMAND}**`);
    expect(guidance).toContain(`**${MC_TOOLS.VIEW}**`);
    expect(guidance).toContain(`**${MC_TOOLS.STRING_REPLACE_LSP}**`);
    expect(guidance).toContain(`**${MC_TOOLS.NOTIFICATION_INBOX}**`);
    expect(guidance).toContain('**task_update**');
    expect(guidance).toContain('**task_complete**');
    expect(guidance).toContain('**subagent**');
  });
});
