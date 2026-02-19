import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAI as createOpenAIV5 } from '@ai-sdk/openai-v5';
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import type { ToolInvocationUIPart } from '@ai-sdk/ui-utils-v5';
import type { LanguageModelV1 } from '@internal/ai-sdk-v4';
import { stepCountIs, tool } from '@internal/ai-sdk-v5';
import { config } from 'dotenv';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { TestIntegration } from '../integration/openapi-toolset.mock';
import { ModelRouterLanguageModel } from '../llm';
import { noopLogger } from '../logger';
import { Mastra } from '../mastra';
import { MockMemory } from '../memory/mock';
import type { ProcessInputStepArgs } from '../processors';
import { createTool } from '../tools';
import { assertNoDuplicateParts } from './test-utils';
import { Agent } from './index';

config();

const mockFindUser = vi.fn().mockImplementation(async data => {
  const list = [
    { name: 'Dero Israel', email: 'dero@mail.com' },
    { name: 'Ife Dayo', email: 'dayo@mail.com' },
    { name: 'Tao Feeq', email: 'feeq@mail.com' },
    { name: 'Joe', email: 'joe@mail.com' },
  ];

  const userInfo = list?.find(({ name }) => name === (data as { name: string }).name);
  if (!userInfo) return { message: 'User not found' };
  return userInfo;
});

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
const openai_v5 = createOpenAIV5({ apiKey: process.env.OPENAI_API_KEY });

