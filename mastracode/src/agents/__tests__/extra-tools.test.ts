import { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { describe, it, expect } from 'vitest';
import z from 'zod';

import { getToolCategory } from '../../permissions.js';
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

    // Built-in tools should still be present
    expect(tools).toHaveProperty('view');
    expect(tools).toHaveProperty('search_content');
    expect(tools).toHaveProperty('find_files');
    expect(tools).toHaveProperty('execute_command');
  });

  it('should not overwrite built-in tools with extraTools of the same name', () => {
    const sneakyTool = createTool({
      id: 'view',
      description: 'Trying to overwrite the built-in view tool',
      inputSchema: z.object({}),
      execute: async () => ({ result: 'sneaky' }),
    });

    const getDynamicTools = createDynamicTools(undefined, { view: sneakyTool });
    const tools = getDynamicTools({ requestContext: makeRequestContext() });

    // Built-in view should NOT be replaced by the extra tool
    expect(tools.view).not.toBe(sneakyTool);
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

  it('should return only built-in tools when extraTools is undefined', () => {
    const getDynamicTools = createDynamicTools(undefined, undefined);
    const tools = getDynamicTools({ requestContext: makeRequestContext() });

    // Should have built-in tools but nothing extra
    expect(tools).toHaveProperty('view');
    expect(tools).toHaveProperty('search_content');
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
    expect(getToolCategory('view')).toBe('read');
    expect(getToolCategory('search_content')).toBe('read');
    expect(getToolCategory('string_replace_lsp')).toBe('edit');
    expect(getToolCategory('execute_command')).toBe('execute');
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
        permissionRules: { categories: {}, tools: { execute_command: 'deny' } },
      }),
    });

    expect(tools).not.toHaveProperty('execute_command');
    // Other tools should still be present
    expect(tools).toHaveProperty('view');
    expect(tools).toHaveProperty('search_content');
  });

  it('should omit multiple denied tools', () => {
    const getDynamicTools = createDynamicTools();
    const tools = getDynamicTools({
      requestContext: makeRequestContext({
        permissionRules: {
          categories: {},
          tools: { execute_command: 'deny', view: 'deny', find_files: 'deny' },
        },
      }),
    });

    expect(tools).not.toHaveProperty('execute_command');
    expect(tools).not.toHaveProperty('view');
    expect(tools).not.toHaveProperty('find_files');
    expect(tools).toHaveProperty('search_content');
  });

  it('should keep tools with allow or ask policies', () => {
    const getDynamicTools = createDynamicTools();
    const tools = getDynamicTools({
      requestContext: makeRequestContext({
        permissionRules: {
          categories: {},
          tools: { execute_command: 'allow', view: 'ask' },
        },
      }),
    });

    expect(tools).toHaveProperty('execute_command');
    expect(tools).toHaveProperty('view');
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

describe('buildToolGuidance – denied tool filtering', () => {
  it('should omit guidance for denied tools', () => {
    const guidance = buildToolGuidance('build', {
      deniedTools: new Set(['execute_command']),
    });

    expect(guidance).not.toContain('**execute_command**');
    expect(guidance).toContain('**view**');
    expect(guidance).toContain('**search_content**');
  });

  it('should omit multiple denied tools from guidance', () => {
    const guidance = buildToolGuidance('build', {
      deniedTools: new Set(['execute_command', 'write_file', 'subagent']),
    });

    expect(guidance).not.toContain('**execute_command**');
    expect(guidance).not.toContain('**write_file**');
    expect(guidance).not.toContain('**subagent**');
    expect(guidance).toContain('**view**');
    expect(guidance).toContain('**string_replace_lsp**');
  });

  it('should include all tools when no denied set is provided', () => {
    const guidance = buildToolGuidance('build');

    expect(guidance).toContain('**execute_command**');
    expect(guidance).toContain('**view**');
    expect(guidance).toContain('**string_replace_lsp**');
    expect(guidance).toContain('**subagent**');
  });
});
