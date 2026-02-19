import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import { MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { Processor, ProcessOutputStepArgs } from '../processors/index';
import { ProcessorStepInputSchema, ProcessorStepOutputSchema } from '../processors/step-schema';
import { RequestContext } from '../request-context';
import { createStep, createWorkflow } from '../workflows';
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
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'processed: ' },
            { type: 'text-delta', id: 'text-1', delta: textContent },
            { type: 'text-end', id: 'text-1' },
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
      expect((result.response.messages![0].content[0] as any).text).toContain('processed:');
      expect((result.response.messages![0].content[0] as any).text).toContain('Processor was here!');
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

      const result = await agentWithAbortProcessor.generate('This should be aborted');

      expect(result.tripwire).toBeDefined();

      expect(result.tripwire?.reason).toBe('Tripwire triggered by abort-processor');

      expect(result.finishReason).toBe('other');
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

      const result = await agentWithCustomAbort.generate('Custom abort test');

      expect(result.tripwire).toBeDefined();
      expect(result.tripwire?.reason).toBe('Custom abort reason');
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

      expect(result.tripwire).toBeDefined();
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
      expect(fullOutput.tripwire).toBeDefined();
      expect(fullOutput.tripwire?.reason).toBe('Stream aborted');

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
      expect(invalidResult.tripwire).toBeDefined();
      expect(invalidResult.tripwire?.reason).toBe('Content validation failed');
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
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'This is a test response with test words' },
              { type: 'text-end', id: 'text-1' },
              { type: 'finish', finishReason: 'stop', usage: { inputTokens: 8, outputTokens: 10, totalTokens: 18 } },
            ]),
          }),
        }),
        outputProcessors: [new TestOutputProcessor()],
      });

      const result = await agent.generate('Hello');

      // The output processors should modify the returned result
      expect((result.response.messages[0].content[0] as any).text).toBe('This is a TEST response with TEST words');

      // And the processor should have been called and processed the text
      expect(processedText).toBe('This is a TEST response with TEST words');
    });

    it('should return processed text in result.text property', async () => {
      class TextTransformProcessor implements Processor {
        readonly id = 'text-transform-processor';
        readonly name = 'Text Transform Processor';

        async processOutputResult({ messages }) {
          return messages.map(msg => ({
            ...msg,
            content: {
              ...msg.content,
              parts: msg.content.parts.map(part =>
                part.type === 'text' ? { ...part, text: part.text.toUpperCase() } : part,
              ),
            },
          }));
        }
      }

      const agent = new Agent({
        id: 'result-text-processor-test-agent',
        name: 'Result Text Processor Test Agent',
        instructions: 'You are a helpful assistant.',
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
        outputProcessors: [new TextTransformProcessor()],
      });

      const result = await agent.generate('Test');

      // The result.text property should contain the processed text (uppercase)
      // not the original unprocessed text
      expect(result.text).toBe('HELLO WORLD');

      // Also verify the response messages are processed correctly
      expect((result.response.messages[0].content[0] as any).text).toBe('HELLO WORLD');
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
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'hello world' },
              { type: 'text-end', id: 'text-1' },
              { type: 'finish', finishReason: 'stop', usage: { inputTokens: 2, outputTokens: 5, totalTokens: 7 } },
            ]),
          }),
        }),
        outputProcessors: [new ReplaceProcessor(), new AddPrefixProcessor()],
      });

      const result = await agent.generate('Test');

      // The output processors should modify the returned result
      expect((result.response.messages?.[0].content[0] as any).text).toBe('[PROCESSED] HELLO world');

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
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'This content is inappropriate and should be blocked' },
              { type: 'text-end', id: 'text-1' },
              { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 } },
            ]),
          }),
        }),
        outputProcessors: [new AbortingOutputProcessor()],
      });

      // Should return tripwire result when processor aborts
      const result = await agent.generate('Generate inappropriate content');

      expect(result.tripwire).toBeDefined();
      expect(result.tripwire?.reason).toBe('Content flagged as inappropriate');
      expect(result.finishReason).toBe('other');
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
                text: 'This is a test response',
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
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'This is a test response' },
              { type: 'text-end', id: 'text-1' },
              { type: 'finish', finishReason: 'stop', usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 } },
            ]),
          }),
        }),
        outputProcessors: [new IncompleteProcessor() as any, new CompleteProcessor()],
      });

      const result = await agent.generate('Test incomplete processors');

      // Only the complete processor should have run
      expect((result.response.messages![0].content[0] as any).text).toBe('[COMPLETE] This is a test response');
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

      const stream = await agent.stream('Hello');

      let collectedText = '';
      for await (const chunk of stream.fullStream) {
        if (chunk.type === 'text-delta') {
          collectedText += chunk.payload.text;
        }
      }

      expect(collectedText).toBe(
        'processed: You are a helpful assistant. Respond with exactly: "This is a TEST response" Hello',
      );
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

      const stream = await agent.stream('Hello');

      let collectedText = '';
      for await (const chunk of stream.fullStream) {
        if (chunk.type === 'text-delta') {
          collectedText += chunk.payload.text;
        }
      }

      // The blocked content should be filtered out completely (not appear in stream)
      expect(collectedText).toBe('processed: ');
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

      const stream = await agent.stream('Hello');
      const chunks: any[] = [];

      for await (const chunk of stream.fullStream) {
        chunks.push(chunk);
      }

      // Should have received a tripwire chunk
      const tripwireChunk = chunks.find(chunk => chunk.type === 'tripwire');
      expect(tripwireChunk).toBeDefined();
      expect(tripwireChunk.payload.reason).toBe('Content triggered abort');

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

      const stream = await agent.stream('Test');

      let collectedText = '';
      for await (const chunk of stream.fullStream) {
        if (chunk.type === 'text-delta') {
          collectedText += chunk.payload.text;
        }
      }

      // Should be processed by both processors: replace "test" -> "TEST", then add prefix
      expect(collectedText).toBe('[PROCESSED] SUH DUDE[PROCESSED] SUH DUDE');
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
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: '{"winner":' },
              { type: 'text-delta', id: 'text-1', delta: '"Barack' },
              { type: 'text-delta', id: 'text-1', delta: ' Obama",' },
              { type: 'text-delta', id: 'text-1', delta: '"year":"2012"}' },
              { type: 'text-end', id: 'text-1' },
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

      const response = await agent.stream('Who won the 2012 US presidential election?', {
        structuredOutput: {
          schema: z.object({
            winner: z.string(),
            year: z.string(),
          }),
        },
      });

      // Consume the stream
      let streamedContent = '';
      for await (const chunk of response.fullStream) {
        if (chunk.type === 'text-delta') {
          streamedContent += chunk.payload.text;
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
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: 'This should be aborted' },
                { type: 'text-end', id: 'text-1' },
                { type: 'finish', finishReason: 'stop', usage: { inputTokens: 4, outputTokens: 10, totalTokens: 14 } },
              ]),
            }),
          }),
          outputProcessors: [abortProcessor],
        });

        const result = await agent.generate('Hello');

        expect(result.tripwire).toBeDefined();
        expect(result.tripwire?.reason).toBe('Tripwire triggered by abort-output-processor');

        expect(result.finishReason).toBe('other');
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

        const stream = await agent.stream('Hello');
        const chunks: any[] = [];

        for await (const chunk of stream.fullStream) {
          chunks.push(chunk);
        }

        // Should receive tripwire chunk
        const tripwireChunk = chunks.find(c => c.type === 'tripwire');
        expect(tripwireChunk).toBeDefined();
        expect(tripwireChunk.payload.reason).toBe('Tripwire triggered by abort-stream-output-processor');
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

        const stream = await agent.stream('Custom abort test');
        const chunks: any[] = [];

        for await (const chunk of stream.fullStream) {
          chunks.push(chunk);
        }

        const tripwireChunk = chunks.find(c => c.type === 'tripwire');
        expect(tripwireChunk).toBeDefined();
        expect(tripwireChunk.payload.reason).toBe('Custom stream output abort reason');
      });
    });
  });
});

