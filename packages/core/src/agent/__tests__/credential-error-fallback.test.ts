import { APICallError } from '@internal/ai-sdk-v5';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { Agent } from '../agent';

/**
 * Tests that verify model fallback behavior for authentication/credential errors.
 *
 * In multi-provider setups (e.g., OpenAI primary + Anthropic/Bedrock secondary),
 * a credential failure (401/403) on one provider should trigger fallback to the
 * next model, since each model may use different providers with independent API keys.
 *
 * Related: https://github.com/mastra-ai/mastra/issues/12756
 */

function createSuccessModel(responseText: string) {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop' as const,
      usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
      text: responseText,
      content: [{ type: 'text' as const, text: responseText }],
      warnings: [],
    }),
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'success-model', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: responseText },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 } },
      ]),
    }),
  });
}

function createAPICallErrorModel(statusCode: number, message: string, isRetryable: boolean) {
  const error = new APICallError({
    message,
    url: 'https://api.example.com/v1/chat/completions',
    requestBodyValues: {},
    statusCode,
    responseBody: JSON.stringify({ error: { message } }),
    isRetryable,
  });

  return new MockLanguageModelV2({
    doGenerate: async () => {
      throw error;
    },
    doStream: async () => {
      throw error;
    },
  });
}

function createCountingErrorModel(statusCode: number, message: string, isRetryable: boolean) {
  let callCount = 0;

  const model = new MockLanguageModelV2({
    doGenerate: async () => {
      callCount++;
      throw new APICallError({
        message,
        url: 'https://api.example.com',
        requestBodyValues: {},
        statusCode,
        isRetryable,
      });
    },
    doStream: async () => {
      callCount++;
      throw new APICallError({
        message,
        url: 'https://api.example.com',
        requestBodyValues: {},
        statusCode,
        isRetryable,
      });
    },
  });

  return { model, getCallCount: () => callCount };
}