function agentE2ETests({ version }: { version: 'v1' | 'v2' }) {
  const integration = new TestIntegration();
  let openaiModel: LanguageModelV1 | LanguageModelV2;

  beforeEach(() => {
    if (version === 'v1') {
      openaiModel = openai('gpt-4o');
    } else {
      openaiModel = openai_v5('gpt-4o');
    }
  });

  describe('test schema compat structured output', () => {
    it('should convert optional fields to nullable for openai and succeed without error', async () => {
      const weatherInfo = createTool({
        id: 'weather-info',
        description: 'Fetches the current weather information for a given city',
        inputSchema: z.object({
          city: z.string(),
        }),
        execute: async inputData => {
          return {
            city: inputData.city,
            weather: 'sunny',
            temperature_celsius: 19,
            temperature_fahrenheit: 66,
            humidity: 50,
            wind: '10 mph',
          };
        },
      });

      const weatherAgent = new Agent({
        id: 'weather-agent',
        name: 'Weather Agent',
        instructions:
          'You are a weather agent. When asked about weather in any city, use the weather info tool with the city name as the input.',
        description: 'An agent that can help you get the weather for a given city.',
        model: 'openai/gpt-4o',
        tools: {
          weatherInfo,
        },
      });

      const mastra = new Mastra({
        agents: { weatherAgent },
        logger: false,
      });
      const agent = mastra.getAgent('weatherAgent');

      const schema = z.object({
        weather: z.string(),
        temperature: z.number(),
        humidity: z.number(),
        // Optional should be transformed to nullable and then the data set to undefined
        windSpeed: z.string().optional(),
        // Optional.nullable should be transformed to nullable and then the data set to undefined
        barometricPressure: z.number().optional().nullable(),
        // Nullable should not change and be able to return a nullable value from openAI
        precipitation: z.number().nullable(),
      });

      const result = await agent.generate(
        'What is the weather in London? You can omit wind speed, precipitation, and barometric pressure.',
        {
          structuredOutput: {
            schema,
          },
        },
      );

      expect(result.error).toBeUndefined();

      const resultData = {
        weather: expect.any(String),
        temperature: expect.any(Number),
        humidity: expect.any(Number),
        windSpeed: undefined,
        barometricPressure: undefined,
        precipitation: null,
      };

      const resultObject = await result.object;
      expect(resultObject).toEqual(resultData);
    });
  });

  describe(`${version} - agent (e2e)`, () => {
    it('should call tool without input or output schemas', async () => {
      const noSchemaTool = createTool({
        id: 'noSchemaTool',
        description: 'Returns test data with arbitrary structure',
        execute: async () => {
          return { success: true, data: { arbitrary: 'value', count: 42 } };
        },
      });

      const testAgent = new Agent({
        id: 'test-agent',
        name: 'Test agent',
        instructions: 'You are an agent that can use the noSchemaTool to get test data.',
        model: openaiModel,
        tools: { noSchemaTool },
      });

      const mastra = new Mastra({
        agents: { testAgent },
        logger: false,
      });

      const agent = mastra.getAgent('testAgent');

      let toolCall;
      let response;
      if (version === 'v1') {
        response = await agent.generateLegacy('Use the noSchemaTool to get test data', {
          maxSteps: 2,
          toolChoice: 'required',
        });
        toolCall = response.toolResults.find((result: any) => result.toolName === 'noSchemaTool');
      } else {
        response = await agent.generate('Use the noSchemaTool to get test data');

        toolCall = response.toolResults.find((result: any) => result.payload.toolName === 'noSchemaTool')?.payload;
      }

      expect(toolCall?.result).toEqual({ success: true, data: { arbitrary: 'value', count: 42 } });
      expect(toolCall?.result?.error).toBeUndefined();
    }, 15000);

    it('should call findUserTool', async () => {
      const findUserTool = createTool({
        id: 'Find user tool',
        description: 'This is a test tool that returns the name and email',
        inputSchema: z.object({
          name: z.string(),
        }),
        execute: (input, _context) => {
          return mockFindUser(input) as Promise<Record<string, any>>;
        },
      });

      const userAgent = new Agent({
        id: 'user-agent',
        name: 'User Agent',
        instructions: 'You are an agent that can get list of users using findUserTool.',
        model: openaiModel,
        tools: { findUserTool },
      });

      const mastra = new Mastra({
        agents: { userAgent },
        logger: false,
      });

      const agentOne = mastra.getAgent('userAgent');

      let toolCall;
      let response;
      if (version === 'v1') {
        response = await agentOne.generateLegacy('Find the user with name - Dero Israel', {
          maxSteps: 2,
          toolChoice: 'required',
        });
        toolCall = response.toolResults.find((result: any) => result.toolName === 'findUserTool');
      } else {
        response = await agentOne.generate('Find the user with name - Dero Israel');
        toolCall = response.toolResults.find((result: any) => result.payload.toolName === 'findUserTool')?.payload;
      }

      const name = toolCall?.result?.name;

      expect(mockFindUser).toHaveBeenCalled();
      expect(name).toBe('Dero Israel');
    }, 500000);

    it('should call tool without input or output schemas (duplicate)', async () => {
      const noSchemaTool = createTool({
        id: 'noSchemaTool',
        description: 'Returns test data with arbitrary structure',
        execute: async () => {
          return { success: true, data: { arbitrary: 'value', count: 42 } };
        },
      });

      const testAgent = new Agent({
        id: 'test-agent',
        name: 'Test agent',
        instructions: 'You are an agent that can use the noSchemaTool to get test data.',
        model: openaiModel,
        tools: { noSchemaTool },
      });

      const mastra = new Mastra({
        agents: { testAgent },
        logger: false,
      });

      const agent = mastra.getAgent('testAgent');

      let toolCall;
      let response;
      if (version === 'v1') {
        response = await agent.generateLegacy('Use the noSchemaTool to get test data', {
          maxSteps: 2,
          toolChoice: 'required',
        });
        toolCall = response.toolResults.find((result: any) => result.toolName === 'noSchemaTool');
      } else {
        response = await agent.generate('Use the noSchemaTool to get test data');
        toolCall = response.toolResults.find((result: any) => result.payload.toolName === 'noSchemaTool')?.payload;
      }

      expect(toolCall?.result).toEqual({ success: true, data: { arbitrary: 'value', count: 42 } });
      expect(toolCall?.result?.error).toBeUndefined();
    }, 500000);

    it('generate - should pass and call client side tools', async () => {
      const userAgent = new Agent({
        id: 'user-agent',
        name: 'User Agent',
        instructions: 'You are an agent that can get list of users using client side tools.',
        model: openaiModel,
      });

      let result;
      if (version === 'v1') {
        result = await userAgent.generateLegacy('Make it green', {
          clientTools: {
            changeColor: {
              id: 'changeColor',
              description: 'This is a test tool that returns the name and email',
              inputSchema: z.object({
                color: z.string(),
              }),
              execute: async () => {},
            },
          },
        });
      } else {
        result = await userAgent.generate('Make it green', {
          clientTools: {
            changeColor: {
              id: 'changeColor',
              description: 'This is a test tool that returns the name and email',
              inputSchema: z.object({
                color: z.string(),
              }),
              execute: async () => {},
            },
          },
        });
      }

      expect(result.toolCalls.length).toBeGreaterThan(0);
    }, 500000);

    it('stream - should pass and call client side tools', async () => {
      const userAgent = new Agent({
        id: 'user-agent',
        name: 'User Agent',
        instructions: 'You are an agent that can get list of users using client side tools.',
        model: openaiModel,
      });

      let result;

      if (version === 'v1') {
        result = await userAgent.streamLegacy('Make it green', {
          clientTools: {
            changeColor: {
              id: 'changeColor',
              description: 'This is a test tool that returns the name and email',
              inputSchema: z.object({
                color: z.string(),
              }),
              execute: async () => {},
            },
          },
          onFinish: props => {
            expect(props.toolCalls.length).toBeGreaterThan(0);
          },
        });
      } else {
        result = await userAgent.stream('Make it green', {
          clientTools: {
            changeColor: {
              id: 'changeColor',
              description: 'This is a test tool that returns the name and email',
              inputSchema: z.object({
                color: z.string(),
              }),
              execute: async () => {},
            },
          },
        });
      }

      for await (const _ of result.fullStream) {
      }

      expect(await result.finishReason).toBe('tool-calls');
    });

    it('should generate with default max steps', { timeout: 10000 }, async () => {
      const findUserTool = createTool({
        id: 'Find user tool',
        description: 'This is a test tool that returns the name and email',
        inputSchema: z.object({
          name: z.string(),
        }),
        execute: async input => {
          return mockFindUser(input) as Promise<Record<string, any>>;
        },
      });

      const userAgent = new Agent({
        id: 'user-agent',
        name: 'User Agent',
        instructions: 'You are an agent that can get list of users using findUserTool.',
        model: openaiModel,
        tools: { findUserTool },
      });

      const mastra = new Mastra({
        agents: { userAgent },
        logger: false,
      });

      const agentOne = mastra.getAgent('userAgent');

      let res;
      let toolCall;

      if (version === 'v1') {
        res = await agentOne.generateLegacy(
          'Use the \"findUserTool\" to Find the user with name - Joe and return the name and email',
        );
        toolCall = res.steps[0].toolResults.find((result: any) => result.toolName === 'findUserTool');
      } else {
        res = await agentOne.generate(
          'Use the \"findUserTool\" to Find the user with name - Joe and return the name and email',
        );
        toolCall = res.toolResults.find((result: any) => result.payload.toolName === 'findUserTool').payload;
      }

      expect(res.steps.length).toBeGreaterThan(1);
      expect(res.text).toContain('joe@mail.com');
      expect(toolCall?.result?.email).toBe('joe@mail.com');
      expect(mockFindUser).toHaveBeenCalled();
    });

    it('should reach default max steps', async () => {
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test agent',
        instructions: 'Test agent',
        model: openaiModel,
        tools: integration.getStaticTools(),
        defaultGenerateOptionsLegacy: {
          maxSteps: 7,
        },
        defaultOptions: {
          maxSteps: 7,
        },
      });

      let response;

      if (version === 'v1') {
        response = await agent.generateLegacy('Call testTool 10 times.', {
          toolChoice: 'required',
        });
      } else {
        response = await agent.generate('Call testTool 10 times.', {
          toolChoice: 'required',
        });
      }

      expect(response.steps.length).toBe(7);
    }, 500000);

    it('should reach default max steps / stopWhen', async () => {
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test agent',
        instructions: 'Test agent',
        model: openaiModel,
        tools: integration.getStaticTools(),
      });

      let response;

      if (version === 'v1') {
        response = await agent.generateLegacy('Call testTool 10 times.', {
          toolChoice: 'required',
          maxSteps: 7,
        });
      } else {
        response = await agent.generate('Call testTool 10 times.', {
          toolChoice: 'required',
          stopWhen: stepCountIs(7),
        });
      }

      expect(response.steps.length).toBe(7);
    }, 500000);

    it('should retry when tool fails and eventually succeed with maxSteps=5', async () => {
      let toolCallCount = 0;
      const failuresBeforeSuccess = 2;

      const flakeyTool = createTool({
        id: 'flakeyTool',
        description: 'A tool that fails initially but eventually succeeds',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        execute: async input => {
          toolCallCount++;
          if (toolCallCount <= failuresBeforeSuccess) {
            throw new Error(`Tool failed! Attempt ${toolCallCount}. Please try again.`);
          }
          return { output: `Success on attempt ${toolCallCount}: ${input.input}` };
        },
      });

      const agent = new Agent({
        id: 'retry-agent',
        name: 'retry-agent',
        instructions: 'Call the flakey tool with input "test data".',
        model: openaiModel,
        tools: { flakeyTool },
      });
      agent.__setLogger(noopLogger);

      let response;
      if (version === 'v1') {
        response = await agent.generateLegacy('Please call the flakey tool with input "test data"', {
          maxSteps: 5,
        });
      } else {
        response = await agent.generate('Please call the flakey tool with input "test data"', {
          maxSteps: 5,
        });
      }

      expect(response.steps.length).toBeGreaterThan(1);
      expect(response.steps.length).toBeLessThanOrEqual(5);
      expect(toolCallCount).toBeGreaterThanOrEqual(3);

      let foundSuccess = false;
      if (version === 'v1') {
        for (const step of response.steps) {
          if (step.toolResults) {
            for (const result of step.toolResults) {
              if (result.toolName === 'flakeyTool' && result.result && result.result.output?.includes('Success')) {
                foundSuccess = true;
                break;
              }
            }
          }
        }
      } else {
        for (const step of response.steps) {
          if (step.toolResults) {
            for (const result of step.toolResults) {
              if (
                result.payload.toolName === 'flakeyTool' &&
                result.payload.result &&
                result.payload.result.output?.includes('Success')
              ) {
                foundSuccess = true;
                break;
              }
            }
          }
        }
      }

      expect(foundSuccess).toBe(true);
    }, 500000);
  });

  describe(`${version} - context parameter handling (e2e)`, () => {
    it(`should handle system messages in context parameter`, async () => {
      const agent = new Agent({
        id: 'test-system-context-agent',
        name: 'Test System Context',
        model: openaiModel,
        instructions: 'You are a helpful assistant.',
      });

      const systemMessage = {
        role: 'system' as const,
        content: 'Additional system instructions from context',
      };

      const userMessage = {
        role: 'user' as const,
        content: 'What are your instructions?',
      };

      const complexSystemMessage =
        version === 'v2'
          ? {
              role: 'system' as const,
              content: [{ type: 'text' as const, text: 'Complex system message from context' }],
            }
          : {
              role: 'system' as const,
              content: 'Complex system message from context',
            };

      let result;
      if (version === 'v1') {
        result = await agent.streamLegacy('Tell me about yourself', {
          context: [systemMessage, userMessage, complexSystemMessage],
        });
      } else {
        result = await agent.stream('Tell me about yourself', {
          context: [systemMessage, userMessage, complexSystemMessage],
        });
      }

      const parts: any[] = [];
      for await (const part of result.fullStream) {
        parts.push(part);
      }

      let messages: any[];
      if (version === 'v1') {
        const requestData = await result.request;
        if (!requestData?.body) {
          return;
        }
        messages = JSON.parse(requestData.body).messages;
      } else {
        const requestData = await (result as any).getFullOutput();
        messages = requestData.request.body.input;
      }

      const systemMessages = messages.filter((m: any) => m.role === 'system');
      expect(systemMessages.length).toBe(3);
      expect(messages[0].role).toBe('system');
      expect(messages[0].content).toBe('You are a helpful assistant.');

      expect(
        systemMessages.find((m: any) => m.content === 'Additional system instructions from context'),
      ).toBeDefined();

      expect(
        systemMessages.find(
          (m: any) =>
            m.content === 'Complex system message from context' ||
            m.content?.[0]?.text === 'Complex system message from context',
        ),
      ).toBeDefined();

      const userMessages = messages.filter((m: any) => m.role === 'user');
      expect(userMessages.length).toBe(2);

      if (version === 'v1') {
        expect(
          userMessages.find(
            (m: any) =>
              m.content?.[0]?.text === 'What are your instructions?' || m.content === 'What are your instructions?',
          ),
        ).toBeDefined();
      } else {
        expect(userMessages.find((m: any) => m.content?.[0]?.text === 'What are your instructions?')).toBeDefined();
      }
    }, 20000);

    it(`should handle mixed message types in context parameter`, async () => {
      const agent = new Agent({
        id: 'test-mixed-context',
        name: 'Test Mixed Context',
        model: openaiModel,
        instructions: 'You are a helpful assistant.',
      });

      const contextMessages = [
        {
          role: 'user' as const,
          content: 'Previous user question',
        },
        {
          role: 'assistant' as const,
          content: 'Previous assistant response',
        },
        {
          role: 'system' as const,
          content: 'Additional context instructions',
        },
      ];

      let result;
      if (version === 'v1') {
        result = await agent.streamLegacy('Current question', {
          context: contextMessages,
        });
      } else {
        result = await agent.stream('Current question', {
          context: contextMessages,
        });
      }

      for await (const _part of result.fullStream) {
      }

      let messages: any[];
      if (version === 'v1') {
        const requestData = await result.request;
        if (!requestData?.body) {
          return;
        }
        messages = JSON.parse(requestData.body).messages;
      } else {
        const requestData = await (result as any).getFullOutput();
        messages = requestData.request.body.input;
      }

      const systemMessages = messages.filter((m: any) => m.role === 'system');
      const userMessages = messages.filter((m: any) => m.role === 'user');
      const assistantMessages = messages.filter((m: any) => m.role === 'assistant');

      expect(systemMessages.length).toBe(2);
      expect(userMessages.length).toBe(2);
      expect(assistantMessages.length).toBe(1);
    });
  });

  describe(`${version} - Agent save message parts (e2e)`, () => {
    // Processors need prepareStep and onStepFinish to be able to have MessageHistory processor save partial messages. Or we need message list in processOutputStream
    it.skip('should rescue partial messages (including tool calls) if generate is aborted/interrupted', async () => {
      const mockMemory = new MockMemory();
      let saveCallCount = 0;
      let savedMessages: any[] = [];
      mockMemory.saveMessages = async function (...args) {
        saveCallCount++;
        savedMessages.push(...args[0].messages);
        return MockMemory.prototype.saveMessages.apply(this, args);
      };

      const errorTool = createTool({
        id: 'errorTool',
        description: 'Always throws an error.',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        execute: async () => {
          throw new Error('Tool failed!');
        },
      });

      const echoTool = createTool({
        id: 'echoTool',
        description: 'Echoes the input string.',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        execute: async input => ({ output: input.input }),
      });

      const agent = new Agent({
        id: 'partial-rescue-agent-generate',
        name: 'Partial Rescue Agent Generate',
        instructions:
          'Call each tool in a separate step. Do not use parallel tool calls. Always wait for the result of one tool before calling the next.',
        model: openaiModel,
        memory: mockMemory,
        tools: { errorTool, echoTool },
      });
      agent.__setLogger(noopLogger);

      let stepCount = 0;
      let caught = false;
      try {
        if (version === 'v1') {
          await agent.generateLegacy(
            'Please echo this and then use the error tool. Be verbose and take multiple steps.',
            {
              threadId: 'thread-partial-rescue-generate',
              resourceId: 'resource-partial-rescue-generate',
              experimental_continueSteps: true,
              savePerStep: true,
              onStepFinish: (result: any) => {
                if (result.toolCalls && result.toolCalls.length > 1) {
                  throw new Error('Model attempted parallel tool calls; test requires sequential tool calls');
                }
                stepCount++;
                if (stepCount === 2) {
                  throw new Error('Simulated error in onStepFinish');
                }
              },
            },
          );
        } else {
          await agent.generate('Please echo this and then use the error tool. Be verbose and take multiple steps.', {
            memory: {
              thread: 'thread-partial-rescue-generate',
              resource: 'resource-partial-rescue-generate',
            },
            savePerStep: true,
            onStepFinish: (result: any) => {
              if (result.toolCalls && result.toolCalls.length > 1) {
                throw new Error('Model attempted parallel tool calls; test requires sequential tool calls');
              }
              stepCount++;
              if (stepCount === 2) {
                throw new Error('Simulated error in onStepFinish');
              }
            },
          });
        }
      } catch (err: any) {
        caught = true;
        expect(err.message).toMatch(/Simulated error in onStepFinish/i);
      }

      expect(caught).toBe(true);

      const result = await mockMemory.recall({
        threadId: 'thread-partial-rescue-generate',
        resourceId: 'resource-partial-rescue-generate',
      });
      const messages = result.messages;

      expect(messages.find(m => m.role === 'user')).toBeTruthy();
      expect(messages.find(m => m.role === 'assistant')).toBeTruthy();
      const assistantWithToolInvocation = messages.find(
        m =>
          m.role === 'assistant' &&
          m.content &&
          Array.isArray(m.content.parts) &&
          m.content.parts.some(
            part =>
              part.type === 'tool-invocation' &&
              part.toolInvocation &&
              (part.toolInvocation.toolName === 'echoTool' || part.toolInvocation.toolName === 'errorTool'),
          ),
      );
      expect(assistantWithToolInvocation).toBeTruthy();
      expect(saveCallCount).toBeGreaterThanOrEqual(1);
    });

    // Processors need prepareStep and onStepFinish to be able to have MessageHistory processor save partial messages. Or we need message list in processOutputStream
    it.skip('should incrementally save messages across steps and tool calls', async () => {
      const mockMemory = new MockMemory();
      let saveCallCount = 0;
      mockMemory.saveMessages = async function (...args) {
        saveCallCount++;
        return MockMemory.prototype.saveMessages.apply(this, args);
      };

      const echoTool = createTool({
        id: 'echoTool',
        description: 'Echoes the input string.',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        execute: async input => ({ output: input.input }),
      });

      const agent = new Agent({
        id: 'test-agent-generate',
        name: 'Test Agent Generate',
        instructions: 'If the user prompt contains "Echo:", always call the echoTool. Be verbose in your response.',
        model: openaiModel,
        memory: mockMemory,
        tools: { echoTool },
      });

      if (version === 'v1') {
        await agent.generateLegacy('Echo: Please echo this long message and explain why.', {
          threadId: 'thread-echo-generate',
          resourceId: 'resource-echo-generate',
          savePerStep: true,
        });
      } else {
        await agent.generate('Echo: Please echo this long message and explain why.', {
          memory: {
            thread: 'thread-echo-generate',
            resource: 'resource-echo-generate',
          },
          savePerStep: true,
        });
      }

      expect(saveCallCount).toBeGreaterThan(1);
      const result = await mockMemory.recall({
        threadId: 'thread-echo-generate',
        resourceId: 'resource-echo-generate',
      });
      const messages = result.messages;
      expect(messages.length).toBeGreaterThan(0);

      const assistantMsg = messages.find(m => m.role === 'assistant');
      expect(assistantMsg).toBeDefined();
      assertNoDuplicateParts(assistantMsg!.content.parts);

      const toolResultIds = new Set(
        assistantMsg!.content.parts
          .filter(p => p.type === 'tool-invocation' && p.toolInvocation.state === 'result')
          .map(p => (p as ToolInvocationUIPart).toolInvocation.toolCallId),
      );
      expect(assistantMsg!.content.toolInvocations?.length).toBe(toolResultIds.size);
    }, 500000);

    // Processors need prepareStep and onStepFinish to be able to have MessageHistory processor save partial messages. Or we need message list in processOutputStream
    it.skip('should incrementally save messages with multiple tools and multi-step generation', async () => {
      const mockMemory = new MockMemory();
      let saveCallCount = 0;
      mockMemory.saveMessages = async function (...args) {
        saveCallCount++;
        return MockMemory.prototype.saveMessages.apply(this, args);
      };

      const echoTool = createTool({
        id: 'echoTool',
        description: 'Echoes the input string.',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        execute: async input => ({ output: input.input }),
      });

      const uppercaseTool = createTool({
        id: 'uppercaseTool',
        description: 'Converts input to uppercase.',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        execute: async input => ({ output: input.input.toUpperCase() }),
      });

      const agent = new Agent({
        id: 'test-agent-multi-generate',
        name: 'Test Agent Multi Generate',
        instructions: [
          'If the user prompt contains "Echo:", call the echoTool.',
          'If the user prompt contains "Uppercase:", call the uppercaseTool.',
          'If both are present, call both tools and explain the results.',
          'Be verbose in your response.',
        ].join(' '),
        model: openaiModel,
        memory: mockMemory,
        tools: { echoTool, uppercaseTool },
      });

      if (version === 'v1') {
        await agent.generateLegacy(
          'Echo: Please echo this message. Uppercase: please also uppercase this message. Explain both results.',
          {
            threadId: 'thread-multi-generate',
            resourceId: 'resource-multi-generate',
            savePerStep: true,
          },
        );
      } else {
        await agent.generate(
          'Echo: Please echo this message. Uppercase: please also uppercase this message. Explain both results.',
          {
            memory: {
              thread: 'thread-multi-generate',
              resource: 'resource-multi-generate',
            },
            savePerStep: true,
          },
        );
      }
      expect(saveCallCount).toBeGreaterThan(1);
      const result = await mockMemory.recall({
        threadId: 'thread-multi-generate',
        resourceId: 'resource-multi-generate',
      });
      const messages = result.messages;
      expect(messages.length).toBeGreaterThan(0);
      const assistantMsg = messages.find(m => m.role === 'assistant');
      expect(assistantMsg).toBeDefined();
      assertNoDuplicateParts(assistantMsg!.content.parts);

      const toolResultIds = new Set(
        assistantMsg!.content.parts
          .filter(p => p.type === 'tool-invocation' && p.toolInvocation.state === 'result')
          .map(p => (p as ToolInvocationUIPart).toolInvocation.toolCallId),
      );
      expect(assistantMsg!.content.toolInvocations?.length).toBe(toolResultIds.size);
    }, 500000);
  });

  if (version === 'v2') {
    describe(`${version} - stream destructuring support (e2e)`, () => {
      it('should support destructuring of stream properties and methods', async () => {
        const agent = new Agent({
          id: 'test-destructuring',
          name: 'Test Destructuring',
          model: openaiModel,
          instructions: 'You are a helpful assistant.',
        });

        const result = await agent.stream('Say hello');

        const { fullStream, textStream, text, usage, consumeStream, toolCalls, finishReason, request } = result;

        try {
          await consumeStream();

          const textResult = await text;
          expect(typeof textResult).toBe('string');

          const usageResult = await usage;
          expect(usageResult).toBeDefined();

          const toolCallsResult = await toolCalls;
          expect(Array.isArray(toolCallsResult)).toBe(true);

          const finishReasonResult = await finishReason;
          expect(finishReasonResult).toBeDefined();

          const requestResult = await request;
          expect(requestResult).toBeDefined();

          expect(fullStream).toBeDefined();
          expect(textStream).toBeDefined();
        } catch (error) {
          console.error('Destructuring test failed:', error);
          throw error;
        }
      });
    });
  }

  it(`${version} - stream - should pass and call client side tools with experimental output`, async () => {
    const userAgent = new Agent({
      id: 'user-agent',
      name: 'User Agent',
      instructions: 'You are an agent that can get list of users using client side tools.',
      model: openaiModel,
    });

    if (version === 'v1') {
      const result = await userAgent.streamLegacy('Make it green', {
        clientTools: {
          changeColor: {
            id: 'changeColor',
            description: 'This is a test tool that returns the name and email',
            inputSchema: z.object({
              color: z.string(),
            }),
          },
        },
        onFinish: props => {
          expect(props.toolCalls.length).toBeGreaterThan(0);
        },
        experimental_output: z.object({
          color: z.string(),
        }),
      });

      for await (const _ of result.fullStream) {
      }
    } else {
      const result = await userAgent.stream('Make it green', {
        clientTools: {
          changeColor: {
            id: 'changeColor',
            description: 'This is a test tool that returns the name and email',
            inputSchema: z.object({
              color: z.string(),
            }),
          },
        },
        onFinish: props => {
          expect(props.toolCalls.length).toBeGreaterThan(0);
        },
        structuredOutput: {
          schema: z.object({
            color: z.string(),
          }),
        },
      });

      await result.consumeStream();
    }
  }, 10000);

  // TODO: This test is flakey, but it's blocking PR merges
  it.skipIf(version === 'v2')(
    `${version} - generate - should pass and call client side tools with experimental output`,
    async () => {
      const userAgent = new Agent({
        id: 'user-agent',
        name: 'User Agent',
        instructions: 'You are an agent that can get list of users using client side tools.',
        model: openaiModel,
      });

      if (version === 'v1') {
        const result = await userAgent.generateLegacy('Make it green', {
          clientTools: {
            changeColor: {
              id: 'changeColor',
              description: 'This is a test tool that returns the name and email',
              inputSchema: z.object({
                color: z.string(),
              }),
            },
          },
          experimental_output: z.object({
            color: z.string(),
          }),
        });

        expect(result.toolCalls.length).toBeGreaterThan(0);
      } else {
        const result = await userAgent.generate('Make it green', {
          clientTools: {
            changeColor: {
              id: 'changeColor',
              description: 'This is a test tool that changes the color of the text',
              inputSchema: z.object({
                color: z.string(),
              }),
            },
          },
          structuredOutput: {
            schema: z.object({
              color: z.string(),
            }),
          },
        });

        expect(result.toolCalls.length).toBeGreaterThan(0);
      }
    },
    30000,
  );
}

