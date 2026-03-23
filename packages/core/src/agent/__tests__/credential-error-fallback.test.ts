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
    describe('stream()', () => {
      it('should not retry non-retryable 401 on the same model', async () => {
        // Non-retryable errors (401/403) should not be retried - p-retry correctly
        // checks isRetryable and skips retries. The outer fallback loop only handles
        // model switching, not retries.
        const primary = createCountingErrorModel(401, 'Unauthorized', false);
        const secondaryModel = createSuccessModel('Fallback success');

        const agent = new Agent({
          id: 'test-no-retry-but-fallback-stream',
          name: 'Test No Retry But Fallback (stream)',
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

        // 401 (isRetryable: false) is not retried - only 1 call to the primary model
        expect(primary.getCallCount()).toBe(1);
      });

      it('should not retry non-retryable 403 on the same model', async () => {
        const primary = createCountingErrorModel(403, 'Forbidden', false);
        const secondaryModel = createSuccessModel('Fallback success');

        const agent = new Agent({
          id: 'test-no-retry-403-stream',
          name: 'Test No Retry 403 (stream)',
          instructions: 'You are a test agent',
          model: [
            { model: primary.model, maxRetries: 3 },
            { model: secondaryModel, maxRetries: 0 },
          ],
        });

        const result = await agent.stream('Hello');
        const fullText = await result.text;

        expect(fullText).toBe('Fallback success');

        // 403 (isRetryable: false) should NOT be retried - only 1 call
        expect(primary.getCallCount()).toBe(1);
      });

      it('should retry retryable 429 on the same model before falling back', async () => {
        const primary = createCountingErrorModel(429, 'Rate limited', true);
        const secondaryModel = createSuccessModel('Fallback success');

        const agent = new Agent({
          id: 'test-retry-then-fallback-stream',
          name: 'Test Retry Then Fallback (stream)',
          instructions: 'You are a test agent',
          model: [
            { model: primary.model, maxRetries: 2 },
            { model: secondaryModel, maxRetries: 0 },
          ],
        });

        const result = await agent.stream('Hello');
        const fullText = await result.text;

        expect(fullText).toBe('Fallback success');
        // Retries are handled by a single layer (p-retry in execute.ts) which respects isRetryable.
        // With maxRetries: 2, we get 3 calls (1 initial + 2 retries) before falling back.
        expect(primary.getCallCount()).toBe(3);
      });

      it('should retry retryable 500 on the same model before falling back', async () => {
        const primary = createCountingErrorModel(500, 'Internal server error', true);
        const secondaryModel = createSuccessModel('Fallback success');

        const agent = new Agent({
          id: 'test-retry-500-stream',
          name: 'Test Retry 500 (stream)',
          instructions: 'You are a test agent',
          model: [
            { model: primary.model, maxRetries: 2 },
            { model: secondaryModel, maxRetries: 0 },
          ],
        });

        const result = await agent.stream('Hello');
        const fullText = await result.text;

        expect(fullText).toBe('Fallback success');

        // With maxRetries: 2, exactly 3 calls (1 initial + 2 retries)
        expect(primary.getCallCount()).toBe(3);
      });
    });

    describe('generate()', () => {
      it('should not retry non-retryable 401 on the same model', async () => {
        const primary = createCountingErrorModel(401, 'Unauthorized', false);
        const secondaryModel = createSuccessModel('Fallback success');

        const agent = new Agent({
          id: 'test-no-retry-but-fallback-generate',
          name: 'Test No Retry But Fallback (generate)',
          instructions: 'You are a test agent',
          model: [
            { model: primary.model, maxRetries: 3 },
            { model: secondaryModel, maxRetries: 0 },
          ],
        });

        const result = await agent.generate('Hello');

        expect(result.text).toBe('Fallback success');

        // 401 (isRetryable: false) should NOT be retried - only 1 call to the primary model
        expect(primary.getCallCount()).toBe(1);
      });

      it('should not retry non-retryable 403 on the same model', async () => {
        const primary = createCountingErrorModel(403, 'Forbidden', false);
        const secondaryModel = createSuccessModel('Fallback success');

        const agent = new Agent({
          id: 'test-no-retry-403-generate',
          name: 'Test No Retry 403 (generate)',
          instructions: 'You are a test agent',
          model: [
            { model: primary.model, maxRetries: 3 },
            { model: secondaryModel, maxRetries: 0 },
          ],
        });

        const result = await agent.generate('Hello');

        expect(result.text).toBe('Fallback success');

        // 403 (isRetryable: false) should NOT be retried - only 1 call
        expect(primary.getCallCount()).toBe(1);
      });

      it('should retry retryable 429 exactly maxRetries times before falling back', async () => {
        const primary = createCountingErrorModel(429, 'Rate limited', true);
        const secondaryModel = createSuccessModel('Fallback success');

        const agent = new Agent({
          id: 'test-retry-then-fallback-generate',
          name: 'Test Retry Then Fallback (generate)',
          instructions: 'You are a test agent',
          model: [
            { model: primary.model, maxRetries: 2 },
            { model: secondaryModel, maxRetries: 0 },
          ],
        });

        const result = await agent.generate('Hello');

        expect(result.text).toBe('Fallback success');

        // With maxRetries: 2, exactly 3 calls (1 initial + 2 retries) before falling back
        expect(primary.getCallCount()).toBe(3);
      });

      it('should retry retryable 500 exactly maxRetries times before falling back', async () => {
        const primary = createCountingErrorModel(500, 'Internal server error', true);
        const secondaryModel = createSuccessModel('Fallback success');

        const agent = new Agent({
          id: 'test-retry-500-generate',
          name: 'Test Retry 500 (generate)',
          instructions: 'You are a test agent',
          model: [
            { model: primary.model, maxRetries: 2 },
            { model: secondaryModel, maxRetries: 0 },
          ],
        });

        const result = await agent.generate('Hello');

        expect(result.text).toBe('Fallback success');

        // With maxRetries: 2, exactly 3 calls (1 initial + 2 retries)
        expect(primary.getCallCount()).toBe(3);
      });
    });
  });
});
