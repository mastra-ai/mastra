import { randomUUID } from 'node:crypto';
import { APICallError } from '@internal/ai-sdk-v5';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { MockMemory } from '../../memory/mock';
import { Agent } from '../agent';

/**
 * Integration test for PrefillErrorHandler recovery.
 *
 * Simulates the Anthropic "assistant message prefill" error:
 * - Pre-populates a conversation thread that ends with an assistant message
 * - The mock model throws the prefill error on the first call
 * - The PrefillErrorHandler (auto-injected) appends a system reminder continue message and signals retry
 * - On retry, the model succeeds
 *
 * Related: https://github.com/mastra-ai/mastra/issues/13969
 */

function createPrefillErrorModel(responseText: string) {
  let callCount = 0;
  const receivedPrompts: any[] = [];

  const model = new MockLanguageModelV2({
    doGenerate: async ({ prompt }) => {
      callCount++;
      receivedPrompts.push(prompt);

      if (callCount === 1) {
        throw new APICallError({
          message:
            'This model does not support assistant message prefill. The conversation must end with a user message.',
          url: 'https://api.anthropic.com/v1/messages',
          requestBodyValues: {},
          statusCode: 400,
          responseBody: JSON.stringify({
            type: 'error',
            error: {
              type: 'invalid_request_error',
              message:
                'This model does not support assistant message prefill. The conversation must end with a user message.',
            },
          }),
          isRetryable: false,
        });
      }

      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        content: [{ type: 'text' as const, text: responseText }],
        warnings: [],
      };
    },
    doStream: async ({ prompt }) => {
      callCount++;
      receivedPrompts.push(prompt);

      if (callCount === 1) {
        throw new APICallError({
          message:
            'This model does not support assistant message prefill. The conversation must end with a user message.',
          url: 'https://api.anthropic.com/v1/messages',
          requestBodyValues: {},
          statusCode: 400,
          responseBody: JSON.stringify({
            type: 'error',
            error: {
              type: 'invalid_request_error',
              message:
                'This model does not support assistant message prefill. The conversation must end with a user message.',
            },
          }),
          isRetryable: false,
        });
      }

      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId: 'mock-anthropic', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: responseText },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
        ]),
      };
    },
  });

  return { model, getCallCount: () => callCount, getReceivedPrompts: () => receivedPrompts };
}

const ANTHROPIC_PREFILL_RETRY_REMINDER = '<system-reminder>continue</system-reminder>';

