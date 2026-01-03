import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Processor } from '../processors/index';
import type { MastraDBMessage } from './message-list';
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
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'This contains ' },
            { type: 'text-delta', id: 'text-1', delta: 'SENSITIVE data that ' },
            { type: 'text-delta', id: 'text-1', delta: 'should be SENSITIVE redacted' },
            { type: 'text-end', id: 'text-1' },
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

describe('OutputProcessor Metadata with Streaming (Issue #11454)', () => {
  let mockModel: MockLanguageModelV2;

  beforeEach(() => {
    mockModel = new MockLanguageModelV2({
      doStream: async () => {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'The answer is 42' },
            { type: 'text-end', id: 'text-1' },
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

  /**
   * Test processor that adds custom metadata to the message in processOutputResult.
   * This simulates a user's processor that extracts information from the response
   * and saves it to message metadata for later access.
   */
  class MetadataProcessor implements Processor {
    readonly id = 'metadata-processor';
    readonly name = 'Metadata Processor';
    processedCalled = false;

    async processOutputResult({ messages }: { messages: MastraDBMessage[] }): Promise<MastraDBMessage[]> {
      this.processedCalled = true;

      // Find the last assistant message and add custom metadata
      const updatedMessages = messages.map(message => {
        if (message.role === 'assistant') {
          return {
            ...message,
            content: {
              ...message.content,
              metadata: {
                ...(message.content.metadata || {}),
                customProcessorData: {
                  processedAt: '2024-01-01T00:00:00Z',
                  extractedInfo: 'important data',
                  wordCount: 4,
                },
              },
            },
          } as MastraDBMessage;
        }
        return message;
      });

      return updatedMessages;
    }
  }

  it('should make processOutputResult metadata accessible in stream response - via messageList', async () => {
    const metadataProcessor = new MetadataProcessor();

    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'Test agent',
      model: mockModel as any,
      outputProcessors: [metadataProcessor],
    });

    // Stream the response
    const stream = await agent.stream('What is the meaning of life?');

    // Consume the stream to trigger processOutputResult
    const _fullOutput = await stream.getFullOutput();

    // Verify the processor was called
    expect(metadataProcessor.processedCalled).toBe(true);

    // Access the response messages from the messageList
    const responseMessages = stream.messageList.get.response.db();
    const lastAssistantMessage = [...responseMessages].reverse().find(m => m.role === 'assistant');

    // BUG: The metadata added by processOutputResult should be present
    expect(lastAssistantMessage).toBeDefined();
    expect(lastAssistantMessage?.content.metadata).toBeDefined();
    expect(lastAssistantMessage?.content.metadata?.customProcessorData).toBeDefined();
    expect(lastAssistantMessage?.content.metadata?.customProcessorData).toEqual({
      processedAt: '2024-01-01T00:00:00Z',
      extractedInfo: 'important data',
      wordCount: 4,
    });
  });

  it('should make processOutputResult metadata accessible in stream response - via response.uiMessages', async () => {
    const metadataProcessor = new MetadataProcessor();

    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'Test agent',
      model: mockModel as any,
      outputProcessors: [metadataProcessor],
    });

    // Stream the response
    const stream = await agent.stream('What is the meaning of life?');

    // Consume the stream to trigger processOutputResult
    await stream.getFullOutput();

    // Verify the processor was called
    expect(metadataProcessor.processedCalled).toBe(true);

    // Access the response via the stream.response promise (this is the common user pattern)
    const response = await stream.response;
    const uiMessages = response.uiMessages;

    // Find the assistant message in UI messages
    const assistantUIMessage = uiMessages?.find(m => m.role === 'assistant');

    // BUG: The metadata added by processOutputResult should be accessible in uiMessages
    expect(assistantUIMessage).toBeDefined();
    expect(assistantUIMessage?.metadata).toBeDefined();
    expect(assistantUIMessage?.metadata?.customProcessorData).toBeDefined();
    expect(assistantUIMessage?.metadata?.customProcessorData).toEqual({
      processedAt: '2024-01-01T00:00:00Z',
      extractedInfo: 'important data',
      wordCount: 4,
    });
  });

  it('should make processOutputResult metadata accessible in stream response - via messageList after consuming stream', async () => {
    const metadataProcessor = new MetadataProcessor();

    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'Test agent',
      model: mockModel as any,
      outputProcessors: [metadataProcessor],
    });

    // Stream the response
    const stream = await agent.stream('What is the meaning of life?');

    // Consume the stream via textStream (common user pattern)
    const textChunks: string[] = [];
    for await (const chunk of stream.textStream) {
      textChunks.push(chunk);
    }

    // Verify we got the text
    expect(textChunks.join('')).toBe('The answer is 42');

    // Verify the processor was called
    expect(metadataProcessor.processedCalled).toBe(true);

    // Access the response messages from the messageList after stream completes
    const responseMessages = stream.messageList.get.response.db();
    const lastAssistantMessage = [...responseMessages].reverse().find(m => m.role === 'assistant');

    // The metadata added by processOutputResult should be present
    expect(lastAssistantMessage).toBeDefined();
    expect(lastAssistantMessage?.content.metadata).toBeDefined();
    expect(lastAssistantMessage?.content.metadata?.customProcessorData).toBeDefined();
    expect(lastAssistantMessage?.content.metadata?.customProcessorData).toEqual({
      processedAt: '2024-01-01T00:00:00Z',
      extractedInfo: 'important data',
      wordCount: 4,
    });
  });

  it('should include processOutputResult metadata in the finish chunk of fullStream', async () => {
    const metadataProcessor = new MetadataProcessor();

    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'Test agent',
      model: mockModel as any,
      outputProcessors: [metadataProcessor],
    });

    // Stream the response
    const stream = await agent.stream('What is the meaning of life?');

    // Collect all chunks from fullStream
    const chunks: any[] = [];
    for await (const chunk of stream.fullStream) {
      chunks.push(chunk);
    }

    // Verify the processor was called
    expect(metadataProcessor.processedCalled).toBe(true);

    // Find the finish chunk - this is what gets sent to clients via /stream/ui
    const finishChunk = chunks.find(c => c.type === 'finish');
    expect(finishChunk).toBeDefined();

    // The finish chunk should contain the response with uiMessages including processor metadata
    const response = finishChunk.payload?.response;
    const uiMessages = response?.uiMessages;

    // The uiMessages should exist and contain the metadata added by the processor
    expect(uiMessages).toBeDefined();

    if (uiMessages) {
      const assistantUIMessage = uiMessages.find((m: any) => m.role === 'assistant');
      expect(assistantUIMessage).toBeDefined();
      expect(assistantUIMessage?.metadata?.customProcessorData).toEqual({
        processedAt: '2024-01-01T00:00:00Z',
        extractedInfo: 'important data',
        wordCount: 4,
      });
    }
  });
});
