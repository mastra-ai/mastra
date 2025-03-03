import { PassThrough } from 'stream';
import { createOpenAI } from '@ai-sdk/openai';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { config } from 'dotenv';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { TestIntegration } from '../integration/openapi-toolset.mock';
import { Mastra } from '../mastra';
import { createTool } from '../tools';
import { CompositeVoice, MastraVoice } from '../voice';

import { Agent } from './index';
import { CoreMessage } from 'ai';

config();

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

  it('should properly trim context to specified maxContextLength', async () => {
    const electionAgent = new Agent({
      name: 'US Election agent',
      instructions: 'You know about the past US elections',
      model: openai('gpt-4o'),
      maxContextLength: 3,
    });

    const mastra = new Mastra({
      agents: { electionAgent },
    });

    const agentOne = mastra.getAgent('electionAgent');

    // 118 tokens if all are included
    const context: CoreMessage[] = [
      { role: 'user', content: 'Who won the 2016 US presidential election?' },
      { role: 'assistant', content: 'Donald Trump won the 2016 US presidential election.' },
      { role: 'user', content: 'Who won the 2012 US presidential election?' },
      { role: 'assistant', content: 'Barack Obama won the 2012 US presidential election.' },
      { role: 'user', content: 'Who won the 2008 US presidential election?' },
      { role: 'assistant', content: 'Barack Obama won the 2008 US presidential election.' },
    ];

    const response = await agentOne.generate('Who won the 2016 US presidential election?', { context });

    const {
      usage: { promptTokens },
    } = response;

    expect(promptTokens).toBeLessThan(80);
  }, 500000);

  it('should use telemetry options when generating a response', async () => {
    const electionAgent = new Agent({
      name: 'US Election agent',
      instructions: 'You know about the past US elections',
      model: openai('gpt-4o'),
    });

    const memoryExporter = new InMemorySpanExporter();
    const tracerProvider = new NodeTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(memoryExporter)],
    });
    tracerProvider.register();

    const mastra = new Mastra({
      agents: { electionAgent },
      telemetry: {
        enabled: true,
        serviceName: 'test-service',
        export: {
          type: 'custom',
          exporter: memoryExporter,
        },
      },
    });
    const agentOne = mastra.getAgent('electionAgent');

    await agentOne.generate('Who won the 2016 US presidential election?', {
      telemetry: { functionId: 'test-function-id', metadata: { test: 'test' } },
    });

    const spans = memoryExporter.getFinishedSpans();
    const aiSpan = spans.find(span => span.name === 'ai.generateText');
    expect(aiSpan).toBeDefined();
    expect(aiSpan?.attributes['ai.telemetry.metadata.test']).toBe('test');
    expect(aiSpan?.attributes['resource.name']).toBe('test-function-id');
    await tracerProvider.shutdown();
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
        const speakers = await voiceAgent.getSpeakers();
        expect(speakers).toEqual([{ voiceId: 'mock-voice' }]);
      });
    });

    describe('speak', () => {
      it('should generate audio stream from text', async () => {
        const audioStream = await voiceAgent.speak('Hello World', {
          speaker: 'mock-voice',
        });

        const chunks: Buffer[] = [];
        for await (const chunk of audioStream) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const audioBuffer = Buffer.concat(chunks);

        expect(audioBuffer.toString()).toBe('mock audio');
      });

      it('should work with different parameters', async () => {
        const audioStream = await voiceAgent.speak('Test with parameters', {
          speaker: 'mock-voice',
          speed: 0.5,
        });

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

        const text = await voiceAgent.listen(audioStream);
        expect(text).toBe('mock transcription');
      });

      it('should accept options', async () => {
        const audioStream = new PassThrough();
        audioStream.end('test audio data');

        const text = await voiceAgent.listen(audioStream, {
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
});
