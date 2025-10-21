/**
 * Integration tests for isVercelTool bug impact on Agent tool execution
 *
 * Tests whether agents properly process v4 and v5 tools:
 * Agent -> ensureToolProperties -> property setting
 */

import { MockLanguageModelV1 } from 'ai/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Agent } from '../agent';
import { createTool } from '../../tools';

describe('Agent Integration - isVercelTool bug impact', () => {
  // Mock model for testing - doesn't need to actually call tools
  const mockModel = new MockLanguageModelV1({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage: { promptTokens: 10, completionTokens: 20 },
      text: 'test response',
    }),
  });

  describe('Agent with v4 tools', () => {
    it('should register and set id for v4 tools correctly', async () => {
      const v4Tool = {
        description: 'V4 test tool',
        parameters: z.object({ input: z.string() }),
        execute: vi.fn(async (args: any) => {
          return { result: args.input };
        }),
      };

      const agent = new Agent({
        name: 'v4-agent',
        instructions: 'Test agent for v4 tools',
        model: mockModel,
        tools: {
          v4Tool,
        },
      });

      // Agent should process tools through ensureToolProperties
      const processedTools = await agent.getTools();

      expect(processedTools).toBeDefined();

      const testTool = processedTools.v4Tool;

      // V4 tools should get id set by ensureToolProperties
      expect(testTool).toBeDefined();
      let id = 'id' in testTool ? testTool.id : undefined;
      expect(id).toBeDefined();
    });
  });

  describe('Agent with v5 tools - BUG TESTS', () => {
    it('should register v5 tools but they miss property setting', async () => {
      const v5Tool = {
        description: 'V5 test tool',
        inputSchema: z.object({ query: z.string() }),
        execute: vi.fn(async (args: any) => {
          return { results: [args.query] };
        }),
      };

      const agent = new Agent({
        name: 'v5-agent',
        instructions: 'Test agent for v5 tools',
        model: mockModel,
        tools: {
          v5Tool,
        },
      });

      const processedTools = await agent.getTools();

      expect(processedTools).toBeDefined();

      const testTool = processedTools.v5Tool;

      expect(testTool).toBeDefined();
      let id = 'id' in testTool ? testTool.id : undefined;
      expect(id).toBeDefined();
    });

    it('should handle provider-defined v5 tools', async () => {
      // Provider-defined tools are just v5 tools with an id already set
      const googleSearchTool = {
        description: 'Search Google',
        inputSchema: z.object({
          query: z.string(),
          maxResults: z.number().optional(),
        }),
        execute: vi.fn(async (args: any) => ({
          results: [],
        })),
      };

      const agent = new Agent({
        name: 'provider-agent',
        instructions: 'Test agent for provider tools',
        model: mockModel,
        tools: {
          googleSearchTool,
        },
      });

      const processedTools = await agent.getTools();

      expect(processedTools).toBeDefined();

      // V5 tools should get id set by ensureToolProperties
      const testTool = processedTools.googleSearchTool;

      expect(testTool).toBeDefined();
      let id = 'id' in testTool ? testTool.id : undefined;
      expect(id).toBeDefined();
    });
  });

  describe('Agent with Mastra tools', () => {
    it('should handle Mastra tools correctly', async () => {
      const mastraTool = createTool({
        id: 'test.tool',
        description: 'Mastra test tool',
        inputSchema: z.object({ data: z.string() }),
        execute: async ({ context }: any) => {
          return { processed: context.data };
        },
      });

      const agent = new Agent({
        name: 'mastra-agent',
        instructions: 'Test agent for Mastra tools',
        model: mockModel,
        tools: {
          mastraTool,
        },
      });

      const processedTools = await agent.getTools();

      expect(processedTools).toBeDefined();

      // Mastra tools should pass through ensureToolProperties unchanged
      const testTool = processedTools.mastraTool;

      expect(testTool).toBeDefined();
      let id = 'id' in testTool ? testTool.id : undefined;
      expect(id).toBe('test.tool');
    });
  });

  describe('Mixed tool types in Agent', () => {
    it('should handle v4, v5, and Mastra tools together', async () => {
      const v4Tool = {
        description: 'V4 tool',
        parameters: z.object({ a: z.string() }),
        execute: async (_args: any) => ({ result: 'v4' }),
      };

      const v5Tool = {
        description: 'V5 tool',
        inputSchema: z.object({ b: z.string() }),
        execute: async (_args: any) => ({ result: 'v5' }),
      };

      const mastraTool = createTool({
        id: 'test.mastra',
        description: 'Mastra tool',
        inputSchema: z.object({ c: z.string() }),
        execute: async ({ context }: any) => ({ result: 'mastra' }),
      });

      const agent = new Agent({
        name: 'mixed-agent',
        instructions: 'Test agent for mixed tools',
        model: mockModel,
        tools: {
          v4Tool,
          v5Tool,
          mastraTool,
        },
      });

      const processedTools = await agent.getTools();

      // All tools should be present
      expect(Object.keys(processedTools)).toHaveLength(3);
      const testTool1 = processedTools.v4Tool;
      const testTool2 = processedTools.v5Tool;
      const testTool3 = processedTools.mastraTool;

      // V4 should get id
      expect(testTool1).toBeDefined();
      let id = 'id' in testTool1 ? testTool1.id : undefined;
      expect(id).toBeDefined();

      // V5 SHOULD get id but won't due to bug
      expect(testTool2).toBeDefined();
      id = 'id' in testTool2 ? testTool2.id : undefined;
      expect(id).toBeDefined();

      // Mastra already has id
      expect(testTool3).toBeDefined();
      expect(testTool3.id).toBe('test.mastra');
    });
  });
});