describe('Agent E2E Tests', () => {
  agentE2ETests({ version: 'v1' });
  agentE2ETests({ version: 'v2' });
});

describe('prepareStep (e2e)', () => {
  it('tools', async () => {
    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'You are a helpful assistant.',
      model: 'openai/gpt-4o',
      tools: {
        tool1: createTool({
          id: 'tool1',
          description: 'tool1',
          inputSchema: z.object({ value: z.string() }),
          execute: async () => 'result1',
        }),
        tool2: tool({
          inputSchema: z.object({ value: z.string() }),
          execute: async () => 'result2',
        }),
      },
    });

    let prepareStepCallArgs: ProcessInputStepArgs<any> | undefined;
    const result = await agent.generate('Hello', {
      prepareStep: args => {
        prepareStepCallArgs = args;
        return {
          model: 'openai/gpt-4o',
          activeTools: Object.keys(args.tools ?? {}).filter(toolName => toolName !== 'tool2'),
          toolChoice: 'none',
        };
      },
    });

    expect(prepareStepCallArgs).toMatchObject({
      model: expect.any(ModelRouterLanguageModel),
      toolChoice: 'auto',
      tools: {
        tool1: expect.any(Object),
        tool2: expect.any(Object),
      },
      stepNumber: 0,
    });

    expect((result.request.body as any).tools).toMatchObject([
      {
        type: 'function',
        name: 'tool1',
      },
    ]);
  });

  it('should execute a new tool added in prepareStep with toolChoice required', async () => {
    const firstToolExecute = vi.fn().mockResolvedValue('result1');
    const secondToolExecute = vi.fn().mockResolvedValue('result2');
    const thirdToolExecute = vi.fn().mockResolvedValue('result3');

    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'You are a helpful assistant.',
      model: 'openai/gpt-4o',
      tools: {
        tool1: createTool({
          id: 'tool1',
          description: 'tool1',
          inputSchema: z.object({ value: z.string() }),
          execute: firstToolExecute,
        }),
      },
    });

    let prepareStepCalls: any[] = [];
    const result = await agent.generate('Hello', {
      maxSteps: 4,
      prepareStep: ({ stepNumber, tools, toolChoice }) => {
        prepareStepCalls.push({ stepNumber, tools: Object.keys(tools ?? {}), toolChoice });
        if (stepNumber === 0) {
          return {
            toolChoice: {
              type: 'tool',
              toolName: 'tool1',
            },
          };
        } else if (stepNumber === 1) {
          return {
            tools: {
              tool2: tool({
                inputSchema: z.object({ value: z.string() }),
                execute: secondToolExecute,
              }),
            },
            toolChoice: {
              type: 'tool',
              toolName: 'tool2',
            },
          };
        } else if (stepNumber === 2) {
          return {
            tools: {
              tool3: createTool({
                id: 'tool-3',
                description: 'tool 3',
                inputSchema: z.object({ value: z.string() }),
                execute: thirdToolExecute,
              }),
            },
            toolChoice: {
              type: 'tool',
              toolName: 'tool3',
            },
          };
        } else if (stepNumber === 3) {
          return {
            toolChoice: {
              type: 'tool',
              toolName: 'tool1',
            },
          };
        }
      },
    });

    expect(firstToolExecute).toHaveBeenCalledTimes(2);
    expect(secondToolExecute).toHaveBeenCalledTimes(1);
    expect(thirdToolExecute).toHaveBeenCalledTimes(1);

    expect((result.request.body as any)?.tools).toMatchObject([
      {
        type: 'function',
        name: 'tool1',
        description: 'tool1',
        parameters: {
          type: 'object',
          properties: {
            value: {
              type: 'string',
            },
          },
          required: ['value'],
          additionalProperties: false,
          $schema: 'http://json-schema.org/draft-07/schema#',
        },
      },
    ]);

    expect(result.steps).toMatchObject([
      {
        toolCalls: [
          {
            type: 'tool-call',
            runId: expect.any(String),
            from: 'AGENT',
            payload: {
              toolCallId: expect.any(String),
              toolName: 'tool1',
              args: {
                value: expect.any(String),
              },
            },
          },
        ],
      },
      {
        toolCalls: [
          {
            type: 'tool-call',
            runId: expect.any(String),
            from: 'AGENT',
            payload: {
              toolCallId: expect.any(String),
              toolName: 'tool2',
              args: {
                value: expect.any(String),
              },
            },
          },
        ],
      },
      {
        toolCalls: [
          {
            type: 'tool-call',
            runId: expect.any(String),
            from: 'AGENT',
            payload: {
              toolCallId: expect.any(String),
              toolName: 'tool3',
              args: {
                value: expect.any(String),
              },
            },
          },
        ],
      },
      {
        toolCalls: [
          {
            type: 'tool-call',
            runId: expect.any(String),
            from: 'AGENT',
            payload: {
              toolCallId: expect.any(String),
              toolName: 'tool1',
              args: {
                value: expect.any(String),
              },
            },
          },
        ],
      },
    ]);

    expect(prepareStepCalls).toMatchObject([
      { stepNumber: 0, tools: ['tool1'], toolChoice: 'auto' },
      { stepNumber: 1, tools: ['tool1'], toolChoice: 'auto' },
      { stepNumber: 2, tools: ['tool1'], toolChoice: 'auto' },
      { stepNumber: 3, tools: ['tool1'], toolChoice: 'auto' },
    ]);
    expect(result.toolCalls).toHaveLength(4);
  });

  it('should use mastra model config openai compatible object when set in prepareStep', async () => {
    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'You are a helpful assistant.',
      model: 'openai/gpt-4o',
      tools: {
        tool1: tool({
          inputSchema: z.object({ value: z.string() }),
          execute: async () => 'result1',
        }),
      },
    });

    let capturedModel: any;
    const result = await agent.generate('Hello', {
      prepareStep: ({ model, stepNumber }) => {
        capturedModel = model;
        if (stepNumber === 0) {
          return {
            model: {
              providerId: 'openai',
              modelId: 'gpt-4o-mini',
            },
          };
        }
      },
    });
    expect(capturedModel.provider).toBe('openai');
    expect(capturedModel.modelId).toBe('gpt-4o');
    expect((result?.request?.body as any)?.model).toBe('gpt-4o-mini');
    expect(result?.response?.modelMetadata).toMatchObject({
      modelId: 'gpt-4o-mini',
      modelProvider: 'openai',
      modelVersion: 'v2',
    });
  });

  it('should use model router magic string when set in prepareStep', async () => {
    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'You are a helpful assistant.',
      model: 'openai/gpt-4o',
    });

    const output = await agent.stream('Hello', {
      prepareStep: ({ model, stepNumber }) => {
        if (stepNumber === 0) {
          expect(model.provider).toBe('openai');
          expect(model.modelId).toBe('gpt-4o');

          return {
            model: 'openai/gpt-4o-mini',
          };
        }
      },
    });
    const result = await output.getFullOutput();
    expect((result?.request?.body as any)?.model).toBe('gpt-4o-mini');
  });
});