describe('New Processor Features', () => {
  describe('TripWire with retry option', () => {
    it('should include retry flag in stream tripwire chunk for input processor', async () => {
      const mockModel = new MockLanguageModelV2({
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'test response' },
            { type: 'text-end', id: '1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 } },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        }),
      });

      const retryProcessor = {
        id: 'retry-processor',
        processInput: async ({ messages, abort }) => {
          abort('Response needs improvement', { retry: true });
          return messages;
        },
      } satisfies Processor;

      const agent = new Agent({
        id: 'retry-tripwire-test-agent',
        name: 'Retry Tripwire Test Agent',
        instructions: 'You are a helpful assistant.',
        model: mockModel,
        inputProcessors: [retryProcessor],
      });

      const stream = await agent.stream('Hello');
      const chunks: any[] = [];

      for await (const chunk of stream.fullStream) {
        chunks.push(chunk);
      }

      const tripwireChunk = chunks.find(c => c.type === 'tripwire');
      expect(tripwireChunk).toBeDefined();
      expect(tripwireChunk.payload.reason).toBe('Response needs improvement');
      expect(tripwireChunk.payload.retry).toBe(true);
    });

    it('should include retry flag in stream tripwire chunk for output stream processor', async () => {
      const mockModel = new MockLanguageModelV2({
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'test response' },
            { type: 'text-end', id: '1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 } },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        }),
      });

      const retryStreamProcessor = {
        id: 'retry-stream-processor',
        processOutputStream: async ({ part, abort }) => {
          if (part.type === 'text-delta') {
            abort('Stream content needs retry', { retry: true });
          }
          return part;
        },
      } satisfies Processor;

      const agent = new Agent({
        id: 'retry-stream-tripwire-test-agent',
        name: 'Retry Stream Tripwire Test Agent',
        instructions: 'You are a helpful assistant.',
        model: mockModel,
        outputProcessors: [retryStreamProcessor],
      });

      const stream = await agent.stream('Hello');
      const chunks: any[] = [];

      for await (const chunk of stream.fullStream) {
        chunks.push(chunk);
      }

      const tripwireChunk = chunks.find(c => c.type === 'tripwire');
      expect(tripwireChunk).toBeDefined();
      expect(tripwireChunk.payload.reason).toBe('Stream content needs retry');
      expect(tripwireChunk.payload.retry).toBe(true);
    });
  });

  describe('TripWire with typed metadata', () => {
    it('should include metadata in stream tripwire chunk for input processor', async () => {
      const mockModel = new MockLanguageModelV2({
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'test response' },
            { type: 'text-end', id: '1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 } },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        }),
      });

      interface PIIMetadata {
        fields: string[];
        severity: 'low' | 'medium' | 'high';
      }

      const piiProcessor = {
        id: 'pii-processor',
        processInput: async ({ messages, abort }) => {
          abort('PII detected in input', {
            metadata: {
              fields: ['email', 'phone'],
              severity: 'high',
            } as PIIMetadata,
          });
          return messages;
        },
      } satisfies Processor;

      const agent = new Agent({
        id: 'metadata-tripwire-test-agent',
        name: 'Metadata Tripwire Test Agent',
        instructions: 'You are a helpful assistant.',
        model: mockModel,
        inputProcessors: [piiProcessor],
      });

      const stream = await agent.stream('My email is test@test.com');
      const chunks: any[] = [];

      for await (const chunk of stream.fullStream) {
        chunks.push(chunk);
      }

      const tripwireChunk = chunks.find(c => c.type === 'tripwire');
      expect(tripwireChunk).toBeDefined();
      expect(tripwireChunk.payload.reason).toBe('PII detected in input');
      expect(tripwireChunk.payload.metadata).toEqual({
        fields: ['email', 'phone'],
        severity: 'high',
      });
    });

    it('should include both retry and metadata in stream tripwire chunk', async () => {
      const mockModel = new MockLanguageModelV2({
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'toxic content here' },
            { type: 'text-end', id: '1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 } },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        }),
      });

      interface ToxicityMetadata {
        category: string;
        confidence: number;
      }

      const toxicityProcessor = {
        id: 'toxicity-processor',
        processOutputStream: async ({ part, abort }) => {
          if (part.type === 'text-delta' && part.payload.text?.includes('toxic')) {
            abort('Toxic content detected', {
              retry: true,
              metadata: {
                category: 'hate_speech',
                confidence: 0.95,
              } as ToxicityMetadata,
            });
          }
          return part;
        },
      } satisfies Processor;

      const agent = new Agent({
        id: 'metadata-stream-tripwire-test-agent',
        name: 'Metadata Stream Tripwire Test Agent',
        instructions: 'You are a helpful assistant.',
        model: mockModel,
        outputProcessors: [toxicityProcessor],
      });

      const stream = await agent.stream('Hello');
      const chunks: any[] = [];

      for await (const chunk of stream.fullStream) {
        chunks.push(chunk);
      }

      const tripwireChunk = chunks.find(c => c.type === 'tripwire');
      expect(tripwireChunk).toBeDefined();
      expect(tripwireChunk.payload.reason).toBe('Toxic content detected');
      expect(tripwireChunk.payload.retry).toBe(true);
      expect(tripwireChunk.payload.metadata).toEqual({
        category: 'hate_speech',
        confidence: 0.95,
      });
    });
  });

  describe('retryCount passed to processors', () => {
    it('should pass retryCount to input processor', async () => {
      let receivedRetryCount = -1;

      const retryAwareProcessor = {
        id: 'retry-aware-processor',
        processInput: async ({ messages, retryCount }) => {
          receivedRetryCount = retryCount;
          return messages;
        },
      } satisfies Processor;

      const agent = new Agent({
        id: 'retry-count-test-agent',
        name: 'Retry Count Test Agent',
        instructions: 'You are a helpful assistant.',
        model: new MockLanguageModelV2({
          doGenerate: async () => ({
            content: [{ type: 'text', text: 'test response' }],
            finishReason: 'stop',
            usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          }),
        }),
        inputProcessors: [retryAwareProcessor],
      });

      await agent.generate('Hello');

      // First call should have retryCount = 0
      expect(receivedRetryCount).toBe(0);
    });

    it('should pass retryCount to output processor', async () => {
      let receivedRetryCount = -1;

      const retryAwareOutputProcessor = {
        id: 'retry-aware-output-processor',
        processOutputResult: async ({ messages, retryCount }) => {
          receivedRetryCount = retryCount;
          return messages;
        },
      } satisfies Processor;

      const agent = new Agent({
        id: 'retry-count-output-test-agent',
        name: 'Retry Count Output Test Agent',
        instructions: 'You are a helpful assistant.',
        model: new MockLanguageModelV2({
          doGenerate: async () => ({
            content: [{ type: 'text', text: 'test response' }],
            finishReason: 'stop',
            usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          }),
        }),
        outputProcessors: [retryAwareOutputProcessor],
      });

      await agent.generate('Hello');

      expect(receivedRetryCount).toBe(0);
    });

    it('should pass retryCount to stream processor', async () => {
      let receivedRetryCount = -1;

      const mockModel = new MockLanguageModelV2({
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'test' },
            { type: 'text-end', id: '1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 } },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        }),
      });

      const retryAwareStreamProcessor = {
        id: 'retry-aware-stream-processor',
        processOutputStream: async ({ part, retryCount }) => {
          if (part.type === 'text-delta') {
            receivedRetryCount = retryCount;
          }
          return part;
        },
      } satisfies Processor;

      const agent = new Agent({
        id: 'retry-count-stream-test-agent',
        name: 'Retry Count Stream Test Agent',
        instructions: 'You are a helpful assistant.',
        model: mockModel,
        outputProcessors: [retryAwareStreamProcessor],
      });

      const stream = await agent.stream('Hello');
      for await (const _ of stream.fullStream) {
        // Consume the stream
      }

      expect(receivedRetryCount).toBe(0);
    });
  });

  describe('retry mechanism', () => {
    it('should retry with feedback when processor calls abort with retry: true', async () => {
      let callCount = 0;
      const receivedMessages: any[][] = [];

      const mockModel = new MockLanguageModelV2({
        doGenerate: async ({ prompt }) => {
          callCount++;
          receivedMessages.push([...prompt]);

          if (callCount === 1) {
            // First call - generate response that will trigger retry
            return {
              content: [{ type: 'text', text: 'bad response that needs improvement' }],
              finishReason: 'stop',
              usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
            };
          } else {
            // Second call after retry - generate acceptable response
            return {
              content: [{ type: 'text', text: 'improved response' }],
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
            };
          }
        },
      });

      const retryTriggeringProcessor = {
        id: 'retry-triggering-processor',
        // Use processOutputStep since that's where retry is implemented in the agentic loop
        processOutputStep: async ({ text, abort, retryCount }: any) => {
          // Only trigger retry on first call when the text contains 'bad response'
          if (retryCount === 0 && text?.includes('bad response')) {
            abort('Response quality too low, please improve', { retry: true });
          }
          return [];
        },
      } satisfies Processor;

      const agent = new Agent({
        id: 'retry-mechanism-test-agent',
        name: 'Retry Mechanism Test Agent',
        instructions: 'You are a helpful assistant.',
        model: mockModel,
        outputProcessors: [retryTriggeringProcessor],
        maxProcessorRetries: 3,
      });

      const result = await agent.generate('Hello');

      // Should have made 2 calls to the model
      expect(callCount).toBe(2);

      // The second call should include the retry feedback message as a system message
      const secondCallMessages = receivedMessages[1];
      const hasRetryFeedback = secondCallMessages.some((msg: any) => {
        if (msg.role === 'system') {
          const content = typeof msg.content === 'string' ? msg.content : '';
          return content.includes('Response quality too low');
        }
        return false;
      });
      expect(hasRetryFeedback).toBe(true);

      // Final result text should only include the accepted response
      // The rejected step has tripwire data, so its text returns empty
      expect(result.text).toBe('improved response');
      expect(result.tripwire).toBeFalsy();

      // Both steps should be in the steps array
      expect(result.steps.length).toBe(2);
      // First step should have tripwire data (rejected)
      expect((result.steps[0] as any).tripwire).toBeDefined();
      expect((result.steps[0] as any).tripwire.reason).toBe('Response quality too low, please improve');
      // Second step should not have tripwire (accepted)
      expect((result.steps[1] as any).tripwire).toBeUndefined();
    });

    it('should increment retryCount on each retry', async () => {
      const receivedRetryCounts: number[] = [];
      let callCount = 0;

      const mockModel = new MockLanguageModelV2({
        doGenerate: async () => {
          callCount++;
          return {
            content: [{ type: 'text', text: `response ${callCount}` }],
            finishReason: 'stop',
            usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          };
        },
      });

      const retryCountTrackingProcessor = {
        id: 'retry-count-tracking-processor',
        // Use processOutputStep since that's where retry is implemented
        processOutputStep: async ({ abort, retryCount }: any) => {
          receivedRetryCounts.push(retryCount);
          // Keep retrying until retryCount reaches 2
          if (retryCount < 2) {
            abort('Need more retries', { retry: true });
          }
          return [];
        },
      } satisfies Processor;

      const agent = new Agent({
        id: 'retry-count-increment-test-agent',
        name: 'Retry Count Increment Test Agent',
        instructions: 'You are a helpful assistant.',
        model: mockModel,
        outputProcessors: [retryCountTrackingProcessor],
        maxProcessorRetries: 5,
      });

      await agent.generate('Hello');

      // Should have received incrementing retry counts: 0, 1, 2
      expect(receivedRetryCounts).toEqual([0, 1, 2]);
      expect(callCount).toBe(3);
    });

    it('should stop retrying and return tripwire when maxProcessorRetries is reached', async () => {
      let callCount = 0;

      const mockModel = new MockLanguageModelV2({
        doGenerate: async () => {
          callCount++;
          return {
            content: [{ type: 'text', text: `response ${callCount}` }],
            finishReason: 'stop',
            usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          };
        },
      });

      const alwaysRetryProcessor = {
        id: 'always-retry-processor',
        // Use processOutputStep since that's where retry is implemented
        processOutputStep: async ({ abort }: any) => {
          // Always trigger retry
          abort('Never satisfied', { retry: true });
          return [];
        },
      } satisfies Processor;

      const agent = new Agent({
        id: 'max-retries-test-agent',
        name: 'Max Retries Test Agent',
        instructions: 'You are a helpful assistant.',
        model: mockModel,
        outputProcessors: [alwaysRetryProcessor],
        maxProcessorRetries: 2,
      });

      const result = await agent.generate('Hello');

      // Should have made maxProcessorRetries + 1 calls (initial + retries)
      expect(callCount).toBe(3);

      // Should return tripwire since max retries exceeded
      expect(result.tripwire).toBeDefined();
      expect(result.tripwire?.reason).toBe('Never satisfied');
    });

    it('should not include rejected assistant response in messages sent to LLM on retry', async () => {
      let callCount = 0;
      const receivedPrompts: LanguageModelV2Prompt[] = [];

      const mockModel = new MockLanguageModelV2({
        doGenerate: async ({ prompt }) => {
          callCount++;
          receivedPrompts.push([...prompt]);

          if (callCount === 1) {
            return {
              content: [{ type: 'text', text: 'fabricated response that should be rejected' }],
              finishReason: 'stop',
              usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
            };
          } else {
            return {
              content: [{ type: 'text', text: 'corrected response' }],
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
            };
          }
        },
      });

      // Capture the rejected text dynamically from the processor, mirroring how
      // a real processor inspects the response at runtime (not hardcoded).
      let firstResponseText = '';

      const fabricationDetector = {
        id: 'fabrication-detector',
        processOutputStep: async ({ text, abort, retryCount }: ProcessOutputStepArgs) => {
          if (retryCount === 0) {
            firstResponseText = text || '';
            abort('Fabrication detected, please regenerate without fabricating', { retry: true });
          }
          return [];
        },
      } satisfies Processor;

      const agent = new Agent({
        id: 'retry-no-rejected-response-agent',
        name: 'Retry No Rejected Response Agent',
        instructions: 'You are a helpful assistant.',
        model: mockModel,
        outputProcessors: [fabricationDetector],
        maxProcessorRetries: 3,
      });

      const result = await agent.generate('What is the capital of France?');

      // Sanity: processor saw the rejected text
      expect(firstResponseText).toBe('fabricated response that should be rejected');
      expect(callCount).toBe(2);

      // The retry call's prompt should NOT contain the rejected assistant response.
      // This is the core of the bug: on retry, the full message thread is sent to the LLM
      // including the rejected response, which confuses the model and causes empty responses.
      const retryPrompt = receivedPrompts[1]!;
      const hasRejectedResponse = retryPrompt.some(msg => {
        if (msg.role !== 'assistant') return false;
        return msg.content.some(part => part.type === 'text' && part.text.includes(firstResponseText));
      });
      expect(hasRejectedResponse).toBe(false);

      // The retry feedback should be present as a system message
      const hasRetryFeedback = retryPrompt.some(
        msg => msg.role === 'system' && msg.content.includes('Fabrication detected'),
      );
      expect(hasRetryFeedback).toBe(true);

      // Final result should be the corrected response
      expect(result.text).toBe('corrected response');
    });

    it('should not include rejected assistant response in messages on retry when streaming', async () => {
      let callCount = 0;
      const receivedPrompts: LanguageModelV2Prompt[] = [];

      const mockModel = new MockLanguageModelV2({
        doStream: async ({ prompt }) => {
          callCount++;
          receivedPrompts.push([...prompt]);

          const responseText = callCount === 1 ? 'fabricated response that should be rejected' : 'corrected response';

          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: responseText },
              { type: 'text-end', id: 'text-1' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
              },
            ]),
            rawCall: { rawPrompt: null, rawSettings: {} },
          };
        },
      });

      // Capture the rejected text dynamically from the processor
      let firstResponseText = '';

      const fabricationDetector = {
        id: 'fabrication-detector-stream',
        processOutputStep: async ({ text, abort, retryCount }: ProcessOutputStepArgs) => {
          if (retryCount === 0) {
            firstResponseText = text || '';
            abort('Fabrication detected, please regenerate', { retry: true });
          }
          return [];
        },
      } satisfies Processor;

      const agent = new Agent({
        id: 'retry-no-rejected-response-stream-agent',
        name: 'Retry No Rejected Response Stream Agent',
        instructions: 'You are a helpful assistant.',
        model: mockModel,
        outputProcessors: [fabricationDetector],
        maxProcessorRetries: 3,
      });

      const stream = await agent.stream('What is the capital of France?');
      // Consume the stream
      for await (const _ of stream.fullStream) {
      }
      const result = await stream.getFullOutput();

      // Sanity: processor saw the rejected text
      expect(firstResponseText).toBe('fabricated response that should be rejected');
      expect(callCount).toBe(2);

      // The retry prompt should NOT contain the rejected assistant response
      const retryPrompt = receivedPrompts[1]!;
      const hasRejectedResponse = retryPrompt.some(msg => {
        if (msg.role !== 'assistant') return false;
        return msg.content.some(part => part.type === 'text' && part.text.includes(firstResponseText));
      });
      expect(hasRejectedResponse).toBe(false);

      // Final text should be the corrected response
      expect(result?.text).toBe('corrected response');
    });
  });

  describe('processorId in tripwire output', () => {
    it('should include processorId in stream tripwire chunk for input processor', async () => {
      const mockModel = new MockLanguageModelV2({
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'test' },
            { type: 'text-end', id: '1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 } },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        }),
      });

      const identifiedProcessor = {
        id: 'my-identified-processor',
        processInput: async ({ messages, abort }) => {
          abort('Blocked by identified processor');
          return messages;
        },
      } satisfies Processor;

      const agent = new Agent({
        id: 'processor-id-test-agent',
        name: 'Processor ID Test Agent',
        instructions: 'You are a helpful assistant.',
        model: mockModel,
        inputProcessors: [identifiedProcessor],
      });

      const stream = await agent.stream('Hello');
      const chunks: any[] = [];

      for await (const chunk of stream.fullStream) {
        chunks.push(chunk);
      }

      const tripwireChunk = chunks.find(c => c.type === 'tripwire');
      expect(tripwireChunk).toBeDefined();
      expect(tripwireChunk.payload.processorId).toBe('my-identified-processor');
    });

    it('should include processorId in stream tripwire chunk for output stream processor', async () => {
      const mockModel = new MockLanguageModelV2({
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'test' },
            { type: 'text-end', id: '1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 } },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        }),
      });

      const identifiedStreamProcessor = {
        id: 'my-stream-processor',
        processOutputStream: async ({ part, abort }) => {
          if (part.type === 'text-delta') {
            abort('Stream blocked');
          }
          return part;
        },
      } satisfies Processor;

      const agent = new Agent({
        id: 'processor-id-stream-test-agent',
        name: 'Processor ID Stream Test Agent',
        instructions: 'You are a helpful assistant.',
        model: mockModel,
        outputProcessors: [identifiedStreamProcessor],
      });

      const stream = await agent.stream('Hello');
      const chunks: any[] = [];

      for await (const chunk of stream.fullStream) {
        chunks.push(chunk);
      }

      const tripwireChunk = chunks.find(c => c.type === 'tripwire');
      expect(tripwireChunk).toBeDefined();
      expect(tripwireChunk.payload.processorId).toBe('my-stream-processor');
    });
  });
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
            processedMessages[0]?.content.parts[0]?.type === 'text' ? processedMessages[0].content.parts[0].text : '';

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
            processedMessages[0]?.content.parts[0]?.type === 'text' ? processedMessages[0].content.parts[0].text : '';

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

      expect(result.tripwire).toBeDefined();
      expect(result.tripwire?.reason).toBe('Content flagged as inappropriate');
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

        expect(result.tripwire).toBeDefined();
        expect(result.tripwire?.reason).toBe('Tripwire triggered by abort-output-processor');
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

        expect(result.tripwire).toBeDefined();
        expect(result.tripwire?.reason).toBe('Custom output abort reason');
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

        expect(result.tripwire).toBeDefined();
        expect(result.tripwire?.reason).toBe('Stop here');
        expect(secondProcessorExecuted).toBe(false);
      });
    });
  });
});

