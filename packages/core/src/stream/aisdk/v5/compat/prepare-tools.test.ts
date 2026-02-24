import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { createTool } from '../../../../tools/tool';
import { prepareToolsAndToolChoice } from './prepare-tools';

describe('prepareToolsAndToolChoice', () => {
  describe('isProviderTool detection', () => {
    it('should detect provider tools by type: provider-defined', () => {
      // Mock a provider tool like openai.tools.webSearch() returns
      // Provider tools have type: 'provider-defined' set by AI SDK
      const providerTool = {
        id: 'openai.web_search',
        type: 'provider-defined',
        args: { search_context_size: 'medium' },
      };

      const result = prepareToolsAndToolChoice({
        tools: { search: providerTool as any },
        toolChoice: undefined,
        activeTools: undefined,
        targetVersion: 'v3',
      });

      expect(result.tools).toBeDefined();
      expect(result.tools).toHaveLength(1);
      expect(result.tools![0]).toMatchObject({
        type: 'provider',
        name: 'web_search',
        id: 'openai.web_search',
        args: { search_context_size: 'medium' },
      });
    });

    it('should use provider-defined type for v2 target version', () => {
      const providerTool = {
        id: 'openai.web_search',
        type: 'provider-defined',
        args: {},
      };

      const result = prepareToolsAndToolChoice({
        tools: { search: providerTool as any },
        toolChoice: undefined,
        activeTools: undefined,
        targetVersion: 'v2',
      });

      expect(result.tools).toBeDefined();
      expect(result.tools![0]).toMatchObject({
        type: 'provider-defined',
        name: 'web_search',
        id: 'openai.web_search',
      });
    });

    it('should handle nested provider tool names correctly', () => {
      // Tool with nested name like 'provider.category.tool_name'
      const providerTool = {
        id: 'anthropic.tools.web_search_20250305',
        type: 'provider-defined',
        args: {},
      };

      const result = prepareToolsAndToolChoice({
        tools: { search: providerTool as any },
        toolChoice: undefined,
        activeTools: undefined,
        targetVersion: 'v3',
      });

      expect(result.tools![0]).toMatchObject({
        type: 'provider',
        name: 'tools.web_search_20250305',
        id: 'anthropic.tools.web_search_20250305',
      });
    });

    it('should detect AI SDK v6 provider tools by type: provider', () => {
      // AI SDK v6 uses type: 'provider' instead of 'provider-defined'
      const v6ProviderTool = {
        id: 'openai.web_search',
        type: 'provider',
        args: { search_context_size: 'medium' },
      };

      const result = prepareToolsAndToolChoice({
        tools: { search: v6ProviderTool as any },
        toolChoice: undefined,
        activeTools: undefined,
        targetVersion: 'v3',
      });

      expect(result.tools).toBeDefined();
      expect(result.tools).toHaveLength(1);
      expect(result.tools![0]).toMatchObject({
        type: 'provider',
        name: 'web_search',
        id: 'openai.web_search',
        args: { search_context_size: 'medium' },
      });
    });

    it('should detect real AI SDK v6 provider tools', async () => {
      // Import the actual AI SDK v6 openai package to test real provider tools
      const { openai: openaiV6 } = await import('@ai-sdk/openai-v6');
      const tool = openaiV6.tools.webSearch({});

      // Verify the actual tool structure
      expect(tool.type).toBe('provider');
      expect((tool as any).id).toBe('openai.web_search');

      const result = prepareToolsAndToolChoice({
        tools: { search: tool } as any,
        toolChoice: undefined,
        activeTools: undefined,
        targetVersion: 'v3',
      });

      expect(result.tools).toHaveLength(1);
      expect(result.tools![0]).toMatchObject({
        type: 'provider',
        name: 'web_search',
        id: 'openai.web_search',
      });
    });
  });

  describe('regular function tools', () => {
    it('should convert Mastra tools to function tools', () => {
      const mastraTool = createTool({
        id: 'test-tool',
        description: 'A test tool',
        inputSchema: z.object({
          query: z.string().describe('The search query'),
        }),
        execute: async ({ query }) => `Result for: ${query}`,
      });

      const result = prepareToolsAndToolChoice({
        tools: { testTool: mastraTool as any },
        toolChoice: undefined,
        activeTools: undefined,
        targetVersion: 'v3',
      });

      expect(result.tools).toBeDefined();
      expect(result.tools).toHaveLength(1);
      expect(result.tools![0]).toMatchObject({
        type: 'function',
        name: 'testTool',
        description: 'A test tool',
      });
    });

    it('should not treat regular tools with no id as provider tools', () => {
      const regularTool = createTool({
        id: 'regular-tool',
        description: 'A regular tool',
        inputSchema: z.object({
          input: z.string(),
        }),
        execute: async ({ input }) => input,
      });

      const result = prepareToolsAndToolChoice({
        tools: { regular: regularTool as any },
        toolChoice: undefined,
        activeTools: undefined,
        targetVersion: 'v3',
      });

      expect(result.tools![0]).toMatchObject({
        type: 'function',
        name: 'regular',
      });
    });

    it('should not treat user tools with dots in their id as provider tools', () => {
      // User-defined tools with dots (like 'fs.readdir' or 'echo.tool') should NOT
      // be treated as provider tools - they have type: 'function', not 'provider-defined'
      const toolWithDots = createTool({
        id: 'echo.tool',
        description: 'A tool that echoes input',
        inputSchema: z.object({
          text: z.string(),
        }),
        execute: async ({ text }) => text,
      });

      const result = prepareToolsAndToolChoice({
        tools: { 'echo.tool': toolWithDots as any },
        toolChoice: undefined,
        activeTools: undefined,
        targetVersion: 'v3',
      });

      expect(result.tools).toBeDefined();
      expect(result.tools).toHaveLength(1);
      // Should be a function tool, NOT a provider tool
      expect(result.tools![0]).toMatchObject({
        type: 'function',
        name: 'echo.tool', // Name should be preserved (key is used, not id)
        description: 'A tool that echoes input',
      });
      // Should NOT have provider tool properties
      expect(result.tools![0]).not.toHaveProperty('args');
    });

    it('should not treat tools with type: function as provider tools even with dot in id', () => {
      // Only tools with type: 'provider-defined' should be treated as provider tools
      // Tools with type: 'function' (or no type) are regular function tools
      const functionToolWithDot = createTool({
        id: 'openai.custom_tool', // Has provider-like prefix but type is 'function'
        description: 'A custom function tool',
        inputSchema: z.object({}),
        execute: async () => 'result',
      });

      const result = prepareToolsAndToolChoice({
        tools: { customTool: functionToolWithDot as any },
        toolChoice: undefined,
        activeTools: undefined,
        targetVersion: 'v3',
      });

      expect(result.tools).toBeDefined();
      expect(result.tools).toHaveLength(1);
      // Should be treated as a function tool since type is not 'provider-defined'
      expect(result.tools![0]).toMatchObject({
        type: 'function',
        name: 'customTool',
      });
    });
  });

  describe('activeTools filtering', () => {
    it('should filter tools based on activeTools array', () => {
      const tool1 = {
        id: 'openai.tool1',
        type: 'provider-defined',
        args: {},
      };
      const tool2 = {
        id: 'openai.tool2',
        type: 'provider-defined',
        args: {},
      };

      const result = prepareToolsAndToolChoice({
        tools: { tool1: tool1 as any, tool2: tool2 as any },
        toolChoice: undefined,
        activeTools: ['tool1'],
        targetVersion: 'v3',
      });

      expect(result.tools).toHaveLength(1);
      expect(result.tools![0]).toMatchObject({
        name: 'tool1',
      });
    });
  });

  describe('toolChoice handling', () => {
    it('should default to auto when toolChoice is undefined but tools exist', () => {
      const providerTool = { id: 'openai.web_search', type: 'provider-defined', args: {} };

      const result = prepareToolsAndToolChoice({
        tools: { search: providerTool as any },
        toolChoice: undefined,
        activeTools: undefined,
      });

      expect(result.toolChoice).toEqual({ type: 'auto' });
    });

    it('should handle string toolChoice values', () => {
      const providerTool = { id: 'openai.web_search', type: 'provider-defined', args: {} };

      const result = prepareToolsAndToolChoice({
        tools: { search: providerTool as any },
        toolChoice: 'required',
        activeTools: undefined,
      });

      expect(result.toolChoice).toEqual({ type: 'required' });
    });

    it('should handle specific tool choice', () => {
      const providerTool = { id: 'openai.web_search', type: 'provider-defined', args: {} };

      const result = prepareToolsAndToolChoice({
        tools: { search: providerTool as any },
        toolChoice: { toolName: 'search' } as any,
        activeTools: undefined,
      });

      expect(result.toolChoice).toEqual({ type: 'tool', toolName: 'search' });
    });
  });

  describe('empty tools', () => {
    it('should return undefined for empty tools object', () => {
      const result = prepareToolsAndToolChoice({
        tools: {},
        toolChoice: undefined,
        activeTools: undefined,
      });

      expect(result.tools).toBeUndefined();
      expect(result.toolChoice).toBeUndefined();
    });

    it('should return undefined for undefined tools', () => {
      const result = prepareToolsAndToolChoice({
        tools: undefined,
        toolChoice: undefined,
        activeTools: undefined,
      });

      expect(result.tools).toBeUndefined();
      expect(result.toolChoice).toBeUndefined();
    });

    it('should preserve toolChoice "none" when tools are empty', () => {
      const result = prepareToolsAndToolChoice({
        tools: {},
        toolChoice: 'none',
        activeTools: undefined,
      });

      expect(result.tools).toBeUndefined();
      expect(result.toolChoice).toEqual({ type: 'none' });
    });

    it('should preserve toolChoice "none" when tools are undefined', () => {
      const result = prepareToolsAndToolChoice({
        tools: undefined,
        toolChoice: 'none',
        activeTools: undefined,
      });

      expect(result.tools).toBeUndefined();
      expect(result.toolChoice).toEqual({ type: 'none' });
    });
  });

  describe('agent-as-tools schema serialization (#13324)', () => {
    it('should produce valid JSON Schema with type keys for all properties including resumeData: z.any()', () => {
      // Simulate what CoreToolBuilder does: inject resumeData and suspendedToolRunId
      // into agent tool schemas. The resumeData field uses z.any() which serializes
      // to {} (no type key) via Zod v4's toJSONSchema. OpenAI rejects schemas
      // without a type key on every property.
      const agentTool = createTool({
        id: 'agent-subAgent',
        description: 'A sub-agent tool',
        inputSchema: z.object({
          prompt: z.string().describe('The prompt for the agent'),
          suspendedToolRunId: z.string().describe('The runId of the suspended tool').nullable().optional().default(''),
          resumeData: z
            .any()
            .describe('The resumeData object created from the resumeSchema of suspended tool')
            .optional(),
        }),
        execute: async () => 'result',
      });

      const result = prepareToolsAndToolChoice({
        tools: { 'agent-subAgent': agentTool as any },
        toolChoice: undefined,
        activeTools: undefined,
        targetVersion: 'v2',
      });

      expect(result.tools).toBeDefined();
      expect(result.tools).toHaveLength(1);

      const toolDef = result.tools![0] as { type: string; inputSchema: Record<string, any> };
      expect(toolDef.type).toBe('function');

      // The critical assertion: every property in the schema must have a 'type' key.
      // OpenAI rejects schemas where properties lack a 'type' key.
      const properties = toolDef.inputSchema.properties;
      expect(properties).toBeDefined();

      for (const [propName, propSchema] of Object.entries(properties)) {
        const schema = propSchema as Record<string, any>;
        const hasTypeKey = 'type' in schema;
        const hasRef = '$ref' in schema;
        const hasAnyOf = 'anyOf' in schema;
        const hasOneOf = 'oneOf' in schema;
        const hasAllOf = 'allOf' in schema;

        expect(
          hasTypeKey || hasRef || hasAnyOf || hasOneOf || hasAllOf,
          `Property '${propName}' in agent tool schema must have a 'type', '$ref', 'anyOf', 'oneOf', or 'allOf' key. Got: ${JSON.stringify(schema)}`,
        ).toBe(true);
      }
    });
  });

  describe('default targetVersion', () => {
    it('should default to v2 when targetVersion is not specified', () => {
      const providerTool = {
        id: 'openai.web_search',
        type: 'provider-defined',
        args: {},
      };

      const result = prepareToolsAndToolChoice({
        tools: { search: providerTool as any },
        toolChoice: undefined,
        activeTools: undefined,
        // No targetVersion specified - should default to 'v2'
      });

      expect(result.tools![0]).toMatchObject({
        type: 'provider-defined', // v2 uses 'provider-defined'
      });
    });
  });
});
