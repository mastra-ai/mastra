import { randomUUID } from 'crypto';
import { openai } from '@ai-sdk/openai';
import { openai as openai_v5 } from '@ai-sdk/openai-v5';
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import type { ToolInvocationUIPart } from '@ai-sdk/ui-utils-v5';
import type { LanguageModelV1 } from '@internal/ai-sdk-v4';
import { MockLanguageModelV1 } from '@internal/ai-sdk-v4';
import { MockLanguageModelV2, convertArrayToReadableStream } from 'ai-v5/test';
import { config } from 'dotenv';
import { describe, expect, it, vi } from 'vitest';
import z from 'zod';
import { noopLogger } from '../../logger';
import type { StorageThreadType } from '../../memory';
import { MockMemory } from '../../memory/mock';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import { MessageList } from '../message-list/index';
import { assertNoDuplicateParts } from '../test-utils';
import { getDummyResponseModel, getEmptyResponseModel, getErrorResponseModel } from './mock-model';

config();

function runStreamTest(version: 'v1' | 'v2') {
  let openaiModel: LanguageModelV1 | LanguageModelV2;

  if (version === 'v1') {
    openaiModel = openai('gpt-4o-mini');
  } else {
    openaiModel = openai_v5('gpt-4o-mini');
  }

  const dummyResponseModel = getDummyResponseModel(version);
  const emptyResponseModel = getEmptyResponseModel(version);
  const errorResponseModel = getErrorResponseModel(version);

  describe(`${version} - stream`, () => {
    it('should rescue partial messages (including tool calls) if stream is aborted/interrupted', async () => {
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
        id: 'partial-rescue-agent',
        name: 'Partial Rescue Agent',
        instructions:
          'Call each tool in a separate step. Do not use parallel tool calls. Always wait for the result of one tool before calling the next.',
        model: openaiModel,
        memory: mockMemory,
        tools: { errorTool, echoTool },
      });

      agent.__setLogger(noopLogger);

      let stepCount = 0;

      let stream;
      if (version === 'v1') {
        stream = await agent.streamLegacy(
          'Please echo this and then use the error tool. Be verbose and take multiple steps.',
          {
            threadId: 'thread-partial-rescue',
            resourceId: 'resource-partial-rescue',
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
        stream = await agent.stream(
          'Please echo this and then use the error tool. Be verbose and you must take multiple steps. Call tools 2x in parallel.',
          {
            threadId: 'thread-partial-rescue',
            resourceId: 'resource-partial-rescue',
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
      }

      let caught = false;

      await stream.consumeStream({
        onError: err => {
          caught = true;
          expect(err.message).toMatch(/Simulated error in onStepFinish/);
        },
      });

      expect(caught).toBe(true);

      // After interruption, check what was saved
      let result = await mockMemory.recall({
        threadId: 'thread-partial-rescue',
        resourceId: 'resource-partial-rescue',
      });
      let messages = result.messages;

      // User message should be saved
      expect(messages.find(m => m.role === 'user')).toBeTruthy();
      // At least one assistant message (could be partial) should be saved
      expect(messages.find(m => m.role === 'assistant')).toBeTruthy();
      // At least one tool call (echoTool or errorTool) should be saved if the model got that far
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
      // There should be at least one save call (user and partial assistant/tool)
      expect(saveCallCount).toBeGreaterThanOrEqual(1);
    }, 500000);

    it('should incrementally save messages across steps and tool calls', async () => {
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
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'If the user prompt contains "Echo:", always call the echoTool. Be verbose in your response.',
        model: openaiModel,
        memory: mockMemory,
        tools: { echoTool },
      });

      let stream;

      if (version === 'v1') {
        stream = await agent.streamLegacy('Echo: Please echo this long message and explain why.', {
          threadId: 'thread-echo',
          resourceId: 'resource-echo',
          savePerStep: true,
        });
      } else {
        stream = await agent.stream('Echo: Please echo this long message and explain why.', {
          threadId: 'thread-echo',
          resourceId: 'resource-echo',
          savePerStep: true,
        });
      }

      await stream.consumeStream();

      expect(saveCallCount).toBeGreaterThan(1);
      const result = await mockMemory.recall({
        threadId: 'thread-echo',
        resourceId: 'resource-echo',
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
      expect(assistantMsg!.content?.toolInvocations?.length).toBe(toolResultIds.size);
    }, 500000);

    it('should incrementally save messages with multiple tools and multi-step streaming', async () => {
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
        id: 'test-agent-multi',
        name: 'Test Agent Multi',
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

      let stream;
      if (version === 'v1') {
        stream = await agent.streamLegacy(
          'Echo: Please echo this message. Uppercase: please also uppercase this message. Explain both results.',
          {
            threadId: 'thread-multi',
            resourceId: 'resource-multi',
            savePerStep: true,
          },
        );
      } else {
        stream = await agent.stream(
          'Echo: Please echo this message. Uppercase: please also uppercase this message. Explain both results.',
          {
            threadId: 'thread-multi',
            resourceId: 'resource-multi',
            savePerStep: true,
          },
        );
      }

      await stream.consumeStream();

      expect(saveCallCount).toBeGreaterThan(1);
      const result = await mockMemory.recall({
        threadId: 'thread-multi',
        resourceId: 'resource-multi',
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
      expect(assistantMsg!.content?.toolInvocations?.length).toBe(toolResultIds.size);
    }, 500000);

    it('should persist the full message after a successful run', async () => {
      const mockMemory = new MockMemory();
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'test',
        model: dummyResponseModel,
        memory: mockMemory,
      });

      let stream;
      if (version === 'v1') {
        stream = await agent.streamLegacy('repeat tool calls', {
          threadId: 'thread-1',
          resourceId: 'resource-1',
        });
      } else {
        stream = await agent.stream('repeat tool calls', {
          threadId: 'thread-1',
          resourceId: 'resource-1',
        });
      }

      await stream.consumeStream();

      const result = await mockMemory.recall({ threadId: 'thread-1', resourceId: 'resource-1' });
      const messages = result.messages;
      // Check that the last message matches the expected final output
      expect(
        messages[messages.length - 1]?.content?.parts?.some(
          p => p.type === 'text' && p.text?.includes('Dummy response'),
        ),
      ).toBe(true);
    });

    it.skipIf(version === 'v2')(
      'should format messages correctly in onStepFinish when provider sends multiple response-metadata chunks (Issue #7050)',
      async () => {
        // This test reproduces the bug where real LLM providers (like OpenRouter)
        // send multiple response-metadata chunks (after each text-delta)
        // which causes the message to have multiple text parts, one for each chunks
        // [{ type: 'text', text: 'Hello' }, { type: 'text', text: ' world' }]
        // instead of properly formatted messages like:
        // [{ role: 'assistant', content: [{ type: 'text', text: 'Hello world' }] }]

        // NOTE: This test is skipped for v2 because it requires format: 'aisdk' which has been removed
        const mockModel = new MockLanguageModelV1({
          doStream: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
            stream: convertArrayToReadableStream([
              { type: 'text-delta', textDelta: 'Hello' },
              { type: 'text-delta', textDelta: ' world' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
              },
            ]),
          }),
        });

        const agent = new Agent({
          id: 'test-agent-7050',
          name: 'Test Agent 7050',
          instructions: 'test',
          model: mockModel,
        });

        let capturedStep: any = null;

        const stream = await agent.streamLegacy('test message', {
          threadId: 'test-thread-7050',
          resourceId: 'test-resource-7050',
          savePerStep: true,
          onStepFinish: async (step: any) => {
            capturedStep = step;
          },
        });

        // Consume the v1 stream (StreamTextResult has textStream property)
        for await (const _chunk of stream.textStream) {
          // Just consume the stream
        }

        // Verify that onStepFinish was called with properly formatted messages
        expect(capturedStep).toBeDefined();
        expect(capturedStep.response).toBeDefined();
        expect(capturedStep.response.messages).toBeDefined();
        expect(Array.isArray(capturedStep.response.messages)).toBe(true);
        expect(capturedStep.response.messages.length).toBeGreaterThan(0);

        // Check that messages have the correct CoreMessage structure
        const firstMessage = capturedStep.response.messages[0];
        expect(firstMessage).toHaveProperty('role');
        expect(firstMessage).toHaveProperty('content');
        expect(typeof firstMessage.role).toBe('string');
        expect(['assistant', 'system', 'user'].includes(firstMessage.role)).toBe(true);
      },
    );

    it('should only call saveMessages for the user message when no assistant parts are generated', async () => {
      const mockMemory = new MockMemory();
      let saveCallCount = 0;

      mockMemory.saveMessages = async function (...args) {
        saveCallCount++;
        return MockMemory.prototype.saveMessages.apply(this, args);
      };

      const agent = new Agent({
        id: 'no-progress-agent',
        name: 'No Progress Agent',
        instructions: 'test',
        model: emptyResponseModel,
        memory: mockMemory,
      });

      let stream;
      if (version === 'v1') {
        stream = await agent.streamLegacy('no progress', {
          threadId: 'thread-2',
          resourceId: 'resource-2',
        });
      } else {
        stream = await agent.stream('no progress', {
          threadId: 'thread-2',
          resourceId: 'resource-2',
        });
      }

      await stream.consumeStream();

      expect(saveCallCount).toBe(1);

      const result = await mockMemory.recall({ threadId: 'thread-2', resourceId: 'resource-2' });
      const messages = result.messages;
      expect(messages.length).toBe(1);
      expect(messages[0].role).toBe('user');
      expect(messages[0].content.content).toBe('no progress');
    });

    it('should not save any message if interrupted before any part is emitted', async () => {
      const mockMemory = new MockMemory();
      let saveCallCount = 0;

      mockMemory.saveMessages = async function (...args) {
        saveCallCount++;
        return MockMemory.prototype.saveMessages.apply(this, args);
      };

      const agent = new Agent({
        id: 'immediate-interrupt-agent',
        name: 'Immediate Interrupt Agent',
        instructions: 'test',
        model: errorResponseModel,
        memory: mockMemory,
      });

      let stream;
      if (version === 'v1') {
        stream = await agent.streamLegacy('interrupt before step', {
          threadId: 'thread-3',
          resourceId: 'resource-3',
        });
      } else {
        stream = await agent.stream('interrupt before step', {
          threadId: 'thread-3',
          resourceId: 'resource-3',
        });
      }

      await stream.consumeStream({
        onError: err => {
          expect(err.message).toBe('Immediate interruption');
        },
      });

      expect(saveCallCount).toBe(0);
      const result = await mockMemory.recall({ threadId: 'thread-3', resourceId: 'resource-3' });
      const messages = result.messages;
      expect(messages.length).toBe(0);
    });

    it('should not save thread if error occurs after starting response but before completion', async () => {
      const mockMemory = new MockMemory();
      const saveThreadSpy = vi.spyOn(mockMemory, 'saveThread');

      let errorModel: MockLanguageModelV1 | MockLanguageModelV2;
      if (version === 'v1') {
        errorModel = new MockLanguageModelV1({
          doStream: async () => {
            const stream = new ReadableStream({
              pull() {
                throw new Error('Simulated stream error');
              },
            });
            return { stream, rawCall: { rawPrompt: null, rawSettings: {} } };
          },
        });
      } else {
        errorModel = new MockLanguageModelV2({
          doStream: async () => {
            const stream = new ReadableStream({
              pull() {
                throw new Error('Simulated stream error');
              },
            });
            return { stream, rawCall: { rawPrompt: null, rawSettings: {} } };
          },
        });
      }

      const agent = new Agent({
        id: 'error-agent-stream',
        name: 'Error Agent Stream',
        instructions: 'test',
        model: errorModel,
        memory: mockMemory,
      });

      let errorCaught = false;

      let stream;
      try {
        if (version === 'v1') {
          stream = await agent.streamLegacy('trigger error', {
            memory: {
              resource: 'user-err',
              thread: {
                id: 'thread-err-stream',
              },
            },
          });

          for await (const _ of stream.textStream) {
            // Should throw
          }
        } else {
          stream = await agent.stream('trigger error', {
            memory: {
              resource: 'user-err',
              thread: {
                id: 'thread-err-stream',
              },
            },
          });

          await stream.consumeStream();
          expect(stream.error).toBeDefined();
          expect(stream.error.message).toMatch(/Simulated stream error/);
          errorCaught = true;
        }
      } catch (err: any) {
        errorCaught = true;
        expect(err.message).toMatch(/Simulated stream error/);
      }

      expect(errorCaught).toBe(true);

      expect(saveThreadSpy).not.toHaveBeenCalled();
      const thread = await mockMemory.getThreadById({ threadId: 'thread-err-stream' });
      expect(thread).toBeNull();
    });
  });

  describe(`stream`, () => {
    it(`should stream from LLM`, async () => {
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        model: openaiModel,
        instructions: `test!`,
      });

      let result;
      let request;

      if (version === 'v1') {
        result = await agent.streamLegacy(`hello!`);
      } else {
        result = await agent.stream(`hello!`);
      }

      const parts: any[] = [];
      for await (const part of result.fullStream) {
        parts.push(part);
      }

      if (version === 'v1') {
        request = JSON.parse((await result.request).body).messages;
        expect(request).toEqual([
          {
            role: 'system',
            content: 'test!',
          },
          {
            role: 'user',
            content: 'hello!',
          },
        ]);
      } else {
        request = (await result.request).body.input;
        expect(request).toEqual([
          {
            role: 'system',
            content: 'test!',
          },
          {
            role: 'user',
            content: [{ type: 'input_text', text: 'hello!' }],
          },
        ]);
      }
    });

    it(`should show correct request input for multi-turn inputs`, { timeout: 30000 }, async () => {
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        model: openaiModel,
        instructions: `test!`,
      });

      let result;
      if (version === 'v1') {
        result = await agent.streamLegacy([
          { role: `user`, content: `hello!` },
          { role: 'assistant', content: 'hi, how are you?' },
          { role: 'user', content: "I'm good, how are you?" },
        ]);
      } else {
        result = await agent.stream([
          { role: `user`, content: `hello!` },
          { role: 'assistant', content: 'hi, how are you?' },
          { role: 'user', content: "I'm good, how are you?" },
        ]);
      }

      const parts: any[] = [];
      for await (const part of result.fullStream) {
        parts.push(part);
      }

      let request;
      if (version === 'v1') {
        request = JSON.parse((await result.request).body).messages;
        expect(request).toEqual([
          {
            role: 'system',
            content: 'test!',
          },
          {
            role: 'user',
            content: 'hello!',
          },
          { role: 'assistant', content: 'hi, how are you?' },
          { role: 'user', content: "I'm good, how are you?" },
        ]);
      } else {
        request = (await result.request).body.input;
        expect(request).toEqual([
          {
            role: 'system',
            content: 'test!',
          },
          {
            role: 'user',
            content: [{ type: 'input_text', text: 'hello!' }],
          },
          { role: 'assistant', content: [{ type: 'output_text', text: 'hi, how are you?' }] },
          { role: 'user', content: [{ type: 'input_text', text: "I'm good, how are you?" }] },
        ]);
      }
    });

    it(`should show correct request input for multi-turn inputs with memory`, async () => {
      const mockMemory = new MockMemory();
      const threadId = '1';
      const resourceId = '2';
      // @ts-ignore
      mockMemory.recall = async function recall() {
        const list = new MessageList({ threadId, resourceId }).add(
          [
            { role: `user`, content: `hello!`, threadId, resourceId },
            { role: 'assistant', content: 'hi, how are you?', threadId, resourceId },
          ],
          `memory`,
        );
        const remembered = list.get.remembered.db();
        return { messages: remembered };
      };

      mockMemory.getThreadById = async function getThreadById() {
        return { id: '1', createdAt: new Date(), resourceId: '2', updatedAt: new Date() } satisfies StorageThreadType;
      };

      const agent = new Agent({
        id: 'test-agent',
        name: 'test',
        model: openaiModel,
        instructions: `test!`,
        memory: mockMemory,
      });

      let result;
      if (version === 'v1') {
        result = await agent.streamLegacy([{ role: 'user', content: "I'm good, how are you?" }], {
          memory: {
            thread: '1',
            resource: '2',
            options: {
              lastMessages: 10,
            },
          },
        });
      } else {
        result = await agent.stream([{ role: 'user', content: "I'm good, how are you?" }], {
          memory: {
            thread: '1',
            resource: '2',
            options: {
              lastMessages: 10,
            },
          },
        });
      }

      for await (const _part of result.fullStream) {
      }

      let request;
      if (version === 'v1') {
        request = JSON.parse((await result.request).body).messages;
        expect(request).toEqual([
          {
            role: 'system',
            content: 'test!',
          },
          {
            role: 'user',
            content: 'hello!',
          },
          { role: 'assistant', content: 'hi, how are you?' },
          { role: 'user', content: "I'm good, how are you?" },
        ]);
      } else {
        request = (await result.request).body.input;
        expect(request).toEqual([
          {
            role: 'system',
            content: 'test!',
          },
          {
            role: 'user',
            content: [{ type: 'input_text', text: 'hello!' }],
          },
          { role: 'assistant', content: [{ type: 'output_text', text: 'hi, how are you?' }] },
          { role: 'user', content: [{ type: 'input_text', text: "I'm good, how are you?" }] },
        ]);
      }
    });

    it(`should order tool calls/results and response text properly`, async () => {
      const mockMemory = new MockMemory();

      const weatherTool = createTool({
        id: 'get_weather',
        description: 'Get the weather for a given location',
        inputSchema: z.object({
          postalCode: z.string().describe('The location to get the weather for'),
        }),
        execute: async input => {
          return `The weather in ${input.postalCode} is sunny. It is currently 70 degrees and feels like 65 degrees.`;
        },
      });

      const threadId = randomUUID();
      const resourceId = 'ordering';

      const agent = new Agent({
        id: 'test',
        name: 'test',
        model: openaiModel,
        instructions: `Testing tool calls! Please respond in a pirate accent`,
        tools: {
          get_weather: weatherTool,
        },
        memory: mockMemory,
      });

      let firstResponse;
      if (version === 'v1') {
        firstResponse = await agent.generateLegacy('What is the weather in London?', {
          threadId,
          resourceId,
          onStepFinish: args => {
            args;
          },
        });
        // The response should contain the weather.
        expect(firstResponse.response.messages).toEqual([
          expect.objectContaining({
            role: 'assistant',
            content: [expect.objectContaining({ type: 'tool-call' })],
          }),
          expect.objectContaining({
            role: 'tool',
            content: [expect.objectContaining({ type: 'tool-result' })],
          }),
          expect.objectContaining({
            role: 'assistant',
            content: expect.any(String),
          }),
        ]);
      } else {
        firstResponse = await agent.generate('What is the weather in London?', {
          threadId,
          resourceId,
          onStepFinish: args => {
            args;
          },
        });

        // The response should contain the weather.
        expect(firstResponse.response.messages).toEqual([
          expect.objectContaining({
            role: 'assistant',
            content: [expect.objectContaining({ type: 'tool-call' })],
          }),
          expect.objectContaining({
            role: 'tool',
            content: [expect.objectContaining({ type: 'tool-result' })],
          }),
          expect.objectContaining({
            role: 'assistant',
            content: [expect.objectContaining({ type: 'text' })],
          }),
        ]);
      }

      expect(firstResponse.text).toContain('65');

      let secondResponse;
      if (version === 'v1') {
        secondResponse = await agent.generateLegacy('What was the tool you just used?', {
          memory: {
            thread: threadId,
            resource: resourceId,
            options: {
              lastMessages: 10,
            },
          },
        });
      } else {
        secondResponse = await agent.generate('What was the tool you just used?', {
          memory: {
            thread: threadId,
            resource: resourceId,
            options: {
              lastMessages: 10,
            },
          },
        });

        expect(secondResponse.request.body.input).toEqual([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({ role: 'user' }),
          // After PR changes: sanitizeV5UIMessages filters out input-available tool parts
          // and keeps only output-available parts. When convertToModelMessages processes
          // an output-available tool part, it generates both function_call and function_call_output
          expect.objectContaining({ type: 'function_call', name: 'get_weather' }),
          expect.objectContaining({ type: 'function_call_output' }),
          expect.objectContaining({ role: 'assistant' }),
          expect.objectContaining({ role: 'user' }),
        ]);
      }

      expect(secondResponse.response.messages).toEqual([expect.objectContaining({ role: 'assistant' })]);
    }, 30_000);

    it.skip('should include assistant messages in onFinish callback with aisdk format', async () => {
      // NOTE: This test is skipped because format: 'aisdk' has been removed
      const mockModel = new MockLanguageModelV2({
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          stream: convertArrayToReadableStream([
            { type: 'text-delta', id: '1', delta: 'Hello! ' },
            { type: 'text-delta', id: '2', delta: 'Nice to meet you!' },
            {
              type: 'finish',
              id: '3',
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
          warnings: [],
        }),
      });

      const agent = new Agent({
        id: 'test-aisdk-onfinish',
        name: 'Test AISDK onFinish',
        model: mockModel,
        instructions: 'You are a helpful assistant.',
      });

      let messagesInOnFinish: any[] | undefined;
      let hasUserMessage = false;
      let hasAssistantMessage = false;

      const result = await agent.stream('Hello, please respond with a greeting.', {
        format: 'aisdk',
        onFinish: props => {
          // Store the messages from onFinish
          messagesInOnFinish = props.messages;

          if (props.messages) {
            props.messages.forEach((msg: any) => {
              if (msg.role === 'user') hasUserMessage = true;
              if (msg.role === 'assistant') hasAssistantMessage = true;
            });
          }
        },
      });

      // Consume the stream
      await result.consumeStream();

      // Verify that messages were provided in onFinish
      expect(messagesInOnFinish).toBeDefined();
      expect(messagesInOnFinish).toBeInstanceOf(Array);

      // response messages should not be user messages
      expect(hasUserMessage).toBe(false);
      // Verify that we have assistant messages
      expect(hasAssistantMessage).toBe(true);

      // Verify the assistant message content
      const assistantMessage = messagesInOnFinish?.find((m: any) => m.role === 'assistant');
      expect(assistantMessage).toBeDefined();
      expect(assistantMessage?.content).toBeDefined();

      // For the v2 model, the assistant message should contain the streamed text
      if (typeof assistantMessage?.content === 'string') {
        expect(assistantMessage.content).toContain('Hello!');
      } else if (Array.isArray(assistantMessage?.content)) {
        const textContent = assistantMessage.content.find((c: any) => c.type === 'text');
        expect(textContent?.text).toContain('Hello!');
      }
    });
  });
}

runStreamTest('v1');
runStreamTest('v2');
