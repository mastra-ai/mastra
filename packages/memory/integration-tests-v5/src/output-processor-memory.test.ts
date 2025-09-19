import { mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { Agent } from '@mastra/core/agent';
import type { Processor } from '@mastra/core/processors';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { MockLanguageModelV2, convertArrayToReadableStream } from 'ai-v5/test';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Output Processor Memory Persistence Integration', () => {
  let memory: Memory;
  let storage: LibSQLStore;
  let dbPath: string;

  beforeEach(async () => {
    // Create a new unique database file in the temp directory for each test
    dbPath = join(await mkdtemp(join(tmpdir(), 'output-processor-test-')), 'test.db');

    storage = new LibSQLStore({
      url: `file:${dbPath}`,
    });

    // Initialize memory with the database
    memory = new Memory({
      storage,
      options: {
        lastMessages: 10,
        semanticRecall: false,
        threads: {
          generateTitle: false,
        },
      },
    });
  });

  afterEach(async () => {
    //@ts-ignore
    await storage.client?.close();
  });

  // Create a PII redaction processor
  class PIIRedactionProcessor implements Processor {
    readonly name = 'pii-redaction-processor';

    // Process complete messages after generation
    async processOutputResult({
      messages,
    }: {
      messages: any[];
      abort: (reason?: string) => never;
      tracingContext?: any;
    }): Promise<any[]> {
      return messages.map(msg => {
        // Handle both v2 format (content.parts) and v5 format (content as array)
        if (msg.role === 'assistant') {
          if (Array.isArray(msg.content)) {
            // v5 format: content is directly an array
            return {
              ...msg,
              content: msg.content.map((part: any) => {
                if (part.type === 'text') {
                  // Redact email addresses, phone numbers, and SSNs
                  let redactedText = part.text
                    .replace(/[\w.-]+@[\w.-]+\.\w+/g, '[EMAIL_REDACTED]')
                    .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE_REDACTED]')
                    .replace(/\bSSN:\s*\d{3}-\d{2}-\d{4}\b/gi, '[SSN_REDACTED]');

                  return {
                    ...part,
                    text: redactedText,
                  };
                }
                return part;
              }),
            };
          } else if (msg.content?.parts) {
            // v2 format: content has parts array
            return {
              ...msg,
              content: {
                ...msg.content,
                parts: msg.content.parts.map((part: any) => {
                  if (part.type === 'text') {
                    // Redact email addresses, phone numbers, and SSNs
                    let redactedText = part.text
                      .replace(/[\w.-]+@[\w.-]+\.\w+/g, '[EMAIL_REDACTED]')
                      .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE_REDACTED]')
                      .replace(/\bSSN:\s*\d{3}-\d{2}-\d{4}\b/gi, '[SSN_REDACTED]');

                    return {
                      ...part,
                      text: redactedText,
                    };
                  }
                  return part;
                }),
              },
            };
          }
        }
        return msg;
      });
    }
  }

  it('should persist PII-redacted messages to memory using generateVNext', async () => {
    // Create a mock model that returns PII data
    const mockModel = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          {
            type: 'text-delta',
            id: 'text-1',
            delta: 'Contact me at john.doe@example.com or call 555-123-4567. My SSN: 123-45-6789.',
          },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 15, totalTokens: 25 },
          },
        ]),
      }),
    });

    // Create an agent with the PII redaction processor
    const agent = new Agent({
      name: 'test-agent-pii',
      model: mockModel,
      instructions: 'You are a helpful assistant',
      outputProcessors: [new PIIRedactionProcessor()],
      memory,
    });

    const threadId = `thread-pii-${Date.now()}`;
    const resourceId = 'test-resource-pii';

    // Generate a response with memory enabled using generateVNext
    const result = await agent.generateVNext('Share your contact info', {
      memory: {
        thread: threadId,
        resource: resourceId,
      },
    });

    // Verify the returned messages have redacted parts
    const returnedAssistantMsg = result.response?.messages?.find((m: any) => m.role === 'assistant');
    expect(returnedAssistantMsg).toBeDefined();

    // content is an array in v5 response format
    const textPart = returnedAssistantMsg.content.find((part: any) => part.type === 'text');
    expect(textPart).toBeDefined();
    const redactedText = textPart.text;

    expect(redactedText).toBe('Contact me at [EMAIL_REDACTED] or call [PHONE_REDACTED]. My [SSN_REDACTED].');
    expect(redactedText).not.toContain('john.doe@example.com');
    expect(redactedText).not.toContain('555-123-4567');
    expect(redactedText).not.toContain('123-45-6789');

    // Wait for async memory operations
    await new Promise(resolve => setTimeout(resolve, 100));

    // Retrieve messages from storage directly
    const savedMessages = await storage.getMessages({
      threadId,
      format: 'v2',
    });

    // Find the assistant message
    const assistantMessages = savedMessages.filter((m: any) => m.role === 'assistant');
    expect(assistantMessages.length).toBeGreaterThan(0);

    const assistantMessage = assistantMessages[0];
    const textParts = assistantMessage.content.parts.filter((p: any) => p.type === 'text');
    expect(textParts.length).toBeGreaterThan(0);

    const savedText = (textParts[0] as any).text;

    // Verify PII is redacted in the saved message
    expect(savedText).toContain('[EMAIL_REDACTED]');
    expect(savedText).toContain('[PHONE_REDACTED]');
    expect(savedText).toContain('[SSN_REDACTED]');

    // Ensure original PII is NOT in the saved message
    expect(savedText).not.toContain('john.doe@example.com');
    expect(savedText).not.toContain('555-123-4567');
    expect(savedText).not.toContain('123-45-6789');
  });

  it('should persist PII-redacted messages to memory using streamVNext', async () => {
    // Create a mock model that returns PII data
    const mockModel = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          {
            type: 'text-delta',
            id: 'text-1',
            delta: 'Contact me at john.doe@example.com or call 555-123-4567. My SSN: 123-45-6789.',
          },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 15, totalTokens: 25 },
          },
        ]),
      }),
    });

    // Create an agent with the PII redaction processor
    const agent = new Agent({
      name: 'test-agent-pii',
      model: mockModel,
      instructions: 'You are a helpful assistant',
      outputProcessors: [new PIIRedactionProcessor()],
      memory,
    });

    const threadId = `thread-pii-streamvnext-${Date.now()}`;
    const resourceId = 'test-resource-pii';

    // Generate a response with memory enabled using generateVNext
    const result = await agent.streamVNext('Share your contact info', {
      memory: {
        thread: threadId,
        resource: resourceId,
      },
    });

    // Verify the returned messages have redacted parts
    const returnedAssistantMsg = (await result.response)?.messages?.find((m: any) => m.role === 'assistant');
    expect(returnedAssistantMsg).toBeDefined();

    // content is an array in v5 response format
    const textPart = returnedAssistantMsg.content.find((part: any) => part.type === 'text');
    expect(textPart).toBeDefined();
    const redactedText = textPart.text;

    expect(redactedText).toBe('Contact me at [EMAIL_REDACTED] or call [PHONE_REDACTED]. My [SSN_REDACTED].');
    expect(redactedText).not.toContain('john.doe@example.com');
    expect(redactedText).not.toContain('555-123-4567');
    expect(redactedText).not.toContain('123-45-6789');

    // Wait for async memory operations
    await new Promise(resolve => setTimeout(resolve, 100));

    // Retrieve messages from storage directly
    const savedMessages = await storage.getMessages({
      threadId,
      format: 'v2',
    });

    // Find the assistant message
    const assistantMessages = savedMessages.filter((m: any) => m.role === 'assistant');
    expect(assistantMessages.length).toBeGreaterThan(0);

    const assistantMessage = assistantMessages[0];
    const textParts = assistantMessage.content.parts.filter((p: any) => p.type === 'text');
    expect(textParts.length).toBeGreaterThan(0);

    const savedText = (textParts[0] as any).text;

    // Verify PII is redacted in the saved message
    expect(savedText).toContain('[EMAIL_REDACTED]');
    expect(savedText).toContain('[PHONE_REDACTED]');
    expect(savedText).toContain('[SSN_REDACTED]');

    // Ensure original PII is NOT in the saved message
    expect(savedText).not.toContain('john.doe@example.com');
    expect(savedText).not.toContain('555-123-4567');
    expect(savedText).not.toContain('123-45-6789');
  });

  it('should chain multiple output processors and persist the result', async () => {
    // First processor: Add a warning prefix
    class WarningPrefixProcessor implements Processor {
      readonly name = 'warning-prefix';

      async processOutputResult({
        messages,
      }: {
        messages: any[];
        abort: (reason?: string) => never;
        tracingContext?: any;
      }): Promise<any[]> {
        return messages.map(msg => {
          if (msg.role === 'assistant') {
            if (Array.isArray(msg.content)) {
              // v5 format
              return {
                ...msg,
                content: msg.content.map((part: any) => {
                  if (part.type === 'text') {
                    return {
                      ...part,
                      text: '[WARNING] ' + part.text,
                    };
                  }
                  return part;
                }),
              };
            } else if (msg.content?.parts) {
              // v2 format
              return {
                ...msg,
                content: {
                  ...msg.content,
                  parts: msg.content.parts.map((part: any) => {
                    if (part.type === 'text') {
                      return {
                        ...part,
                        text: '[WARNING] ' + part.text,
                      };
                    }
                    return part;
                  }),
                },
              };
            }
          }
          return msg;
        });
      }
    }

    // Second processor: Convert to uppercase
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
            if (Array.isArray(msg.content)) {
              // v5 format
              return {
                ...msg,
                content: msg.content.map((part: any) => {
                  if (part.type === 'text') {
                    return {
                      ...part,
                      text: part.text.toUpperCase(),
                    };
                  }
                  return part;
                }),
              };
            } else if (msg.content?.parts) {
              // v2 format
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
          }
          return msg;
        });
      }
    }

    const mockModel = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          {
            type: 'text-delta',
            id: 'text-1',
            delta: 'This is a test message',
          },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
          },
        ]),
      }),
    });

    const agent = new Agent({
      name: 'test-agent-chain',
      model: mockModel,
      instructions: 'You are a helpful assistant',
      outputProcessors: [new WarningPrefixProcessor(), new UppercaseProcessor()],
      memory,
    });

    const threadId = `thread-chain-${Date.now()}`;
    const resourceId = 'test-resource-chain';

    // Generate a response using generateVNext
    const result = await agent.generateVNext('Say something', {
      memory: {
        thread: threadId,
        resource: resourceId,
      },
    });

    // Verify processors were applied in order: first prefix, then uppercase
    const chainedAssistantMsg = result.response?.messages?.find((m: any) => m.role === 'assistant');
    expect(chainedAssistantMsg).toBeDefined();
    const chainedTextPart = chainedAssistantMsg.content.find((p: any) => p.type === 'text');
    expect(chainedTextPart).toBeDefined();
    expect(chainedTextPart.text).toBe('[WARNING] THIS IS A TEST MESSAGE');

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 100));

    // Retrieve from storage
    const savedMessages = await storage.getMessages({
      threadId,
      format: 'v2',
    });

    const assistantMessage = savedMessages.find((m: any) => m.role === 'assistant');
    expect(assistantMessage).toBeDefined();

    const textParts = assistantMessage?.content.parts.filter((p: any) => p.type === 'text') || [];
    expect((textParts[0] as any).text).toBe('[WARNING] THIS IS A TEST MESSAGE');
  });

  it('should persist processed messages when refreshing conversation', async () => {
    // This tests the original bug scenario - refreshing should show processed messages
    class SensitiveDataRedactor implements Processor {
      readonly name = 'sensitive-data-redactor';

      async processOutputResult({
        messages,
      }: {
        messages: any[];
        abort: (reason?: string) => never;
        tracingContext?: any;
      }): Promise<any[]> {
        return messages.map(msg => {
          if (msg.role === 'assistant') {
            if (Array.isArray(msg.content)) {
              // v5 format
              return {
                ...msg,
                content: msg.content.map((part: any) => {
                  if (part.type === 'text') {
                    // Redact credit card numbers
                    let redactedText = part.text.replace(
                      /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
                      '[CARD_REDACTED]',
                    );

                    return {
                      ...part,
                      text: redactedText,
                    };
                  }
                  return part;
                }),
              };
            } else if (msg.content?.parts) {
              // v2 format
              return {
                ...msg,
                content: {
                  ...msg.content,
                  parts: msg.content.parts.map((part: any) => {
                    if (part.type === 'text') {
                      // Redact credit card numbers
                      let redactedText = part.text.replace(
                        /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
                        '[CARD_REDACTED]',
                      );

                      return {
                        ...part,
                        text: redactedText,
                      };
                    }
                    return part;
                  }),
                },
              };
            }
          }
          return msg;
        });
      }
    }

    const mockModel = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          {
            type: 'text-delta',
            id: 'text-1',
            delta: 'Your card number is 4532-1234-5678-9012',
          },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 5, outputTokens: 8, totalTokens: 13 },
          },
        ]),
      }),
    });

    const agent = new Agent({
      name: 'test-agent-refresh',
      model: mockModel,
      instructions: 'You are a helpful assistant',
      outputProcessors: [new SensitiveDataRedactor()],
      memory,
    });

    const threadId = `thread-refresh-${Date.now()}`;
    const resourceId = 'test-resource-refresh';

    // First interaction - generate response using generateVNext
    const result = await agent.generateVNext('What is my card number?', {
      memory: {
        thread: threadId,
        resource: resourceId,
      },
    });

    // Verify the response has redacted card number in parts
    const refreshAssistantMsg = result.response?.messages?.find((m: any) => m.role === 'assistant');
    expect(refreshAssistantMsg).toBeDefined();
    const refreshTextPart = refreshAssistantMsg.content.find((p: any) => p.type === 'text');
    expect(refreshTextPart).toBeDefined();
    expect(refreshTextPart.text).toBe('Your card number is [CARD_REDACTED]');

    // Wait for memory persistence
    await new Promise(resolve => setTimeout(resolve, 100));

    // Simulate page refresh - retrieve messages from storage
    const messagesAfterRefresh = await storage.getMessages({
      threadId,
      format: 'v2',
    });

    // Find the assistant message
    const assistantMessageAfterRefresh = messagesAfterRefresh.find((m: any) => m.role === 'assistant');
    expect(assistantMessageAfterRefresh).toBeDefined();

    const textParts = assistantMessageAfterRefresh?.content.parts.filter((p: any) => p.type === 'text') || [];
    const savedText = (textParts[0] as any)?.text || '';

    // The saved message should still have the redacted content, not the original
    expect(savedText).toBe('Your card number is [CARD_REDACTED]');
    expect(savedText).not.toContain('4532-1234-5678-9012');

    // This confirms the bug is fixed - refreshing shows the processed (redacted) message
  });
});