describe('PrefillErrorHandler Recovery', () => {
  describe('generate()', () => {
    it('should recover from prefill error by appending a system reminder continue message and retrying', async () => {
      const mockMemory = new MockMemory();
      const threadId = randomUUID();
      const resourceId = randomUUID();
      const now = new Date();

      // Create a thread and pre-populate it with a conversation ending in an assistant message
      await mockMemory.createThread({ threadId, resourceId });
      await mockMemory.saveMessages({
        messages: [
          {
            id: randomUUID(),
            role: 'user' as const,
            content: {
              format: 2 as const,
              parts: [{ type: 'text' as const, text: 'Hello, what is 2+2?' }],
            },
            threadId,
            resourceId,
            createdAt: new Date(now.getTime() - 2000),
            type: 'text' as const,
          },
          {
            id: randomUUID(),
            role: 'assistant' as const,
            content: {
              format: 2 as const,
              parts: [{ type: 'text' as const, text: 'The answer is 4.' }],
            },
            threadId,
            resourceId,
            createdAt: new Date(now.getTime() - 1000),
            type: 'text' as const,
          },
        ],
      });

      const { model, getCallCount, getReceivedPrompts } = createPrefillErrorModel('Recovery successful!');

      const agent = new Agent({
        id: 'prefill-test-generate',
        name: 'Prefill Test Agent',
        instructions: 'You are a test agent',
        model: [{ model, maxRetries: 0 }],
        memory: mockMemory,
        maxProcessorRetries: 1,
      });

      // The conversation in memory ends with an assistant message.
      // On the first call, the model will throw the prefill error.
      // PrefillErrorHandler should catch it, append the system reminder, and retry.
      const result = await agent.generate('Continue the conversation', {
        memory: {
          thread: threadId,
          resource: resourceId,
        },
      });

      expect(result.text).toBe('Recovery successful!');
      expect(getCallCount()).toBe(2); // First call failed, second succeeded

      // Verify the retry prompt contains the synthetic prefill-retry system reminder
      const retryPrompt = getReceivedPrompts()[1];
      expect(retryPrompt).toBeDefined();

      const hasRetryReminderMessage = retryPrompt.some(
        (msg: any) =>
          msg.role === 'user' &&
          Array.isArray(msg.content) &&
          msg.content.some((part: any) => part.type === 'text' && part.text === ANTHROPIC_PREFILL_RETRY_REMINDER),
      );
      expect(hasRetryReminderMessage).toBe(true);

      const visibleMessages = await mockMemory.recall({ threadId, resourceId });
      expect(
        visibleMessages.messages.some(
          message =>
            message.role === 'user' &&
            message.content.parts.some(part => part.type === 'text' && part.text === ANTHROPIC_PREFILL_RETRY_REMINDER),
        ),
      ).toBe(false);

      const rawMessages = await mockMemory.recall({ threadId, resourceId, includeSystemReminders: true });
      const retryReminderMessage = rawMessages.messages.find(
        message =>
          message.role === 'user' &&
          message.content.parts.some(part => part.type === 'text' && part.text === ANTHROPIC_PREFILL_RETRY_REMINDER),
      );
      expect(retryReminderMessage).toBeDefined();
      expect(retryReminderMessage?.content.metadata).toEqual({
        systemReminder: {
          type: 'anthropic-prefill-processor-retry',
        },
      });
    });

    it('should NOT retry for non-prefill API errors', async () => {
      const mockMemory = new MockMemory();
      const threadId = randomUUID();
      const resourceId = randomUUID();

      await mockMemory.createThread({ threadId, resourceId });

      // A model that always throws a non-prefill, non-retryable error
      const model = new MockLanguageModelV2({
        doGenerate: async () => {
          throw new APICallError({
            message: 'Invalid request body',
            url: 'https://api.anthropic.com/v1/messages',
            requestBodyValues: {},
            statusCode: 400,
            isRetryable: false,
          });
        },
        doStream: async () => {
          throw new APICallError({
            message: 'Invalid request body',
            url: 'https://api.anthropic.com/v1/messages',
            requestBodyValues: {},
            statusCode: 400,
            isRetryable: false,
          });
        },
      });

      const agent = new Agent({
        id: 'prefill-test-no-recovery',
        name: 'Prefill Test No Recovery',
        instructions: 'You are a test agent',
        model: [{ model, maxRetries: 0 }],
        memory: mockMemory,
      });

      // Non-prefill error should NOT be caught by PrefillErrorHandler
      await expect(
        agent.generate('Hello', {
          memory: {
            thread: threadId,
            resource: resourceId,
          },
        }),
      ).rejects.toThrow('Invalid request body');
    });
  });

  describe('stream()', () => {
    it('should recover from prefill error by appending a system reminder continue message and retrying', async () => {
      const mockMemory = new MockMemory();
      const threadId = randomUUID();
      const resourceId = randomUUID();
      const now = new Date();

      await mockMemory.createThread({ threadId, resourceId });
      await mockMemory.saveMessages({
        messages: [
          {
            id: randomUUID(),
            role: 'user' as const,
            content: {
              format: 2 as const,
              parts: [{ type: 'text' as const, text: 'Tell me a joke' }],
            },
            threadId,
            resourceId,
            createdAt: new Date(now.getTime() - 2000),
            type: 'text' as const,
          },
          {
            id: randomUUID(),
            role: 'assistant' as const,
            content: {
              format: 2 as const,
              parts: [{ type: 'text' as const, text: 'Why did the chicken cross the road?' }],
            },
            threadId,
            resourceId,
            createdAt: new Date(now.getTime() - 1000),
            type: 'text' as const,
          },
        ],
      });

      const { model, getCallCount, getReceivedPrompts } = createPrefillErrorModel('Stream recovery!');

      const agent = new Agent({
        id: 'prefill-test-stream',
        name: 'Prefill Test Stream Agent',
        instructions: 'You are a test agent',
        model: [{ model, maxRetries: 0 }],
        memory: mockMemory,
        maxProcessorRetries: 1,
      });

      const result = await agent.stream('Continue', {
        memory: {
          thread: threadId,
          resource: resourceId,
        },
      });

      const fullText = await result.text;

      expect(fullText).toBe('Stream recovery!');
      expect(getCallCount()).toBe(2);

      // Verify the synthetic prefill-retry system reminder was in the retry prompt
      const retryPrompt = getReceivedPrompts()[1];
      const hasRetryReminderMessage = retryPrompt.some(
        (msg: any) =>
          msg.role === 'user' &&
          Array.isArray(msg.content) &&
          msg.content.some((part: any) => part.type === 'text' && part.text === ANTHROPIC_PREFILL_RETRY_REMINDER),
      );
      expect(hasRetryReminderMessage).toBe(true);
    });

    it('should only retry once even if the error persists', async () => {
      const mockMemory = new MockMemory();
      const threadId = randomUUID();
      const resourceId = randomUUID();
      const now = new Date();

      await mockMemory.createThread({ threadId, resourceId });
      await mockMemory.saveMessages({
        messages: [
          {
            id: randomUUID(),
            role: 'user' as const,
            content: {
              format: 2 as const,
              parts: [{ type: 'text' as const, text: 'Hello' }],
            },
            threadId,
            resourceId,
            createdAt: new Date(now.getTime() - 2000),
            type: 'text' as const,
          },
          {
            id: randomUUID(),
            role: 'assistant' as const,
            content: {
              format: 2 as const,
              parts: [{ type: 'text' as const, text: 'Hi there' }],
            },
            threadId,
            resourceId,
            createdAt: new Date(now.getTime() - 1000),
            type: 'text' as const,
          },
        ],
      });

      // Model that always throws prefill error (never recovers)
      let callCount = 0;
      const model = new MockLanguageModelV2({
        doGenerate: async () => {
          callCount++;
          throw new APICallError({
            message: 'This model does not support assistant message prefill.',
            url: 'https://api.anthropic.com/v1/messages',
            requestBodyValues: {},
            statusCode: 400,
            isRetryable: false,
          });
        },
        doStream: async () => {
          callCount++;
          throw new APICallError({
            message: 'This model does not support assistant message prefill.',
            url: 'https://api.anthropic.com/v1/messages',
            requestBodyValues: {},
            statusCode: 400,
            isRetryable: false,
          });
        },
      });

      const agent = new Agent({
        id: 'prefill-test-max-retry',
        name: 'Prefill Test Max Retry',
        instructions: 'You are a test agent',
        model: [{ model, maxRetries: 0 }],
        memory: mockMemory,
        maxProcessorRetries: 1,
      });

      const result = await agent.stream('Continue', {
        memory: {
          thread: threadId,
          resource: resourceId,
        },
      });

      // Should have attempted twice: first call fails, retry fails, then gives up
      // PrefillErrorHandler returns void on retryCount > 0, so it only retries once
      // The stream should eventually error out after exhausting retries
      let didThrow = false;
      try {
        await result.text;
      } catch {
        didThrow = true;
      }
      expect(didThrow).toBe(true);
      expect(callCount).toBe(2);
    });
  });
});