describe('Workflow as Processor', () => {
  describe('input processor workflow', () => {
    it('should execute a workflow as an input processor', async () => {
      let workflowExecuted = false;

      // Create a processor that will be used as a workflow step
      const inputProcessor: Processor = {
        id: 'input-transformer',
        processInput: async ({ messages }) => {
          workflowExecuted = true;
          // Transform messages by adding a prefix
          return messages.map(msg => ({
            ...msg,
            content: {
              ...msg.content,
              parts: msg.content.parts.map(part =>
                part.type === 'text' ? { ...part, text: `[WORKFLOW] ${part.text}` } : part,
              ),
            },
          }));
        },
      };

      // Pass the processor directly to .then() via createStep
      const inputProcessorWorkflow = createWorkflow({
        id: 'input-processor-workflow',
        inputSchema: ProcessorStepInputSchema,
        outputSchema: ProcessorStepOutputSchema,
      })
        .then(createStep(inputProcessor))
        .commit();

      const mockModel = new MockLanguageModelV2({
        doGenerate: async ({ prompt }) => {
          // Extract the transformed text from the prompt
          const messages = Array.isArray(prompt) ? prompt : [];
          const userMessage = messages.find(m => m.role === 'user');
          const content = userMessage?.content?.[0];
          const text =
            content && typeof content === 'object' && 'type' in content && content.type === 'text'
              ? content.text
              : 'No text found';

          return {
            content: [{ type: 'text', text: `Response to: ${text}` }],
            finishReason: 'stop',
            usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          };
        },
      });

      const agent = new Agent({
        id: 'workflow-input-processor-test-agent',
        name: 'Workflow Input Processor Test Agent',
        instructions: 'You are a helpful assistant.',
        model: mockModel,
        inputProcessors: [inputProcessorWorkflow],
      });

      const result = await agent.generate('Hello world');

      expect(workflowExecuted).toBe(true);
      // The response should include the transformed message
      expect(result.text).toContain('[WORKFLOW]');
    });

    it('should handle tripwire from input processor workflow', async () => {
      // Create a processor that triggers a tripwire
      const tripwireProcessor: Processor = {
        id: 'tripwire-processor',
        processInput: async ({ messages, abort }) => {
          // Check for forbidden content
          const hasBlockedContent = messages.some(msg =>
            msg.content.parts.some(part => part.type === 'text' && part.text.includes('blocked')),
          );

          if (hasBlockedContent) {
            abort('Content contains blocked keywords', { retry: true, metadata: { severity: 'high' } });
          }

          return messages;
        },
      };

      const tripwireWorkflow = createWorkflow({
        id: 'tripwire-input-workflow',
        inputSchema: ProcessorStepInputSchema,
        outputSchema: ProcessorStepOutputSchema,
      })
        .then(createStep(tripwireProcessor))
        .commit();

      const mockModel = new MockLanguageModelV2({
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'response' },
            { type: 'text-end', id: '1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 } },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        }),
      });

      const agent = new Agent({
        id: 'tripwire-workflow-test-agent',
        name: 'Tripwire Workflow Test Agent',
        instructions: 'You are a helpful assistant.',
        model: mockModel,
        inputProcessors: [tripwireWorkflow],
      });

      const stream = await agent.stream('This message contains blocked content');
      const chunks: any[] = [];

      for await (const chunk of stream.fullStream) {
        chunks.push(chunk);
      }

      const tripwireChunk = chunks.find(c => c.type === 'tripwire');
      expect(tripwireChunk).toBeDefined();
      expect(tripwireChunk.payload.reason).toBe('Content contains blocked keywords');
      expect(tripwireChunk.payload.retry).toBe(true);
      expect(tripwireChunk.payload.metadata).toEqual({ severity: 'high' });
    });
  });

  describe('output processor workflow', () => {
    it('should execute a workflow as an output processor', async () => {
      let workflowExecuted = false;

      // Create a processor for output processing
      const outputProcessor: Processor = {
        id: 'output-transformer',
        processOutputResult: async ({ messages }) => {
          workflowExecuted = true;
          // Transform output messages by adding a suffix
          return messages.map(msg => {
            if (msg.role === 'assistant') {
              return {
                ...msg,
                content: {
                  ...msg.content,
                  parts: msg.content.parts.map(part =>
                    part.type === 'text' ? { ...part, text: `${part.text} [PROCESSED]` } : part,
                  ),
                },
              };
            }
            return msg;
          });
        },
      };

      const outputProcessorWorkflow = createWorkflow({
        id: 'output-processor-workflow',
        inputSchema: ProcessorStepInputSchema,
        outputSchema: ProcessorStepOutputSchema,
      })
        .then(createStep(outputProcessor))
        .commit();

      const mockModel = new MockLanguageModelV2({
        doGenerate: async () => ({
          content: [{ type: 'text', text: 'Hello from the agent' }],
          finishReason: 'stop',
          usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        }),
      });

      const agent = new Agent({
        id: 'workflow-output-processor-test-agent',
        name: 'Workflow Output Processor Test Agent',
        instructions: 'You are a helpful assistant.',
        model: mockModel,
        outputProcessors: [outputProcessorWorkflow],
      });

      const result = await agent.generate('Hello');

      expect(workflowExecuted).toBe(true);
      // Output processors modify response.messages, not result.text
      expect((result.response.messages![0].content[0] as any).text).toBe('Hello from the agent [PROCESSED]');
    });

    it('should handle tripwire from output processor workflow', async () => {
      // Create a processor that triggers a tripwire on certain output
      const outputTripwireProcessor: Processor = {
        id: 'output-tripwire-processor',
        processOutputResult: async ({ messages, abort }) => {
          // Check for inappropriate output
          const hasInappropriateOutput = messages.some(
            msg =>
              msg.role === 'assistant' &&
              msg.content.parts.some(part => part.type === 'text' && part.text.includes('inappropriate')),
          );

          if (hasInappropriateOutput) {
            abort('Output contains inappropriate content', { retry: false });
          }

          return messages;
        },
      };

      const outputTripwireWorkflow = createWorkflow({
        id: 'output-tripwire-workflow',
        inputSchema: ProcessorStepInputSchema,
        outputSchema: ProcessorStepOutputSchema,
      })
        .then(createStep(outputTripwireProcessor))
        .commit();

      const mockModel = new MockLanguageModelV2({
        doGenerate: async () => ({
          content: [{ type: 'text', text: 'This is inappropriate content' }],
          finishReason: 'stop',
          usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        }),
      });

      const agent = new Agent({
        id: 'output-tripwire-workflow-test-agent',
        name: 'Output Tripwire Workflow Test Agent',
        instructions: 'You are a helpful assistant.',
        model: mockModel,
        outputProcessors: [outputTripwireWorkflow],
      });

      const result = await agent.generate('Hello');

      expect(result.tripwire).toBeDefined();
      expect(result.tripwire?.reason).toBe('Output contains inappropriate content');
    });
  });

  describe('workflow with a processor that does multiple transformations', () => {
    it('should execute a workflow with a processor that applies multiple changes', async () => {
      const transformations: string[] = [];

      // Create a processor that applies multiple transformations
      const multiTransformProcessor: Processor = {
        id: 'multi-transform-processor',
        processInput: async ({ messages }) => {
          transformations.push('prefix');
          transformations.push('suffix');
          return messages.map(msg => ({
            ...msg,
            content: {
              ...msg.content,
              parts: msg.content.parts.map(part =>
                part.type === 'text' ? { ...part, text: `[PREFIX]${part.text}[SUFFIX]` } : part,
              ),
            },
          }));
        },
      };

      const processorWorkflow = createWorkflow({
        id: 'multi-transform-processor-workflow',
        inputSchema: ProcessorStepInputSchema,
        outputSchema: ProcessorStepOutputSchema,
      })
        .then(createStep(multiTransformProcessor))
        .commit();

      const mockModel = new MockLanguageModelV2({
        doGenerate: async ({ prompt }) => {
          const messages = Array.isArray(prompt) ? prompt : [];
          const userMessage = messages.find(m => m.role === 'user');
          const content = userMessage?.content?.[0];
          const text =
            content && typeof content === 'object' && 'type' in content && content.type === 'text'
              ? content.text
              : 'No text found';

          return {
            content: [{ type: 'text', text: `Echo: ${text}` }],
            finishReason: 'stop',
            usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          };
        },
      });

      const agent = new Agent({
        id: 'multi-transform-workflow-test-agent',
        name: 'Multi-Transform Workflow Test Agent',
        instructions: 'You are a helpful assistant.',
        model: mockModel,
        inputProcessors: [processorWorkflow],
      });

      const result = await agent.generate('Hello');

      expect(transformations).toEqual(['prefix', 'suffix']);
      // The response should include both prefix and suffix
      expect(result.text).toContain('[PREFIX]');
      expect(result.text).toContain('[SUFFIX]');
    });
  });

  describe('TripWire in processInputStep', () => {
    it('should emit tripwire chunk when processor aborts in processInputStep', async () => {
      const mockModel = new MockLanguageModelV2({
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'test response' },
            { type: 'text-end', id: '1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 } },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        }),
      });

      const processInputStepProcessor = {
        id: 'input-step-tripwire-processor',
        processInputStep: async ({ abort }: { abort: (reason?: string, options?: any) => never }) => {
          abort('Blocked by processInputStep', {
            metadata: { toxicityScore: 0.9, category: 'harmful' },
          });
          return {};
        },
      } satisfies Processor;

      const agent = new Agent({
        id: 'process-input-step-tripwire-test-agent',
        name: 'ProcessInputStep Tripwire Test Agent',
        instructions: 'You are a helpful assistant.',
        model: mockModel,
        inputProcessors: [processInputStepProcessor],
      });

      const stream = await agent.stream('Hello');
      const chunks: any[] = [];

      for await (const chunk of stream.fullStream) {
        chunks.push(chunk);
      }

      const tripwireChunk = chunks.find(c => c.type === 'tripwire');
      expect(tripwireChunk).toBeDefined();
      expect(tripwireChunk.payload.reason).toBe('Blocked by processInputStep');
      expect(tripwireChunk.payload.metadata).toEqual({ toxicityScore: 0.9, category: 'harmful' });
      expect(tripwireChunk.payload.processorId).toBe('input-step-tripwire-processor');
    });

    it('should emit tripwire chunk with retry option when processor aborts in processInputStep', async () => {
      const mockModel = new MockLanguageModelV2({
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'test response' },
            { type: 'text-end', id: '1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 } },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        }),
      });

      const processInputStepProcessor = {
        id: 'input-step-retry-processor',
        processInputStep: async ({ abort }: { abort: (reason?: string, options?: any) => never }) => {
          abort('Please try again', { retry: true });
          return {};
        },
      } satisfies Processor;

      const agent = new Agent({
        id: 'process-input-step-retry-tripwire-test-agent',
        name: 'ProcessInputStep Retry Tripwire Test Agent',
        instructions: 'You are a helpful assistant.',
        model: mockModel,
        inputProcessors: [processInputStepProcessor],
      });

      const stream = await agent.stream('Hello');
      const chunks: any[] = [];

      for await (const chunk of stream.fullStream) {
        chunks.push(chunk);
      }

      const tripwireChunk = chunks.find(c => c.type === 'tripwire');
      expect(tripwireChunk).toBeDefined();
      expect(tripwireChunk.payload.reason).toBe('Please try again');
      expect(tripwireChunk.payload.retry).toBe(true);
    });
  });

  describe('TripWire in processOutputStep', () => {
    it('should emit tripwire chunk when processor aborts in processOutputStep', async () => {
      const mockModel = new MockLanguageModelV2({
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'test response' },
            { type: 'text-end', id: '1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 } },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        }),
      });

      const processOutputStepProcessor = {
        id: 'output-step-tripwire-processor',
        processOutputStep: async ({ abort }: { abort: (reason?: string, options?: any) => never }) => {
          abort('Blocked by processOutputStep', {
            metadata: { toxicityScore: 0.8, category: 'inappropriate' },
          });
          return [];
        },
      } satisfies Processor;

      const agent = new Agent({
        id: 'process-output-step-tripwire-test-agent',
        name: 'ProcessOutputStep Tripwire Test Agent',
        instructions: 'You are a helpful assistant.',
        model: mockModel,
        outputProcessors: [processOutputStepProcessor],
      });

      const stream = await agent.stream('Hello');
      const chunks: any[] = [];

      for await (const chunk of stream.fullStream) {
        chunks.push(chunk);
      }

      // processOutputStep tripwire is reported via step-finish with tripwire data
      const stepFinishChunk = chunks.find(c => c.type === 'step-finish');
      expect(stepFinishChunk).toBeDefined();
      expect(stepFinishChunk.payload.stepResult.reason).toBe('tripwire');
    });

    it('should emit tripwire chunk with metadata when processor aborts in processOutputStep', async () => {
      const mockModel = new MockLanguageModelV2({
        doGenerate: async () => ({
          content: [{ type: 'text', text: 'harmful content' }],
          finishReason: 'stop',
          usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        }),
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'harmful content' },
            { type: 'text-end', id: '1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 } },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        }),
      });

      const processOutputStepProcessor = {
        id: 'output-step-metadata-processor',
        processOutputStep: async ({
          text,
          abort,
        }: {
          text?: string;
          abort: (reason?: string, options?: any) => never;
        }) => {
          if (text?.includes('harmful')) {
            abort('Content policy violation', {
              metadata: { category: 'harmful_content', confidence: 0.95 },
            });
          }
          return [];
        },
      } satisfies Processor;

      const agent = new Agent({
        id: 'process-output-step-metadata-tripwire-test-agent',
        name: 'ProcessOutputStep Metadata Tripwire Test Agent',
        instructions: 'You are a helpful assistant.',
        model: mockModel,
        outputProcessors: [processOutputStepProcessor],
      });

      const result = await agent.generate('Hello');

      // The tripwire should be set on the result
      expect(result.tripwire).toBeDefined();
      expect(result.tripwire?.reason).toBe('Content policy violation');
      expect(result.tripwire?.metadata).toEqual({ category: 'harmful_content', confidence: 0.95 });
      expect(result.tripwire?.processorId).toBe('output-step-metadata-processor');
    });
  });

  describe('TripWire in prepareStep option', () => {
    it('should emit tripwire chunk when prepareStep calls abort', async () => {
      const mockModel = new MockLanguageModelV2({
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'test response' },
            { type: 'text-end', id: '1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 } },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        }),
      });

      const agent = new Agent({
        id: 'prepare-step-tripwire-test-agent',
        name: 'PrepareStep Tripwire Test Agent',
        instructions: 'You are a helpful assistant.',
        model: mockModel,
      });

      const stream = await agent.stream('Hello', {
        prepareStep: ({ abort }) => {
          abort('Blocked by prepareStep', {
            metadata: { reason: 'content_moderation', score: 0.85 },
          });
        },
      });

      const chunks: any[] = [];
      for await (const chunk of stream.fullStream) {
        chunks.push(chunk);
      }

      const tripwireChunk = chunks.find(c => c.type === 'tripwire');
      expect(tripwireChunk).toBeDefined();
      expect(tripwireChunk.payload.reason).toBe('Blocked by prepareStep');
      expect(tripwireChunk.payload.metadata).toEqual({ reason: 'content_moderation', score: 0.85 });
      expect(tripwireChunk.payload.processorId).toBe('prepare-step');
    });

    it('should emit tripwire chunk with retry option when prepareStep calls abort with retry', async () => {
      const mockModel = new MockLanguageModelV2({
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'test response' },
            { type: 'text-end', id: '1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 } },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        }),
      });

      const agent = new Agent({
        id: 'prepare-step-retry-tripwire-test-agent',
        name: 'PrepareStep Retry Tripwire Test Agent',
        instructions: 'You are a helpful assistant.',
        model: mockModel,
      });

      const stream = await agent.stream('Hello', {
        prepareStep: ({ abort }) => {
          abort('Please rephrase your question', { retry: true });
        },
      });

      const chunks: any[] = [];
      for await (const chunk of stream.fullStream) {
        chunks.push(chunk);
      }

      const tripwireChunk = chunks.find(c => c.type === 'tripwire');
      expect(tripwireChunk).toBeDefined();
      expect(tripwireChunk.payload.reason).toBe('Please rephrase your question');
      expect(tripwireChunk.payload.retry).toBe(true);
    });
  });
});
