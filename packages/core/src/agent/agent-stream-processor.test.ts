import { convertArrayToReadableStream, MockLanguageModelV2 } from 'ai-v5/test';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Processor } from '../processors/index';
import { Agent } from './index';

describe('Stream vs Non-Stream Output Processor Consistency (Issue #7087)', () => {
  let mockModel: MockLanguageModelV2;
  let processedStreamChunks: string[] = [];
  let finalMessageContent: string = '';

  // Test processor that replaces "SENSITIVE" with "[REDACTED]"
  class RedactionProcessor implements Processor {
    readonly id = 'redaction-processor';
    readonly name = 'Redaction Processor';

    async processOutputStream({ part }: any) {
      // Handle both internal format (payload.text) and AISDK format (text)
      if (part.type === 'text-delta') {
        let text: string | undefined;

        // Handle internal format
        if (part.payload && 'text' in part.payload) {
          text = part.payload.text;
        }
        // Handle AISDK format
        else if ('text' in part) {
          text = part.text;
        }

        if (text) {
          const processedText = text.replace(/SENSITIVE/g, '[REDACTED]');
          processedStreamChunks.push(processedText);

          // Return in the same format we received
          if (part.payload && 'text' in part.payload) {
            return {
              ...part,
              payload: { ...part.payload, text: processedText },
            };
          } else {
            return { ...part, text: processedText };
          }
        }
      }
      return part;
    }

    async processOutputResult({ messages }: { messages: any[] }) {
      // Capture what the final message looks like when it reaches processOutputResult
      if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage.role === 'assistant' && lastMessage.content) {
          if (typeof lastMessage.content === 'string') {
            finalMessageContent = lastMessage.content;
          } else if (lastMessage.content.parts) {
            finalMessageContent = lastMessage.content.parts
              .filter((p: any) => p.type === 'text')
              .map((p: any) => p.text)
              .join('');
          }
        }
      }
      return messages;
    }
  }

  beforeEach(() => {
    processedStreamChunks = [];
    finalMessageContent = '';

    mockModel = new MockLanguageModelV2({
      doStream: async () => {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'This contains ' },
            { type: 'text-delta', id: '1', delta: 'SENSITIVE data that ' },
            { type: 'text-delta', id: '1', delta: 'should be SENSITIVE redacted' },
            { type: 'text-end', id: '1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
          rawCall: { rawPrompt: [], rawSettings: {} },
          warnings: [],
        };
      },
    });
  });

  it('should apply processOutputStream transformations to both stream and final messages', async () => {
    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'Test agent',
      model: mockModel as any,
      outputProcessors: [new RedactionProcessor()],
    });

    // Stream the response
    const stream = await agent.stream('test message', {
      format: 'aisdk',
    });

    // Collect stream chunks
    const streamedText: string[] = [];
    for await (const chunk of stream.textStream) {
      streamedText.push(chunk);
    }

    // What the user sees in the stream (CORRECTLY REDACTED)
    const streamedContent = streamedText.join('');
    expect(streamedContent).toBe('This contains [REDACTED] data that should be [REDACTED] redacted');

    // Verify our processor actually processed the stream chunks
    expect(processedStreamChunks.join('')).toBe('This contains [REDACTED] data that should be [REDACTED] redacted');

    // The final message that gets passed to processOutputResult should now be PROCESSED
    // This confirms the fix is working - stream processors now affect the final messages
    expect(finalMessageContent).toBe('This contains [REDACTED] data that should be [REDACTED] redacted');
  });

  it('should maintain consistency between stream and stored messages after fix', async () => {
    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'Test agent',
      model: mockModel as any,
      outputProcessors: [new RedactionProcessor()],
    });

    // Stream the response with memory enabled
    const stream = await agent.stream('test message', {
      format: 'aisdk',
      memory: {
        thread: 'test-thread-123',
        resource: 'test-resource-123',
      },
    });

    // Collect stream chunks
    const streamedText: string[] = [];
    for await (const chunk of stream.textStream) {
      streamedText.push(chunk);
    }

    const streamedContent = streamedText.join('');

    // After the fix, both should be consistently redacted
    expect(streamedContent).toBe('This contains [REDACTED] data that should be [REDACTED] redacted');
    expect(finalMessageContent).toBe('This contains [REDACTED] data that should be [REDACTED] redacted');
  });
});
