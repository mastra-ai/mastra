import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import type { LanguageModelV1 } from '@internal/ai-sdk-v4';
import { simulateReadableStream, MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { MastraDBMessage } from '../../memory';
import type { ProcessInputStepArgs } from '../../processors';
import { RequestContext } from '../../request-context';
import { createTool } from '../../tools';
import { Agent } from '../agent';

function inputProcessorTests(version: 'v1' | 'v2') {
  describe(`${version} - Input Processors`, () => {
    let mockModel: MockLanguageModelV1 | MockLanguageModelV2;

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

    beforeEach(() => {
      if (version === 'v1') {
        mockModel = new MockLanguageModelV1({
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
                    .map(part => part.text)
                    .join(' ');
                }
                return '';
              })
              .filter(Boolean)
              .join(' ');

            return {
              text: `processed: ${textContent}`,
              finishReason: 'stop',
              usage: { promptTokens: 10, completionTokens: 20 },
              rawCall: { rawPrompt: prompt, rawSettings: {} },
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
                    .map(part => part.text)
                    .join(' ');
                }
                return '';
              })
              .filter(Boolean)
              .join(' ');

            return {
              stream: simulateReadableStream({
                chunks: [
                  { type: 'text-delta', textDelta: 'processed: ' },
                  { type: 'text-delta', textDelta: textContent },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    usage: { promptTokens: 10, completionTokens: 20 },
                  },
                ],
              }),
              rawCall: { rawPrompt: prompt, rawSettings: {} },
            };
          },
        });
      } else {
        mockModel = new MockLanguageModelV2({
          doGenerate: async ({ prompt }: LanguageModelV2CallOptions) => {
            const messages = Array.isArray(prompt) ? prompt : [];
            const textContent = messages
              .map(msg => {
                if (typeof msg.content === 'string') {
                  return msg.content;
                } else if (Array.isArray(msg.content)) {
                  return msg.content
                    .filter(part => part.type === 'text')
                    .map(part => (part as LanguageModelV2TextPart).text)
                    .join(' ');
                }
                return '';
              })
              .filter(Boolean)
              .join(' ');

            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              content: [{ type: 'text', text: `processed: ${textContent}` }],
              warnings: [],
            };
          },
          doStream: async ({ prompt }) => {
            const messages = Array.isArray(prompt) ? prompt : [];
            const textContent = messages
              .map(msg => {
                if (typeof msg.content === 'string') {
                  return msg.content;
                } else if (Array.isArray(msg.content)) {
                  return msg.content
                    .filter(part => part.type === 'text')
                    .map(part => (part as LanguageModelV2TextPart).text)
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
                { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
              ]),
              rawCall: { rawPrompt: prompt, rawSettings: {} },
              warnings: [],
            };
          },
        });
      }
    });

    describe('basic functionality', () => {
      it('should run input processors before generation', async () => {
        const processor = {
          id: 'test-processor',
          name: 'Test Processor',
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

        let result;
        if (version === 'v1') {
          result = await agentWithProcessor.generateLegacy('Hello world');
        } else {
          result = await agentWithProcessor.generate('Hello world');
        }

        // The processor should have added a message
        expect(result.text).toContain('processed:');
        expect(result.text).toContain('Processor was here!');
      });

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

        let result;
        if (version === 'v1') {
          result = await agentWithProcessors.generateLegacy('Hello');
        } else {
          result = await agentWithProcessors.generate('Hello');
        }

        expect(result.text).toContain('First processor');
        expect(result.text).toContain('Second processor');
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
          id: 'test-agent',
          name: 'Test Agent',
          instructions: 'You are a helpful assistant',
          model: mockModel,
          inputProcessors: [processor1, processor2],
        });

        let result;
        if (version === 'v1') {
          result = await agentWithAsyncProcessors.generateLegacy('Test async');
        } else {
          result = await agentWithAsyncProcessors.generate('Test async');
        }

        // Processors run sequentially, so "First processor" should appear before "Second processor"
        expect(result.text).toContain('First processor');
        expect(result.text).toContain('Second processor');
      });
    });

    describe('tripwire functionality', () => {
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
          id: 'test-agent',
          name: 'Test Agent',
          instructions: 'You are a helpful assistant',
          model: mockModel,
          inputProcessors: [abortProcessor],
        });

        let result;
        if (version === 'v1') {
          result = await agentWithAbortProcessor.generateLegacy('This should be aborted');
        } else {
          result = await agentWithAbortProcessor.generate('This should be aborted');
        }

        expect(result.tripwire).toBeDefined();
        expect(result.tripwire?.reason).toBe('Tripwire triggered by abort-processor');
        expect(await result.text).toBe('');
        expect(await result.finishReason).toBe('other');
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
          id: 'test-agent',
          name: 'Test Agent',
          instructions: 'You are a helpful assistant',
          model: mockModel,
          inputProcessors: [customAbortProcessor],
        });

        let result;
        if (version === 'v1') {
          result = await agentWithCustomAbort.generateLegacy('Custom abort test');
        } else {
          result = await agentWithCustomAbort.generate('Custom abort test');
        }

        expect(result.tripwire).toBeDefined();
        expect(result.tripwire?.reason).toBe('Custom abort reason');
        expect(await result.text).toBe('');
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
          id: 'test-agent',
          name: 'Test Agent',
          instructions: 'You are a helpful assistant',
          model: mockModel,
          inputProcessors: [abortProcessor, shouldNotRunProcessor],
        });

        let result;
        if (version === 'v1') {
          result = await agentWithAbortSequence.generateLegacy('Abort sequence test');
        } else {
          result = await agentWithAbortSequence.generate('Abort sequence test');
        }

        expect(result.tripwire).toBeDefined();
        expect(secondProcessorExecuted).toBe(false);
      });
    });

    describe('streaming with input processors', () => {
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
          id: 'test-agent',
          name: 'Test Agent',
          instructions: 'You are a helpful assistant',
          model: mockModel,
          inputProcessors: [streamProcessor],
        });

        let stream;
        if (version === 'v1') {
          stream = await agentWithStreamProcessor.streamLegacy('Stream test');
        } else {
          stream = await agentWithStreamProcessor.stream('Stream test');
        }

        let fullText = '';
        for await (const textPart of stream.textStream) {
          fullText += textPart;
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
          id: 'test-agent',
          name: 'Test Agent',
          instructions: 'You are a helpful assistant',
          model: mockModel,
          inputProcessors: [streamAbortProcessor],
        });

        let stream;
        if (version === 'v1') {
          stream = await agentWithStreamAbort.streamLegacy('Stream abort test');
          expect(stream.tripwire).toBeDefined();
          expect(stream.tripwire?.reason).toBe('Stream aborted');
        } else {
          stream = await agentWithStreamAbort.stream('Stream abort test');

          for await (const chunk of stream.fullStream) {
            expect(chunk.type).toBe('tripwire');
            expect(chunk.payload?.reason).toBe('Stream aborted');
          }
          const fullOutput = await (stream as MastraModelOutput<any>).getFullOutput();
          expect(fullOutput.tripwire).toBeDefined();
          expect(fullOutput.tripwire?.reason).toBe('Stream aborted');
        }

        // Stream should be empty
        let textReceived = '';
        for await (const textPart of stream.textStream) {
          textReceived += textPart;
        }
        expect(textReceived).toBe('');
      });

      it('should include deployer methods when tripwire is triggered in streaming', async () => {
        const deployerAbortProcessor = {
          id: 'deployer-abort',
          name: 'Deployer Abort',
          processInput: async ({ abort, messages }) => {
            abort('Deployer test abort');
            return messages;
          },
        };

        const agentWithDeployerAbort = new Agent({
          id: 'test-agent',
          name: 'Test Agent',
          instructions: 'You are a helpful assistant',
          model: mockModel,
          inputProcessors: [deployerAbortProcessor],
        });

        let stream;
        if (version === 'v1') {
          stream = await agentWithDeployerAbort.streamLegacy('Deployer abort test');
        } else {
          stream = await agentWithDeployerAbort.stream('Deployer abort test');
        }

        if (version === 'v1') {
          expect(stream.tripwire).toBeDefined();
          expect(stream.tripwire?.reason).toBe('Deployer test abort');
          // Verify deployer methods exist and return Response objects
          expect(typeof stream.toDataStreamResponse).toBe('function');
          expect(typeof stream.toTextStreamResponse).toBe('function');

          const dataStreamResponse = stream.toDataStreamResponse();
          const textStreamResponse = stream.toTextStreamResponse();

          expect(dataStreamResponse).toBeInstanceOf(Response);
          expect(textStreamResponse).toBeInstanceOf(Response);
          expect(dataStreamResponse.status).toBe(200);
          expect(textStreamResponse.status).toBe(200);

          // Verify other required methods are present
          expect(typeof stream.pipeDataStreamToResponse).toBe('function');
          expect(typeof stream.pipeTextStreamToResponse).toBe('function');
          expect(stream.experimental_partialOutputStream).toBeDefined();
          expect(typeof stream.experimental_partialOutputStream[Symbol.asyncIterator]).toBe('function');
        } else if (version === 'v2') {
          const fullOutput = await (stream as MastraModelOutput<any>).getFullOutput();
          expect(fullOutput.tripwire).toBeDefined();
          expect(fullOutput.tripwire?.reason).toBe('Deployer test abort');
        }
      });
    });

    describe('dynamic input processors', () => {
      it('should support function-based input processors', async () => {
        const requestContext = new RequestContext<{ processorMessage: string }>();
        requestContext.set('processorMessage', 'Dynamic message');

        const agentWithDynamicProcessors = new Agent({
          id: 'test-agent',
          name: 'Test Agent',
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

        let result;
        if (version === 'v1') {
          result = await agentWithDynamicProcessors.generateLegacy('Test dynamic', {
            requestContext,
          });
        } else {
          result = await agentWithDynamicProcessors.generate('Test dynamic', {
            requestContext,
          });
        }

        expect(result.text).toContain('Dynamic message');
      });

      it('should handle empty processors array', async () => {
        const agentWithEmptyProcessors = new Agent({
          id: 'test-agent',
          name: 'Test Agent',
          instructions: 'You are a helpful assistant',
          model: mockModel,
          inputProcessors: [],
        });

        let result;
        if (version === 'v1') {
          result = await agentWithEmptyProcessors.generateLegacy('No processors test');
        } else {
          result = await agentWithEmptyProcessors.generate('No processors test');
        }

        expect(result.text).toContain('processed:');
        expect(result.text).toContain('No processors test');
      });
    });

    describe('message manipulation', () => {
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
          id: 'test-agent',
          name: 'Test Agent',
          instructions: 'You are a helpful assistant',
          model: mockModel,
          inputProcessors: [messageModifierProcessor],
        });

        let result;
        if (version === 'v1') {
          result = await agentWithModifier.generateLegacy('Original user message');
        } else {
          result = await agentWithModifier.generate('Original user message');
        }

        expect(result.text).toContain('MODIFIED: Original message was received');
        expect(result.text).toContain('Original user message');
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
          id: 'test-agent',
          name: 'Test Agent',
          instructions: 'You are a helpful assistant',
          model: mockModel,
          inputProcessors: [validationProcessor],
        });

        // Test valid content
        let validResult;
        if (version === 'v1') {
          validResult = await agentWithValidator.generateLegacy('This is appropriate content');
        } else {
          validResult = await agentWithValidator.generate('This is appropriate content');
        }
        expect(validResult.text).toContain('Content validated');

        // Test invalid content
        let invalidResult;
        if (version === 'v1') {
          invalidResult = await agentWithValidator.generateLegacy('This contains inappropriate content');
        } else {
          invalidResult = await agentWithValidator.generate('This contains inappropriate content');
        }
        expect(invalidResult.tripwire).toBeDefined();
        expect(invalidResult.tripwire?.reason).toBe('Content validation failed');
      });
    });
  });

}

inputProcessorTests('v1');
inputProcessorTests('v2');
