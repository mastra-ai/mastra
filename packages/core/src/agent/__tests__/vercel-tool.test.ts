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
  // Simple mock model that doesn't call tools (for property tests)
  const simpleMockModel = new MockLanguageModelV1({
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
        model: simpleMockModel,
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
        model: simpleMockModel,
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
        model: simpleMockModel,
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
        model: simpleMockModel,
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
        model: simpleMockModel,
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

  describe('Agent tool execution - Execute Signature Tests', () => {
    /**
     * These tests verify that tools are called with the correct execute signature
     * when actually executed through an agent.
     */

    describe('Real model test - v5 tool with actual API call', () => {
      it('should execute v5 tool with real OpenAI model to verify actual behavior', async () => {
        if (!process.env.OPENAI_API_KEY) {
          console.log('Skipping real model test - OPENAI_API_KEY not set');
          return;
        }

        const { openai } = await import('@ai-sdk/openai');

        let receivedFirstParam: any;

        const v5Tool = {
          description: 'V5 tool that returns what it receives',
          inputSchema: z.object({ query: z.string() }),
          execute: vi.fn(async (firstParam: any) => {
            receivedFirstParam = firstParam;
            // Real v5 tools expect args directly: firstParam.query
            // If bug exists, firstParam is { context: { query: ... }, mastra, ... }
            // So firstParam.query will be UNDEFINED!
            return {
              success: true,
              receivedQuery: firstParam.query, // This will be undefined if bug exists
              receivedStructure: Object.keys(firstParam),
            };
          }),
        };

        const agent = new Agent({
          name: 'real-v5-agent-test',
          instructions: 'You are a test agent. Call the v5TestTool with query="test search".',
          model: openai('gpt-4o-mini'),
          tools: { v5TestTool: v5Tool },
        });

        const response = await agent.generateLegacy('Call the v5TestTool with query="test search"', {
          toolChoice: 'required',
          maxSteps: 1,
        });

        // Verify tool was called
        expect(v5Tool.execute).toHaveBeenCalledTimes(1);

        // Check what the tool actually received
        console.log('Real agent model test - receivedFirstParam:', receivedFirstParam);

        // THIS IS THE KEY CHECK - does v5 tool get args directly or wrapped in context?
        if (receivedFirstParam.context) {
          console.log('BUG CONFIRMED: v5 tool received Mastra signature with context wrapper');
          console.log('receivedFirstParam.query:', receivedFirstParam.query); // Will be undefined
          console.log('receivedFirstParam.context.query:', receivedFirstParam.context.query); // Will have value
        } else {
          console.log('v5 tool received AI SDK signature correctly');
          console.log('receivedFirstParam.query:', receivedFirstParam.query); // Will have value
        }

        // Check the tool result
        const toolResult = response.toolResults?.[0];
        console.log('Tool result:', toolResult?.result);

        // If bug exists, receivedQuery will be undefined even though the model passed the query
        if (toolResult?.result.receivedQuery === undefined && receivedFirstParam.context) {
          console.log('FUNCTIONAL BUG CONFIRMED: Tool returned undefined query due to wrong signature');
        }
      }, 30000);
    });

    it('should execute v4 tools with AI SDK signature (args, options)', async () => {
      let receivedFirstParam: any;
      let receivedSecondParam: any;

      const v4Tool = {
        description: 'V4 test tool',
        parameters: z.object({ input: z.string() }),
        execute: vi.fn(async (firstParam: any, secondParam: any) => {
          receivedFirstParam = firstParam;
          receivedSecondParam = secondParam;
          return { result: firstParam.input };
        }),
      };

      // Mock model that triggers a tool call
      const mockModelWithToolCall = new MockLanguageModelV1({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'tool-calls',
          usage: { promptTokens: 10, completionTokens: 20 },
          toolCalls: [
            {
              toolCallType: 'function',
              toolCallId: 'call-1',
              toolName: 'v4Tool',
              args: JSON.stringify({ input: 'test-value' }),
            },
          ],
        }),
      });

      const agent = new Agent({
        name: 'v4-execute-agent',
        instructions: 'Test agent for v4 tool execution',
        model: mockModelWithToolCall,
        tools: { v4Tool },
      });

      await agent.generateLegacy('test prompt', { maxSteps: 1 });

      // Verify tool was called
      expect(v4Tool.execute).toHaveBeenCalledTimes(1);

      // V4 tool should receive AI SDK signature: (args, options)
      expect(receivedFirstParam).toEqual({ input: 'test-value' });
      expect(receivedFirstParam).not.toHaveProperty('context');
      expect(receivedSecondParam).toBeDefined();
      expect(receivedSecondParam).toHaveProperty('abortSignal');
    });

    it('should execute v5 tools with AI SDK signature - BUG TEST', async () => {
      let receivedFirstParam: any;

      const v5Tool = {
        description: 'V5 test tool',
        inputSchema: z.object({ query: z.string() }),
        execute: vi.fn(async (firstParam: any) => {
          receivedFirstParam = firstParam;
          // This simulates real v5 tool behavior - accessing firstParam.query directly
          // If bug exists, firstParam is { context: {query: ...}, mastra, ... }
          // So firstParam.query is UNDEFINED!
          return { results: [firstParam.query] };
        }),
      };

      // Mock model that triggers a tool call
      const mockModelWithToolCall = new MockLanguageModelV1({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'tool-calls',
          usage: { promptTokens: 10, completionTokens: 20 },
          toolCalls: [
            {
              toolCallType: 'function',
              toolCallId: 'call-2',
              toolName: 'v5Tool',
              args: JSON.stringify({ query: 'test-query' }),
            },
          ],
        }),
      });

      const agent = new Agent({
        name: 'v5-execute-agent',
        instructions: 'Test agent for v5 tool execution',
        model: mockModelWithToolCall,
        tools: { v5Tool },
      });

      const response = await agent.generateLegacy('test prompt', { maxSteps: 1 });

      // Verify tool was called
      expect(v5Tool.execute).toHaveBeenCalledTimes(1);

      // THIS WILL FAIL - v5 tool should receive AI SDK signature but receives Mastra signature
      // Expected: { query: 'test-query' }
      // Actual: { context: { query: 'test-query' }, mastra, threadId, ... }
      expect(receivedFirstParam).toEqual({ query: 'test-query' });
      expect(receivedFirstParam).not.toHaveProperty('context');
      expect(receivedFirstParam).not.toHaveProperty('mastra');
      expect(receivedFirstParam).not.toHaveProperty('threadId');

      // CRITICAL: Because of wrong signature, the tool's response is broken!
      // Tool tried to access firstParam.query but it's actually at firstParam.context.query
      // So firstParam.query is UNDEFINED
      const toolResult = response.toolResults?.[0];
      expect(toolResult?.result).toEqual({ results: ['test-query'] }); // THIS WILL FAIL
      // Actual result will be: { results: [undefined] }
    });

    it('should execute Mastra tools with Mastra signature (context object)', async () => {
      let receivedContext: any;
      const executeFn = vi.fn(async ({ context }: any) => {
        receivedContext = context;
        return { processed: context.data };
      });

      const mastraTool = createTool({
        id: 'test.execute',
        description: 'Mastra test tool for execution',
        inputSchema: z.object({ data: z.string() }),
        execute: executeFn,
      });

      // Mock model that triggers a tool call
      const mockModelWithToolCall = new MockLanguageModelV1({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'tool-calls',
          usage: { promptTokens: 10, completionTokens: 20 },
          toolCalls: [
            {
              toolCallType: 'function',
              toolCallId: 'call-3',
              toolName: 'mastraTool', // Must match the key in tools object
              args: JSON.stringify({ data: 'test-data' }),
            },
          ],
        }),
      });

      const agent = new Agent({
        name: 'mastra-execute-agent',
        instructions: 'Test agent for Mastra tool execution',
        model: mockModelWithToolCall,
        tools: { mastraTool },
      });

      await agent.generateLegacy('test prompt', { maxSteps: 1 });

      // Verify tool was called
      expect(executeFn).toHaveBeenCalledTimes(1);

      // Mastra tools should receive context object with the args
      expect(receivedContext).toEqual({ data: 'test-data' });
    });
  });
});
