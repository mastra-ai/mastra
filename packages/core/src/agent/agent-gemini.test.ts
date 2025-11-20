import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { MockMemory } from '../memory/mock';
import { RequestContext } from '../request-context';
import type { ChunkType } from '../stream/types';
import { createTool } from '../tools';
import { createStep, createWorkflow } from '../workflows';
import { Agent } from './index';

describe('Gemini Model Compatibility Tests', () => {
  let memory: MockMemory;
  let requestContext: RequestContext;

  beforeEach(() => {
    memory = new MockMemory();
    requestContext = new RequestContext();
  });

  const MODEL = 'google/gemini-2.0-flash-lite';

  describe('Direct generate() method - Gemini basic functionality', () => {
    it('should handle basic generation with Gemini', async () => {
      const agent = new Agent({
        id: 'basic-gemini',
        name: 'Basic Gemini Agent',
        instructions: 'You are a helpful assistant',
        model: MODEL,
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
        model: MODEL,
      });

      const result = await agent.generate('List 3 benefits of exercise', {
        structuredOutput: {
          schema: z.object({
            benefits: z.array(z.string()),
          }),
        },
      });

      expect(result.object).toBeDefined();
      expect(result.object.benefits).toBeDefined();
      expect(Array.isArray(result.object.benefits)).toBe(true);
    });

    it('should throw error for empty user message', async () => {
      const agent = new Agent({
        id: 'system-context-agent',
        name: 'System Context Agent',
        instructions: 'You are an expert assistant. Always provide detailed explanations.',
        model: MODEL,
      });

      await expect(agent.generate('')).rejects.toThrow();
    });

    it('should handle single turn with maxSteps=1 and messages ending with assistant', async () => {
      const agent = new Agent({
        id: 'max-steps-agent',
        name: 'Max Steps Agent',
        instructions: 'You help users choose between options A, B, or C.',
        model: MODEL,
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
          structuredOutput: {
            schema: z.object({
              selection: z.string(),
              reason: z.string(),
            }),
          },
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
        model: MODEL,
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
        id: 'tool-call-agent',
        name: 'Tool Call Agent',
        instructions: 'You help users with their queries',
        model: MODEL,
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

    it('should handle messages with only assistant role', async () => {
      const agent = new Agent({
        id: 'assistant-only-agent',
        name: 'Assistant Only Agent',
        instructions: 'You help users with their queries',
        model: MODEL,
      });

      const result = await agent.generate([{ role: 'assistant', content: 'I can help you with that task.' }]);

      expect(result).toBeDefined();
    });
  });

  describe('Agent network() method', () => {
    it('should handle basic network generation with Gemini', async () => {
      const helperAgent = new Agent({
        id: 'helper-agent',
        name: 'Helper Agent',
        instructions: 'You answer simple questions. For "what is the capital of France?", respond "Paris".',
        model: MODEL,
      });

      const agent = new Agent({
        id: 'basic-network-agent',
        name: 'Basic Network Agent',
        instructions: 'You coordinate tasks. Always delegate questions to helperAgent.',
        model: MODEL,
        agents: { helperAgent },
        memory,
      });

      const stream = await agent.network('What is the capital of France?', {
        requestContext,
        maxSteps: 2,
      });

      const chunks: ChunkType[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toBeDefined();
      expect(chunks.length).toBeGreaterThan(1);
    }, 15000);

    it('should handle empty user message with system context in network', async () => {
      const helperAgent = new Agent({
        id: 'helper-agent',
        name: 'Helper Agent',
        instructions: 'You help with tasks',
        model: MODEL,
        defaultVNextStreamOptions: {
          maxSteps: 1,
        },
      });

      const agent = new Agent({
        id: 'network-empty-message-agent',
        name: 'Network Empty Message Agent',
        instructions: 'You coordinate tasks. Always provide detailed explanations.',
        model: MODEL,
        agents: { helperAgent },
        memory,
        defaultVNextStreamOptions: {
          maxSteps: 1,
        },
      });

      const stream = await agent.network('', {
        requestContext,
        maxSteps: 1,
      });

      const chunks: ChunkType[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toBeDefined();
      expect(chunks.length).toBeGreaterThan(1);
    }, 60000);

    it('should handle single turn with maxSteps=1 and messages ending with assistant in network', async () => {
      const helperAgent = new Agent({
        id: 'helper-agent',
        name: 'Calculator Agent',
        instructions: 'You are a calculator. When asked for math, respond with just the numeric answer.',
        model: MODEL,
      });

      const agent = new Agent({
        id: 'network-max-steps-agent',
        name: 'Network Max Steps Agent',
        instructions: 'You coordinate tasks. Always delegate math questions to helperAgent.',
        model: MODEL,
        agents: { helperAgent },
        memory,
      });

      const stream = await agent.network(
        [
          { role: 'user', content: 'What is 5 plus 3?' },
          { role: 'assistant', content: 'Let me calculate that for you.' },
        ],
        {
          requestContext,
          maxSteps: 1,
        },
      );

      const chunks: ChunkType[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toBeDefined();
      expect(chunks.length).toBeGreaterThan(1);
    }, 15000);

    it('should handle conversation ending with tool result in network (with follow-up user message)', async () => {
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
        model: MODEL,
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
          requestContext,
          maxSteps: 1,
        },
      );

      const chunks: ChunkType[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toBeDefined();
      expect(chunks.length).toBeGreaterThan(1);
    }, 15000);

    it('should handle conversation ending with tool result in network (agentic loop pattern)', async () => {
      const testTool = createTool({
        id: 'weather-tool',
        description: 'Gets weather information',
        inputSchema: z.object({ location: z.string() }),
        outputSchema: z.object({ weather: z.string() }),
        execute: async () => ({ weather: 'Sunny, 72°F' }),
      });

      const agent = new Agent({
        id: 'network-agentic-tool-result-agent',
        name: 'Network Agentic Tool Result Agent',
        instructions: 'You help with weather queries. Summarize weather results.',
        model: MODEL,
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
        ],
        {
          requestContext,
          maxSteps: 1,
        },
      );

      const chunks: ChunkType[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toBeDefined();
      expect(chunks.length).toBeGreaterThan(1);
    }, 15000);

    it('should handle messages starting with assistant-with-tool-call in network', async () => {
      const testTool = createTool({
        id: 'test-tool',
        description: 'A test tool',
        inputSchema: z.object({ query: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        execute: async () => ({ result: 'test result' }),
      });

      const agent = new Agent({
        id: 'network-tool-call-agent',
        name: 'Network Tool Call Agent',
        instructions: 'You help users understand tool results. Explain tool outputs clearly.',
        model: MODEL,
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
          requestContext,
          maxSteps: 1,
        },
      );

      const chunks: ChunkType[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toBeDefined();
      expect(chunks.length).toBeGreaterThan(1);
    }, 15000);

    it('should handle network with workflow execution', async () => {
      const researchAgent = new Agent({
        id: 'research-agent',
        name: 'Research Agent',
        instructions: 'You research topics and provide brief summaries.',
        model: MODEL,
      });

      const researchStep = createStep({
        id: 'research-step',
        description: 'Research a topic',
        inputSchema: z.object({ topic: z.string() }),
        outputSchema: z.object({ summary: z.string() }),
        execute: async ({ inputData }) => {
          const resp = await researchAgent.generate(`Research: ${inputData.topic}`, {
            structuredOutput: {
              schema: z.object({ summary: z.string() }),
            },
          });
          return { summary: resp.object.summary };
        },
      });

      const researchWorkflow = createWorkflow({
        id: 'research-workflow',
        description: 'Workflow for researching topics',
        steps: [],
        inputSchema: z.object({ topic: z.string() }),
        outputSchema: z.object({ summary: z.string() }),
        options: { validateInputs: false },
      })
        .then(researchStep)
        .commit();

      const agent = new Agent({
        id: 'network-workflow-agent',
        name: 'Network Workflow Agent',
        instructions: 'You coordinate research workflows.',
        model: MODEL,
        workflows: { researchWorkflow },
        memory,
      });

      const stream = await agent.network('Execute research-workflow on machine learning', {
        requestContext,
        maxSteps: 2,
      });

      const chunks: ChunkType[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toBeDefined();
      expect(chunks.length).toBeGreaterThan(1);
    }, 20000);

    it('should handle simple conversation ending with assistant in network', async () => {
      const agent = new Agent({
        id: 'network-simple-ending-agent',
        name: 'Network Simple Ending Agent',
        instructions: 'You help users with their queries',
        model: MODEL,
        memory,
      });

      const stream = await agent.network(
        [
          { role: 'user', content: 'Hello, how are you?' },
          { role: 'assistant', content: 'I am doing well, thank you!' },
        ],
        {
          requestContext,
          maxSteps: 1,
        },
      );

      const chunks: ChunkType[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toBeDefined();
      expect(chunks.length).toBeGreaterThan(1);
    }, 15000);

    it('should handle messages with only assistant role in network', async () => {
      const helperAgent = new Agent({
        id: 'helper-agent',
        name: 'Helper Agent',
        instructions: 'You help with tasks',
        model: MODEL,
      });

      const agent = new Agent({
        id: 'network-assistant-only-agent',
        name: 'Network Assistant Only Agent',
        instructions: 'You coordinate tasks',
        model: MODEL,
        agents: { helperAgent },
        memory,
      });

      const stream = await agent.network([{ role: 'assistant', content: 'This is a system message' }], {
        requestContext,
        maxSteps: 1,
      });

      const chunks: ChunkType[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toBeDefined();
      expect(chunks.length).toBeGreaterThan(1);
    }, 15000);
  });
});
