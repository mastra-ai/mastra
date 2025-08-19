import { convertArrayToReadableStream, MockLanguageModelV2 } from 'ai-v5/test';
import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import type { Processor } from '../processors/index';
import { RuntimeContext } from '../runtime-context';
import type { MastraMessageV2 } from './types';
import { Agent } from './index';

// Helper function to create a MastraMessageV2
const createMessage = (text: string, role: 'user' | 'assistant' = 'user'): MastraMessageV2 => ({
  id: crypto.randomUUID(),
  role,
  content: {
    format: 2,
    parts: [{ type: 'text', text }],
  },
  createdAt: new Date(),
});

describe('Input and Output Processors with VNext Methods', () => {
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

  describe('Input Processors with generate_vnext', () => {
    it.only('should run input processors before generation', async () => {
      const processor = {
        name: 'test-processor',
        processInput: async ({ messages }) => {
          messages.push(createMessage('Processor was here!'));
          return messages;
        },
      };

      const agentWithProcessor = new Agent({
        name: 'test-agent',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        inputProcessors: [processor],
      });

      const result = await agentWithProcessor.generate_vnext('Hello world');

      console.log('result', JSON.stringify(result, null, 2));

      // The processor should have added a message
      expect((result.response.messages[0].content[0] as any).text).toContain('processed:');
      expect((result.response.messages[0].content[0] as any).text).toContain('Processor was here!');
    });

    it('should run multiple processors in order', async () => {
      const processor1 = {
        name: 'processor-1',
        processInput: async ({ messages }) => {
          messages.push(createMessage('First processor'));
          return messages;
        },
      };

      const processor2 = {
        name: 'processor-2',
        processInput: async ({ messages }) => {
          messages.push(createMessage('Second processor'));
          return messages;
        },
      };

      const agentWithProcessors = new Agent({
        name: 'test-agent',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        inputProcessors: [processor1, processor2],
      });

      const result = await agentWithProcessors.generate_vnext('Hello');

      expect((result.response.messages[0].content[0] as any).text).toContain('First processor');
      expect((result.response.messages[0].content[0] as any).text).toContain('Second processor');
    });

    it('should support async processors running in sequence', async () => {
      const processor1 = {
        name: 'async-processor-1',
        processInput: async ({ messages }) => {
          messages.push(createMessage('First processor'));
          return messages;
        },
      };

      const processor2 = {
        name: 'async-processor-2',
        processInput: async ({ messages }) => {
          await new Promise(resolve => setTimeout(resolve, 10));
          messages.push(createMessage('Second processor'));
          return messages;
        },
      };

      const agentWithAsyncProcessors = new Agent({
        name: 'test-agent',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        inputProcessors: [processor1, processor2],
      });

      const result = await agentWithAsyncProcessors.generate_vnext('Test async');

      // Processors run sequentially, so "First processor" should appear before "Second processor"
      expect((result.response.messages[0].content[0] as any).text).toContain('First processor');
      expect((result.response.messages[0].content[0] as any).text).toContain('Second processor');
    });

    it('should handle processor abort with default message', async () => {
      const abortProcessor = {
        name: 'abort-processor',
        processInput: async ({ abort, messages }) => {
          abort();
          return messages;
        },
      };

      const agentWithAbortProcessor = new Agent({
        name: 'test-agent',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        inputProcessors: [abortProcessor],
      });

      const result = await agentWithAbortProcessor.generate_vnext('This should be aborted');

      expect(result.tripwire).toBe(true);
      expect(result.tripwireReason).toBe('Tripwire triggered by abort-processor');
      expect(result.finishReason).toBe('other');
    });

    it('should handle processor abort with custom message', async () => {
      const customAbortProcessor = {
        name: 'custom-abort',
        processInput: async ({ abort, messages }) => {
          abort('Custom abort reason');
          return messages;
        },
      };

      const agentWithCustomAbort = new Agent({
        name: 'test-agent',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        inputProcessors: [customAbortProcessor],
      });

      const result = await agentWithCustomAbort.generate_vnext('Custom abort test');

      expect(result.tripwire).toBe(true);
      expect(result.tripwireReason).toBe('Custom abort reason');
    });

    it('should not execute subsequent processors after abort', async () => {
      let secondProcessorExecuted = false;

      const abortProcessor = {
        name: 'abort-first',
        processInput: async ({ abort, messages }) => {
          abort('Stop here');
          return messages;
        },
      };

      const shouldNotRunProcessor = {
        name: 'should-not-run',
        processInput: async ({ messages }) => {
          secondProcessorExecuted = true;
          messages.push(createMessage('This should not be added'));
          return messages;
        },
      };

      const agentWithAbortSequence = new Agent({
        name: 'test-agent',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        inputProcessors: [abortProcessor, shouldNotRunProcessor],
      });

      const result = await agentWithAbortSequence.generate_vnext('Abort sequence test');

      expect(result.tripwire).toBe(true);
      expect(secondProcessorExecuted).toBe(false);
    });
  });

  describe('Input Processors with stream_vnext', () => {
    it('should handle input processors with streaming', async () => {
      const streamProcessor = {
        name: 'stream-processor',
        processInput: async ({ messages }) => {
          messages.push(createMessage('Stream processor active'));
          return messages;
        },
      };

      const agentWithStreamProcessor = new Agent({
        name: 'test-agent',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        inputProcessors: [streamProcessor],
      });

      const stream = await agentWithStreamProcessor.stream_vnext('Stream test');

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
        name: 'stream-abort',
        processInput: async ({ abort, messages }) => {
          abort('Stream aborted');
          return messages;
        },
      };

      const agentWithStreamAbort = new Agent({
        name: 'test-agent',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        inputProcessors: [streamAbortProcessor],
      });

      const stream = await agentWithStreamAbort.stream_vnext('Stream abort test');

      expect(stream.tripwire).toBe(true);
      expect(stream.tripwireReason).toBe('Stream aborted');

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
      const runtimeContext = new RuntimeContext<{ processorMessage: string }>();
      runtimeContext.set('processorMessage', 'Dynamic message');

      const agentWithDynamicProcessors = new Agent({
        name: 'test-agent',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        inputProcessors: ({ runtimeContext }) => {
          const message: string = runtimeContext.get('processorMessage') || 'Default message';
          return [
            {
              name: 'dynamic-processor',
              processInput: async ({ messages }) => {
                messages.push(createMessage(message));
                return messages;
              },
            },
          ];
        },
      });

      const result = await agentWithDynamicProcessors.generate_vnext('Test dynamic', {
        runtimeContext,
      });

      expect((result.response.messages[0].content[0] as any).text).toContain('Dynamic message');
    });

    it('should allow processors to modify message content', async () => {
      const messageModifierProcessor = {
        name: 'message-modifier',
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
        name: 'test-agent',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        inputProcessors: [messageModifierProcessor],
      });

      const result = await agentWithModifier.generate_vnext('Original user message');

      expect((result.response.messages[0].content[0] as any).text).toContain('MODIFIED: Original message was received');
      expect((result.response.messages[0].content[0] as any).text).toContain('Original user message');
    });

    it('should allow processors to filter or validate messages', async () => {
      const validationProcessor = {
        name: 'validator',
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
        name: 'test-agent',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        inputProcessors: [validationProcessor],
      });

      // Test valid content
      const validResult = await agentWithValidator.generate_vnext('This is appropriate content');
      expect((validResult.response.messages[0].content[0] as any).text).toContain('Content validated');

      // Test invalid content
      const invalidResult = await agentWithValidator.generate_vnext('This contains inappropriate content');
      expect(invalidResult.tripwire).toBe(true);
      expect(invalidResult.tripwireReason).toBe('Content validation failed');
    });

    it('should handle empty processors array', async () => {
      const agentWithEmptyProcessors = new Agent({
        name: 'test-agent',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        inputProcessors: [],
      });

      const result = await agentWithEmptyProcessors.generate_vnext('No processors test');

      expect((result.response.messages[0].content[0] as any).text).toContain('processed:');
      expect((result.response.messages[0].content[0] as any).text).toContain('No processors test');
    });
  });

  describe('Output Processors with generate_vnext', () => {
    it('should process final text through output processors', async () => {
      let processedText = '';

      class TestOutputProcessor implements Processor {
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
          processedText =
            processedMessages[0]?.content.parts[0]?.type === 'text'
              ? (processedMessages[0].content.parts[0] as any).text
              : '';

          return processedMessages;
        }
      }

      const agent = new Agent({
        name: 'generate-output-processor-test-agent',
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
        }),
        outputProcessors: [new TestOutputProcessor()],
      });

      const result = await agent.generate_vnext('Hello');

      // The output processors should modify the returned result
      expect((result.response.messages[0].content[0] as any).text).toBe('This is a TEST response with TEST words');

      // And the processor should have been called and processed the text
      expect(processedText).toBe('This is a TEST response with TEST words');
    });

    it('should process messages through multiple output processors in sequence', async () => {
      let finalProcessedText = '';

      class ReplaceProcessor implements Processor {
        readonly name = 'replace-processor';

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
        readonly name = 'prefix-processor';

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
        name: 'multi-processor-generate-test-agent',
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
        }),
        outputProcessors: [new ReplaceProcessor(), new AddPrefixProcessor()],
      });

      const result = await agent.generate_vnext('Test');

      // The output processors should modify the returned result
      expect((result.response.messages[0].content[0] as any).text).toBe('[PROCESSED] HELLO world');

      // And both processors should have been called in sequence
      expect(finalProcessedText).toBe('[PROCESSED] HELLO world');
    });

    it('should handle abort in output processors', async () => {
      class AbortingOutputProcessor implements Processor {
        readonly name = 'aborting-output-processor';

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
        name: 'aborting-generate-test-agent',
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
        }),
        outputProcessors: [new AbortingOutputProcessor()],
      });

      // Should return tripwire result when processor aborts
      const result = await agent.generate_vnext('Generate inappropriate content');

      expect(result.tripwire).toBe(true);
      expect(result.tripwireReason).toBe('Content flagged as inappropriate');
      expect(result.finishReason).toBe('other');
    });

    it('should skip processors that do not implement processOutputResult', async () => {
      class CompleteProcessor implements Processor {
        readonly name = 'complete-processor';

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
        readonly name = 'incomplete-processor';
        // Note: This processor doesn't implement processOutputResult or extend Processor
      }

      const agent = new Agent({
        name: 'mixed-processor-test-agent',
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
        }),
        outputProcessors: [new IncompleteProcessor() as any, new CompleteProcessor()],
      });

      const result = await agent.generate_vnext('Test incomplete processors');

      // Only the complete processor should have run
      expect((result.response.messages[0].content[0] as any).text).toBe('[COMPLETE] Test response');
    });
  });

  describe('Output Processors with stream_vnext', () => {
    it('should process text chunks through output processors in real-time', async () => {
      class TestOutputProcessor implements Processor {
        readonly name = 'test-output-processor';

        async processOutputStream(args: {
          part: any;
          streamParts: any[];
          state: Record<string, any>;
          abort: (reason?: string) => never;
        }) {
          const { part } = args;
          // Only process text-delta chunks
          if (part.type === 'text-delta') {
            return { type: 'text-delta', textDelta: part.textDelta.replace(/test/gi, 'TEST') };
          }
          return part;
        }
      }

      const agent = new Agent({
        name: 'output-processor-test-agent',
        instructions: 'You are a helpful assistant. Respond with exactly: "This is a test response"',
        model: mockModel,
        outputProcessors: [new TestOutputProcessor()],
      });

      const stream = await agent.stream_vnext('Hello');

      let collectedText = '';
      for await (const chunk of stream.fullStream) {
        if (chunk.type === 'text-delta') {
          collectedText += chunk.payload.text;
        }
      }

      // The output processor should have replaced "test" with "TEST"
      expect(collectedText).toBe('This is a TEST response');
    });

    it('should filter blocked content chunks', async () => {
      class BlockingOutputProcessor implements Processor {
        readonly name = 'filtering-output-processor';

        async processOutputStream({ part }) {
          // Filter out chunks containing "blocked"
          if (part.type === 'text-delta' && part.textDelta?.includes('blocked')) {
            return null; // Return null to filter the chunk
          }
          return part;
        }
      }

      const agent = new Agent({
        name: 'blocking-processor-test-agent',
        instructions: 'You are a helpful assistant.',
        model: mockModel,
        outputProcessors: [new BlockingOutputProcessor()],
      });

      const stream = await agent.stream_vnext('Hello');

      let collectedText = '';
      for await (const chunk of stream.fullStream) {
        if (chunk.type === 'text-delta') {
          collectedText += chunk.payload.text;
        }
      }

      // The blocked content should be filtered out completely (not appear in stream)
      expect(collectedText).toBe('This is a test response');
    });

    it('should emit tripwire when output processor calls abort', async () => {
      class AbortingOutputProcessor implements Processor {
        readonly name = 'aborting-output-processor';

        async processOutputStream({ part, abort }) {
          if (part.type === 'text-delta' && part.textDelta?.includes('test')) {
            abort('Content triggered abort');
          }

          return part;
        }
      }

      const agent = new Agent({
        name: 'aborting-processor-test-agent',
        instructions: 'You are a helpful assistant.',
        model: mockModel,
        outputProcessors: [new AbortingOutputProcessor()],
      });

      const stream = await agent.stream_vnext('Hello');
      const chunks: any[] = [];

      for await (const chunk of stream.fullStream) {
        chunks.push(chunk);
      }

      // Should have received a tripwire chunk
      const tripwireChunk = chunks.find(chunk => chunk.type === 'tripwire');
      expect(tripwireChunk).toBeDefined();
      expect(tripwireChunk.tripwireReason).toBe('Content triggered abort');

      // Should not have received the text after the abort trigger
      let collectedText = '';
      chunks.forEach(chunk => {
        if (chunk.type === 'text-delta') {
          collectedText += chunk.payload.text;
        }
      });
      // The abort happens when "test" is encountered, which is in the first chunk
      // So we might not get any text before the abort
      expect(collectedText).not.toContain('test');
    });

    it('should process chunks through multiple output processors in sequence', async () => {
      class ReplaceProcessor implements Processor {
        readonly name = 'replace-processor';

        async processOutputStream({ part }) {
          if (part.type === 'text-delta') {
            return { type: 'text-delta', textDelta: part.textDelta.replace(/test/gi, 'TEST') };
          }
          return part;
        }
      }

      class AddPrefixProcessor implements Processor {
        readonly name = 'prefix-processor';

        async processOutputStream({ part }) {
          // Add prefix to any chunk that contains "TEST"
          if (part.type === 'text-delta' && part.textDelta?.includes('TEST')) {
            return { type: 'text-delta', textDelta: `[PROCESSED] ${part.textDelta}` };
          }
          return part;
        }
      }

      const agent = new Agent({
        name: 'multi-processor-test-agent',
        instructions: 'Respond with: "This is a test response"',
        model: mockModel,
        outputProcessors: [new ReplaceProcessor(), new AddPrefixProcessor()],
      });

      const stream = await agent.stream_vnext('Test');

      let collectedText = '';
      for await (const chunk of stream.fullStream) {
        if (chunk.type === 'text-delta') {
          collectedText += chunk.payload.text;
        }
      }

      // Should be processed by both processors: replace "test" -> "TEST", then add prefix
      expect(collectedText).toBe('[PROCESSED] This is a TEST response');
    });
  });

  describe('Tripwire Functionality', () => {
    describe('stream_vnext method', () => {
      it('should handle processor abort with default message', async () => {
        const abortProcessor = {
          name: 'abort-stream-output-processor',
          async processOutputStream({ part, abort }) {
            // Abort immediately on any text part
            if (part.type === 'text-delta') {
              abort();
            }
            return part;
          },
        } satisfies Processor;

        const agent = new Agent({
          name: 'stream-output-tripwire-test-agent',
          instructions: 'You are a helpful assistant.',
          model: mockModel,
          outputProcessors: [abortProcessor],
        });

        const stream = await agent.stream_vnext('Hello');
        const chunks: any[] = [];

        for await (const chunk of stream.fullStream) {
          chunks.push(chunk);
        }

        // Should receive tripwire chunk
        const tripwireChunk = chunks.find(c => c.type === 'tripwire');
        expect(tripwireChunk).toBeDefined();
        expect(tripwireChunk.tripwireReason).toBe('Stream part blocked by abort-stream-output-processor');
      });

      it('should handle processor abort with custom message', async () => {
        const customAbortProcessor = {
          name: 'custom-abort-stream-output',
          async processOutputStream({ part, abort }) {
            if (part.type === 'text-delta') {
              abort('Custom stream output abort reason');
            }
            return part;
          },
        } satisfies Processor;

        const agent = new Agent({
          name: 'custom-stream-output-tripwire-test-agent',
          instructions: 'You are a helpful assistant.',
          model: mockModel,
          outputProcessors: [customAbortProcessor],
        });

        const stream = await agent.stream_vnext('Custom abort test');
        const chunks: any[] = [];

        for await (const chunk of stream.fullStream) {
          chunks.push(chunk);
        }

        const tripwireChunk = chunks.find(c => c.type === 'tripwire');
        expect(tripwireChunk).toBeDefined();
        expect(tripwireChunk.tripwireReason).toBe('Custom stream output abort reason');
      });
    });
  });

  describe('Structured Output with Processors', () => {
    it('should process structured output through output processors with generate_vnext', async () => {
      let processedObject: any = null;

      class StructuredOutputProcessor implements Processor {
        readonly name = 'structured-output-processor';

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
        name: 'structured-output-processor-test-agent',
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
            usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
            rawCall: { rawPrompt: null, rawSettings: {} },
          }),
        }),
        outputProcessors: [new StructuredOutputProcessor()],
      });

      const result = await agent.generate_vnext('Who won the 2012 US presidential election?', {
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
      let firstProcessorObject: any = null;
      let secondProcessorObject: any = null;

      class FirstProcessor implements Processor {
        readonly name = 'first-processor';

        async processOutputResult({ messages }) {
          const processedMessages = messages.map(msg => ({
            ...msg,
            content: {
              ...msg.content,
              parts: msg.content.parts.map(part => {
                if (part.type === 'text') {
                  try {
                    const data = JSON.parse(part.text);
                    const modified = { ...data, first_processed: true };
                    firstProcessorObject = modified;
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

      class SecondProcessor implements Processor {
        readonly name = 'second-processor';

        async processOutputResult({ messages }) {
          const processedMessages = messages.map(msg => ({
            ...msg,
            content: {
              ...msg.content,
              parts: msg.content.parts.map(part => {
                if (part.type === 'text') {
                  try {
                    const data = JSON.parse(part.text);
                    const modified = { ...data, second_processed: true };
                    secondProcessorObject = modified;
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
        name: 'multi-structured-processor-test-agent',
        instructions: 'You know about US elections.',
        model: new MockLanguageModelV2({
          doGenerate: async () => ({
            content: [
              {
                type: 'text',
                text: '{"winner": "Joe Biden", "year": "2020"}',
              },
            ],
            warnings: [],
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
            rawCall: { rawPrompt: null, rawSettings: {} },
          }),
        }),
        outputProcessors: [new FirstProcessor(), new SecondProcessor()],
      });

      const result = await agent.generate_vnext('Who won the 2020 US presidential election?', {
        output: z.object({
          winner: z.string(),
          year: z.string(),
        }),
      });

      // Both processors should have run in sequence
      expect(result.object.winner).toBe('Joe Biden');
      expect(result.object.year).toBe('2020');
      expect((result.object as any).first_processed).toBe(true);
      expect((result.object as any).second_processed).toBe(true);

      // Verify both processors were called
      expect(firstProcessorObject).toEqual({
        winner: 'Joe Biden',
        year: '2020',
        first_processed: true,
      });

      expect(secondProcessorObject).toEqual({
        winner: 'Joe Biden',
        year: '2020',
        first_processed: true,
        second_processed: true,
      });
    });

    it('should process streamed structured output through output processors with stream_vnext', async () => {
      let processedChunks: string[] = [];
      let finalProcessedObject: any = null;

      class StreamStructuredProcessor implements Processor {
        readonly name = 'stream-structured-processor';

        async processOutputStream({ part }) {
          // Handle text-delta chunks
          if (part.type === 'text-delta' && part.textDelta) {
            // Collect and transform streaming chunks
            const modifiedChunk = {
              ...part,
              textDelta: part.textDelta.replace(/obama/gi, 'OBAMA'),
            };
            processedChunks.push(part.textDelta);
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
        name: 'stream-structured-processor-test-agent',
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

      const response = await agent.stream_vnext('Who won the 2012 US presidential election?', {
        output: z.object({
          winner: z.string(),
          year: z.string(),
        }),
      });

      // Consume the stream
      let streamedContent = '';
      for await (const chunk of response.fullStream) {
        if (chunk.type === 'text-delta') {
          streamedContent += chunk.payload.text;
        }
      }

      // Wait for the stream to finish
      await response.finishReason;

      // Check that streaming chunks were processed
      expect(processedChunks.length).toBeGreaterThan(0);
      expect(processedChunks.join('')).toContain('Barack');

      // Check that streaming content was modified
      expect(streamedContent).toContain('OBAMA');

      // Check that final object processing occurred
      expect(finalProcessedObject).toEqual({
        winner: 'Barack Obama',
        year: '2012',
        stream_processed: true,
      });
    });
  });

  describe('Tripwire Functionality', () => {
    describe('generate_vnext method', () => {
      it('should handle processor abort with default message', async () => {
        const abortProcessor = {
          name: 'abort-output-processor',
          async processOutputResult({ abort, messages }) {
            abort();
            return messages;
          },
        } satisfies Processor;

        const agent = new Agent({
          name: 'output-tripwire-test-agent',
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
          }),
          outputProcessors: [abortProcessor],
        });

        const result = await agent.generate_vnext('Hello');

        expect(result.tripwire).toBe(true);
        expect(result.tripwireReason).toBe('Tripwire triggered by abort-output-processor');
        expect(result.finishReason).toBe('other');
      });

      it('should handle processor abort with custom message', async () => {
        const customAbortProcessor = {
          name: 'custom-abort-output',
          async processOutputResult({ abort, messages }) {
            abort('Custom output abort reason');
            return messages;
          },
        } satisfies Processor;

        const agent = new Agent({
          name: 'custom-output-tripwire-test-agent',
          instructions: 'You are a helpful assistant.',
          model: new MockLanguageModelV2({
            doGenerate: async () => ({
              content: [
                {
                  type: 'text',
                  text: 'This should be aborted with custom message',
                },
              ],
              warnings: [],
              finishReason: 'stop',
              usage: { inputTokens: 8, outputTokens: 10, totalTokens: 18 },
              rawCall: { rawPrompt: null, rawSettings: {} },
            }),
          }),
          outputProcessors: [customAbortProcessor],
        });

        const result = await agent.generate_vnext('Custom abort test');

        expect(result.tripwire).toBe(true);
        expect(result.tripwireReason).toBe('Custom output abort reason');
      });
    });

    describe('stream_vnext method', () => {
      it('should handle processor abort with default message', async () => {
        const abortProcessor = {
          name: 'abort-stream-output-processor',
          async processOutputStream({ part, abort }) {
            // Abort immediately on any text part
            if (part.type === 'text-delta') {
              abort();
            }
            return part;
          },
        } satisfies Processor;

        const agent = new Agent({
          name: 'stream-output-tripwire-test-agent',
          instructions: 'You are a helpful assistant.',
          model: mockModel,
          outputProcessors: [abortProcessor],
        });

        const stream = await agent.stream_vnext('Hello');
        const chunks: any[] = [];

        for await (const chunk of stream.fullStream) {
          chunks.push(chunk);
        }

        // Should receive tripwire chunk
        const tripwireChunk = chunks.find(c => c.type === 'tripwire');
        expect(tripwireChunk).toBeDefined();
        expect(tripwireChunk.tripwireReason).toBe('Stream part blocked by abort-stream-output-processor');
      });

      it('should handle processor abort with custom message', async () => {
        const customAbortProcessor = {
          name: 'custom-abort-stream-output',
          async processOutputStream({ part, abort }) {
            if (part.type === 'text-delta') {
              abort('Custom stream output abort reason');
            }
            return part;
          },
        } satisfies Processor;

        const agent = new Agent({
          name: 'custom-stream-output-tripwire-test-agent',
          instructions: 'You are a helpful assistant.',
          model: mockModel,
          outputProcessors: [customAbortProcessor],
        });

        const stream = await agent.stream_vnext('Custom abort test');
        const chunks: any[] = [];

        for await (const chunk of stream.fullStream) {
          chunks.push(chunk);
        }

        const tripwireChunk = chunks.find(c => c.type === 'tripwire');
        expect(tripwireChunk).toBeDefined();
        expect(tripwireChunk.tripwireReason).toBe('Custom stream output abort reason');
      });
    });
  });
});
