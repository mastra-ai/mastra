import { openai as openai_v5 } from '@ai-sdk/openai-v5';
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV1 } from '@internal/ai-sdk-v4';
import { convertArrayToReadableStream, MockLanguageModelV2 } from 'ai-v5/test';
import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { Processor } from '../processors/index';
import { RequestContext } from '../request-context';
import type { MastraDBMessage } from './types';
import { Agent } from './index';

// Helper function to create a MastraDBMessage
const createMessage = (text: string, role: 'user' | 'assistant' = 'user'): MastraDBMessage => ({
  id: crypto.randomUUID(),
  role,
  content: {
    format: 2,
    parts: [{ type: 'text', text }],
  },
  createdAt: new Date(),
});

describe('Input and Output Processors', () => {
  let mockModel: MockLanguageModelV2;

  beforeEach(() => {
    mockModel = new MockLanguageModelV2({
      doGenerate: async ({ prompt }) => {
        // Extract text content from the prompt messages
        const messages = Array.isArray(prompt) ? prompt : [];
        const textContent = messages
          .map(msg => {
            if (typeof msg.content === 'string') {
              return msg.content;
            } else if (Array.isArray(msg.content)) {
              return msg.content
                .filter(part => part.type === 'text')
                .map(part => (part as any).text)
                .join(' ');
            }
            return '';
          })
          .filter(Boolean)
          .join(' ');

        return {
          content: [
            {
              type: 'text',
              text: `processed: ${textContent}`,
            },
          ],
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          rawCall: { rawPrompt: prompt, rawSettings: {} },
          warnings: [],
        };
      },
      doStream: async ({ prompt }) => {
        // Extract text content from the prompt messages
        const messages = Array.isArray(prompt) ? prompt : [];
        const textContent = messages
          .map(msg => {
            if (typeof msg.content === 'string') {
              return msg.content;
            } else if (Array.isArray(msg.content)) {
              return msg.content
                .filter(part => part.type === 'text')
                .map(part => (part as any).text)
                .join(' ');
            }
            return '';
          })
          .filter(Boolean)
          .join(' ');

        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'processed: ' },
            { type: 'text-delta', id: '1', delta: textContent },
            { type: 'text-end', id: '1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
          rawCall: { rawPrompt: prompt, rawSettings: {} },
          warnings: [],
        };
      },
    });
  });

  describe('Input Processors with generate', () => {
    it('should run input processors before generation', async () => {
      const processor = {
        id: 'test-processor',
        name: 'test-processor',
        processInput: async ({ messages }) => {
          messages.push(createMessage('Processor was here!'));
          return messages;
        },
      };

      const agentWithProcessor = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        inputProcessors: [processor],
      });

      const result = await agentWithProcessor.generate('Hello world');

      // The processor should have added a message
      expect((result.response.messages[0].content[0] as any).text).toContain('processed:');
      expect((result.response.messages[0].content[0] as any).text).toContain('Processor was here!');
    }, 50000);

    it('should run multiple processors in order', async () => {
      const processor1 = {
        id: 'processor-1',
        name: 'Processor 1',
        processInput: async ({ messages }) => {
          messages.push(createMessage('First processor'));
          return messages;
        },
      };

      const processor2 = {
        id: 'processor-2',
        name: 'Processor 2',
        processInput: async ({ messages }) => {
          messages.push(createMessage('Second processor'));
          return messages;
        },
      };

      const agentWithProcessors = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        inputProcessors: [processor1, processor2],
      });

      const result = await agentWithProcessors.generate('Hello');

      expect((result.response.messages[0].content[0] as any).text).toContain('First processor');
      expect((result.response.messages[0].content[0] as any).text).toContain('Second processor');
    });

    it('should support async processors running in sequence', async () => {
      const processor1 = {
        id: 'async-processor-1',
        name: 'Async Processor 1',
        processInput: async ({ messages }) => {
          messages.push(createMessage('First processor'));
          return messages;
        },
      };

      const processor2 = {
        id: 'async-processor-2',
        name: 'Async Processor 2',
        processInput: async ({ messages }) => {
          await new Promise(resolve => setTimeout(resolve, 10));
          messages.push(createMessage('Second processor'));
          return messages;
        },
      };

      const agentWithAsyncProcessors = new Agent({
        id: 'async-processors-test-agent',
        name: 'Test Agent',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        inputProcessors: [processor1, processor2],
      });

      const result = await agentWithAsyncProcessors.generate('Test async');

      // Processors run sequentially, so "First processor" should appear before "Second processor"
      expect((result.response.messages[0].content[0] as any).text).toContain('First processor');
      expect((result.response.messages[0].content[0] as any).text).toContain('Second processor');
    });

    it('should handle processor abort with default message', async () => {
      const abortProcessor = {
        id: 'abort-processor',
        name: 'Abort Processor',
        processInput: async ({ abort, messages }) => {
          abort();
          return messages;
        },
      };

      const agentWithAbortProcessor = new Agent({
        id: 'abort-processor-test-agent',
        name: 'Abort Processor Test Agent',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        inputProcessors: [abortProcessor],
      });

      async function testWithFormat(format: 'aisdk' | 'mastra') {
        const result = await agentWithAbortProcessor.generate('This should be aborted', {
          format,
        });

        expect(result.tripwire).toBe(true);

        expect(result.tripwireReason).toBe('Tripwire triggered by abort-processor');

        expect(await result.finishReason).toBe('other');
      }

      // await testWithFormat('aisdk');
      await testWithFormat('mastra');
    });

    it('should handle processor abort with custom message', async () => {
      const customAbortProcessor = {
        id: 'custom-abort',
        name: 'Custom Abort',
        processInput: async ({ abort, messages }) => {
          abort('Custom abort reason');
          return messages;
        },
      };

      const agentWithCustomAbort = new Agent({
        id: 'custom-abort-test-agent',
        name: 'Custom Abort Test Agent',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        inputProcessors: [customAbortProcessor],
      });

      async function testWithFormat(format: 'aisdk' | 'mastra') {
        const result = await agentWithCustomAbort.generate('Custom abort test', {
          format,
        });

        expect(result.tripwire).toBe(true);
        expect(result.tripwireReason).toBe('Custom abort reason');
      }

      // await testWithFormat('aisdk');
      await testWithFormat('mastra');
    });

    it('should not execute subsequent processors after abort', async () => {
      let secondProcessorExecuted = false;

      const abortProcessor = {
        id: 'abort-first',
        name: 'Abort First',
        processInput: async ({ abort, messages }) => {
          abort('Stop here');
          return messages;
        },
      };

      const shouldNotRunProcessor = {
        id: 'should-not-run',
        name: 'Should Not Run',
        processInput: async ({ messages }) => {
          secondProcessorExecuted = true;
          messages.push(createMessage('This should not be added'));
          return messages;
        },
      };

      const agentWithAbortSequence = new Agent({
        id: 'abort-sequence-test-agent',
        name: 'Abort Sequence Test Agent',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        inputProcessors: [abortProcessor, shouldNotRunProcessor],
      });

      const result = await agentWithAbortSequence.generate('Abort sequence test');

      expect(result.tripwire).toBe(true);
      expect(secondProcessorExecuted).toBe(false);
    });
  });

  describe('Input Processors with non-user role messages', () => {
    it('should handle input processors that add system messages', async () => {
      const systemMessageProcessor = {
        id: 'system-message-processor',
        name: 'System Message Processor',
        processInput: async ({ messages }) => {
          // Add a system message to provide additional context
          const systemMessage: MastraDBMessage = {
            id: crypto.randomUUID(),
            role: 'system',
            content: { content: 'You are a helpful assistant.', format: 2, parts: [] },
            createdAt: new Date(),
          };

          // Return system message followed by user messages
          return [systemMessage, ...messages];
        },
      };

      const agent = new Agent({
        id: 'system-message-processor-test-agent',
        name: 'System Message Processor Test Agent',
        instructions: 'You are a test agent',
        model: mockModel,
        inputProcessors: [systemMessageProcessor],
      });

      // This should not throw an error about invalid system message format
      const result = await agent.generate('Hello');

      expect(result.text).toBeDefined();
      expect(result.text).toContain('processed:');
    });

    it('should handle input processors that add assistant messages for context', async () => {
      const assistantMessageProcessor = {
        id: 'assistant-message-processor',
        name: 'Assistant Message Processor',
        processInput: async ({ messages }) => {
          // Add an assistant message (e.g., from previous conversation)
          const assistantMessage: MastraDBMessage = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: {
              format: 2,
              parts: [{ type: 'text', text: 'Previously, I helped you with your code.' }],
            },
            createdAt: new Date(),
          };

          // Return assistant message followed by user messages
          return [assistantMessage, ...messages];
        },
      };

      const agent = new Agent({
        id: 'assistant-message-processor-test-agent',
        name: 'Assistant Message Processor Test Agent',
        instructions: 'You are a test agent',
        model: mockModel,
        inputProcessors: [assistantMessageProcessor],
      });

      const result = await agent.generate('Continue from before');

      expect(result.text).toBeDefined();
      expect(result.text).toContain('processed:');
    });
  });

  describe('Input Processors with stream', () => {
    it('should handle input processors with streaming', async () => {
      const streamProcessor = {
        id: 'stream-processor',
        name: 'Stream Processor',
        processInput: async ({ messages }) => {
          messages.push(createMessage('Stream processor active'));
          return messages;
        },
      };

      const agentWithStreamProcessor = new Agent({
        id: 'stream-processor-test-agent',
        name: 'Stream Processor Test Agent',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        inputProcessors: [streamProcessor],
      });

      const stream = await agentWithStreamProcessor.stream('Stream test');

      let fullText = '';
      for await (const chunk of stream.fullStream) {
        if (chunk.type === 'text-delta') {
          fullText += chunk.payload.text;
        }
      }

      expect(fullText).toContain('Stream processor active');
    });

    it('should handle abort in streaming with tripwire response', async () => {
      const streamAbortProcessor = {
        id: 'stream-abort',
        name: 'Stream Abort',
        processInput: async ({ abort, messages }) => {
          abort('Stream aborted');
          return messages;
        },
      };

      const agentWithStreamAbort = new Agent({
        id: 'stream-abort-test-agent',
        name: 'Stream Abort Test Agent',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        inputProcessors: [streamAbortProcessor],
      });

      const stream = await agentWithStreamAbort.stream('Stream abort test');

      const fullOutput = await stream.getFullOutput();
      expect(fullOutput.tripwire).toBe(true);
      expect(fullOutput.tripwireReason).toBe('Stream aborted');

      // Stream should be empty
      let textReceived = '';
      for await (const chunk of stream.fullStream) {
        if (chunk.type === 'text-delta') {
          textReceived += chunk.payload.text;
        }
      }
      expect(textReceived).toBe('');
    });

    it('should support function-based input processors', async () => {
      const requestContext = new RequestContext<{ processorMessage: string }>();
      requestContext.set('processorMessage', 'Dynamic message');

      const agentWithDynamicProcessors = new Agent({
        id: 'dynamic-processors-test-agent',
        name: 'Dynamic Processors Test Agent',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        inputProcessors: ({ requestContext }) => {
          const message: string = requestContext.get('processorMessage') || 'Default message';
          return [
            {
              id: 'dynamic-processor',
              name: 'Dynamic Processor',
              processInput: async ({ messages }) => {
                messages.push(createMessage(message));
                return messages;
              },
            },
          ];
        },
      });

      const result = await agentWithDynamicProcessors.generate('Test dynamic', {
        requestContext,
      });

      expect((result.response.messages[0].content[0] as any).text).toContain('Dynamic message');
    });

    it('should allow processors to modify message content', async () => {
      const messageModifierProcessor = {
        id: 'message-modifier',
        name: 'Message Modifier',
        processInput: async ({ messages }) => {
          // Access existing messages and modify them
          const lastMessage = messages[messages.length - 1];

          if (lastMessage && lastMessage.content.parts.length > 0) {
            // Add a prefix to user messages
            messages.push(createMessage('MODIFIED: Original message was received'));
          }
          return messages;
        },
      };

      const agentWithModifier = new Agent({
        id: 'message-modifier-test-agent',
        name: 'Message Modifier Test Agent',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        inputProcessors: [messageModifierProcessor],
      });

      const result = await agentWithModifier.generate('Original user message');

      expect((result.response.messages[0].content[0] as any).text).toContain('MODIFIED: Original message was received');
      expect((result.response.messages[0].content[0] as any).text).toContain('Original user message');
    });

    it('should allow processors to filter or validate messages', async () => {
      const validationProcessor = {
        id: 'validator',
        name: 'Validator',
        processInput: async ({ messages, abort }) => {
          // Extract text content from all messages
          const textContent = messages
            .map(msg =>
              msg.content.parts
                .filter(part => part.type === 'text')
                .map(part => part.text)
                .join(' '),
            )
            .join(' ');

          const hasInappropriateContent = textContent.includes('inappropriate');

          if (hasInappropriateContent) {
            abort('Content validation failed');
          } else {
            messages.push(createMessage('Content validated'));
          }
          return messages;
        },
      };

      const agentWithValidator = new Agent({
        id: 'validator-test-agent',
        name: 'Validator Test Agent',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        inputProcessors: [validationProcessor],
      });

      // Test valid content
      const validResult = await agentWithValidator.generate('This is appropriate content');
      expect((validResult.response.messages[0].content[0] as any).text).toContain('Content validated');

      // Test invalid content
      const invalidResult = await agentWithValidator.generate('This contains inappropriate content');
      expect(invalidResult.tripwire).toBe(true);
      expect(invalidResult.tripwireReason).toBe('Content validation failed');
    });

    it('should handle empty processors array', async () => {
      const agentWithEmptyProcessors = new Agent({
        id: 'empty-processors-test-agent',
        name: 'Empty Processors Test Agent',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        inputProcessors: [],
      });

      const result = await agentWithEmptyProcessors.generate('No processors test');

      expect((result.response.messages[0].content[0] as any).text).toContain('processed:');
      expect((result.response.messages[0].content[0] as any).text).toContain('No processors test');
    });
  });

  describe('Output Processors with generate', () => {
    it('should process final text through output processors', async () => {
      let processedText = '';

      class TestOutputProcessor implements Processor {
        readonly id = 'test-output-processor';
        readonly name = 'test-output-processor';

        async processOutputResult({ messages }) {
          // Process the final generated text
          const processedMessages = messages.map(msg => ({
            ...msg,
            content: {
              ...msg.content,
              parts: msg.content.parts.map(part =>
                part.type === 'text' ? { ...part, text: part.text.replace(/test/gi, 'TEST') } : part,
              ),
            },
          }));

          // Store the processed text to verify it was called
          processedText = processedMessages[0]?.content.parts.find(part => part.type === 'text')?.text || '';

          return processedMessages;
        }
      }

      const agent = new Agent({
        id: 'generate-output-processor-test-agent',
        name: 'Generate Output Processor Test Agent',
        instructions: 'You are a helpful assistant.',
        model: new MockLanguageModelV2({
          doGenerate: async () => ({
            content: [
              {
                type: 'text',
                text: 'This is a test response with test words',
              },
            ],
            finishReason: 'stop',
            usage: { inputTokens: 8, outputTokens: 10, totalTokens: 18 },
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          }),
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'This is a test response with test words' },
              { type: 'text-end', id: '1' },
              { type: 'finish', finishReason: 'stop', usage: { inputTokens: 8, outputTokens: 10, totalTokens: 18 } },
            ]),
          }),
        }),
        outputProcessors: [new TestOutputProcessor()],
      });

      async function testWithFormat(format: 'aisdk' | 'mastra') {
        const result = await agent.generate('Hello', {
          format,
        });

        // The output processors should modify the returned result
        expect((result.response.messages[0].content[0] as any).text).toBe('This is a TEST response with TEST words');

        // And the processor should have been called and processed the text
        expect(processedText).toBe('This is a TEST response with TEST words');
      }

      // await testWithFormat('aisdk');
      await testWithFormat('mastra');
    });

    it('should process messages through multiple output processors in sequence', async () => {
      let finalProcessedText = '';

      class ReplaceProcessor implements Processor {
        readonly id = 'replace-processor';
        readonly name = 'Replace Processor';

        async processOutputResult({ messages }) {
          return messages.map(msg => ({
            ...msg,
            content: {
              ...msg.content,
              parts: msg.content.parts.map(part =>
                part.type === 'text' ? { ...part, text: part.text.replace(/hello/gi, 'HELLO') } : part,
              ),
            },
          }));
        }
      }

      class AddPrefixProcessor implements Processor {
        readonly id = 'prefix-processor';
        readonly name = 'Add Prefix Processor';

        async processOutputResult({ messages }) {
          const processedMessages = messages.map(msg => ({
            ...msg,
            content: {
              ...msg.content,
              parts: msg.content.parts.map(part =>
                part.type === 'text' ? { ...part, text: `[PROCESSED] ${part.text}` } : part,
              ),
            },
          }));

          // Store the final processed text to verify both processors ran
          finalProcessedText = processedMessages[0]?.content.parts.find(part => part.type === 'text')?.text || '';

          return processedMessages;
        }
      }

      const agent = new Agent({
        id: 'multi-processor-generate-test-agent',
        name: 'Multi Processor Generate Test Agent',
        instructions: 'Respond with: "hello world"',
        model: new MockLanguageModelV2({
          doGenerate: async () => ({
            content: [
              {
                type: 'text',
                text: 'hello world',
              },
            ],
            finishReason: 'stop',
            usage: { inputTokens: 2, outputTokens: 5, totalTokens: 7 },
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          }),
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'hello world' },
              { type: 'text-end', id: '1' },
              { type: 'finish', finishReason: 'stop', usage: { inputTokens: 2, outputTokens: 5, totalTokens: 7 } },
            ]),
          }),
        }),
        outputProcessors: [new ReplaceProcessor(), new AddPrefixProcessor()],
      });

      async function testWithFormat(format: 'aisdk' | 'mastra') {
        const result = await agent.generate('Test', {
          format,
        });

        // The output processors should modify the returned result
        expect((result.response.messages[0].content[0] as any).text).toBe('[PROCESSED] HELLO world');

        // And both processors should have been called in sequence
        expect(finalProcessedText).toBe('[PROCESSED] HELLO world');
      }

      // await testWithFormat('aisdk');
      await testWithFormat('mastra');
    });

    it('should handle abort in output processors', async () => {
      class AbortingOutputProcessor implements Processor {
        readonly id = 'aborting-output-processor';
        readonly name = 'Aborting Output Processor';

        async processOutputResult({ messages, abort }) {
          // Check if the response contains inappropriate content
          const hasInappropriateContent = messages.some(msg =>
            msg.content.parts.some(part => part.type === 'text' && part.text.includes('inappropriate')),
          );

          if (hasInappropriateContent) {
            abort('Content flagged as inappropriate');
          }

          return messages;
        }
      }

      const agent = new Agent({
        id: 'aborting-generate-test-agent',
        name: 'Aborting Generate Test Agent',
        instructions: 'You are a helpful assistant.',
        model: new MockLanguageModelV2({
          doGenerate: async () => ({
            content: [
              {
                type: 'text',
                text: 'This content is inappropriate and should be blocked',
              },
            ],
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          }),
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'This content is inappropriate and should be blocked' },
              { type: 'text-end', id: '1' },
              { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 } },
            ]),
          }),
        }),
        outputProcessors: [new AbortingOutputProcessor()],
      });

      async function testWithFormat(format: 'aisdk' | 'mastra') {
        // Should return tripwire result when processor aborts
        const result = await agent.generate('Generate inappropriate content', {
          format,
        });

        expect(result.tripwire).toBe(true);
        expect(result.tripwireReason).toBe('Content flagged as inappropriate');
        expect(result.finishReason).toBe('other');
      }

      // await testWithFormat('aisdk');
      await testWithFormat('mastra');
    });

    it('should skip processors that do not implement processOutputResult', async () => {
      class CompleteProcessor implements Processor {
        readonly id = 'complete-processor';
        readonly name = 'Complete Processor';

        async processOutputResult({ messages }) {
          return messages.map(msg => ({
            ...msg,
            content: {
              ...msg.content,
              parts: msg.content.parts.map(part =>
                part.type === 'text' ? { ...part, text: `[COMPLETE] ${part.text}` } : part,
              ),
            },
          }));
        }
      }

      class IncompleteProcessor {
        readonly id = 'incomplete-processor';
        readonly name = 'Incomplete Processor';
        // Note: This processor doesn't implement processOutputResult or extend Processor
      }

      const agent = new Agent({
        id: 'mixed-processor-test-agent',
        name: 'Mixed Processor Test Agent',
        instructions: 'You are a helpful assistant.',
        model: new MockLanguageModelV2({
          doGenerate: async () => ({
            content: [
              {
                type: 'text',
                text: 'Test response',
              },
            ],
            finishReason: 'stop',
            usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          }),
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'This is a test response' },
              { type: 'text-end', id: '1' },
              { type: 'finish', finishReason: 'stop', usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 } },
            ]),
          }),
        }),
        outputProcessors: [new IncompleteProcessor() as any, new CompleteProcessor()],
      });

      async function testWithFormat(format: 'aisdk' | 'mastra') {
        const result = await agent.generate('Test incomplete processors', {
          format,
        });

        // Only the complete processor should have run
        expect((result.response.messages[0].content[0] as any).text).toBe('[COMPLETE] This is a test response');
      }

      // await testWithFormat('aisdk');
      await testWithFormat('mastra');
    });
  });

  describe('Output Processors with stream', () => {
    it('should process text chunks through output processors in real-time', async () => {
      class TestOutputProcessor implements Processor {
        readonly id = 'test-output-processor';
        readonly name = 'Test Output Processor';

        async processOutputStream(args: {
          part: any;
          streamParts: any[];
          state: Record<string, any>;
          abort: (reason?: string) => never;
        }) {
          const { part } = args;
          // Only process text-delta chunks
          if (part.type === 'text-delta') {
            return {
              type: 'text-delta',
              payload: {
                ...part.payload,
                text: part.payload.text.replace(/test/gi, 'TEST'),
              },
            };
          }
          return part;
        }
      }

      const agent = new Agent({
        id: 'output-processor-test-agent',
        name: 'Output Processor Test Agent',
        instructions: 'You are a helpful assistant. Respond with exactly: "This is a test response"',
        model: mockModel,
        outputProcessors: [new TestOutputProcessor()],
      });

      async function testWithFormat(format: 'aisdk' | 'mastra') {
        const stream = await agent.stream('Hello', {
          format,
        });

        let collectedText = '';
        for await (const chunk of stream.fullStream) {
          if (chunk.type === 'text-delta') {
            if (format === 'aisdk') {
              collectedText += chunk.text;
            } else {
              collectedText += chunk.payload.text;
            }
          }
        }

        expect(collectedText).toBe(
          'processed: You are a helpful assistant. Respond with exactly: "This is a TEST response" Hello',
        );
      }

      // await testWithFormat('aisdk');
      await testWithFormat('mastra');
    });

    it('should filter blocked content chunks', async () => {
      class BlockingOutputProcessor implements Processor {
        readonly id = 'filtering-output-processor';
        readonly name = 'Filtering Output Processor';

        async processOutputStream({ part }) {
          // Filter out chunks containing "blocked"
          if (part.type === 'text-delta' && part.payload.text?.includes('You are')) {
            return null; // Return null to filter the chunk
          }
          return part;
        }
      }

      const agent = new Agent({
        id: 'blocking-processor-test-agent',
        name: 'Blocking Processor Test Agent',
        instructions: 'You are a helpful assistant.',
        model: mockModel,
        outputProcessors: [new BlockingOutputProcessor()],
      });

      async function testWithFormat(format: 'aisdk' | 'mastra') {
        const stream = await agent.stream('Hello', {
          format,
        });

        let collectedText = '';
        for await (const chunk of stream.fullStream) {
          if (chunk.type === 'text-delta') {
            if (format === 'aisdk') {
              collectedText += chunk.text;
            } else {
              collectedText += chunk.payload.text;
            }
          }
        }

        // The blocked content should be filtered out completely (not appear in stream)
        expect(collectedText).toBe('processed: ');
      }

      // await testWithFormat('aisdk');
      await testWithFormat('mastra');
    });

    it('should emit tripwire when output processor calls abort', async () => {
      class AbortingOutputProcessor implements Processor {
        readonly id = 'aborting-output-processor';
        readonly name = 'Aborting Output Processor';

        async processOutputStream({ part, abort }) {
          if (part.type === 'text-delta' && part.payload.text?.includes('processed')) {
            abort('Content triggered abort');
          }

          return part;
        }
      }

      const agent = new Agent({
        id: 'aborting-processor-test-agent',
        name: 'Aborting Processor Test Agent',
        instructions: 'You are a helpful assistant.',
        model: mockModel,
        outputProcessors: [new AbortingOutputProcessor()],
      });

      async function testWithFormat(format: 'aisdk' | 'mastra') {
        const stream = await agent.stream('Hello', {
          format,
        });
        const chunks: any[] = [];

        for await (const chunk of stream.fullStream) {
          chunks.push(chunk);
        }

        // Should have received a tripwire chunk
        const tripwireChunk = chunks.find(chunk => chunk.type === 'tripwire');
        expect(tripwireChunk).toBeDefined();

        if (format === 'aisdk') {
          expect(tripwireChunk.tripwireReason).toBe('Content triggered abort');
        } else {
          expect(tripwireChunk.payload.tripwireReason).toBe('Content triggered abort');
        }

        // Should not have received the text after the abort trigger
        let collectedText = '';
        chunks.forEach(chunk => {
          if (chunk.type === 'text-delta') {
            if (format === 'aisdk') {
              collectedText += chunk.text;
            } else {
              collectedText += chunk.payload.text;
            }
          }
        });
        // The abort happens when "test" is encountered, which is in the first chunk
        // So we might not get any text before the abort
        expect(collectedText).not.toContain('test');
      }

      // await testWithFormat('aisdk');
      await testWithFormat('mastra');
    });

    it('should process chunks through multiple output processors in sequence', async () => {
      class ReplaceProcessor implements Processor {
        readonly id = 'replace-processor';
        readonly name = 'Replace Processor';

        async processOutputStream({ part }) {
          if (part.type === 'text-delta' && part.payload.text) {
            return {
              type: 'text-delta',
              payload: {
                ...part.payload,
                text: 'SUH DUDE',
              },
            };
          }
          return part;
        }
      }

      class AddPrefixProcessor implements Processor {
        readonly id = 'prefix-processor';
        readonly name = 'Add Prefix Processor';

        async processOutputStream({ part }) {
          // Add prefix to any chunk that contains "TEST"
          if (part.type === 'text-delta' && part.payload.text?.includes('SUH DUDE')) {
            return {
              type: 'text-delta',
              payload: {
                ...part.payload,
                text: `[PROCESSED] ${part.payload.text}`,
              },
            };
          }
          return part;
        }
      }

      const agent = new Agent({
        id: 'multi-processor-test-agent',
        name: 'Multi Processor Test Agent',
        instructions: 'Respond with: "This is a test response"',
        model: mockModel,
        outputProcessors: [new ReplaceProcessor(), new AddPrefixProcessor()],
      });

      async function testWithFormat(format: 'aisdk' | 'mastra') {
        const stream = await agent.stream('Test', {
          format,
        });

        let collectedText = '';
        for await (const chunk of stream.fullStream) {
          if (chunk.type === 'text-delta') {
            if (format === 'aisdk') {
              collectedText += chunk.text;
            } else {
              collectedText += chunk.payload.text;
            }
          }
        }

        // Should be processed by both processors: replace "test" -> "TEST", then add prefix
        expect(collectedText).toBe('[PROCESSED] SUH DUDE[PROCESSED] SUH DUDE');
      }

      // await testWithFormat('aisdk');
      await testWithFormat('mastra');
    });
  });

  describe('Custom Output with Processors', () => {
    it('should process streamed structured output through output processors with stream', async () => {
      let processedChunks: string[] = [];
      let finalProcessedObject: any = null;

      class StreamStructuredProcessor implements Processor {
        readonly id = 'stream-structured-processor';
        readonly name = 'Stream Structured Processor';

        async processOutputStream({ part }) {
          // Handle text-delta chunks
          if (part.type === 'text-delta' && part.payload.text) {
            // Collect and transform streaming chunks
            const modifiedChunk = {
              ...part,
              payload: {
                ...part.payload,
                text: part.payload.text.replace(/obama/gi, 'OBAMA'),
              },
            };
            processedChunks.push(part.payload.text);
            return modifiedChunk;
          }
          return part;
        }

        async processOutputResult({ messages }) {
          // Also process the final result
          const processedMessages = messages.map(msg => ({
            ...msg,
            content: {
              ...msg.content,
              parts: msg.content.parts.map(part => {
                if (part.type === 'text') {
                  try {
                    const data = JSON.parse(part.text);
                    const modified = { ...data, stream_processed: true };
                    finalProcessedObject = modified;
                    return { ...part, text: JSON.stringify(modified) };
                  } catch {
                    return part;
                  }
                }
                return part;
              }),
            },
          }));

          return processedMessages;
        }
      }

      const agent = new Agent({
        id: 'stream-structured-processor-test-agent',
        name: 'Stream Structured Processor Test Agent',
        instructions: 'You know about US elections.',
        model: new MockLanguageModelV2({
          doGenerate: async () => ({
            content: [
              {
                type: 'text',
                text: '{"winner": "Barack Obama", "year": "2012"}',
              },
            ],
            warnings: [],
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
            rawCall: { rawPrompt: null, rawSettings: {} },
          }),
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: '{"winner":' },
              { type: 'text-delta', id: '1', delta: '"Barack' },
              { type: 'text-delta', id: '1', delta: ' Obama",' },
              { type: 'text-delta', id: '1', delta: '"year":"2012"}' },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
              },
            ]),
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          }),
        }),
        outputProcessors: [new StreamStructuredProcessor()],
      });

      async function testWithFormat(format: 'aisdk' | 'mastra') {
        const response = await agent.stream('Who won the 2012 US presidential election?', {
          structuredOutput: {
            schema: z.object({
              winner: z.string(),
              year: z.string(),
            }),
          },
          format,
        });

        // Consume the stream
        let streamedContent = '';
        for await (const chunk of response.fullStream) {
          if (chunk.type === 'text-delta') {
            if (format === 'aisdk') {
              streamedContent += chunk.text;
            } else {
              streamedContent += chunk.payload.text;
            }
          }
        }

        // Wait for the stream to finish
        await response.getFullOutput();

        // Check that streaming chunks were processed
        expect(processedChunks.length).toBeGreaterThan(0);
        expect(processedChunks.join('')).toContain('Barack');

        // Check that streaming content was modified
        expect(streamedContent).toContain('OBAMA');

        // Check that final object processing occurred
        expect(finalProcessedObject).toEqual({
          winner: 'Barack OBAMA',
          year: '2012',
          stream_processed: true,
        });
      }

      // await testWithFormat('aisdk');
      await testWithFormat('mastra');
    }, 20_000);
  });

  describe('Tripwire Functionality', () => {
    describe('generate method', () => {
      it('should handle processor abort with default message', async () => {
        const abortProcessor = {
          id: 'abort-output-processor',
          name: 'Abort Output Processor',
          async processOutputResult({ abort, messages }) {
            abort();
            return messages;
          },
        } satisfies Processor;

        const agent = new Agent({
          id: 'output-tripwire-test-agent',
          name: 'Output Tripwire Test Agent',
          instructions: 'You are a helpful assistant.',
          model: new MockLanguageModelV2({
            doGenerate: async () => ({
              content: [
                {
                  type: 'text',
                  text: 'This should be aborted',
                },
              ],
              warnings: [],
              finishReason: 'stop',
              usage: { inputTokens: 4, outputTokens: 10, totalTokens: 14 },
              rawCall: { rawPrompt: null, rawSettings: {} },
            }),
            doStream: async () => ({
              stream: convertArrayToReadableStream([
                { type: 'stream-start', warnings: [] },
                { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'This should be aborted' },
                { type: 'text-end', id: '1' },
                { type: 'finish', finishReason: 'stop', usage: { inputTokens: 4, outputTokens: 10, totalTokens: 14 } },
              ]),
            }),
          }),
          outputProcessors: [abortProcessor],
        });

        async function testWithFormat(format: 'aisdk' | 'mastra') {
          const result = await agent.generate('Hello', {
            format,
          });

          expect(result.tripwire).toBe(true);
          expect(result.tripwireReason).toBe('Tripwire triggered by abort-output-processor');

          expect(await result.finishReason).toBe('other');
        }

        // await testWithFormat('aisdk');
        await testWithFormat('mastra');
      });
    });

    describe('stream method', () => {
      it('should handle processor abort with default message', async () => {
        const abortProcessor = {
          id: 'abort-stream-output-processor',
          name: 'Abort Stream Output Processor',
          async processOutputStream({ part, abort }) {
            // Abort immediately on any text part
            if (part.type === 'text-delta') {
              abort();
            }
            return part;
          },
        } satisfies Processor;

        const agent = new Agent({
          id: 'stream-output-tripwire-test-agent',
          name: 'Stream Output Tripwire Test Agent',
          instructions: 'You are a helpful assistant.',
          model: mockModel,
          outputProcessors: [abortProcessor],
        });

        async function testWithFormat(format: 'aisdk' | 'mastra') {
          const stream = await agent.stream('Hello', {
            format,
          });
          const chunks: any[] = [];

          for await (const chunk of stream.fullStream) {
            chunks.push(chunk);
          }

          // Should receive tripwire chunk
          const tripwireChunk = chunks.find(c => c.type === 'tripwire');
          expect(tripwireChunk).toBeDefined();
          if (format === 'aisdk') {
            expect(tripwireChunk.tripwireReason).toBe('Stream part blocked by abort-stream-output-processor');
          } else {
            expect(tripwireChunk.payload.tripwireReason).toBe('Stream part blocked by abort-stream-output-processor');
          }
        }

        // await testWithFormat('aisdk');
        await testWithFormat('mastra');
      });

      it('should handle processor abort with custom message', async () => {
        const customAbortProcessor = {
          id: 'custom-abort-stream-output',
          name: 'Custom Abort Stream Output',
          async processOutputStream({ part, abort }) {
            if (part.type === 'text-delta') {
              abort('Custom stream output abort reason');
            }
            return part;
          },
        } satisfies Processor;

        const agent = new Agent({
          id: 'custom-stream-output-tripwire-test-agent',
          name: 'Custom Stream Output Tripwire Test Agent',
          instructions: 'You are a helpful assistant.',
          model: mockModel,
          outputProcessors: [customAbortProcessor],
        });

        async function testWithFormat(format: 'aisdk' | 'mastra') {
          const stream = await agent.stream('Custom abort test', {
            format,
          });
          const chunks: any[] = [];

          for await (const chunk of stream.fullStream) {
            chunks.push(chunk);
          }

          const tripwireChunk = chunks.find(c => c.type === 'tripwire');
          expect(tripwireChunk).toBeDefined();
          if (format === 'aisdk') {
            expect(tripwireChunk.tripwireReason).toBe('Custom stream output abort reason');
          } else {
            expect(tripwireChunk.payload.tripwireReason).toBe('Custom stream output abort reason');
          }
        }

        // await testWithFormat('aisdk');
        await testWithFormat('mastra');
      });
    });
  });

  function testStructuredOutput(format: 'aisdk' | 'mastra', model: LanguageModelV2) {
    describe('StructuredOutputProcessor Integration Tests', () => {
      describe('with real LLM', () => {
        it('should convert unstructured text to structured JSON for color analysis', async () => {
          const colorSchema = z.object({
            color: z.string().describe('The primary color'),
            intensity: z.enum(['light', 'medium', 'bright', 'vibrant']).describe('How intense the color is'),
            hexCode: z
              .string()
              .regex(/^#[0-9A-F]{6}$/i)
              .describe('Hex color code')
              .nullable(),
            mood: z.string().describe('The mood or feeling the color evokes'),
          });

          const agent = new Agent({
            id: 'color-expert',
            name: 'Color Expert',
            instructions: `You are an expert on colors. 
              Analyze colors and describe their properties, psychological effects, and technical details.
              Always give a hex code for the color.
              `,
            model,
          });

          const result = await agent.generate(
            'Tell me about a vibrant sunset orange color. What are its properties and how does it make people feel? Keep your response really short.',
            {
              structuredOutput: {
                schema: colorSchema,
                model, // Use smaller model for faster tests
                errorStrategy: 'strict',
              },
              format,
            },
          );

          // Verify we have both natural text AND structured data
          expect(result.text).toBeTruthy();

          expect(() => JSON.parse(result.text)).toThrow();

          expect(result.object).toBeDefined();

          // Validate the structured data
          expect(result.object).toMatchObject({
            color: expect.any(String),
            intensity: expect.stringMatching(/^(light|medium|bright|vibrant)$/),
            hexCode: expect.stringMatching(/^#[0-9A-F]{6}$/i),
            mood: expect.any(String),
          });

          // Validate the content makes sense for orange
          expect(result.object!.color.toLowerCase()).toContain('orange');
          expect(['bright', 'vibrant']).toContain(result.object!.intensity);
          expect(result.object!.mood).toBeTruthy();

          console.log('Natural text:', result.text);
          console.log('Structured color data:', result.object);
        }, 40000);

        it('should handle complex nested schemas for article analysis', async () => {
          const articleSchema = z.object({
            title: z.string().describe('A concise title for the content'),
            summary: z.string().describe('A brief summary of the main points'),
            keyPoints: z
              .array(
                z.object({
                  point: z.string().describe('A key insight or main point'),
                  importance: z.number().min(1).max(5).describe('Importance level from 1-5'),
                }),
              )
              .describe('List of key points from the content'),
            metadata: z.object({
              topics: z.array(z.string()).describe('Main topics covered'),
              difficulty: z.enum(['beginner', 'intermediate', 'advanced']).describe('Content difficulty level'),
              estimatedReadTime: z.number().describe('Estimated reading time in minutes'),
            }),
          });

          const agent = new Agent({
            id: 'content-analyzer',
            name: 'Content Analyzer',
            instructions: 'You are an expert content analyst. Read and analyze text content to extract key insights.',
            model,
          });

          const articleText = `
          Machine learning has revolutionized how we approach data analysis. 
          At its core, machine learning involves training algorithms to recognize patterns in data. 
          There are three main types: supervised learning (with labeled data), unsupervised learning (finding hidden patterns), 
          and reinforcement learning (learning through trial and error). 
          Popular applications include recommendation systems, image recognition, and natural language processing. 
          For beginners, starting with simple algorithms like linear regression or decision trees is recommended.
        `;

          const result = await agent.generate(`Analyze this article and extract key information:\n\n${articleText}`, {
            structuredOutput: {
              schema: articleSchema,
              model,
              errorStrategy: 'strict',
            },
            format,
          });

          // Verify we have both natural text AND structured data
          expect(result.text).toBeTruthy();

          expect(() => JSON.parse(result.text)).toThrow();

          expect(result.object).toBeDefined();

          // Validate the structured data
          expect(result.object).toMatchObject({
            title: expect.any(String),
            summary: expect.any(String),
            keyPoints: expect.arrayContaining([
              expect.objectContaining({
                point: expect.any(String),
                importance: expect.any(Number),
              }),
            ]),
            metadata: expect.objectContaining({
              topics: expect.any(Array),
              difficulty: expect.stringMatching(/^(beginner|intermediate|advanced)$/),
              estimatedReadTime: expect.any(Number),
            }),
          });

          // Validate content relevance
          expect(result.object!.title.toLowerCase()).toMatch(/machine learning|ml|data/);
          expect(result.object!.summary.toLowerCase()).toContain('machine learning');
          expect(result.object!.keyPoints.length).toBeGreaterThan(0);
          expect(
            result.object!.metadata.topics.some(
              (topic: string) =>
                topic.toLowerCase().includes('machine learning') || topic.toLowerCase().includes('data'),
            ),
          ).toBe(true);

          console.log('Natural text:', result.text);
          console.log('Structured article analysis:', result.object);
        }, 40000);

        it('should handle fallback strategy gracefully', async () => {
          const strictSchema = z.object({
            impossible: z.literal('exact_match_required'),
            number: z.number().min(1000).max(1000), // Very restrictive
          });

          const fallbackValue = {
            impossible: 'exact_match_required' as const,
            number: 1000,
          };

          const agent = new Agent({
            id: 'test-agent',
            name: 'Test Agent',
            instructions: 'You are a helpful assistant.',
            model,
          });

          const result = await agent.generate('Tell me about the weather today in a casual way.', {
            structuredOutput: {
              schema: strictSchema,
              model: new MockLanguageModelV2({
                doStream: async () => {
                  throw new Error('test error');
                },
              }),
              errorStrategy: 'fallback',
              fallbackValue,
            },
            format,
          });

          // Should preserve natural text but return fallback object
          expect(result.text).toBeTruthy();

          expect(result.object).toEqual(fallbackValue);

          console.log('Natural text:', result.text);
          console.log('Fallback object:', result.object);
        }, 40000);

        it('should work with different models for main agent vs structuring agent', async () => {
          const ideaSchema = z.object({
            idea: z.string().describe('The creative idea'),
            category: z.enum(['technology', 'business', 'art', 'science', 'other']).describe('Category of the idea'),
            feasibility: z.number().min(1).max(10).describe('How feasible is this idea (1-10)'),
            resources: z.array(z.string()).describe('Resources needed to implement'),
          });

          const agent = new Agent({
            id: 'creative-thinker',
            name: 'Creative Thinker',
            instructions: 'You are a creative thinker who generates innovative ideas and explores possibilities.',
            model, // Use faster model for idea generation
          });

          const result = await agent.generate(
            'Come up with an innovative solution for reducing food waste in restaurants.',
            {
              structuredOutput: {
                schema: ideaSchema,
                model,
                errorStrategy: 'strict',
              },
              format,
            },
          );

          // Verify we have both natural text AND structured data
          expect(result.text).toBeTruthy();

          expect(result.object).toBeDefined();

          // Validate structured data
          expect(result.object).toMatchObject({
            idea: expect.any(String),
            category: expect.stringMatching(/^(technology|business|art|science|other)$/),
            feasibility: expect.any(Number),
            resources: expect.any(Array),
          });

          // Validate content
          expect(result.object!.idea).toBeDefined();
          expect(result.object!.feasibility).toBeGreaterThanOrEqual(1);
          expect(result.object!.feasibility).toBeLessThanOrEqual(10);
          expect(result.object!.resources.length).toBeGreaterThan(0);

          console.log('Natural text:', result.text);
          console.log('Structured idea data:', result.object);
        }, 40000);
      });

      it('should work with stream', async () => {
        const ideaSchema = z.object({
          idea: z.string().describe('The creative idea'),
          category: z.enum(['technology', 'business', 'art', 'science', 'other']).describe('Category of the idea'),
          feasibility: z.number().min(1).max(10).describe('How feasible is this idea (1-10)'),
          resources: z.array(z.string()).describe('Resources needed to implement'),
        });

        const agent = new Agent({
          id: 'creative-thinker',
          name: 'Creative Thinker',
          instructions: 'You are a creative thinker who generates innovative ideas and explores possibilities.',
          model: model,
        });

        const result = await agent.stream(
          `
              Come up with an innovative solution for reducing food waste in restaurants. 
              Make sure to include an idea, category, feasibility, and resources.
            `,
          {
            format,
            structuredOutput: {
              schema: ideaSchema,
              model,
              errorStrategy: 'strict',
            },
          },
        );

        const resultText = await result.text;
        const resultObj = await result.object;

        expect(resultText).toBeTruthy();
        expect(resultText).toMatch(/food waste|restaurant|reduce|solution|innovative/i); // Should contain natural language
        expect(resultObj).toBeDefined();

        expect(resultObj).toMatchObject({
          idea: expect.any(String),
          category: expect.stringMatching(/^(technology|business|art|science|other)$/),
          feasibility: expect.any(Number),
          resources: expect.any(Array),
        });

        expect(resultObj.feasibility).toBeGreaterThanOrEqual(1);
        expect(resultObj.feasibility).toBeLessThanOrEqual(10);
        expect(resultObj.resources.length).toBeGreaterThan(0);
      }, 60000);

      it('should work with stream with useJsonSchemaPromptInjection', async () => {
        const ideaSchema = z.object({
          idea: z.string().describe('The creative idea'),
          category: z.enum(['technology', 'business', 'art', 'science', 'other']).describe('Category of the idea'),
          feasibility: z.number().min(1).max(10).describe('How feasible is this idea (1-10)'),
          resources: z.array(z.string()).describe('Resources needed to implement'),
        });

        const agent = new Agent({
          id: 'creative-thinker',
          name: 'Creative Thinker',
          instructions: 'You are a creative thinker who generates innovative ideas and explores possibilities.',
          model: model,
        });

        const result = await agent.stream(
          `
              Come up with an innovative solution for reducing food waste in restaurants. 
              Make sure to include an idea, category, feasibility, and resources.
            `,
          {
            format,
            structuredOutput: {
              schema: ideaSchema,
              model,
              errorStrategy: 'strict',
              jsonPromptInjection: true,
            },
          },
        );

        const resultText = await result.text;
        const resultObj = await result.object;

        expect(resultText).toBeTruthy();
        expect(resultText).toMatch(/food waste|restaurant|reduce|solution|innovative/i); // Should contain natural language
        expect(resultObj).toBeDefined();

        expect(resultObj).toMatchObject({
          idea: expect.any(String),
          category: expect.stringMatching(/^(technology|business|art|science|other)$/),
          feasibility: expect.any(Number),
          resources: expect.any(Array),
        });

        expect(resultObj.feasibility).toBeGreaterThanOrEqual(1);
        expect(resultObj.feasibility).toBeLessThanOrEqual(10);
        expect(resultObj.resources.length).toBeGreaterThan(0);
      }, 60000);
    });
  }

  // testStructuredOutput('aisdk', openai_v5('gpt-4o'));
  testStructuredOutput('mastra', openai_v5('gpt-4o'));
});

