import { describe, it, expect, vi } from 'vitest';
import { MessageList } from '../../agent/message-list';
import type { Processor } from '../../processors';
import type { ChunkType } from '../types';
import { MastraModelOutput } from './output';

describe('Output Processor Memory Persistence', () => {
  it('should update response messages after output processors run', async () => {
    // Create a processor that modifies text in complete messages
    class TextModifierProcessor implements Processor {
      readonly name = 'text-modifier';

      // Process complete messages after streaming is done
      async processOutputResult({
        messages,
      }: {
        messages: any[];
        abort: (reason?: string) => never;
        tracingContext?: any;
      }): Promise<any[]> {
        // Modify the assistant message content
        return messages.map(msg => {
          if (msg.role === 'assistant') {
            return {
              ...msg,
              content: {
                ...msg.content,
                parts: msg.content.parts.map((part: any) => {
                  if (part.type === 'text') {
                    return {
                      ...part,
                      text: part.text.toUpperCase(), // Convert to uppercase
                    };
                  }
                  return part;
                }),
              },
            };
          }
          return msg;
        });
      }
    }

    // Create a message list with initial messages
    const messageList = new MessageList();
    messageList.add({ role: 'user', content: 'Hello' }, 'user');

    // Add the assistant message that will be processed
    // This simulates what happens in the real flow
    messageList.add({ role: 'assistant', content: 'hello world' }, 'response');

    // Create a mock stream that simulates LLM response
    const mockStream = new ReadableStream({
      async start(controller) {
        // Emit text chunks
        controller.enqueue({
          type: 'text-delta',
          payload: { text: 'hello world' },
        });

        // Emit finish chunk with metadata
        controller.enqueue({
          type: 'finish',
          payload: {
            output: {
              usage: { inputTokens: 10, outputTokens: 5 },
            },
            stepResult: {
              reason: 'stop',
            },
            metadata: {
              request: {},
              providerMetadata: {},
            },
            messages: {
              all: [],
              nonUser: [],
            },
          },
        });

        controller.close();
      },
    });

    // Create the output stream with output processors
    const outputStream = new MastraModelOutput({
      model: {
        modelId: 'test-model',
        provider: 'test-provider',
        version: 'v2' as const,
      },
      stream: mockStream as any,
      messageList,
      options: {
        runId: 'test-run',
        outputProcessors: [new TextModifierProcessor()],
        onFinish: vi.fn(),
      },
    });

    // Wait for stream to complete
    await outputStream.text;

    // Get the response object which should contain processed messages
    const response = await outputStream.response;

    // Verify that response.messages contains the processed text
    expect(response).toBeDefined();
    expect(response.messages).toBeDefined();

    // The messages should reflect the text transformation (uppercase)
    const assistantMessages = response.messages.filter((m: any) => m.role === 'assistant');
    expect(assistantMessages.length).toBeGreaterThan(0);

    // Check that the text was processed (converted to uppercase)
    const assistantContent = assistantMessages[0].content;
    if (typeof assistantContent === 'string') {
      expect(assistantContent).toBe('HELLO WORLD');
    } else if (Array.isArray(assistantContent)) {
      const textPart = assistantContent.find((p: any) => p.type === 'text');
      expect(textPart?.text).toBe('HELLO WORLD');
    }
  });

  it('should handle processor that removes text content', async () => {
    // Create a processor that removes all text
    class RemoveTextProcessor implements Processor {
      readonly name = 'remove-text';

      async processOutputStream({
        part,
      }: {
        part: ChunkType;
        streamParts: ChunkType[];
        state: Record<string, any>;
        abort: (reason?: string) => never;
      }): Promise<ChunkType | null | undefined> {
        if (part.type === 'text-delta') {
          return null; // Remove text deltas
        }
        return part;
      }
    }

    const messageList = new MessageList();
    messageList.add({ role: 'user', content: 'Test' }, 'user');

    const mockStream = new ReadableStream({
      async start(controller) {
        controller.enqueue({
          type: 'text-delta',
          payload: { text: 'This text should be removed' },
        });

        controller.enqueue({
          type: 'finish',
          payload: {
            output: {
              usage: { inputTokens: 5, outputTokens: 6 },
            },
            stepResult: {
              reason: 'stop',
            },
            metadata: {
              request: {},
              providerMetadata: {},
            },
            messages: {
              all: [],
              nonUser: [],
            },
          },
        });

        controller.close();
      },
    });

    const outputStream = new MastraModelOutput({
      model: {
        modelId: 'test-model',
        provider: 'test-provider',
        version: 'v2' as const,
      },
      stream: mockStream as any,
      messageList,
      options: {
        runId: 'test-run-2',
        outputProcessors: [new RemoveTextProcessor()],
        onFinish: vi.fn(),
      },
    });

    // Wait for stream to complete
    const text = await outputStream.text;
    expect(text).toBe(''); // Text should be empty

    // Get the response
    const response = await outputStream.response;

    // Verify response.messages reflects the removed text
    const assistantMessages = response.messages.filter((m: any) => m.role === 'assistant');

    if (assistantMessages.length > 0) {
      const assistantContent = assistantMessages[0].content;
      if (typeof assistantContent === 'string') {
        expect(assistantContent).toBe('');
      } else if (Array.isArray(assistantContent)) {
        const textParts = assistantContent.filter((p: any) => p.type === 'text');
        expect(textParts.length).toBe(0);
      }
    }
  });

  it('should apply multiple processors in sequence', async () => {
    // First processor: add prefix
    class PrefixProcessor implements Processor {
      readonly name = 'prefix';

      async processOutputResult({
        messages,
      }: {
        messages: any[];
        abort: (reason?: string) => never;
        tracingContext?: any;
      }): Promise<any[]> {
        return messages.map(msg => {
          if (msg.role === 'assistant') {
            return {
              ...msg,
              content: {
                ...msg.content,
                parts: msg.content.parts.map((part: any) => {
                  if (part.type === 'text') {
                    return {
                      ...part,
                      text: '[PREFIX] ' + part.text,
                    };
                  }
                  return part;
                }),
              },
            };
          }
          return msg;
        });
      }
    }

    // Second processor: uppercase
    class UppercaseProcessor implements Processor {
      readonly name = 'uppercase';

      async processOutputResult({
        messages,
      }: {
        messages: any[];
        abort: (reason?: string) => never;
        tracingContext?: any;
      }): Promise<any[]> {
        return messages.map(msg => {
          if (msg.role === 'assistant') {
            return {
              ...msg,
              content: {
                ...msg.content,
                parts: msg.content.parts.map((part: any) => {
                  if (part.type === 'text') {
                    return {
                      ...part,
                      text: part.text.toUpperCase(),
                    };
                  }
                  return part;
                }),
              },
            };
          }
          return msg;
        });
      }
    }

    const messageList = new MessageList();
    messageList.add({ role: 'user', content: 'Test' }, 'user');
    messageList.add({ role: 'assistant', content: 'hello' }, 'response');

    const mockStream = new ReadableStream({
      async start(controller) {
        controller.enqueue({
          type: 'text-delta',
          payload: { text: 'hello' },
        });

        controller.enqueue({
          type: 'finish',
          payload: {
            output: {
              usage: { inputTokens: 1, outputTokens: 1 },
            },
            stepResult: {
              reason: 'stop',
            },
            metadata: {
              request: {},
              providerMetadata: {},
            },
            messages: {
              all: [],
              nonUser: [],
            },
          },
        });

        controller.close();
      },
    });

    const outputStream = new MastraModelOutput({
      model: {
        modelId: 'test-model',
        provider: 'test-provider',
        version: 'v2' as const,
      },
      stream: mockStream as any,
      messageList,
      options: {
        runId: 'test-run-3',
        outputProcessors: [new PrefixProcessor(), new UppercaseProcessor()],
        onFinish: vi.fn(),
      },
    });

    const text = await outputStream.text;
    // First processor adds prefix, second makes uppercase
    expect(text).toBe('[PREFIX] HELLO');

    const response = await outputStream.response;
    const assistantMessages = response.messages.filter((m: any) => m.role === 'assistant');

    if (assistantMessages.length > 0) {
      const assistantContent = assistantMessages[0].content;
      if (typeof assistantContent === 'string') {
        expect(assistantContent).toBe('[PREFIX] HELLO');
      } else if (Array.isArray(assistantContent)) {
        const textPart = assistantContent.find((p: any) => p.type === 'text');
        expect(textPart?.text).toBe('[PREFIX] HELLO');
      }
    }
  });
});
