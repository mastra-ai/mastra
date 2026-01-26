import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { Mastra } from '..';
import { MockMemory } from '../memory/mock';
import { RequestContext } from '../request-context';
import { InMemoryStore } from '../storage';
import type { ChunkType } from '../stream/types';
import { createTool } from '../tools';
import { createStep, createWorkflow } from '../workflows';
import { Agent } from './index';

describe('Gemini Model Compatibility Tests', () => {
  let memory: MockMemory;
  let requestContext: RequestContext;
  let mockStorage: InMemoryStore;

  beforeEach(() => {
    memory = new MockMemory();
    requestContext = new RequestContext();
    mockStorage = new InMemoryStore();
  });

  const MODEL = 'google/gemini-2.0-flash-lite';
  const GEMINI_3_PRO = 'google/gemini-3-pro-preview';

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

    it('should return structured output from network', async () => {
      const helperAgent = new Agent({
        id: 'research-helper',
        name: 'Research Helper',
        instructions: 'You provide brief research summaries when asked.',
        model: MODEL,
      });

      const agent = new Agent({
        id: 'structured-network-agent',
        name: 'Structured Network Agent',
        instructions: 'You coordinate research tasks. Delegate to researchHelper for research.',
        model: MODEL,
        agents: { helperAgent },
        memory,
      });

      const resultSchema = z.object({
        summary: z.string().describe('Brief summary'),
        confidence: z.number().min(0).max(1).describe('Confidence score'),
      });

      const stream = await agent.network('Research AI briefly', {
        requestContext,
        structuredOutput: { schema: resultSchema },
      });

      // Consume stream
      for await (const _ of stream) {
      }

      // Verify structured output
      const result = await stream.object;
      expect(result).toBeDefined();
      expect(typeof result!.summary).toBe('string');
      expect(typeof result!.confidence).toBe('number');
    }, 30000);

    it('should handle empty user message with system context in network', async () => {
      const helperAgent = new Agent({
        id: 'helper-agent',
        name: 'Helper Agent',
        instructions: 'You help with tasks',
        model: MODEL,
        defaultOptions: {
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
        defaultOptions: {
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

  describe('Gemini 3 Pro with tool calls', () => {
    it(
      'should preserve thought_signature metadata through tool call round-trip',
      { retry: 2, timeout: 120000 },
      async () => {
        const weatherTool = createTool({
          id: 'get-weather',
          description: 'Gets the current weather for a location',
          inputSchema: z.object({
            location: z.string().describe('The city and state, e.g. San Francisco, CA'),
          }),
          outputSchema: z.object({
            temperature: z.number(),
            conditions: z.string(),
          }),
          execute: async () => {
            return {
              temperature: 72,
              conditions: 'Sunny',
            };
          },
        });

        const agent = new Agent({
          id: 'weather-gemini3-agent',
          name: 'Weather Gemini3 Agent',
          instructions: 'You are a helpful weather assistant. Use the get-weather tool to answer weather questions.',
          model: GEMINI_3_PRO,
          tools: { weatherTool },
          memory,
        });

        // This should trigger a tool call, then process the result
        const stream = await agent.stream('What is the weather in San Francisco?', {
          maxSteps: 5,
          memory: {
            thread: 'tool-calls',
            resource: 'gemini-3',
          },
        });

        const result = await stream.getFullOutput();
        expect(result).toBeDefined();
        expect(result.request.body).toContain(`thoughtSignature`);
        expect(result.text).toBeDefined();
        expect(result.text.length).toBeGreaterThan(0);
        expect(result.error).toBeUndefined();

        const stream2 = await agent.stream('Whats the weather there now?', {
          memory: {
            thread: 'tool-calls',
            resource: 'gemini-3',
          },
        });
        const result2 = await stream2.getFullOutput();
        expect(result2).toBeDefined();
        expect(result2.request.body).toContain(`thoughtSignature`);
        expect(result2.text).toBeDefined();
        expect(result2.text.length).toBeGreaterThan(0);
        expect(result2.error).toBeUndefined();
      },
    );

    it('should handle multi-step tool calls with gemini 3 pro', { retry: 2, timeout: 120000 }, async () => {
      const weatherTool = createTool({
        id: 'get-weather-multi',
        description: 'Gets the current weather for a location',
        inputSchema: z.object({
          location: z.string().describe('The city and state, e.g. San Francisco, CA'),
        }),
        outputSchema: z.object({
          temperature: z.number(),
          conditions: z.string(),
        }),
        execute: async () => {
          return {
            temperature: 72,
            conditions: 'Sunny',
          };
        },
      });

      const agent = new Agent({
        id: 'weather-multi-gemini3-agent',
        name: 'Weather Multi Gemini3 Agent',
        instructions:
          'You are a helpful weather assistant. Use the get-weather-multi tool to answer weather questions.',
        model: GEMINI_3_PRO,
        tools: { weatherTool },
        memory,
      });

      // This should trigger a tool call, then process the result
      const result = await agent.generate('What is the weather in San Francisco and New York?', {
        maxSteps: 5,
      });

      expect(result).toBeDefined();
      expect(result.text).toBeDefined();
      expect(result.text.length).toBeGreaterThan(0);
      expect(result.error).toBeUndefined();
    });
  });

  describe('Tool suspension and resumption', () => {
    it('should call findUserTool with suspend and resume via stream when autoResumeSuspendedTools is true', async () => {
      const findUserTool = createTool({
        id: 'Find user tool',
        description: 'This is a test tool that returns the name, email and age',
        inputSchema: z.object({
          name: z.string(),
        }),
        suspendSchema: z.object({
          message: z.string(),
        }),
        resumeSchema: z.object({
          age: z.number(),
        }),
        execute: async (inputData, context) => {
          if (!context?.agent?.resumeData) {
            return await context?.agent?.suspend({ message: 'Please provide the age of the user' });
          }

          return {
            name: inputData.name,
            age: context?.agent?.resumeData?.age,
            email: 'test@test.com',
          };
        },
      });

      const findUserProfessionTool = createTool({
        id: 'Find user profession tool',
        description: 'This is a test tool that returns the profession of the user',
        inputSchema: z.object({
          name: z.string(),
        }),
        execute: async () => {
          return {
            profession: 'Software Engineer',
          };
        },
      });

      const userAgent = new Agent({
        id: 'user-agent',
        name: 'User Agent',
        instructions: 'You are an agent that can get list of users using findUserTool.',
        model: MODEL,
        tools: { findUserTool, findUserProfessionTool },
        memory,
        defaultOptions: {
          autoResumeSuspendedTools: true,
        },
      });

      const mastra = new Mastra({
        agents: { userAgent },
        logger: false,
        storage: mockStorage,
      });

      const agentOne = mastra.getAgent('userAgent');

      const suspendData = {
        suspendPayload: null,
        suspendedToolName: '',
      };
      const threadAndResource = {
        thread: randomUUID(),
        resource: randomUUID(),
      };
      const stream = await agentOne.stream('Find the name, age and profession of the user - Dero Israel', {
        memory: threadAndResource,
      });
      for await (const _chunk of stream.fullStream) {
        if (_chunk.type === 'tool-call-suspended') {
          suspendData.suspendPayload = _chunk.payload.suspendPayload;
          suspendData.suspendedToolName = _chunk.payload.toolName;
        }
      }
      if (suspendData.suspendPayload) {
        const resumeStream = await agentOne.stream('He is 25 years old', {
          memory: threadAndResource,
        });
        for await (const _chunk of resumeStream.fullStream) {
        }

        const toolResults = await resumeStream.toolResults;

        const toolCall = toolResults?.find((result: any) => result.payload.toolName === 'findUserTool')?.payload;

        const name = (toolCall?.result as any)?.name;
        const email = (toolCall?.result as any)?.email;
        const age = (toolCall?.result as any)?.age;

        expect(name).toBe('Dero Israel');
        expect(email).toBe('test@test.com');
        expect(age).toBe(25);
      }

      expect(suspendData.suspendPayload).toBeDefined();
      expect(suspendData.suspendedToolName).toBe('findUserTool');
      expect((suspendData.suspendPayload as any)?.message).toBe('Please provide the age of the user');
    }, 15000);

    it('should call findUserTool with suspend and resume via generate when autoResumeSuspendedTools is true', async () => {
      const findUserTool = createTool({
        id: 'Find user tool',
        description: 'This is a test tool that returns the name, email and age',
        inputSchema: z.object({
          name: z.string(),
        }),
        suspendSchema: z.object({
          message: z.string(),
        }),
        resumeSchema: z.object({
          age: z.number(),
        }),
        execute: async (inputData, context) => {
          // console.log('context', context);
          if (!context?.agent?.resumeData) {
            return await context?.agent?.suspend({ message: 'Please provide the age of the user' });
          }

          return {
            name: inputData.name,
            age: context?.agent?.resumeData?.age,
            email: 'test@test.com',
          };
        },
      });

      const findUserProfessionTool = createTool({
        id: 'Find user profession tool',
        description: 'This is a test tool that returns the profession of the user',
        inputSchema: z.object({
          name: z.string(),
        }),
        execute: async () => {
          return {
            profession: 'Software Engineer',
          };
        },
      });

      const userAgent = new Agent({
        id: 'user-agent',
        name: 'User Agent',
        instructions: 'You are an agent that can get list of users using findUserTool.',
        model: MODEL,
        tools: { findUserTool, findUserProfessionTool },
        memory,
        defaultOptions: {
          autoResumeSuspendedTools: true,
        },
      });

      const mastra = new Mastra({
        agents: { userAgent },
        logger: false,
        storage: mockStorage,
      });

      const agentOne = mastra.getAgent('userAgent');

      const threadAndResource = {
        thread: randomUUID(),
        resource: randomUUID(),
      };
      const output = await agentOne.generate('Find the name, age and profession of the user - Dero Israel', {
        memory: threadAndResource,
      });

      expect(output.finishReason).toBe('suspended');
      expect(output.toolResults).toHaveLength(0);
      expect(output.suspendPayload).toMatchObject({
        toolName: 'findUserTool',
        suspendPayload: {
          message: 'Please provide the age of the user',
        },
      });
      const resumeOutput = await agentOne.generate('He is 25 years old', {
        memory: threadAndResource,
      });

      const toolResults = resumeOutput.toolResults;

      const toolCall = toolResults?.find((result: any) => result.payload.toolName === 'findUserTool')?.payload;

      const name = (toolCall?.result as any)?.name;
      const email = (toolCall?.result as any)?.email;
      const age = (toolCall?.result as any)?.age;

      expect(resumeOutput.suspendPayload).toBeUndefined();
      expect(name).toBe('Dero Israel');
      expect(email).toBe('test@test.com');
      expect(age).toBe(25);
    }, 15000);

    it('should call findUserWorkflow with suspend and resume via stream when autoResumeSuspendedTools is true', async () => {
      const findUserStep = createStep({
        id: 'find-user-step',
        description: 'This is a step that returns the name, email and age',
        inputSchema: z.object({
          name: z.string(),
        }),
        suspendSchema: z.object({
          message: z.string(),
        }),
        resumeSchema: z.object({
          noOfYears: z.number(),
        }),
        outputSchema: z.object({
          name: z.string(),
          email: z.string(),
          age: z.number(),
        }),
        execute: async ({ suspend, resumeData, inputData }) => {
          if (!resumeData) {
            return await suspend({ message: 'Please provide the age of the user' });
          }

          return {
            name: inputData?.name,
            email: 'test@test.com',
            age: resumeData?.noOfYears,
          };
        },
      });

      const findUserWorkflow = createWorkflow({
        id: 'find-user-workflow',
        description: 'This is a tool that returns name and age',
        inputSchema: z.object({
          name: z.string(),
        }),
        outputSchema: z.object({
          name: z.string(),
          email: z.string(),
          age: z.number(),
        }),
      })
        .then(findUserStep)
        .commit();

      const userAgent = new Agent({
        id: 'user-agent',
        name: 'User Agent',
        instructions: 'You are an agent that can get list of users using findUserWorkflow.',
        model: MODEL,
        workflows: { findUserWorkflow },
        memory,
        defaultOptions: {
          autoResumeSuspendedTools: true,
        },
      });

      const mastra = new Mastra({
        agents: { userAgent },
        logger: false,
        storage: mockStorage,
      });

      const agentOne = mastra.getAgent('userAgent');

      const threadAndResource = {
        thread: 'test-thread-1',
        resource: 'test-resource-1',
      };

      let toolCall;
      const stream = await agentOne.stream('Find the name and age of the user - Dero Israel', {
        memory: threadAndResource,
      });
      const suspendData = {
        suspendPayload: null,
        suspendedToolName: '',
      };
      for await (const _chunk of stream.fullStream) {
        console.dir(_chunk, { depth: null });
        if (_chunk.type === 'tool-call-suspended') {
          suspendData.suspendPayload = _chunk.payload.suspendPayload;
          suspendData.suspendedToolName = _chunk.payload.toolName;
        }
      }
      if (suspendData.suspendPayload) {
        const resumeStream = await agentOne.stream('He is 25 years old', {
          memory: threadAndResource,
        });
        for await (const _chunk of resumeStream.fullStream) {
        }

        const toolResults = await resumeStream.toolResults;

        toolCall = toolResults?.find((result: any) => result.payload.toolName === 'workflow-findUserWorkflow')?.payload;

        const name = toolCall?.result?.result?.name;
        const email = toolCall?.result?.result?.email;
        const age = toolCall?.result?.result?.age;

        expect(name).toBe('Dero Israel');
        expect(email).toBe('test@test.com');
        expect(age).toBe(25);
      }

      expect(suspendData.suspendPayload).toBeDefined();
      expect(suspendData.suspendedToolName).toBe('workflow-findUserWorkflow');
      expect((suspendData.suspendPayload as any)?.message).toBe('Please provide the age of the user');
    }, 15000);

    it('should call findUserWorkflow with suspend and resume via generate when autoResumeSuspendedTools is true', async () => {
      const findUserStep = createStep({
        id: 'find-user-step',
        description: 'This is a step that returns the name, email and age',
        inputSchema: z.object({
          name: z.string(),
        }),
        suspendSchema: z.object({
          message: z.string(),
        }),
        resumeSchema: z.object({
          age: z.number(),
        }),
        outputSchema: z.object({
          name: z.string(),
          email: z.string(),
          age: z.number(),
        }),
        execute: async ({ suspend, resumeData, inputData }) => {
          if (!resumeData) {
            return await suspend({ message: 'Please provide the age of the user' });
          }

          return {
            name: inputData?.name,
            email: 'test@test.com',
            age: resumeData?.age,
          };
        },
      });

      const findUserWorkflow = createWorkflow({
        id: 'find-user-workflow',
        description: 'This is a tool that returns name and age',
        inputSchema: z.object({
          name: z.string(),
        }),
        outputSchema: z.object({
          name: z.string(),
          email: z.string(),
          age: z.number(),
        }),
      })
        .then(findUserStep)
        .commit();

      const userAgent = new Agent({
        id: 'user-agent',
        name: 'User Agent',
        instructions: 'You are an agent that can get list of users using findUserWorkflow.',
        model: MODEL,
        workflows: { findUserWorkflow },
        memory,
        defaultOptions: {
          autoResumeSuspendedTools: true,
        },
      });

      const mastra = new Mastra({
        agents: { userAgent },
        logger: false,
        storage: mockStorage,
      });

      const agentOne = mastra.getAgent('userAgent');

      const threadAndResource = {
        thread: 'test-thread-2',
        resource: 'test-resource-2',
      };

      const output = await agentOne.generate('Find the name and age of the user - Dero Israel', {
        memory: threadAndResource,
      });
      expect(output.finishReason).toBe('suspended');
      expect(output.toolResults).toHaveLength(0);
      expect(output.suspendPayload).toMatchObject({
        toolName: 'workflow-findUserWorkflow',
        suspendPayload: {
          message: 'Please provide the age of the user',
        },
      });
      const resumeOutput = await agentOne.generate('He is 25 years old', {
        memory: threadAndResource,
      });

      const toolResults = resumeOutput.toolResults;

      const toolCall = toolResults?.find(
        (result: any) => result.payload.toolName === 'workflow-findUserWorkflow',
      )?.payload;

      const name = (toolCall?.result as any)?.result?.name;
      const email = (toolCall?.result as any)?.result?.email;
      const age = (toolCall?.result as any)?.result?.age;

      expect(resumeOutput.suspendPayload).toBeUndefined();
      expect(name).toBe('Dero Israel');
      expect(email).toBe('test@test.com');
      expect(age).toBe(25);
    }, 15000);
  });
});
