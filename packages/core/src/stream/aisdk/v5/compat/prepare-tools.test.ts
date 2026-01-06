import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { createTool } from '../../../../tools/tool';
import { prepareToolsAndToolChoice } from './prepare-tools';

describe('prepareToolsAndToolChoice', () => {
  describe('isProviderTool detection', () => {
    it('should detect provider tools by id format (provider.tool_name)', () => {
      // Mock a provider tool like openai.tools.webSearch() returns
      const providerTool = {
        id: 'openai.web_search',
        type: 'function',
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
        type: 'function',
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
        type: 'function',
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
  });

  describe('activeTools filtering', () => {
    it('should filter tools based on activeTools array', () => {
      const tool1 = {
        id: 'openai.tool1',
        type: 'function',
        args: {},
      };
      const tool2 = {
        id: 'openai.tool2',
        type: 'function',
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
      const providerTool = { id: 'openai.web_search', args: {} };

      const result = prepareToolsAndToolChoice({
        tools: { search: providerTool as any },
        toolChoice: undefined,
        activeTools: undefined,
      });

      expect(result.toolChoice).toEqual({ type: 'auto' });
    });

    it('should handle string toolChoice values', () => {
      const providerTool = { id: 'openai.web_search', args: {} };

      const result = prepareToolsAndToolChoice({
        tools: { search: providerTool as any },
        toolChoice: 'required',
        activeTools: undefined,
      });

      expect(result.toolChoice).toEqual({ type: 'required' });
    });

    it('should handle specific tool choice', () => {
      const providerTool = { id: 'openai.web_search', args: {} };

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
  });

  describe('default targetVersion', () => {
    it('should default to v2 when targetVersion is not specified', () => {
      const providerTool = {
        id: 'openai.web_search',
        type: 'function',
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
