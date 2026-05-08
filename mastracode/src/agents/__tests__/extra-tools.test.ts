import { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { describe, it, expect } from 'vitest';
import z from 'zod';

import { getToolCategory } from '../../permissions.js';
import { MC_TOOLS } from '../../tool-names.js';
import { buildToolGuidance } from '../prompts/tool-guidance.js';
import { createDynamicTools } from '../tools.js';

// Minimal mock of HarnessRequestContext shape that createDynamicTools reads
function makeRequestContext(
  overrides: {
    modeId?: string;
    projectPath?: string;
    permissionRules?: { categories?: Record<string, string>; tools?: Record<string, string> };
  } = {},
) {
  const ctx = new RequestContext();
  ctx.set('harness', {
    modeId: overrides.modeId ?? 'build',
    getState: () => ({
      projectPath: overrides.projectPath ?? '/tmp/test-project',
      currentModelId: 'anthropic/claude-opus-4-6',
      permissionRules: overrides.permissionRules ?? { categories: {}, tools: {} },
    }),
  });
  return ctx;
}

describe('createDynamicTools – extraTools', () => {
  it('should include extraTools in the returned tool set', () => {
    const myCustomTool = createTool({
      id: 'my_custom_tool',
      description: 'A custom tool provided via extraTools',
      inputSchema: z.object({ query: z.string() }),
      execute: async () => ({ result: 'custom' }),
    });

    const getDynamicTools = createDynamicTools(undefined, { my_custom_tool: myCustomTool });
    const tools = getDynamicTools({ requestContext: makeRequestContext() });

    // The extra tool must be present alongside the built-in tools
    expect(tools).toHaveProperty('my_custom_tool');
    expect(tools.my_custom_tool).toBe(myCustomTool);

    // Built-in non-workspace tools should still be present
    expect(tools).toHaveProperty('request_access');
  });

  it('should not overwrite built-in tools with extraTools of the same name', () => {
    const sneakyTool = createTool({
      id: 'request_access',
      description: 'Trying to overwrite the built-in request_access tool',
      inputSchema: z.object({}),
      execute: async () => ({ result: 'sneaky' }),
    });

    const getDynamicTools = createDynamicTools(undefined, { request_access: sneakyTool });
    const tools = getDynamicTools({ requestContext: makeRequestContext() });

    // Built-in request_access should NOT be replaced by the extra tool
    expect(tools.request_access).not.toBe(sneakyTool);
  });

  it('should return extraTools even when no MCP manager is provided', () => {
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
    const tools = getDynamicTools({ requestContext: makeRequestContext() });

    expect(tools).toHaveProperty('tool_a');
    expect(tools).toHaveProperty('tool_b');
  });

  it('should support extraTools as a function that receives requestContext', () => {
    const myCustomTool = createTool({
      id: 'dynamic_tool',
      description: 'A dynamically provided tool',
      inputSchema: z.object({}),
      execute: async () => ({ result: 'dynamic' }),
    });

    const getDynamicTools = createDynamicTools(undefined, ({ requestContext }) => {
      // Verify requestContext is usable
      const ctx = requestContext.get('harness') as any;
      if (!ctx) return {};
      return { dynamic_tool: myCustomTool };
    });

    const tools = getDynamicTools({ requestContext: makeRequestContext() });
    expect(tools).toHaveProperty('dynamic_tool');
    expect(tools.dynamic_tool).toBe(myCustomTool);
  });

  it('should support extraTools function that conditionally returns empty', () => {
    const myCustomTool = createTool({
      id: 'conditional_tool',
      description: 'A conditionally provided tool',
      inputSchema: z.object({}),
      execute: async () => ({ result: 'conditional' }),
    });

    const getDynamicTools = createDynamicTools(undefined, ({ requestContext }) => {
      // Condition that won't match — harness context has no 'featureFlag' key
      const flag = requestContext.get('featureFlag') as string | undefined;
      if (!flag) return {};
      return { conditional_tool: myCustomTool };
    });

    const tools = getDynamicTools({ requestContext: makeRequestContext() });
    expect(tools).not.toHaveProperty('conditional_tool');
  });

  it('should return only built-in tools when extraTools is undefined', () => {
    const getDynamicTools = createDynamicTools(undefined, undefined);
    const tools = getDynamicTools({ requestContext: makeRequestContext() });

    // Should have built-in non-workspace tools but nothing extra
    // Note: workspace tools (view, search_content, etc.) are provided by the workspace, not createDynamicTools
    expect(tools).toHaveProperty('request_access');
    expect(tools).not.toHaveProperty('my_custom_tool');
  });
});

describe('getToolCategory – extra tools', () => {
  it('should categorize unknown/extra tools as "mcp"', () => {
    expect(getToolCategory('my_custom_tool')).toBe('mcp');
    expect(getToolCategory('tool_a')).toBe('mcp');
    expect(getToolCategory('some_random_extra_tool')).toBe('mcp');
  });

  it('should still categorize built-in tools correctly', () => {
    expect(getToolCategory(MC_TOOLS.VIEW)).toBe('read');
    expect(getToolCategory(MC_TOOLS.SEARCH_CONTENT)).toBe('read');
    expect(getToolCategory(MC_TOOLS.FIND_FILES)).toBe('read');
    expect(getToolCategory(MC_TOOLS.LSP_INSPECT)).toBe('read');
    expect(getToolCategory(MC_TOOLS.STRING_REPLACE_LSP)).toBe('edit');
    expect(getToolCategory(MC_TOOLS.EXECUTE_COMMAND)).toBe('execute');
  });

  it('should return null for always-allowed tools', () => {
    expect(getToolCategory('ask_user')).toBeNull();
    expect(getToolCategory('task_write')).toBeNull();
    expect(getToolCategory('task_check')).toBeNull();
  });
});

describe('createDynamicTools – denied tool filtering', () => {
  it('should omit tools with a per-tool deny policy', () => {
    const getDynamicTools = createDynamicTools();
    const tools = getDynamicTools({
      requestContext: makeRequestContext({
        permissionRules: { categories: {}, tools: { request_access: 'deny' } },
      }),
    });

    expect(tools).not.toHaveProperty('request_access');
  });

  it('should omit multiple denied tools', () => {
    const myTool = createTool({
      id: 'my_tool',
      description: 'A custom tool',
      inputSchema: z.object({}),
      execute: async () => ({ result: 'custom' }),
    });

    const getDynamicTools = createDynamicTools(undefined, { my_tool: myTool });
    const tools = getDynamicTools({
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

  it('should keep tools with allow or ask policies', () => {
    const getDynamicTools = createDynamicTools();
    const tools = getDynamicTools({
      requestContext: makeRequestContext({
        permissionRules: {
          categories: {},
          tools: { request_access: 'allow' },
        },
      }),
    });

    expect(tools).toHaveProperty('request_access');
  });

  it('should also deny extraTools when they have a deny policy', () => {
    const myTool = createTool({
      id: 'my_tool',
      description: 'A custom tool',
      inputSchema: z.object({}),
      execute: async () => ({ result: 'custom' }),
    });

    const getDynamicTools = createDynamicTools(undefined, { my_tool: myTool });
    const tools = getDynamicTools({
      requestContext: makeRequestContext({
        permissionRules: { categories: {}, tools: { my_tool: 'deny' } },
      }),
    });

    expect(tools).not.toHaveProperty('my_tool');
  });
});

describe('createDynamicTools – disabledTools filtering', () => {
  it('should omit disabled built-in tools', () => {
    const getDynamicTools = createDynamicTools(undefined, undefined, undefined, [
      'request_sandbox_access',
      'execute_command',
    ]);

    const tools = getDynamicTools({ requestContext: makeRequestContext() });
    expect(tools).not.toHaveProperty('request_sandbox_access');
    expect(tools).not.toHaveProperty('execute_command');
    // web_search is provided by the Anthropic model mock and should survive filtering
    expect(tools).toHaveProperty('web_search');
  });

  it('should omit disabled extraTools', () => {
    const myTool = createTool({
      id: 'my_tool',
      description: 'A custom tool',
      inputSchema: z.object({}),
      execute: async () => ({ result: 'custom' }),
    });

    const getDynamicTools = createDynamicTools(undefined, { my_tool: myTool }, undefined, ['my_tool']);
    const tools = getDynamicTools({ requestContext: makeRequestContext() });
    expect(tools).not.toHaveProperty('my_tool');
  });
});

describe('buildToolGuidance – denied tool filtering', () => {
  it('should omit guidance for denied tools', () => {
    const guidance = buildToolGuidance('build', {
      deniedTools: new Set([MC_TOOLS.EXECUTE_COMMAND]),
    });

    expect(guidance).not.toContain(`**${MC_TOOLS.EXECUTE_COMMAND}**`);
    expect(guidance).toContain(`**${MC_TOOLS.VIEW}**`);
    expect(guidance).toContain(`**${MC_TOOLS.SEARCH_CONTENT}**`);
  });

  it('should omit multiple denied tools from guidance', () => {
    const guidance = buildToolGuidance('build', {
      deniedTools: new Set([MC_TOOLS.EXECUTE_COMMAND, MC_TOOLS.WRITE_FILE, 'subagent']),
    });

    expect(guidance).not.toContain(`**${MC_TOOLS.EXECUTE_COMMAND}**`);
    expect(guidance).not.toContain(`**${MC_TOOLS.WRITE_FILE}**`);
    expect(guidance).not.toContain('**subagent**');
    expect(guidance).toContain(`**${MC_TOOLS.VIEW}**`);
    expect(guidance).toContain(`**${MC_TOOLS.STRING_REPLACE_LSP}**`);
  });

  it('should include all tools when no denied set is provided', () => {
    const guidance = buildToolGuidance('build');

    expect(guidance).toContain(`**${MC_TOOLS.EXECUTE_COMMAND}**`);
    expect(guidance).toContain(`**${MC_TOOLS.VIEW}**`);
    expect(guidance).toContain(`**${MC_TOOLS.STRING_REPLACE_LSP}**`);
    expect(guidance).toContain('**subagent**');
  });
});
