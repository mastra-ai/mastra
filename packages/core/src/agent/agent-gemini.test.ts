import { google } from '@ai-sdk/google-v5';
import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { RuntimeContext } from '../runtime-context';
import { createTool } from '../tools';
import { createStep, createWorkflow } from '../workflows';
import { MockMemory } from './test-utils';
import { Agent } from './index';
import type { ChunkType } from '../stream/types';

describe('Gemini Model Compatibility Tests', () => {
  let memory: MockMemory;
  let runtimeContext: RuntimeContext;

  beforeEach(() => {
    memory = new MockMemory();
    runtimeContext = new RuntimeContext();
  });

  describe('Direct generate() method - Gemini basic functionality', () => {
    it('should handle basic generation with Gemini', async () => {
      const agent = new Agent({
        id: 'basic-gemini',
        name: 'Basic Gemini Agent',
        instructions: 'You are a helpful assistant',
        model: google('gemini-2.5-flash-lite'),
      });

      const result = await agent.generate('Hello, how are you?');
      expect(result).toBeDefined();
      expect(result.text).toBeDefined();
    });

    it('should handle generation with structured output', async () => {
      const agent = new Agent({
        id: 'structured-gemini',
        name: 'Structured Gemini Agent',
        instructions: 'You provide structured responses',
        model: google('gemini-2.5-flash-lite'),
      });

      const result = await agent.generate('List 3 benefits of exercise', {
        output: z.object({
          benefits: z.array(z.string()),
        }),
      });

      expect(result.object).toBeDefined();
      expect(result.object.benefits).toBeDefined();
      expect(Array.isArray(result.object.benefits)).toBe(true);
    });

    it('should handle empty user message with system context', async () => {
      const agent = new Agent({
        id: 'system-context-agent',
        name: 'System Context Agent',
        instructions: 'You are an expert assistant. Always provide detailed explanations.',
        model: google('gemini-2.5-flash-lite'),
      });

      const result = await agent.generate('');

      expect(result).toBeDefined();
    });

    it('should handle single turn with maxSteps=1 and messages ending with assistant', async () => {
      const agent = new Agent({
        id: 'max-steps-agent',
        name: 'Max Steps Agent',
        instructions: 'You help users choose between options A, B, or C.',
        model: google('gemini-2.5-flash-lite'),
        memory,
      });

      const result = await agent.generate(
        [
          {
            role: 'user',
            content:
              'I need to choose between option A (fast), option B (cheap), or option C (reliable). I value reliability most.',
          },
          { role: 'assistant', content: 'Let me help you make the best choice.' },
        ],
        {
          maxSteps: 1,
          output: z.object({
            selection: z.string(),
            reason: z.string(),
          }),
        },
      );

      expect(result).toBeDefined();
      expect(result.object).toBeDefined();
    });

    it('should handle conversation ending with tool result', async () => {
      const testTool = createTool({
        id: 'weather-tool',
        description: 'Gets weather information',
        inputSchema: z.object({ location: z.string() }),
        outputSchema: z.object({ weather: z.string() }),
        execute: async () => ({ weather: 'Sunny, 72°F' }),
      });

      const agent = new Agent({
        id: 'tool-result-ending-agent',
        name: 'Tool Result Ending Agent',
        instructions: 'You help with weather queries',
        model: google('gemini-2.5-flash-lite'),
        tools: { testTool },
      });

      const result = await agent.generate([
        { role: 'user', content: 'What is the weather?' },
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'call_1',
              toolName: 'weather-tool',
              args: { location: 'San Francisco' },
            },
          ],
        },
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call_1',
              toolName: 'weather-tool',
              result: 'Sunny, 72°F',
            },
          ],
        },
      ]);

      expect(result).toBeDefined();
    });

    it('should handle messages starting with assistant-with-tool-call', async () => {
      const testTool = createTool({
        id: 'test-tool',
        description: 'A test tool',
        inputSchema: z.object({ query: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        execute: async () => ({ result: 'test result' }),
      });

      const agent = new Agent({
        id: 'issue-7287-agent',
        name: 'Issue 7287 Agent',
        instructions: 'You help users with their queries',
        model: google('gemini-2.5-flash-lite'),
        tools: { testTool },
      });

      const result = await agent.generate([
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'call_1',
              toolName: 'test-tool',
              args: { query: 'test' },
            },
          ],
        },
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call_1',
              toolName: 'test-tool',
              result: 'previous result',
            },
          ],
        },
        { role: 'user', content: 'What was that about?' },
      ]);

      expect(result).toBeDefined();
    });
  });

  describe('Agent network() method', () => {
    it('should handle basic network generation with Gemini', async () => {
      const helperAgent = new Agent({
        name: 'helper-agent',
        instructions: 'You answer simple questions. For "what is the capital of France?", respond "Paris".',
        model: google('gemini-2.5-flash-lite'),
      });

      const agent = new Agent({
        id: 'basic-network-agent',
        name: 'Basic Network Agent',
        instructions: 'You coordinate tasks. Always delegate questions to helperAgent.',
        model: google('gemini-2.5-flash-lite'),
        agents: { helperAgent },
        memory,
      });

      const stream = await agent.network('What is the capital of France?', {
        runtimeContext,
        maxSteps: 2,
      });

      const chunks: ChunkType[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toBeDefined();
      expect(chunks.length).toBeGreaterThan(0);
    }, 15000);

    it('should handle empty user message with system context in network', async () => {
      const helperAgent = new Agent({
        name: 'helper-agent',
        instructions: 'You help with tasks',
        model: google('gemini-2.5-flash-lite'),
      });

      const agent = new Agent({
        id: 'network-empty-message-agent',
        name: 'Network Empty Message Agent',
        instructions: 'You coordinate tasks. Always provide detailed explanations.',
        model: google('gemini-2.5-flash-lite'),
        agents: { helperAgent },
        memory,
      });

      const stream = await agent.network('', {
        runtimeContext,
        maxSteps: 2,
      });

      const chunks: ChunkType[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toBeDefined();
    }, 15000);

    it('should handle single turn with maxSteps=1 and messages ending with assistant in network', async () => {
      const helperAgent = new Agent({
        name: 'helper-agent',
        instructions: 'You are a calculator. When asked for math, respond with just the numeric answer.',
        model: google('gemini-2.5-flash-lite'),
      });

      const agent = new Agent({
        id: 'network-max-steps-agent',
        name: 'Network Max Steps Agent',
        instructions: 'You coordinate tasks. Always delegate math questions to helperAgent.',
        model: google('gemini-2.5-flash-lite'),
        agents: { helperAgent },
        memory,
      });

      const stream = await agent.network(
        [
          { role: 'user', content: 'What is 5 plus 3?' },
          { role: 'assistant', content: 'Let me calculate that for you.' },
          { role: 'user', content: 'Please provide the answer now.' },
        ],
        {
          runtimeContext,
          maxSteps: 1,
        },
      );

      const chunks: ChunkType[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toBeDefined();
    }, 15000);

    it('should handle conversation ending with tool result in network', async () => {
      const testTool = createTool({
        id: 'weather-tool',
        description: 'Gets weather information',
        inputSchema: z.object({ location: z.string() }),
        outputSchema: z.object({ weather: z.string() }),
        execute: async () => ({ weather: 'Sunny, 72°F' }),
      });

      const agent = new Agent({
        id: 'network-tool-result-ending-agent',
        name: 'Network Tool Result Ending Agent',
        instructions: 'You help with weather queries. Summarize weather results when asked.',
        model: google('gemini-2.5-flash-lite'),
        tools: { testTool },
        memory,
      });

      const stream = await agent.network(
        [
          { role: 'user', content: 'What is the weather?' },
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolCallId: 'call_1',
                toolName: 'weather-tool',
                args: { location: 'San Francisco' },
              },
            ],
          },
          {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: 'call_1',
                toolName: 'weather-tool',
                result: 'Sunny, 72°F',
              },
            ],
          },
          { role: 'user', content: 'Is that good weather for a picnic?' },
        ],
        {
          runtimeContext,
          maxSteps: 1,
        },
      );

      const chunks: ChunkType[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toBeDefined();
    }, 15000);

    it('should handle messages starting with assistant-with-tool-call in network (Issue #7287)', async () => {
      const testTool = createTool({
        id: 'test-tool',
        description: 'A test tool',
        inputSchema: z.object({ query: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        execute: async () => ({ result: 'test result' }),
      });

      const agent = new Agent({
        id: 'network-issue-7287-agent',
        name: 'Network Issue 7287 Agent',
        instructions: 'You help users understand tool results. Explain tool outputs clearly.',
        model: google('gemini-2.5-flash-lite'),
        tools: { testTool },
        memory,
      });

      const stream = await agent.network(
        [
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolCallId: 'call_1',
                toolName: 'test-tool',
                args: { query: 'test' },
              },
            ],
          },
          {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: 'call_1',
                toolName: 'test-tool',
                result: 'previous result',
              },
            ],
          },
          { role: 'user', content: 'Explain what this result means.' },
        ],
        {
          runtimeContext,
          maxSteps: 1,
        },
      );

      const chunks: ChunkType[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toBeDefined();
    }, 15000);
  });
});
