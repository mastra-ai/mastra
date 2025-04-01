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

  it('should allow updating instructions after agent creation', async () => {
    const agent = new Agent({
      name: 'UpdatableAgent',
      instructions: 'You are a general assistant.',
      model: openai('gpt-4o'),
    });

    agent.__updateInstructions(
      'You are a specialized math tutor. Always include the phrase "As your math tutor" in your responses.',
    );

    const response = await agent.generate('Can you help me with algebra?');

    expect(response.text).toContain('As your math tutor');
  }, 500000);

  it('should override instructions in generate/stream methods', async () => {
    const agent = new Agent({
      name: 'OverrideAgent',
      instructions: 'You are a helpful assistant who responds in a friendly manner.',
      model: openai('gpt-4o'),
    });

    const generateResponse = await agent.generate('What is your role?', {
      instructions: 'You are a strict professor who always speaks formally.',
    });

    expect(generateResponse.text).toContain('professor');
    expect(generateResponse.text).not.toContain('helpful assistant');

    const streamResponse = await agent.stream('How would you describe yourself?', {
      instructions: 'You are a pirate who always speaks like a pirate, saying "Arrr" and using pirate slang.',
    });

    let streamedText = '';
    for await (const chunk of streamResponse.textStream) {
      streamedText += chunk;
    }

    expect(streamedText).toMatch(/Arrr|pirate/i);
    expect(streamedText).not.toContain('helpful assistant');
  }, 500000);

  describe('voice capabilities', () => {
    class MockVoice extends MastraVoice {
      async speak(): Promise<NodeJS.ReadableStream> {
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
          output: new MockVoice({
            speaker: 'mock-voice',
          }),
          input: new MockVoice({
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

        await expect(agentWithoutVoice.voice.getSpeakers()).rejects.toThrow('No voice provider configured');
        await expect(agentWithoutVoice.voice.speak('Test')).rejects.toThrow('No voice provider configured');
        await expect(agentWithoutVoice.voice.listen(new PassThrough())).rejects.toThrow('No voice provider configured');
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

  describe('agent variable handling', () => {
    it('should pass variables to tools', async () => {
      const variablesSchema = z.object({
        weatherApiKey: z.string(),
        temperatureUnit: z.enum(['celsius', 'fahrenheit']),
      });

      type WeatherVariables = z.infer<typeof variablesSchema>;

      const mockWeatherTool = vi.fn().mockImplementation(async ({ context, variables }) => {
        const location = context.location;
        const unit = variables.temperatureUnit;
        const apiKey = variables.weatherApiKey;

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
        variablesSchema: variablesSchema,
        execute: mockWeatherTool,
      });

      const agent = new Agent({
        name: 'WeatherAgent',
        instructions: 'You are an agent that can fetch weather information',
        model: openai('gpt-4o'),
        tools: { weatherTool },
        variablesSchema: variablesSchema,
      });

      const variables: WeatherVariables = {
        weatherApiKey: 'weather-api-123456',
        temperatureUnit: 'celsius',
      };

      await agent.generate('What is the weather in San Francisco?', {
        variables,
        toolChoice: 'required',
      });

      expect(mockWeatherTool).toHaveBeenCalled();
      expect(mockWeatherTool.mock.calls[0][0].variables).toEqual(variables);
      expect(mockWeatherTool.mock.calls[0][0].context.location).toBe('San Francisco');
    }, 500000);

    it('should handle tools with different variable schemas than the agent', async () => {
      const agentVarsSchema = z.object({
        apiKey: z.string(),
        userId: z.number(),
        preferences: z.object({
          language: z.string(),
        }),
      });

      const subsetVarsSchema = z.object({
        apiKey: z.string(),
        userId: z.number(),
      });

      const differentVarsSchema = z.object({
        databaseUrl: z.string(),
        timeout: z.number(),
      });

      const subsetToolMock = vi.fn().mockImplementation(async ({ variables }) => {
        return {
          result: {
            apiKey: variables.apiKey,
            userId: variables.userId,
          },
        };
      });

      const differentToolMock = vi.fn().mockImplementation(async ({ variables }) => {
        return {
          result: {
            databaseUrl: variables.databaseUrl,
            timeout: variables.timeout,
          },
        };
      });

      const subsetTool = createTool({
        id: 'subsetTool',
        description: 'Tool with subset of agent variables',
        variablesSchema: subsetVarsSchema,
        execute: subsetToolMock,
      });

      const differentTool = createTool({
        id: 'differentTool',
        description: 'Tool with different variables',
        variablesSchema: differentVarsSchema,
        execute: differentToolMock,
      });

      const agent = new Agent({
        name: 'MultiSchemaAgent',
        instructions: 'You are an agent with tools that have different variable schemas',
        model: openai('gpt-4o'),
        tools: {
          subsetTool: subsetTool as any,
          differentTool: differentTool as any,
        },
        variablesSchema: agentVarsSchema,
      });

      const agentVariables = {
        apiKey: 'agent-api-key',
        userId: 123,
        preferences: {
          language: 'en',
        },
      };

      await agent.generate('Use the subset tool', {
        variables: agentVariables,
        toolChoice: { type: 'tool', toolName: 'subsetTool' },
      });

      expect(subsetToolMock).toHaveBeenCalled();
      expect(subsetToolMock.mock.calls[0][0].variables).toEqual({
        apiKey: 'agent-api-key',
        userId: 123,
      });

      subsetToolMock.mockClear();
      differentToolMock.mockClear();

      // Testing with variables that satisfy both schemas
      const combinedVariables = {
        apiKey: 'agent-api-key',
        userId: 123,
        preferences: {
          language: 'en',
        },
        databaseUrl: 'mongodb://localhost:27017',
        timeout: 5000,
      };

      await agent.generate('Use the different tool', {
        variables: combinedVariables,
        toolChoice: { type: 'tool', toolName: 'differentTool' },
      });

      expect(differentToolMock).toHaveBeenCalled();
      expect(differentToolMock.mock.calls[0][0].variables).toEqual({
        databaseUrl: 'mongodb://localhost:27017',
        timeout: 5000,
      });
    }, 500000);

    it('should validate variables at the tool level', async () => {
      const toolVarsSchema = z.object({
        apiKey: z.string(),
        maxResults: z.number().min(1).max(100),
        filters: z.array(z.string()),
      });

      const toolWithValidationMock = vi
        .fn()
        .mockImplementation(async ({ variables }: { variables: z.infer<typeof toolVarsSchema> }) => {
          if (variables.maxResults > 50) {
            throw new Error('maxResults exceeds recommended limit of 50');
          }

          return {
            result: {
              success: true,
              usedFilters: variables.filters,
              resultCount: variables.maxResults,
            },
          };
        });

      const toolWithValidation = createTool({
        id: 'validationTool',
        description: 'Tool that validates its variables',
        variablesSchema: toolVarsSchema,
        execute: toolWithValidationMock,
      });

      const agent = new Agent({
        name: 'ValidationAgent',
        instructions: 'You are an agent with a tool that validates variables',
        model: openai('gpt-4o'),
        tools: { toolWithValidation },
        variablesSchema: toolVarsSchema,
      });

      const validVariables = {
        apiKey: 'valid-api-key',
        maxResults: 20,
        filters: ['active', 'recent'],
      };

      await agent.generate('Use the validation tool', {
        variables: validVariables,
        toolChoice: { type: 'tool', toolName: 'toolWithValidation' },
      });

      expect(toolWithValidationMock).toHaveBeenCalled();
      expect(toolWithValidationMock.mock.calls[0][0].variables).toEqual(validVariables);

      toolWithValidationMock.mockClear();

      const invalidVariables = {
        apiKey: 'valid-api-key',
        maxResults: 75, // Exceeds the tool's internal limit of 50
        filters: ['active', 'recent'],
      };

      await withSilentLogging(agent, async () => {
        await expect(
          agent.generate('Use the validation tool with invalid variables', {
            variables: invalidVariables,
            toolChoice: { type: 'tool', toolName: 'toolWithValidation' },
          }),
        ).rejects.toThrow('maxResults exceeds recommended limit of 50');
      });
    }, 500000);

    it('should handle errors when tools have incompatible variable schemas', async () => {
      const agentVarsSchema = z.object({
        apiKey: z.string(),
        userId: z.number(),
      });

      const incompatibleVarsSchema = z.object({
        apiKey: z.number(), // Different type than agent's string
        userId: z.string(), // Different type than agent's number
      });

      const incompatibleToolMock = vi.fn().mockImplementation(async ({ variables }) => {
        return {
          result: variables,
        };
      });

      const incompatibleTool = createTool({
        id: 'incompatibleTool',
        description: 'Tool with incompatible variable schema',
        variablesSchema: incompatibleVarsSchema,
        execute: incompatibleToolMock,
      });

      const agent = new Agent({
        name: 'ErrorHandlingAgent',
        instructions: 'You are an agent with a tool that has incompatible variables',
        model: openai('gpt-4o'),
        tools: { incompatibleTool: incompatibleTool as any },
        variablesSchema: agentVarsSchema,
      });

      const agentVariables = {
        apiKey: 'agent-api-key',
        userId: 123,
      };

      await withSilentLogging(agent, async () => {
        await expect(
          agent.generate('Use the incompatible tool', {
            variables: agentVariables,
            toolChoice: { type: 'tool', toolName: 'incompatibleTool' },
          }),
        ).rejects.toThrow('Variables validation failed');
      });
    }, 500000);
  });

  it('should handle stream method with variables', async () => {
    const varsSchema = z.object({
      apiKey: z.string(),
      region: z.string(),
      userName: z.string(),
    });

    const agent = new Agent({
      name: 'StreamAgent',
      instructions: 'You are an assistant who responds with location information',
      model: openai('gpt-4o'),
      variablesSchema: varsSchema,
    });

    const streamVariables = {
      apiKey: 'stream-api-key-123',
      region: 'Western Europe',
      userName: 'Carlos',
    };

    const response = await agent.stream('Could you introduce yourself briefly?', {
      variables: streamVariables,
    });

    let finalText = '';
    for await (const chunk of response.textStream) {
      finalText += chunk;
    }

    expect(finalText).toBeDefined();
    expect(finalText.length).toBeGreaterThan(0);
  }, 500000);
});
