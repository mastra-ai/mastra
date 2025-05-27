import { PassThrough } from 'stream';
import { createOpenAI } from '@ai-sdk/openai';
import { simulateReadableStream } from 'ai';
import { MockLanguageModelV1 } from 'ai/test';
import { config } from 'dotenv';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { TestIntegration } from '../integration/openapi-toolset.mock';
import { Mastra } from '../mastra';
import { RuntimeContext } from '../runtime-context';
import { createTool } from '../tools';
import { CompositeVoice, MastraVoice } from '../voice';

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

describe('agent', () => {
  const integration = new TestIntegration();

  let dummyModel;
  beforeEach(() => {
    dummyModel = new MockLanguageModelV1({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 20 },
        text: `Dummy response`,
      }),
    });
  });

  it('should get a text response from the agent', async () => {
    const electionAgent = new Agent({
      name: 'US Election agent',
      instructions: 'You know about the past US elections',
      model: new MockLanguageModelV1({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { promptTokens: 10, completionTokens: 20 },
          text: `Donald Trump won the 2016 U.S. presidential election, defeating Hillary Clinton.`,
        }),
      }),
    });

    const mastra = new Mastra({
      agents: { electionAgent },
      logger: false,
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
      model: new MockLanguageModelV1({
        doStream: async () => ({
          stream: simulateReadableStream({
            chunks: [
              { type: 'text-delta', textDelta: 'Donald' },
              { type: 'text-delta', textDelta: ' Trump' },
              { type: 'text-delta', textDelta: ` won` },
              { type: 'text-delta', textDelta: ` the` },
              { type: 'text-delta', textDelta: ` ` },
              { type: 'text-delta', textDelta: `201` },
              { type: 'text-delta', textDelta: `6` },
              { type: 'text-delta', textDelta: ` US` },
              { type: 'text-delta', textDelta: ` presidential` },
              { type: 'text-delta', textDelta: ` election` },
              {
                type: 'finish',
                finishReason: 'stop',
                logprobs: undefined,
                usage: { completionTokens: 10, promptTokens: 3 },
              },
            ],
          }),
          rawCall: { rawPrompt: null, rawSettings: {} },
        }),
      }),
    });

    const mastra = new Mastra({
      agents: { electionAgent },
      logger: false,
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
      model: new MockLanguageModelV1({
        defaultObjectGenerationMode: 'json',
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { promptTokens: 10, completionTokens: 20 },
          text: `{"winner":"Barack Obama"}`,
        }),
      }),
    });

    const mastra = new Mastra({
      agents: { electionAgent },
      logger: false,
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
      // model: openai('gpt-4o'),
      model: new MockLanguageModelV1({
        defaultObjectGenerationMode: 'json',
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { promptTokens: 10, completionTokens: 20 },
          text: `{"elements":[{"winner":"Barack Obama","year":"2012"},{"winner":"Donald Trump","year":"2016"}]}`,
        }),
      }),
    });

    const mastra = new Mastra({
      agents: { electionAgent },
      logger: false,
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
      model: new MockLanguageModelV1({
        defaultObjectGenerationMode: 'json',
        doStream: async () => ({
          stream: simulateReadableStream({
            chunks: [
              { type: 'text-delta', textDelta: '{' },
              { type: 'text-delta', textDelta: '"winner":' },
              { type: 'text-delta', textDelta: `"Barack Obama"` },
              { type: 'text-delta', textDelta: `}` },
              {
                type: 'finish',
                finishReason: 'stop',
                logprobs: undefined,
                usage: { completionTokens: 10, promptTokens: 3 },
              },
            ],
          }),
          rawCall: { rawPrompt: null, rawSettings: {} },
        }),
      }),
    });

    const mastra = new Mastra({
      agents: { electionAgent },
      logger: false,
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
      logger: false,
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

  it('generate - should pass and call client side tools', async () => {
    const userAgent = new Agent({
      name: 'User agent',
      instructions: 'You are an agent that can get list of users using client side tools.',
      model: openai('gpt-4o'),
    });

    const result = await userAgent.generate('Make it green', {
      clientTools: {
        changeColor: {
          id: 'changeColor',
          description: 'This is a test tool that returns the name and email',
          inputSchema: z.object({
            color: z.string(),
          }),
          execute: async () => {
            console.log('SUHHH');
          },
        },
      },
    });

    expect(result.toolCalls.length).toBeGreaterThan(0);
  });

  it('stream - should pass and call client side tools', async () => {
    const userAgent = new Agent({
      name: 'User agent',
      instructions: 'You are an agent that can get list of users using client side tools.',
      model: openai('gpt-4o'),
    });

    const result = await userAgent.stream('Make it green', {
      clientTools: {
        changeColor: {
          id: 'changeColor',
          description: 'This is a test tool that returns the name and email',
          inputSchema: z.object({
            color: z.string(),
          }),
          execute: async () => {
            console.log('SUHHH');
          },
        },
      },
      onFinish: props => {
        expect(props.toolCalls.length).toBeGreaterThan(0);
      },
    });

    for await (const _ of result.fullStream) {
    }
  });

  it('should generate with default max steps', { timeout: 10000 }, async () => {
    const findUserTool = createTool({
      id: 'Find user tool',
      description: 'This is a test tool that returns the name and email',
      inputSchema: z.object({
        name: z.string(),
      }),
      execute: async ({ context }) => {
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
      logger: false,
    });

    const agentOne = mastra.getAgent('userAgent');

    const res = await agentOne.generate(
      'Use the "findUserTool" to Find the user with name - Joe and return the name and email',
    );

    const toolCall: any = res.steps[0].toolResults.find((result: any) => result.toolName === 'findUserTool');

    expect(res.steps.length > 1);
    expect(res.text.includes('joe@mail.com'));
    expect(toolCall?.result?.email).toBe('joe@mail.com');
    expect(mockFindUser).toHaveBeenCalled();
  });

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
      logger: false,
    });

    const agentOne = mastra.getAgent('testAgent');

    const response = await agentOne.generate('Call testTool', {
      toolChoice: 'required',
    });

    const toolCall: any = response.toolResults.find((result: any) => result.toolName === 'testTool');

    const message = toolCall?.result?.message;

    expect(message).toBe('Executed successfully');
  }, 500000);

  it('should reach default max steps', async () => {
    const agent = new Agent({
      name: 'Test agent',
      instructions: 'Test agent',
      model: openai('gpt-4o'),
      tools: integration.getStaticTools(),
      defaultGenerateOptions: {
        maxSteps: 7,
      },
    });

    const response = await agent.generate('Call testTool 10 times.', {
      toolChoice: 'required',
    });
    expect(response.steps.length).toBe(7);
  }, 500000);

  it('should properly sanitize incomplete tool calls from memory messages', () => {
    const agent = new Agent({
      name: 'Test agent',
      instructions: 'Test agent',
      model: new MockLanguageModelV1({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { promptTokens: 10, completionTokens: 20 },
          text: ``,
        }),
      }),
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

  it('should preserve empty assistant messages after tool use', () => {
    const agent = new Agent({
      name: 'Test agent',
      instructions: 'Test agent',
      model: new MockLanguageModelV1({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { promptTokens: 10, completionTokens: 20 },
          text: ``,
        }),
      }),
    });

    // Create an assistant message with a tool call
    const assistantToolCallMessage = {
      role: 'assistant' as const,
      content: [{ type: 'tool-call' as const, toolName: 'testTool', toolCallId: 'tool-1', args: {}, text: 'call' }],
    };

    // Create a tool message that responds to the tool call
    const toolMessage = {
      role: 'tool' as const,
      content: [
        { type: 'tool-result' as const, toolName: 'testTool', toolCallId: 'tool-1', text: 'result', result: '' },
      ],
    };

    // Create an empty assistant message that follows the tool message
    const emptyAssistantMessage = {
      role: 'assistant' as const,
      content: '', // Empty string content
    };

    const userMessage = {
      role: 'user' as const,
      content: 'Hello',
    };

    const messages = [assistantToolCallMessage, toolMessage, emptyAssistantMessage, userMessage];

    const sanitizedMessages = agent.sanitizeResponseMessages(messages);

    // The empty assistant message should be preserved even though it has empty content
    expect(sanitizedMessages).toContainEqual(emptyAssistantMessage);

    // The tool message should be preserved because it has a matching tool call ID
    expect(sanitizedMessages).toContainEqual(toolMessage);

    // All messages should be preserved
    expect(sanitizedMessages).toHaveLength(4);
    expect(sanitizedMessages[0]).toEqual(assistantToolCallMessage);
    expect(sanitizedMessages[1]).toEqual(toolMessage);
    expect(sanitizedMessages[2]).toEqual(emptyAssistantMessage);
    expect(sanitizedMessages[3]).toEqual(userMessage);
  });

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
        model: dummyModel,
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
          model: dummyModel,
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
        model: openai('gpt-4'),
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
      expect((agent.getTools() as Agent['tools']).mastraTool).toBeDefined();
      expect((agent.getTools() as Agent['tools']).vercelTool).toBeDefined();

      // Verify both tools can be executed
      await (agent.getTools() as Agent['tools']).mastraTool.execute!({ name: 'test' });
      await (agent.getTools() as Agent['tools']).vercelTool.execute!({ name: 'test' });

      expect(mastraExecute).toHaveBeenCalled();
      expect(vercelExecute).toHaveBeenCalled();
    });

    it('should make runtimeContext available to tools when injected in generate', async () => {
      const testRuntimeContext = new RuntimeContext([['test-value', 'runtimeContext-value']]);
      let capturedValue: string | null = null;

      const testTool = createTool({
        id: 'runtimeContext-test-tool',
        description: 'A tool that verifies runtimeContext is available',
        inputSchema: z.object({
          query: z.string(),
        }),
        execute: ({ runtimeContext }) => {
          capturedValue = runtimeContext.get('test-value')!;

          return Promise.resolve({
            success: true,
            runtimeContextAvailable: !!runtimeContext,
            runtimeContextValue: capturedValue,
          });
        },
      });

      const agent = new Agent({
        name: 'runtimeContext-test-agent',
        instructions: 'You are an agent that tests runtimeContext availability.',
        model: openai('gpt-4o'),
        tools: { testTool },
      });

      const mastra = new Mastra({
        agents: { agent },
        logger: false,
      });

      const testAgent = mastra.getAgent('agent');

      const response = await testAgent.generate('Use the runtimeContext-test-tool with query "test"', {
        toolChoice: 'required',
        runtimeContext: testRuntimeContext,
      });

      const toolCall = response.toolResults.find(result => result.toolName === 'testTool');

      expect(toolCall?.result?.runtimeContextAvailable).toBe(true);
      expect(toolCall?.result?.runtimeContextValue).toBe('runtimeContext-value');
      expect(capturedValue).toBe('runtimeContext-value');
    }, 500000);

    it('should make runtimeContext available to tools when injected in stream', async () => {
      const testRuntimeContext = new RuntimeContext([['test-value', 'runtimeContext-value']]);
      let capturedValue: string | null = null;

      const testTool = createTool({
        id: 'runtimeContext-test-tool',
        description: 'A tool that verifies runtimeContext is available',
        inputSchema: z.object({
          query: z.string(),
        }),
        execute: ({ runtimeContext }) => {
          capturedValue = runtimeContext.get('test-value')!;

          return Promise.resolve({
            success: true,
            runtimeContextAvailable: !!runtimeContext,
            runtimeContextValue: capturedValue,
          });
        },
      });

      const agent = new Agent({
        name: 'runtimeContext-test-agent',
        instructions: 'You are an agent that tests runtimeContext availability.',
        model: openai('gpt-4o'),
        tools: { testTool },
      });

      const mastra = new Mastra({
        agents: { agent },
        logger: false,
      });

      const testAgent = mastra.getAgent('agent');

      const stream = await testAgent.stream('Use the runtimeContext-test-tool with query "test"', {
        toolChoice: 'required',
        runtimeContext: testRuntimeContext,
      });

      for await (const _chunk of stream.textStream) {
        // empty line
      }

      const toolCall = (await stream.toolResults).find(result => result.toolName === 'testTool');

      expect(toolCall?.result?.runtimeContextAvailable).toBe(true);
      expect(toolCall?.result?.runtimeContextValue).toBe('runtimeContext-value');
      expect(capturedValue).toBe('runtimeContext-value');
    }, 500000);
  });
});
