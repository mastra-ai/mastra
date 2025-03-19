import { PassThrough } from 'stream';
import { createOpenAI } from '@ai-sdk/openai';
import { config } from 'dotenv';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { TestIntegration } from '../integration/openapi-toolset.mock';
import type { Logger } from '../logger';
import { noopLogger } from '../logger';
import { Mastra } from '../mastra';
import { createTool } from '../tools';
import { CompositeVoice, MastraVoice } from '../voice';

import { Agent } from './index';

config();

/**
 * Utility function to run a test with silent logging
 * @param agent The agent to silence
 * @param testFn The test function to run with silent logging
 */
async function withSilentLogging<T>(agent: Agent<any, any, any>, testFn: () => Promise<T>): Promise<T> {
  const originalAgentLogger = agent['logger'];
  const originalLLMLogger = agent.llm['logger'];

  try {
    agent.__setLogger(noopLogger as unknown as Logger);
    agent.llm.__setLogger(noopLogger as unknown as Logger);
    return await testFn();
  } finally {
    agent.__setLogger(originalAgentLogger);
    agent.llm.__setLogger(originalLLMLogger);
  }
}

const mockFindUser = vi.fn().mockImplementation(async data => {
  const list = [
    { name: 'Dero Israel', email: 'dero@mail.com' },
    { name: 'Ife Dayo', email: 'dayo@mail.com' },
    { name: 'Tao Feeq', email: 'feeq@mail.com' },
  ];

  const userInfo = list?.find(({ name }) => name === (data as { name: string }).name);
  if (!userInfo) return { message: 'User not found' };
  return userInfo;
});

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

