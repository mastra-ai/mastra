import { MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import type { Processor, ProcessOutputResultArgs } from '../../processors/index';
import { Agent } from '../index';

// Legacy generateLegacy/streamLegacy path with AI SDK v4 (MockLanguageModelV1): this path does
// not go through loop(), and aimock scenarios only drive v5+ providers, so these stay here.
describe('v1 model - output processors', () => {
  describe('generate output processors', () => {
    it('should process final text through output processors', async () => {
      let processedText = '';

      class TestOutputProcessor implements Processor {
        readonly id = 'test-output-processor';
        readonly name = 'Test Output Processor';

        async processOutputResult({ messages }: ProcessOutputResultArgs) {
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

        async processOutputResult({ messages }: ProcessOutputResultArgs) {
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

        async processOutputResult({ messages }: ProcessOutputResultArgs) {
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

        async processOutputResult({ messages, abort }: ProcessOutputResultArgs) {
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

      expect(result.tripwire?.reason).toBe('Content flagged as inappropriate');
      expect(result.text).toBe('');
      expect(result.finishReason).toBe('other');
    });

    it('should skip processors that do not implement processOutputResult', async () => {
      let processedText = '';

      class CompleteProcessor implements Processor {
        readonly id = 'complete-processor';
        readonly name = 'Complete Processor';

        async processOutputResult({ messages }: ProcessOutputResultArgs) {
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

        async processOutputResult({ messages }: ProcessOutputResultArgs) {
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

        async processOutputResult({ messages }: ProcessOutputResultArgs) {
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

        async processOutputResult({ messages }: ProcessOutputResultArgs) {
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
          async processOutputResult({ abort, messages }: ProcessOutputResultArgs) {
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

        expect(result.tripwire?.reason).toBe('Tripwire triggered by abort-output-processor');
        expect(result.text).toBe('');
        expect(result.finishReason).toBe('other');
      });

      it('should handle processor abort with custom message', async () => {
        const customAbortProcessor = {
          id: 'custom-abort-output',
          name: 'Custom Abort Output',
          async processOutputResult({ abort, messages }: ProcessOutputResultArgs) {
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

        expect(result.tripwire?.reason).toBe('Custom output abort reason');
        expect(result.text).toBe('');
      });

      it('should not execute subsequent processors after abort', async () => {
        let secondProcessorExecuted = false;

        const abortProcessor = {
          id: 'abort-first-output',
          name: 'Abort First Output',
          async processOutputResult({ abort, messages }: ProcessOutputResultArgs) {
            abort('Stop here');
            return messages;
          },
        } satisfies Processor;

        const shouldNotRunProcessor = {
          id: 'should-not-run-output',
          name: 'Should Not Run Output',
          async processOutputResult({ messages }: ProcessOutputResultArgs) {
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

        expect(result.tripwire?.reason).toBe('Stop here');
        expect(secondProcessorExecuted).toBe(false);
      });
    });
  });
});
