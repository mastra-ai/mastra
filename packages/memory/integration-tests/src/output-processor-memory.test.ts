import { mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import type { Processor } from '@mastra/core/processors';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

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

  it.skip('should persist PII-redacted messages to memory', async () => {
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
          if (msg.role === 'assistant' && msg.content?.parts) {
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
          return msg;
        });
      }
    }

    // Create an agent with the PII redaction processor
    const agent = new Agent({
      name: 'test-agent-pii',
      model: openai('gpt-3.5-turbo'),
      instructions: 'You are a helpful assistant',
      outputProcessors: [new PIIRedactionProcessor()],
      memory,
    });

    const threadId = `thread-pii-${Date.now()}`;
    const resourceId = 'test-resource-pii';

    // Mock the LLM to return PII data
    vi.spyOn(agent as any, '__getLLM').mockReturnValue({
      generate: vi.fn().mockResolvedValue({
        text: 'Contact me at john.doe@example.com or call 555-123-4567. My SSN: 123-45-6789.',
        response: {
          messages: [
            {
              role: 'assistant',
              content: 'Contact me at john.doe@example.com or call 555-123-4567. My SSN: 123-45-6789.',
            },
          ],
        },
        usage: { promptTokens: 10, completionTokens: 15, totalTokens: 25 },
        finishReason: 'stop',
      }),
    });

    // Generate a response with memory enabled
    const result = await agent.generate('Share your contact info', {
      memory: {
        thread: threadId,
        resource: resourceId,
      },
    });

    // Verify the returned text is redacted
    expect(result.text).toBe('Contact me at [EMAIL_REDACTED] or call [PHONE_REDACTED]. My [SSN_REDACTED].');
    expect(result.text).not.toContain('john.doe@example.com');
    expect(result.text).not.toContain('555-123-4567');
    expect(result.text).not.toContain('123-45-6789');

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

  it.skip('should chain multiple output processors and persist the result', async () => {
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
          if (msg.role === 'assistant' && msg.content?.parts) {
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
          if (msg.role === 'assistant' && msg.content?.parts) {
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

    const agent = new Agent({
      name: 'test-agent-chain',
      model: openai('gpt-3.5-turbo'),
      instructions: 'You are a helpful assistant',
      outputProcessors: [new WarningPrefixProcessor(), new UppercaseProcessor()],
      memory,
    });

    const threadId = `thread-chain-${Date.now()}`;
    const resourceId = 'test-resource-chain';

    // Mock the LLM response
    vi.spyOn(agent as any, '__getLLM').mockReturnValue({
      generate: vi.fn().mockResolvedValue({
        text: 'This is a test message',
        response: {
          messages: [
            {
              role: 'assistant',
              content: 'This is a test message',
            },
          ],
        },
        usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
        finishReason: 'stop',
      }),
    });

    // Generate a response
    const result = await agent.generate('Say something', {
      memory: {
        thread: threadId,
        resource: resourceId,
      },
    });

    // Verify processors were applied in order: first prefix, then uppercase
    expect(result.text).toBe('[WARNING] THIS IS A TEST MESSAGE');

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

  it.skip('should handle processor that removes all text content', async () => {
    // Processor that removes all text (extreme redaction case)
    class RemoveAllTextProcessor implements Processor {
      readonly name = 'remove-all-text';

      async processOutputResult({
        messages,
      }: {
        messages: any[];
        abort: (reason?: string) => never;
        tracingContext?: any;
      }): Promise<any[]> {
        return messages.map(msg => {
          if (msg.role === 'assistant' && msg.content?.parts) {
            return {
              ...msg,
              content: {
                ...msg.content,
                // Remove all text parts
                parts: msg.content.parts.filter((part: any) => part.type !== 'text'),
              },
            };
          }
          return msg;
        });
      }
    }

    const agent = new Agent({
      name: 'test-agent-remove',
      model: openai('gpt-3.5-turbo'),
      instructions: 'You are a helpful assistant',
      outputProcessors: [new RemoveAllTextProcessor()],
      memory,
    });

    const threadId = `thread-remove-${Date.now()}`;
    const resourceId = 'test-resource-remove';

    // Mock the LLM response
    vi.spyOn(agent as any, '__getLLM').mockReturnValue({
      generate: vi.fn().mockResolvedValue({
        text: 'This text should be completely removed',
        response: {
          messages: [
            {
              role: 'assistant',
              content: 'This text should be completely removed',
            },
          ],
        },
        usage: { promptTokens: 5, completionTokens: 7, totalTokens: 12 },
        finishReason: 'stop',
      }),
    });

    // Generate a response
    const result = await agent.generate('Say something', {
      memory: {
        thread: threadId,
        resource: resourceId,
      },
    });

    // Verify text was removed
    expect(result.text).toBe('');

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 100));

    // Retrieve from storage
    const savedMessages = await storage.getMessages({
      threadId,
      format: 'v2',
    });

    const assistantMessage = savedMessages.find((m: any) => m.role === 'assistant');
    expect(assistantMessage).toBeDefined();

    // Should have no text parts
    const textParts = assistantMessage?.content.parts.filter((p: any) => p.type === 'text') || [];
    expect(textParts.length).toBe(0);
  });

  it.skip('should persist processed messages when refreshing conversation', async () => {
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
          if (msg.role === 'assistant' && msg.content?.parts) {
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
          return msg;
        });
      }
    }

    const agent = new Agent({
      name: 'test-agent-refresh',
      model: openai('gpt-3.5-turbo'),
      instructions: 'You are a helpful assistant',
      outputProcessors: [new SensitiveDataRedactor()],
      memory,
    });

    const threadId = `thread-refresh-${Date.now()}`;
    const resourceId = 'test-resource-refresh';

    // Mock the LLM response with credit card info
    vi.spyOn(agent as any, '__getLLM').mockReturnValue({
      generate: vi.fn().mockResolvedValue({
        text: 'Your card number is 4532-1234-5678-9012',
        response: {
          messages: [
            {
              role: 'assistant',
              content: 'Your card number is 4532-1234-5678-9012',
            },
          ],
        },
        usage: { promptTokens: 5, completionTokens: 8, totalTokens: 13 },
        finishReason: 'stop',
      }),
    });

    // First interaction - generate response
    const result = await agent.generate('What is my card number?', {
      memory: {
        thread: threadId,
        resource: resourceId,
      },
    });

    expect(result.text).toBe('Your card number is [CARD_REDACTED]');

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