describe('agent', () => {
  const integration = new TestIntegration();

  it('should get a text response from the agent', async () => {
    const electionAgent = new Agent({
      name: 'US Election agent',
      instructions: 'You know about the past US elections',
      model: openai('gpt-4o'),
    });

    const mastra = new Mastra({
      agents: { electionAgent },
    });

    const agentOne = mastra.getAgent('electionAgent');

    const response = await agentOne.generate('Who won the 2016 US presidential election?');

    const { text, toolCalls } = response;

    expect(text).toContain('Donald Trump');
    expect(toolCalls.length).toBeLessThan(1);
  });

  it('should get a streamed text response from the agent', async () => {
    const electionAgent = new Agent({
      name: 'US Election agent',
      instructions: 'You know about the past US elections',
      model: openai('gpt-4o'),
    });

    const mastra = new Mastra({
      agents: { electionAgent },
    });

    const agentOne = mastra.getAgent('electionAgent');

    const response = await agentOne.stream('Who won the 2016 US presidential election?');

    const { textStream } = response;

    let previousText = '';
    let finalText = '';
    for await (const textPart of textStream) {
      expect(textPart === previousText).toBe(false);
      previousText = textPart;
      finalText = finalText + previousText;
      expect(textPart).toBeDefined();
    }

    expect(finalText).toContain('Donald Trump');
  }, 500000);

  it('should get a structured response from the agent', async () => {
    const electionAgent = new Agent({
      name: 'US Election agent',
      instructions: 'You know about the past US elections',
      model: openai('gpt-4o'),
    });

    const mastra = new Mastra({
      agents: { electionAgent },
    });

    const agentOne = mastra.getAgent('electionAgent');

    const response = await agentOne.generate('Who won the 2012 US presidential election?', {
      output: z.object({
        winner: z.string(),
      }),
    });

    const { object } = response;

    expect(object.winner).toContain('Barack Obama');
  });

  it('should support ZodSchema structured output type', async () => {
    const electionAgent = new Agent({
      name: 'US Election agent',
      instructions: 'You know about the past US elections',
      model: openai('gpt-4o'),
    });

    const mastra = new Mastra({
      agents: { electionAgent },
    });

    const agentOne = mastra.getAgent('electionAgent');

    const response = await agentOne.generate('Give me the winners of 2012 and 2016 US presidential elections', {
      output: z.array(
        z.object({
          winner: z.string(),
          year: z.string(),
        }),
      ),
    });

    const { object } = response;

    expect(object.length).toBeGreaterThan(1);
    expect(object).toMatchObject([
      {
        year: '2012',
        winner: 'Barack Obama',
      },
      {
        year: '2016',
        winner: 'Donald Trump',
      },
    ]);
  });

  it('should get a streamed structured response from the agent', async () => {
    const electionAgent = new Agent({
      name: 'US Election agent',
      instructions: 'You know about the past US elections',
      model: openai('gpt-4o'),
    });

    const mastra = new Mastra({
      agents: { electionAgent },
    });

    const agentOne = mastra.getAgent('electionAgent');

    const response = await agentOne.stream('Who won the 2012 US presidential election?', {
      output: z.object({
        winner: z.string(),
      }),
    });

    const { partialObjectStream } = response;

    let previousPartialObject = {} as { winner: string };
    for await (const partialObject of partialObjectStream) {
      if (partialObject['winner'] && previousPartialObject['winner']) {
        expect(partialObject['winner'] === previousPartialObject['winner']).toBe(false);
      }
      previousPartialObject = partialObject as { winner: string };
      expect(partialObject).toBeDefined();
    }

    expect(previousPartialObject['winner']).toBe('Barack Obama');
  });

  it('should call findUserTool', async () => {
    const findUserTool = createTool({
      id: 'Find user tool',
      description: 'This is a test tool that returns the name and email',
      inputSchema: z.object({
        name: z.string(),
      }),
      execute: ({ context }) => {
        return mockFindUser(context) as Promise<Record<string, any>>;
      },
    });

    const userAgent = new Agent({
      name: 'User agent',
      instructions: 'You are an agent that can get list of users using findUserTool.',
      model: openai('gpt-4o'),
      tools: { findUserTool },
    });

    const mastra = new Mastra({
      agents: { userAgent },
    });

    const agentOne = mastra.getAgent('userAgent');

    const response = await agentOne.generate('Find the user with name - Dero Israel', {
      maxSteps: 2,
      toolChoice: 'required',
    });

    const toolCall: any = response.toolResults.find((result: any) => result.toolName === 'findUserTool');

    const name = toolCall?.result?.name;

    expect(mockFindUser).toHaveBeenCalled();
    expect(name).toBe('Dero Israel');
  }, 500000);

  it('should call testTool from TestIntegration', async () => {
    const testAgent = new Agent({
      name: 'Test agent',
      instructions: 'You are an agent that call testTool',
      model: openai('gpt-4o'),
      tools: integration.getStaticTools(),
    });

    const mastra = new Mastra({
      agents: {
        testAgent,
      },
    });

    const agentOne = mastra.getAgent('testAgent');

    const response = await agentOne.generate('Call testTool', {
      toolChoice: 'required',
    });

    const toolCall: any = response.toolResults.find((result: any) => result.toolName === 'testTool');

    const message = toolCall?.result?.message;

    expect(message).toBe('Executed successfully');
  }, 500000);

  it('should properly sanitize incomplete tool calls from memory messages', () => {
    const agent = new Agent({
      name: 'Test agent',
      instructions: 'Test agent',
      model: openai('gpt-4o'),
    });

    const toolResultOne = {
      role: 'tool' as const,
      content: [{ type: 'tool-result' as const, toolName: '', toolCallId: 'tool-1', text: 'result', result: '' }],
    };
    const toolCallTwo = {
      role: 'assistant' as const,
      content: [{ type: 'tool-call' as const, toolName: '', args: '', toolCallId: 'tool-2', text: 'call' }],
    };
    const toolResultTwo = {
      role: 'tool' as const,
      content: [{ type: 'tool-result' as const, toolName: '', toolCallId: 'tool-2', text: 'result', result: '' }],
    };
    const toolCallThree = {
      role: 'assistant' as const,
      content: [{ type: 'tool-call' as const, toolName: '', args: '', toolCallId: 'tool-3', text: 'call' }],
    };
    const memoryMessages = [toolResultOne, toolCallTwo, toolResultTwo, toolCallThree];

    const sanitizedMessages = agent.sanitizeResponseMessages(memoryMessages);

    // The tool result for tool-1 should be removed since there's no matching tool call
    expect(sanitizedMessages).not.toContainEqual(toolResultOne);

    // The tool call and result for tool-2 should remain since they form a complete pair
    expect(sanitizedMessages).toContainEqual(toolCallTwo);
    expect(sanitizedMessages).toContainEqual(toolResultTwo);

    // The tool call for tool-3 should be removed since there's no matching result
    expect(sanitizedMessages).not.toContainEqual(toolCallThree);
    expect(sanitizedMessages).toHaveLength(2);
  });

  describe('voice capabilities', () => {
    class MockVoice extends MastraVoice {
      async speak(_input: string | NodeJS.ReadableStream): Promise<NodeJS.ReadableStream> {
        const stream = new PassThrough();
        stream.end('mock audio');
        return stream;
      }

      async listen(): Promise<string> {
        return 'mock transcription';
      }

      async getSpeakers() {
        return [{ voiceId: 'mock-voice' }];
      }
    }

    let voiceAgent: Agent;
    beforeEach(() => {
      voiceAgent = new Agent({
        name: 'Voice Agent',
        instructions: 'You are an agent with voice capabilities',
        model: openai('gpt-4o'),
        voice: new CompositeVoice({
          speakProvider: new MockVoice({
            speaker: 'mock-voice',
          }),
          listenProvider: new MockVoice({
            speaker: 'mock-voice',
          }),
        }),
      });
    });

    describe('getSpeakers', () => {
      it('should list available voices', async () => {
        const speakers = await voiceAgent.voice?.getSpeakers();
        expect(speakers).toEqual([{ voiceId: 'mock-voice' }]);
      });
    });

    describe('speak', () => {
      it('should generate audio stream from text', async () => {
        const audioStream = await voiceAgent.voice?.speak('Hello World', {
          speaker: 'mock-voice',
        });

        if (!audioStream) {
          expect(audioStream).toBeDefined();
          return;
        }

        const chunks: Buffer[] = [];
        for await (const chunk of audioStream) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const audioBuffer = Buffer.concat(chunks);

        expect(audioBuffer.toString()).toBe('mock audio');
      });

      it('should work with different parameters', async () => {
        const audioStream = await voiceAgent.voice?.speak('Test with parameters', {
          speaker: 'mock-voice',
          speed: 0.5,
        });

        if (!audioStream) {
          expect(audioStream).toBeDefined();
          return;
        }

        const chunks: Buffer[] = [];
        for await (const chunk of audioStream) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const audioBuffer = Buffer.concat(chunks);

        expect(audioBuffer.toString()).toBe('mock audio');
      });
    });

    describe('listen', () => {
      it('should transcribe audio', async () => {
        const audioStream = new PassThrough();
        audioStream.end('test audio data');

        const text = await voiceAgent.voice?.listen(audioStream);
        expect(text).toBe('mock transcription');
      });

      it('should accept options', async () => {
        const audioStream = new PassThrough();
        audioStream.end('test audio data');

        const text = await voiceAgent.voice?.listen(audioStream, {
          language: 'en',
        });
        expect(text).toBe('mock transcription');
      });
    });

    describe('error handling', () => {
      it('should throw error when no voice provider is configured', async () => {
        const agentWithoutVoice = new Agent({
          name: 'No Voice Agent',
          instructions: 'You are an agent without voice capabilities',
          model: openai('gpt-4o'),
        });

        await expect(agentWithoutVoice.getSpeakers()).rejects.toThrow('No voice provider configured');
        await expect(agentWithoutVoice.speak('Test')).rejects.toThrow('No voice provider configured');
        await expect(agentWithoutVoice.listen(new PassThrough())).rejects.toThrow('No voice provider configured');
      });
    });
  });

  describe('agent tool handling', () => {
    it('should accept and execute both Mastra and Vercel tools in Agent constructor', async () => {
      const mastraExecute = vi.fn().mockResolvedValue({ result: 'mastra' });
      const vercelExecute = vi.fn().mockResolvedValue({ result: 'vercel' });

      const agent = new Agent({
        name: 'test',
        instructions: 'test agent instructions',
        model: openai('gpt-4o'),
        tools: {
          mastraTool: createTool({
            id: 'test',
            description: 'test',
            inputSchema: z.object({ name: z.string() }),
            execute: mastraExecute,
          }),
          vercelTool: {
            description: 'test',
            parameters: {
              type: 'object',
              properties: {
                name: { type: 'string' },
              },
            },
            execute: vercelExecute,
          },
        },
      });

      // Verify tools exist
      expect(agent.tools.mastraTool).toBeDefined();
      expect(agent.tools.vercelTool).toBeDefined();

      // Verify both tools can be executed
      await agent.tools.mastraTool.execute?.({ name: 'test' }, { messages: [], toolCallId: '' });
      await agent.tools.vercelTool.execute?.({ name: 'test' }, { messages: [], toolCallId: '' });

      expect(mastraExecute).toHaveBeenCalled();
      expect(vercelExecute).toHaveBeenCalled();
    });
  });

  describe('agent dependency handling', () => {
    it('should pass dependencies to tools', async () => {
      const dependenciesSchema = z.object({
        weatherApiKey: z.string(),
        temperatureUnit: z.enum(['celsius', 'fahrenheit']),
      });

      type WeatherDependencies = z.infer<typeof dependenciesSchema>;

      const mockWeatherTool = vi.fn().mockImplementation(async ({ context, dependencies }) => {
        const location = context.location;
        const unit = dependencies.temperatureUnit;
        const apiKey = dependencies.weatherApiKey;

        return {
          result: {
            location,
            temperature: unit === 'celsius' ? 22 : 72,
            conditions: 'Sunny',
            humidity: '45%',
            _meta: {
              apiKeyUsed: apiKey,
              unit,
            },
          },
        };
      });

      const weatherTool = createTool({
        id: 'getWeatherForecast',
        description: 'Get the current weather forecast for a location',
        inputSchema: z.object({
          location: z.string().describe('The city or location to get weather for'),
        }),
        dependenciesSchema: dependenciesSchema,
        execute: mockWeatherTool,
      });

      const agent = new Agent({
        name: 'WeatherAgent',
        instructions: 'You are an agent that can fetch weather information',
        model: openai('gpt-4o'),
        tools: { weatherTool },
        dependenciesSchema: dependenciesSchema,
      });

      const dependencies: WeatherDependencies = {
        weatherApiKey: 'weather-api-123456',
        temperatureUnit: 'celsius',
      };

      await agent.generate('What is the weather in San Francisco?', {
        dependencies,
        toolChoice: 'required',
      });

      expect(mockWeatherTool).toHaveBeenCalled();
      expect(mockWeatherTool.mock.calls[0][0].dependencies).toEqual(dependencies);
      expect(mockWeatherTool.mock.calls[0][0].context.location).toBe('San Francisco');
    }, 500000);

    it('should handle tools with different dependency schemas than the agent', async () => {
      const agentDepsSchema = z.object({
        apiKey: z.string(),
        userId: z.number(),
        preferences: z.object({
          language: z.string(),
        }),
      });

      const subsetDepsSchema = z.object({
        apiKey: z.string(),
        userId: z.number(),
      });

      const differentDepsSchema = z.object({
        databaseUrl: z.string(),
        timeout: z.number(),
      });

      const subsetToolMock = vi.fn().mockImplementation(async ({ dependencies }) => {
        return {
          result: {
            apiKey: dependencies.apiKey,
            userId: dependencies.userId,
          },
        };
      });

      const differentToolMock = vi.fn().mockImplementation(async ({ dependencies }) => {
        return {
          result: {
            databaseUrl: dependencies.databaseUrl,
            timeout: dependencies.timeout,
          },
        };
      });

      const subsetTool = createTool({
        id: 'subsetTool',
        description: 'Tool with subset of agent dependencies',
        dependenciesSchema: subsetDepsSchema,
        execute: subsetToolMock,
      });

      const differentTool = createTool({
        id: 'differentTool',
        description: 'Tool with different dependencies',
        dependenciesSchema: differentDepsSchema,
        execute: differentToolMock,
      });

      const agent = new Agent({
        name: 'MultiSchemaAgent',
        instructions: 'You are an agent with tools that have different dependency schemas',
        model: openai('gpt-4o'),
        tools: {
          subsetTool: subsetTool as any,
          differentTool: differentTool as any,
        },
        dependenciesSchema: agentDepsSchema,
      });

      const agentDependencies = {
        apiKey: 'agent-api-key',
        userId: 123,
        preferences: {
          language: 'en',
        },
      };

      await agent.generate('Use the subset tool', {
        dependencies: agentDependencies,
        toolChoice: { type: 'tool', toolName: 'subsetTool' },
      });

      expect(subsetToolMock).toHaveBeenCalled();
      expect(subsetToolMock.mock.calls[0][0].dependencies).toEqual({
        apiKey: 'agent-api-key',
        userId: 123,
      });

      subsetToolMock.mockClear();
      differentToolMock.mockClear();

      // Testing with dependencies that satisfy both schemas
      const combinedDependencies = {
        apiKey: 'agent-api-key',
        userId: 123,
        preferences: {
          language: 'en',
        },
        databaseUrl: 'mongodb://localhost:27017',
        timeout: 5000,
      };

      await agent.generate('Use the different tool', {
        dependencies: combinedDependencies,
        toolChoice: { type: 'tool', toolName: 'differentTool' },
      });

      expect(differentToolMock).toHaveBeenCalled();
      expect(differentToolMock.mock.calls[0][0].dependencies).toEqual({
        databaseUrl: 'mongodb://localhost:27017',
        timeout: 5000,
      });
    }, 500000);

    it('should validate dependencies at the tool level', async () => {
      const toolDepsSchema = z.object({
        apiKey: z.string(),
        maxResults: z.number().min(1).max(100),
        filters: z.array(z.string()),
      });

      const toolWithValidationMock = vi.fn().mockImplementation(async ({ dependencies }) => {
        if (dependencies.maxResults > 50) {
          throw new Error('maxResults exceeds recommended limit of 50');
        }

        return {
          result: {
            success: true,
            usedFilters: dependencies.filters,
            resultCount: dependencies.maxResults,
          },
        };
      });

      const toolWithValidation = createTool({
        id: 'validationTool',
        description: 'Tool that validates its dependencies',
        dependenciesSchema: toolDepsSchema,
        execute: toolWithValidationMock,
      });

      const agent = new Agent({
        name: 'ValidationAgent',
        instructions: 'You are an agent with a tool that validates dependencies',
        model: openai('gpt-4o'),
        tools: { toolWithValidation },
        dependenciesSchema: toolDepsSchema,
      });

      const validDependencies = {
        apiKey: 'valid-api-key',
        maxResults: 20,
        filters: ['active', 'recent'],
      };

      await agent.generate('Use the validation tool', {
        dependencies: validDependencies,
        toolChoice: { type: 'tool', toolName: 'toolWithValidation' },
      });

      expect(toolWithValidationMock).toHaveBeenCalled();
      expect(toolWithValidationMock.mock.calls[0][0].dependencies).toEqual(validDependencies);

      toolWithValidationMock.mockClear();

      const invalidDependencies = {
        apiKey: 'valid-api-key',
        maxResults: 75, // Exceeds the tool's internal limit of 50
        filters: ['active', 'recent'],
      };

      await withSilentLogging(agent, async () => {
        await expect(
          agent.generate('Use the validation tool with invalid dependencies', {
            dependencies: invalidDependencies,
            toolChoice: { type: 'tool', toolName: 'toolWithValidation' },
          }),
        ).rejects.toThrow('maxResults exceeds recommended limit of 50');
      });
    }, 500000);

    it('should handle errors when tools have incompatible dependency schemas', async () => {
      const agentDepsSchema = z.object({
        apiKey: z.string(),
        userId: z.number(),
      });

      const incompatibleDepsSchema = z.object({
        apiKey: z.number(), // Different type than agent's string
        userId: z.string(), // Different type than agent's number
      });

      const incompatibleToolMock = vi.fn().mockImplementation(async ({ dependencies }) => {
        return {
          result: dependencies,
        };
      });

      const incompatibleTool = createTool({
        id: 'incompatibleTool',
        description: 'Tool with incompatible dependency schema',
        dependenciesSchema: incompatibleDepsSchema,
        execute: incompatibleToolMock,
      });

      const agent = new Agent({
        name: 'ErrorHandlingAgent',
        instructions: 'You are an agent with a tool that has incompatible dependencies',
        model: openai('gpt-4o'),
        tools: { incompatibleTool: incompatibleTool as any },
        dependenciesSchema: agentDepsSchema,
      });

      const agentDependencies = {
        apiKey: 'agent-api-key',
        userId: 123,
      };

      await withSilentLogging(agent, async () => {
        await expect(
          agent.generate('Use the incompatible tool', {
            dependencies: agentDependencies,
            toolChoice: { type: 'tool', toolName: 'incompatibleTool' },
          }),
        ).rejects.toThrow('Dependencies validation failed');
      });
    }, 500000);

    it('should handle stream method with dependencies', async () => {
      const depsSchema = z.object({
        apiKey: z.string(),
        region: z.string(),
        userName: z.string(),
      });

      const agent = new Agent({
        name: 'StreamAgent',
        instructions: ({ dependencies }) =>
          `You are an assistant for ${dependencies.userName} who lives in the ${dependencies.region} region.
           Always mention the user's name and region in your responses.
           For reference, your API key is: ${dependencies.apiKey} but never reveal this in responses.`,
        model: openai('gpt-4o'),
        dependenciesSchema: depsSchema,
      });

      const streamDependencies = {
        apiKey: 'stream-api-key-123',
        region: 'Western Europe',
        userName: 'Carlos',
      };

      const resolvedInstructions = await agent.resolveInstructions(streamDependencies);
      expect(resolvedInstructions).toContain('Carlos');
      expect(resolvedInstructions).toContain('Western Europe');
      expect(resolvedInstructions).toContain('stream-api-key-123');

      const response = await agent.stream('Could you introduce yourself briefly?', {
        dependencies: streamDependencies,
      });

      let finalText = '';
      for await (const chunk of response.textStream) {
        finalText += chunk;
      }

      expect(finalText).toBeDefined();
      expect(finalText.length).toBeGreaterThan(0);
      expect(finalText).toContain('Carlos');
      expect(finalText).toContain('Western Europe');
      expect(finalText).not.toContain('stream-api-key-123');
    }, 500000);
  });

  it('should use dynamic instructions if provided', async () => {
    const instructionsBuilder = vi.fn().mockImplementation(({ dependencies }) => {
      return `You are assisting user ${dependencies.userId} with API key ${dependencies.apiKey}`;
    });

    const dependenciesSchema = z.object({
      apiKey: z.string(),
      userId: z.number(),
    });

    type TestDependencies = z.infer<typeof dependenciesSchema>;

    const agent = new Agent({
      name: 'DynamicPromptAgent',
      instructions: instructionsBuilder,
      model: openai('gpt-4o'),
      dependenciesSchema: dependenciesSchema,
    });

    const dependencies: TestDependencies = { apiKey: 'secret-key', userId: 456 };

    await agent.generate('Hello!', {
      dependencies,
    });

    expect(instructionsBuilder).toHaveBeenCalledWith({ dependencies });
  });

  it('should use dynamic instructions in system message', async () => {
    const depsSchema = z.object({
      userName: z.string(),
      location: z.string(),
    });

    async function dynamicInstructions({ dependencies }: { dependencies: z.infer<typeof depsSchema> }) {
      return `You are a personal assistant for ${dependencies.userName} who lives in ${dependencies.location}. 
        IMPORTANT: Always start your responses with the phrase "As your assistant in ${dependencies.location}".`;
    }

    const agent = new Agent({
      name: 'RealAgent',
      instructions: dynamicInstructions,
      model: openai('gpt-4o'),
      dependenciesSchema: depsSchema,
    });

    await expect(agent.resolveInstructions()).rejects.toThrow('Dependencies validation failed');

    const response = await agent.generate('Introduce yourself briefly', {
      dependencies: {
        userName: 'Alice',
        location: 'New York',
      },
    });

    expect(response.text).toContain('As your assistant in New York');
  }, 500000);

  it('should support both static and dynamic instructions', async () => {
    const staticAgent = new Agent({
      name: 'StaticAgent',
      instructions: 'You are a helpful assistant.',
      model: openai('gpt-4o'),
    });

    const staticInstructions = await staticAgent.resolveInstructions();
    expect(staticInstructions).toBe('You are a helpful assistant.');

    const dynamicAgentNoSchema = new Agent({
      name: 'DynamicAgentNoSchema',
      instructions: async () => {
        return 'You are a weather assistant. Always use celsius for temperature by default.';
      },
      model: openai('gpt-4o'),
    });

    const dynamicInstructionsNoSchema = await dynamicAgentNoSchema.resolveInstructions();
    expect(dynamicInstructionsNoSchema).toBe(
      'You are a weather assistant. Always use celsius for temperature by default.',
    );

    const depsSchema = z.object({
      userName: z.string(),
      tempUnit: z.enum(['celsius', 'fahrenheit']),
    });

    const dynamicInstructionsBuilder = vi.fn().mockImplementation(async ({ dependencies }) => {
      return `You are a weather assistant for ${dependencies.userName}. 
        Always use ${dependencies.tempUnit} for temperature.`;
    });

    const dynamicAgent = new Agent({
      name: 'DynamicAgent',
      instructions: dynamicInstructionsBuilder,
      model: openai('gpt-4o'),
      dependenciesSchema: depsSchema,
    });

    const validDeps = {
      userName: 'John',
      tempUnit: 'celsius' as const,
    };

    const resolvedInstructions = await dynamicAgent.resolveInstructions(validDeps);
    expect(resolvedInstructions).toContain('You are a weather assistant for John');
    expect(resolvedInstructions).toContain('Always use celsius for temperature');

    await dynamicAgent.generate("What's the weather like?", {
      dependencies: validDeps,
    });

    expect(dynamicInstructionsBuilder).toHaveBeenCalledWith({
      dependencies: validDeps,
    });

    await expect(dynamicAgent.resolveInstructions()).rejects.toThrow('Dependencies validation failed');

    await expect(dynamicAgent.resolveInstructions({ userName: 'John' } as any)).rejects.toThrow(
      'Dependencies validation failed',
    );
  });

  it('should allow updating instructions after agent creation', async () => {
    const agent = new Agent({
      name: 'UpdatableAgent',
      instructions: 'You are a general assistant.',
      model: openai('gpt-4o'),
    });

    const initialInstructions = await agent.resolveInstructions();
    expect(initialInstructions).toBe('You are a general assistant.');

    agent.__updateInstructions(
      'You are a specialized math tutor. Always include the phrase "As your math tutor" in your responses.',
    );

    const updatedInstructions = await agent.resolveInstructions();
    expect(updatedInstructions).toBe(
      'You are a specialized math tutor. Always include the phrase "As your math tutor" in your responses.',
    );

    const response = await agent.generate('Can you help me with algebra?');

    expect(response.text).toContain('As your math tutor');

    function dynamicInstructions() {
      return 'You are a specialized tutor. Always include the phrase "As your tutor" in your responses.';
    }

    agent.__updateInstructions(dynamicInstructions as any);

    const emptyDynamicInstructions = await agent.resolveInstructions();
    expect(emptyDynamicInstructions).toBe(
      'You are a specialized tutor. Always include the phrase "As your tutor" in your responses.',
    );

    const response2 = await agent.generate('Can you help me with physics?');

    expect(response2.text).toContain('As your tutor');

    const subjectSchema = z.object({
      subject: z.string(),
    });

    const agentWithSchema = new Agent({
      name: 'SchemaAgent',
      instructions: 'You are a general assistant.',
      model: openai('gpt-4o'),
      dependenciesSchema: subjectSchema,
    });

    function schemaInstructions({ dependencies }: { dependencies: z.infer<typeof subjectSchema> }) {
      return `You are a specialized ${dependencies.subject} tutor. Always include the phrase "As your ${dependencies.subject} tutor" in your responses.`;
    }

    agentWithSchema.__updateInstructions(schemaInstructions);

    await expect(agentWithSchema.resolveInstructions()).rejects.toThrow('Dependencies validation failed');

    const resolvedWithDeps = await agentWithSchema.resolveInstructions({ subject: 'physics' });
    expect(resolvedWithDeps).toBe(
      'You are a specialized physics tutor. Always include the phrase "As your physics tutor" in your responses.',
    );

    const response3 = await agentWithSchema.generate('Can you help me understand gravity?', {
      dependencies: { subject: 'physics' },
    });

    expect(response3.text).toContain('As your physics tutor');
  }, 500000);

  it('should require dependencies when schema is defined', async () => {
    const depsSchema = z.object({
      userName: z.string(),
      role: z.string(),
      expertise: z.array(z.string()),
    });

    function dynamicInstructions({ dependencies }: { dependencies: z.infer<typeof depsSchema> }) {
      const expertiseList = dependencies.expertise.join(', ');
      return `You are a ${dependencies.role} for ${dependencies.userName} with expertise in ${expertiseList}.`;
    }

    const agent = new Agent({
      name: 'SchemaAgent',
      instructions: dynamicInstructions,
      model: openai('gpt-4o'),
      dependenciesSchema: depsSchema,
    });

    await expect(agent.resolveInstructions()).rejects.toThrow('Dependencies validation failed');

    await expect(
      agent.resolveInstructions({
        userName: 'Bob',
        // Missing 'role' field
        expertise: ['JavaScript'],
      } as any),
    ).rejects.toThrow('Dependencies validation failed');

    const resolvedInstructions = await agent.resolveInstructions({
      userName: 'Bob',
      role: 'technical advisor',
      expertise: ['JavaScript', 'TypeScript', 'React'],
    });

    expect(resolvedInstructions).toBe(
      'You are a technical advisor for Bob with expertise in JavaScript, TypeScript, React.',
    );
  });

  it('should ignore dependencies when no schema is defined', async () => {
    function dynamicInstructions({ dependencies }: { dependencies: any }) {
      if (Object.keys(dependencies).length === 0) {
        return 'You are a general assistant with no dependencies.';
      }
      return `You should not see this: ${JSON.stringify(dependencies)}`;
    }

    const agent = new Agent({
      name: 'NoSchemaAgent',
      instructions: dynamicInstructions,
      model: openai('gpt-4o'),
    });

    const resolvedInstructions = await agent.resolveInstructions({
      userName: 'Bob',
      role: 'technical advisor',
      expertise: ['JavaScript'],
    });

    expect(resolvedInstructions).toBe(
      'You should not see this: {"userName":"Bob","role":"technical advisor","expertise":["JavaScript"]}',
    );
  });

  it('should resolve instructions with both static strings and dynamic builders', async () => {
    const staticAgent = new Agent({
      name: 'StaticInstructionsAgent',
      instructions: 'You are a static instructions agent.',
      model: openai('gpt-4o'),
    });

    const resolvedStaticInstructions = await staticAgent.resolveInstructions();
    expect(resolvedStaticInstructions).toBe('You are a static instructions agent.');

    const resolvedStaticWithDeps = await staticAgent.resolveInstructions({ foo: 'bar' } as any);
    expect(resolvedStaticWithDeps).toBe('You are a static instructions agent.');

    const simpleDynamicAgent = new Agent({
      name: 'SimpleDynamicAgent',
      instructions: ({ dependencies }: { dependencies: any }) => {
        return `You are a dynamic agent with ${dependencies?.mode || 'default'} mode.`;
      },
      model: openai('gpt-4o'),
    });

    const resolvedSimpleDynamic = await simpleDynamicAgent.resolveInstructions();
    expect(resolvedSimpleDynamic).toBe('You are a dynamic agent with default mode.');

    const resolvedSimpleDynamicWithDeps = await simpleDynamicAgent.resolveInstructions({ mode: 'advanced' });
    expect(resolvedSimpleDynamicWithDeps).toBe('You are a dynamic agent with advanced mode.');

    const depsSchema = z.object({
      mode: z.enum(['beginner', 'intermediate', 'expert']),
      userName: z.string(),
    });

    const complexDynamicAgent = new Agent({
      name: 'ComplexDynamicAgent',
      instructions: ({ dependencies }: { dependencies: z.infer<typeof depsSchema> }) => {
        return `Hello ${dependencies.userName}, you are using the ${dependencies.mode} mode.`;
      },
      model: openai('gpt-4o'),
      dependenciesSchema: depsSchema,
    });

    const resolvedComplexDynamic = await complexDynamicAgent.resolveInstructions({
      mode: 'expert',
      userName: 'Charlie',
    });
    expect(resolvedComplexDynamic).toBe('Hello Charlie, you are using the expert mode.');

    await expect(
      complexDynamicAgent.resolveInstructions({
        mode: 'invalid-mode' as any,
        userName: 'Dave',
      }),
    ).rejects.toThrow('Dependencies validation failed');

    await expect(complexDynamicAgent.resolveInstructions()).rejects.toThrow('Dependencies validation failed');
  });
});