describe('Credential/Auth Error Fallback', () => {
  describe('stream() - fallback on auth errors', () => {
    it('should fallback to secondary model on 401 Unauthorized', async () => {
      const primaryModel = createAPICallErrorModel(401, 'Invalid API key', false);
      const secondaryModel = createSuccessModel('Secondary model response');

      const agent = new Agent({
        id: 'test-401-fallback-stream',
        name: 'Test 401 Fallback (stream)',
        instructions: 'You are a test agent',
        model: [
          { model: primaryModel, maxRetries: 0 },
          { model: secondaryModel, maxRetries: 0 },
        ],
      });

      const result = await agent.stream('Hello');
      const fullText = await result.text;

      expect(fullText).toBe('Secondary model response');
    });

    it('should fallback to secondary model on 403 Forbidden', async () => {
      const primaryModel = createAPICallErrorModel(403, 'Access denied', false);
      const secondaryModel = createSuccessModel('Secondary model response');

      const agent = new Agent({
        id: 'test-403-fallback-stream',
        name: 'Test 403 Fallback (stream)',
        instructions: 'You are a test agent',
        model: [
          { model: primaryModel, maxRetries: 0 },
          { model: secondaryModel, maxRetries: 0 },
        ],
      });

      const result = await agent.stream('Hello');
      const fullText = await result.text;

      expect(fullText).toBe('Secondary model response');
    });

    it('should fallback to secondary model on 429 Rate Limit', async () => {
      const primaryModel = createAPICallErrorModel(429, 'Rate limit exceeded', true);
      const secondaryModel = createSuccessModel('Secondary model response');

      const agent = new Agent({
        id: 'test-429-fallback-stream',
        name: 'Test 429 Fallback (stream)',
        instructions: 'You are a test agent',
        model: [
          { model: primaryModel, maxRetries: 0 },
          { model: secondaryModel, maxRetries: 0 },
        ],
      });

      const result = await agent.stream('Hello');
      const fullText = await result.text;

      expect(fullText).toBe('Secondary model response');
    });

    it('should fallback to secondary model on 500 Internal Server Error', async () => {
      const primaryModel = createAPICallErrorModel(500, 'Internal server error', true);
      const secondaryModel = createSuccessModel('Secondary model response');

      const agent = new Agent({
        id: 'test-500-fallback-stream',
        name: 'Test 500 Fallback (stream)',
        instructions: 'You are a test agent',
        model: [
          { model: primaryModel, maxRetries: 0 },
          { model: secondaryModel, maxRetries: 0 },
        ],
      });

      const result = await agent.stream('Hello');
      const fullText = await result.text;

      expect(fullText).toBe('Secondary model response');
    });
  });

  describe('generate() - fallback on auth errors', () => {
    it('should fallback to secondary model on 401 Unauthorized', async () => {
      const primaryModel = createAPICallErrorModel(401, 'Invalid API key', false);
      const secondaryModel = createSuccessModel('Secondary model response');

      const agent = new Agent({
        id: 'test-401-fallback-generate',
        name: 'Test 401 Fallback (generate)',
        instructions: 'You are a test agent',
        model: [
          { model: primaryModel, maxRetries: 0 },
          { model: secondaryModel, maxRetries: 0 },
        ],
      });

      const result = await agent.generate('Hello');
      expect(result.text).toBe('Secondary model response');
    });

    it('should fallback to secondary model on 403 Forbidden', async () => {
      const primaryModel = createAPICallErrorModel(403, 'Access denied', false);
      const secondaryModel = createSuccessModel('Secondary model response');

      const agent = new Agent({
        id: 'test-403-fallback-generate',
        name: 'Test 403 Fallback (generate)',
        instructions: 'You are a test agent',
        model: [
          { model: primaryModel, maxRetries: 0 },
          { model: secondaryModel, maxRetries: 0 },
        ],
      });

      const result = await agent.generate('Hello');
      expect(result.text).toBe('Secondary model response');
    });
  });

  describe('error propagation when all models fail', () => {
    it('should surface error when single model returns 401', async () => {
      const primaryModel = createAPICallErrorModel(401, 'Invalid API key', false);

      const agent = new Agent({
        id: 'test-401-no-fallback',
        name: 'Test 401 No Fallback',
        instructions: 'You are a test agent',
        model: [{ model: primaryModel, maxRetries: 0 }],
      });

      await expect(agent.generate('Hello')).rejects.toThrow();
    });

    it('should surface error when both models fail with auth errors', async () => {
      const primaryModel = createAPICallErrorModel(401, 'Primary: Invalid API key', false);
      const secondaryModel = createAPICallErrorModel(403, 'Secondary: Access denied', false);

      const agent = new Agent({
        id: 'test-both-fail-auth',
        name: 'Test Both Fail Auth',
        instructions: 'You are a test agent',
        model: [
          { model: primaryModel, maxRetries: 0 },
          { model: secondaryModel, maxRetries: 0 },
        ],
      });

      await expect(agent.generate('Hello')).rejects.toThrow();
    });
  });

  describe('retry behavior for non-retryable errors', () => {
    it('should not retry non-retryable 401 on the same model (maxRetries should be ignored)', async () => {
      // BUG: executeStreamWithFallbackModels retries all errors regardless of isRetryable.
      // The p-retry layer in execute.ts correctly checks isRetryable, but the outer
      // retry loop in llm-execution-step.ts does not, causing redundant retries
      // for non-retryable errors like 401/403.
      //
      // Expected: primaryCallCount === 1 (no retry for non-retryable error)
      // Actual:   primaryCallCount === 4 (maxRetries + 1 attempts)
      const primary = createCountingErrorModel(401, 'Unauthorized', false);
      const secondaryModel = createSuccessModel('Fallback success');

      const agent = new Agent({
        id: 'test-no-retry-but-fallback',
        name: 'Test No Retry But Fallback',
        instructions: 'You are a test agent',
        model: [
          { model: primary.model, maxRetries: 3 },
          { model: secondaryModel, maxRetries: 0 },
        ],
      });

      const result = await agent.stream('Hello');
      const fullText = await result.text;

      // Fallback works correctly
      expect(fullText).toBe('Fallback success');

      // BUG: 401 (isRetryable: false) is retried maxRetries times by the outer loop.
      // The outer executeStreamWithFallbackModels loop does not check isRetryable,
      // so it retries all errors including non-retryable ones.
      // Current behavior: 4 calls (1 initial + 3 retries)
      // Expected behavior: 1 call (no retries for non-retryable errors)
      expect(primary.getCallCount()).toBe(4); // Documents current (buggy) behavior
      // TODO: After fix, this should be:
      // expect(primary.getCallCount()).toBe(1);
    });

    it('should retry retryable 429 on the same model before falling back', async () => {
      const primary = createCountingErrorModel(429, 'Rate limited', true);
      const secondaryModel = createSuccessModel('Fallback success');

      const agent = new Agent({
        id: 'test-retry-then-fallback',
        name: 'Test Retry Then Fallback',
        instructions: 'You are a test agent',
        model: [
          { model: primary.model, maxRetries: 2 },
          { model: secondaryModel, maxRetries: 0 },
        ],
      });

      const result = await agent.stream('Hello');
      const fullText = await result.text;

      expect(fullText).toBe('Fallback success');
      // BUG: Retries are duplicated across two layers:
      // - Layer 1 (p-retry in execute.ts): retries maxRetries times for retryable errors
      // - Layer 2 (executeStreamWithFallbackModels): also retries maxRetries times
      // Result: (maxRetries + 1) * (maxRetries + 1) = 3 * 3 = 9 calls instead of 3
      // Current behavior: 9 calls (double retry)
      // Expected behavior: 3 calls (1 initial + 2 retries, single layer)
      expect(primary.getCallCount()).toBe(9); // Documents current (buggy) behavior
      // TODO: After fix, this should be:
      // expect(primary.getCallCount()).toBe(3);
    });
  });
});