describe('v1 model - output processors', () => {
  describe('generate output processors', () => {
    it('should process final text through output processors', async () => {
      let processedText = '';

      class TestOutputProcessor implements Processor {
        readonly id = 'test-output-processor';
        readonly name = 'Test Output Processor';

        async processOutputResult({ messages }) {
          // Process the final generated text
          const processedMessages = messages.map(msg => ({
            ...msg,
            content: {
              ...msg.content,
              parts: msg.content.parts.map(part =>
                part.type === 'text' ? { ...part, text: part.text.replace(/test/gi, 'TEST') } : part,
              ),
            },
          }));

          // Store the processed text to verify it was called
          processedText =
            processedMessages[0]?.content.parts[0]?.type === 'text'
              ? (processedMessages[0].content.parts[0] as any).text
              : '';

          return processedMessages;
        }
      }

      const agent = new Agent({
        id: 'generate-output-processor-test-agent',
        name: 'Generate Output Processor Test Agent',
        instructions: 'You are a helpful assistant.',
        model: new MockLanguageModelV1({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            text: 'This is a test response with test words',
            finishReason: 'stop',
            usage: { completionTokens: 8, promptTokens: 10 },
          }),
        }),
        outputProcessors: [new TestOutputProcessor()],
      });

      const result = await agent.generateLegacy('Hello');

      // The output processors should modify the returned result
      expect(result.text).toBe('This is a TEST response with TEST words');

      // And the processor should have been called and processed the text
      expect(processedText).toBe('This is a TEST response with TEST words');
    });

    it('should process messages through multiple output processors in sequence', async () => {
      let finalProcessedText = '';

      class ReplaceProcessor implements Processor {
        readonly id = 'replace-processor';
        readonly name = 'Replace Processor';

        async processOutputResult({ messages }) {
          return messages.map(msg => ({
            ...msg,
            content: {
              ...msg.content,
              parts: msg.content.parts.map(part =>
                part.type === 'text' ? { ...part, text: part.text.replace(/hello/gi, 'HELLO') } : part,
              ),
            },
          }));
        }
      }

      class AddPrefixProcessor implements Processor {
        readonly id = 'prefix-processor';
        readonly name = 'Add Prefix Processor';

        async processOutputResult({ messages }) {
          const processedMessages = messages.map(msg => ({
            ...msg,
            content: {
              ...msg.content,
              parts: msg.content.parts.map(part =>
                part.type === 'text' ? { ...part, text: `[PROCESSED] ${part.text}` } : part,
              ),
            },
          }));

          // Store the final processed text to verify both processors ran
          finalProcessedText =
            processedMessages[0]?.content.parts[0]?.type === 'text'
              ? (processedMessages[0].content.parts[0] as any).text
              : '';

          return processedMessages;
        }
      }

      const agent = new Agent({
        id: 'multi-processor-generate-test-agent',
        name: 'Multi Processor Generate Test Agent',
        instructions: 'Respond with: "hello world"',
        model: new MockLanguageModelV1({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            text: 'hello world',
            finishReason: 'stop',
            usage: { completionTokens: 2, promptTokens: 5 },
          }),
        }),
        outputProcessors: [new ReplaceProcessor(), new AddPrefixProcessor()],
      });

      const result = await agent.generateLegacy('Test');

      // The output processors should modify the returned result
      expect(result.text).toBe('[PROCESSED] HELLO world');

      // And both processors should have been called in sequence
      expect(finalProcessedText).toBe('[PROCESSED] HELLO world');
    });

    it('should handle abort in output processors', async () => {
      class AbortingOutputProcessor implements Processor {
        readonly id = 'aborting-output-processor';
        readonly name = 'Aborting Output Processor';

        async processOutputResult({ messages, abort }) {
          // Check if the response contains inappropriate content
          const hasInappropriateContent = messages.some(msg =>
            msg.content.parts.some(part => part.type === 'text' && part.text.includes('inappropriate')),
          );

          if (hasInappropriateContent) {
            abort('Content flagged as inappropriate');
          }

          return messages;
        }
      }

      const agent = new Agent({
        id: 'aborting-generate-test-agent',
        name: 'Aborting Generate Test Agent',
        instructions: 'You are a helpful assistant.',
        model: new MockLanguageModelV1({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            text: 'This content is inappropriate and should be blocked',
            finishReason: 'stop',
            usage: { completionTokens: 10, promptTokens: 10 },
          }),
        }),
        outputProcessors: [new AbortingOutputProcessor()],
      });

      // Should return tripwire result when processor aborts
      const result = await agent.generateLegacy('Generate inappropriate content');

      expect(result.tripwire).toBe(true);
      expect(result.tripwireReason).toBe('Content flagged as inappropriate');
      expect(result.text).toBe('');
      expect(result.finishReason).toBe('other');
    });

    it('should skip processors that do not implement processOutputResult', async () => {
      let processedText = '';

      class CompleteProcessor implements Processor {
        readonly id = 'complete-processor';
        readonly name = 'Complete Processor';

        async processOutputResult({ messages }) {
          const processedMessages = messages.map(msg => ({
            ...msg,
            content: {
              ...msg.content,
              parts: msg.content.parts.map(part =>
                part.type === 'text' ? { ...part, text: `${part.text} [COMPLETE]` } : part,
              ),
            },
          }));

          // Store the processed text to verify this processor ran
          processedText =
            processedMessages[0]?.content.parts[0]?.type === 'text'
              ? (processedMessages[0].content.parts[0] as any).text
              : '';

          return processedMessages;
        }
      }

      // Only include the complete processor - the incomplete one would cause TypeScript errors
      const agent = new Agent({
        id: 'skipping-generate-test-agent',
        name: 'Skipping Generate Test Agent',
        instructions: 'You are a helpful assistant.',
        model: new MockLanguageModelV1({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            text: 'Original response',
            finishReason: 'stop',
            usage: { completionTokens: 2, promptTokens: 5 },
          }),
        }),
        outputProcessors: [new CompleteProcessor()],
      });

      const result = await agent.generateLegacy('Test');

      // The output processors should modify the returned result
      expect(result.text).toBe('Original response [COMPLETE]');

      // And the complete processor should have processed the text
      expect(processedText).toBe('Original response [COMPLETE]');
    });
  });

  describe('generate output processors with structured output', () => {
    it('should process structured output through output processors', async () => {
      let processedObject: any = null;

      class TestStructuredOutputProcessor implements Processor {
        readonly id = 'test-structured-output-processor';
        readonly name = 'Test Structured Output Processor';

        async processOutputResult({ messages }) {
          // Process the final generated text and extract the structured data
          const processedMessages = messages.map(msg => ({
            ...msg,
            content: {
              ...msg.content,
              parts: msg.content.parts.map(part => {
                if (part.type === 'text') {
                  // Parse the JSON and modify it
                  try {
                    const parsedData = JSON.parse(part.text);
                    const modifiedData = {
                      ...parsedData,
                      winner: parsedData.winner?.toUpperCase() || '',
                      processed: true,
                    };
                    processedObject = modifiedData;
                    return { ...part, text: JSON.stringify(modifiedData) };
                  } catch {
                    return part;
                  }
                }
                return part;
              }),
            },
          }));

          return processedMessages;
        }
      }

      const agent = new Agent({
        id: 'structured-output-processor-test-agent',
        name: 'Structured Output Processor Test Agent',
        instructions: 'You know about US elections.',
        model: new MockLanguageModelV1({
          defaultObjectGenerationMode: 'json',
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            text: '{"winner": "Barack Obama", "year": "2012"}',
            finishReason: 'stop',
            usage: { completionTokens: 10, promptTokens: 10 },
          }),
        }),
        outputProcessors: [new TestStructuredOutputProcessor()],
      });

      const result = await agent.generateLegacy('Who won the 2012 US presidential election?', {
        output: z.object({
          winner: z.string(),
          year: z.string(),
        }),
      });

      // The output processors should modify the returned result
      expect(result.object.winner).toBe('BARACK OBAMA');
      expect(result.object.year).toBe('2012');
      expect((result.object as any).processed).toBe(true);

      // And the processor should have been called and processed the structured data
      expect(processedObject).toEqual({
        winner: 'BARACK OBAMA',
        year: '2012',
        processed: true,
      });
    });

    it('should handle multiple processors with structured output', async () => {
      let firstProcessorCalled = false;
      let secondProcessorCalled = false;
      let finalResult: any = null;

      class FirstProcessor implements Processor {
        readonly id = 'first-processor';
        readonly name = 'First Processor';

        async processOutputResult({ messages }) {
          firstProcessorCalled = true;
          return messages.map(msg => ({
            ...msg,
            content: {
              ...msg.content,
              parts: msg.content.parts.map(part => {
                if (part.type === 'text') {
                  try {
                    const data = JSON.parse(part.text);
                    const modified = { ...data, first_processed: true };
                    return { ...part, text: JSON.stringify(modified) };
                  } catch {
                    return part;
                  }
                }
                return part;
              }),
            },
          }));
        }
      }

      class SecondProcessor implements Processor {
        readonly id = 'second-processor';
        readonly name = 'Second Processor';

        async processOutputResult({ messages }) {
          secondProcessorCalled = true;
          return messages.map(msg => ({
            ...msg,
            content: {
              ...msg.content,
              parts: msg.content.parts.map(part => {
                if (part.type === 'text') {
                  try {
                    const data = JSON.parse(part.text);
                    const modified = { ...data, second_processed: true };
                    finalResult = modified;
                    return { ...part, text: JSON.stringify(modified) };
                  } catch {
                    return part;
                  }
                }
                return part;
              }),
            },
          }));
        }
      }

      const agent = new Agent({
        id: 'multi-processor-structured-test-agent',
        name: 'Multi Processor Structured Test Agent',
        instructions: 'You are a helpful assistant.',
        model: new MockLanguageModelV1({
          defaultObjectGenerationMode: 'json',
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            text: '{"message": "hello world"}',
            finishReason: 'stop',
            usage: { completionTokens: 5, promptTokens: 5 },
          }),
        }),
        outputProcessors: [new FirstProcessor(), new SecondProcessor()],
      });

      const result = await agent.generateLegacy('Say hello', {
        output: z.object({
          message: z.string(),
        }),
      });

      // The output processors should modify the returned result
      expect(result.object.message).toBe('hello world');
      expect((result.object as any).first_processed).toBe(true);
      expect((result.object as any).second_processed).toBe(true);

      // Both processors should have been called
      expect(firstProcessorCalled).toBe(true);
      expect(secondProcessorCalled).toBe(true);

      // Final result should have both processor modifications
      expect(finalResult).toEqual({
        message: 'hello world',
        first_processed: true,
        second_processed: true,
      });
    });
  });

  describe('tripwire functionality', () => {
    describe('generate method', () => {
      it('should handle processor abort with default message', async () => {
        const abortProcessor = {
          id: 'abort-output-processor',
          name: 'Abort Output Processor',
          async processOutputResult({ abort, messages }) {
            abort();
            return messages;
          },
        } satisfies Processor;

        const agent = new Agent({
          id: 'output-tripwire-test-agent',
          name: 'Output Tripwire Test Agent',
          instructions: 'You are a helpful assistant.',
          model: new MockLanguageModelV1({
            doGenerate: async () => ({
              rawCall: { rawPrompt: null, rawSettings: {} },
              text: 'This should be aborted',
              finishReason: 'stop',
              usage: { completionTokens: 4, promptTokens: 10 },
            }),
          }),
          outputProcessors: [abortProcessor],
        });

        const result = await agent.generateLegacy('Hello');

        expect(result.tripwire).toBe(true);
        expect(result.tripwireReason).toBe('Tripwire triggered by abort-output-processor');
        expect(result.text).toBe('');
        expect(result.finishReason).toBe('other');
      });

      it('should handle processor abort with custom message', async () => {
        const customAbortProcessor = {
          id: 'custom-abort-output',
          name: 'Custom Abort Output',
          async processOutputResult({ abort, messages }) {
            abort('Custom output abort reason');
            return messages;
          },
        } satisfies Processor;

        const agent = new Agent({
          id: 'custom-output-tripwire-test-agent',
          name: 'Custom Output Tripwire Test Agent',
          instructions: 'You are a helpful assistant.',
          model: new MockLanguageModelV1({
            doGenerate: async () => ({
              rawCall: { rawPrompt: null, rawSettings: {} },
              text: 'This should be aborted with custom message',
              finishReason: 'stop',
              usage: { completionTokens: 8, promptTokens: 10 },
            }),
          }),
          outputProcessors: [customAbortProcessor],
        });

        const result = await agent.generateLegacy('Custom abort test');

        expect(result.tripwire).toBe(true);
        expect(result.tripwireReason).toBe('Custom output abort reason');
        expect(result.text).toBe('');
      });

      it('should not execute subsequent processors after abort', async () => {
        let secondProcessorExecuted = false;

        const abortProcessor = {
          id: 'abort-first-output',
          name: 'Abort First Output',
          async processOutputResult({ abort, messages }) {
            abort('Stop here');
            return messages;
          },
        } satisfies Processor;

        const shouldNotRunProcessor = {
          id: 'should-not-run-output',
          name: 'Should Not Run Output',
          async processOutputResult({ messages }) {
            secondProcessorExecuted = true;
            return messages.map(msg => ({
              ...msg,
              content: {
                ...msg.content,
                parts: msg.content.parts.map(part =>
                  part.type === 'text' ? { ...part, text: `${part.text} [SHOULD NOT APPEAR]` } : part,
                ),
              },
            }));
          },
        } satisfies Processor;

        const agent = new Agent({
          id: 'output-abort-sequence-test-agent',
          name: 'Output Abort Sequence Test Agent',
          instructions: 'You are a helpful assistant.',
          model: new MockLanguageModelV1({
            doGenerate: async () => ({
              rawCall: { rawPrompt: null, rawSettings: {} },
              text: 'Abort sequence test',
              finishReason: 'stop',
              usage: { completionTokens: 3, promptTokens: 10 },
            }),
          }),
          outputProcessors: [abortProcessor, shouldNotRunProcessor],
        });

        const result = await agent.generateLegacy('Abort sequence test');

        expect(result.tripwire).toBe(true);
        expect(result.tripwireReason).toBe('Stop here');
        expect(secondProcessorExecuted).toBe(false);
      });
    });
  });
});
