import type { LanguageModelV2, LanguageModelV2StreamPart } from '@ai-sdk/provider-v5';
import { describe, it, expect, vi } from 'vitest';
import { execute } from '../../../../stream/aisdk/v5/execute';
import type { ChunkType } from '../../../../stream/types';

/**
 * Tests for the shouldThrowError fix in llm-execution-step.ts.
 *
 * Background: `execute()` accepts a `shouldThrowError` flag. When true, API errors
 * (429, 529, timeouts) are thrown, allowing the fallback loop in
 * `executeStreamWithFallbackModels` to catch them and retry/propagate.
 * When false, errors are silently wrapped into a ReadableStream and returned
 * as a "successful" result — the caller never sees the error.
 *
 * The bug (https://github.com/mastra-ai/mastra/issues/13656):
 * For single-model agents, `shouldThrowError` was set to `!isLastModel` = false,
 * so API errors were silently swallowed. The fix sets `shouldThrowError: true` always.
 */

function createMockModel(doStreamImpl: LanguageModelV2['doStream']): LanguageModelV2 {
  return {
    modelId: 'test-model',
    provider: 'test-provider',
    specificationVersion: 'v2',
    defaultObjectGenerationMode: 'json',
    doStream: doStreamImpl,
    doGenerate: vi.fn(),
  } as unknown as LanguageModelV2;
}

function createSuccessStream(): ReadableStream<LanguageModelV2StreamPart> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'response-metadata', id: 'resp-1', timestamp: new Date(), modelId: 'test-model' });
      controller.enqueue({ type: 'text-delta', textDelta: 'Hello' });
      controller.enqueue({
        type: 'finish',
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 5 },
      });
      controller.close();
    },
  });
}

async function collectStreamChunks(stream: ReadableStream<ChunkType>): Promise<ChunkType[]> {
  const reader = stream.getReader();
  const chunks: ChunkType[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return chunks;
}

describe('execute() shouldThrowError behavior', () => {
  const baseExecuteArgs = {
    runId: 'test-run',
    inputMessages: [{ role: 'user' as const, content: [{ type: 'text' as const, text: 'hello' }] }],
    onResult: vi.fn(),
    methodType: 'stream' as const,
    modelSettings: { maxRetries: 0 },
  };

  it('should error the stream when shouldThrowError is true and the model throws', async () => {
    const apiError = new Error('429 Too Many Requests');
    const model = createMockModel(vi.fn().mockRejectedValue(apiError));

    const stream = execute({
      ...baseExecuteArgs,
      model,
      shouldThrowError: true,
    });

    // Stream should error when consumed — the error propagates through the
    // ReadableStream controller via safeError(), causing reader.read() to reject.
    const reader = stream.getReader();
    await expect(reader.read()).rejects.toThrow('429 Too Many Requests');
  });

  it('should wrap error in stream chunks when shouldThrowError is false', async () => {
    const apiError = new Error('529 Overloaded');
    const model = createMockModel(vi.fn().mockRejectedValue(apiError));

    const stream = execute({
      ...baseExecuteArgs,
      model,
      shouldThrowError: false,
    });

    // Stream should NOT error — it wraps the error as a chunk
    const chunks = await collectStreamChunks(stream);

    // Should contain an error-type chunk somewhere in the stream
    const hasErrorChunk = chunks.some(c => c.type === 'error');
    expect(hasErrorChunk).toBe(true);
  });

  it('should propagate the original error object when shouldThrowError is true', async () => {
    const apiError = new Error('Gateway Timeout');
    (apiError as any).statusCode = 504;
    const model = createMockModel(vi.fn().mockRejectedValue(apiError));

    const stream = execute({
      ...baseExecuteArgs,
      model,
      shouldThrowError: true,
    });

    const reader = stream.getReader();
    try {
      await reader.read();
      expect.unreachable('Should have thrown');
    } catch (err: any) {
      // The original error (or a wrapper containing it) should propagate
      expect(err.message).toContain('Gateway Timeout');
    }
  });

  it('should succeed normally when the model does not throw', async () => {
    const model = createMockModel(
      vi.fn().mockResolvedValue({
        stream: createSuccessStream(),
        warnings: [],
        request: {},
        rawResponse: {},
      }),
    );

    const stream = execute({
      ...baseExecuteArgs,
      model,
      shouldThrowError: true,
    });

    const chunks = await collectStreamChunks(stream);

    // Stream should complete without errors
    const errorChunks = chunks.filter(c => c.type === 'error');
    expect(errorChunks.length).toBe(0);

    // Should have some chunks (the exact types depend on the Mastra transform)
    expect(chunks.length).toBeGreaterThan(0);
  });
});

describe('multi-model fallback with shouldThrowError: true', () => {
  it('should try the next model when a non-last model fails (shouldThrowError: true)', async () => {
    // This tests the scenario where shouldThrowError: true is used for ALL models.
    // For non-last models, the error should be caught by executeStreamWithFallbackModels'
    // catch block, which increments the attempt counter and tries the next model.
    //
    // We test this indirectly: the execute() function with shouldThrowError: true
    // errors the stream. The fallback loop (in llm-execution-step.ts) consumes
    // the stream in processOutputStream, which re-throws. The catch block in the
    // callback re-throws for non-last models, which the fallback loop catches.
    //
    // Here we verify the prerequisite: shouldThrowError: true makes the stream
    // error (not wrap), so the fallback loop's catch path can fire.

    const error = new Error('Model overloaded');
    const failingModel = createMockModel(vi.fn().mockRejectedValue(error));
    const successModel = createMockModel(
      vi.fn().mockResolvedValue({
        stream: createSuccessStream(),
        warnings: [],
        request: {},
        rawResponse: {},
      }),
    );

    // Failing model with shouldThrowError: true — stream errors
    const failStream = execute({
      runId: 'test-run',
      model: failingModel,
      inputMessages: [{ role: 'user' as const, content: [{ type: 'text' as const, text: 'hello' }] }],
      onResult: vi.fn(),
      shouldThrowError: true,
      methodType: 'stream' as const,
      modelSettings: { maxRetries: 0 },
    });
    const reader = failStream.getReader();
    await expect(reader.read()).rejects.toThrow('Model overloaded');

    // Success model works normally — stream completes without error
    const successStream = execute({
      runId: 'test-run',
      model: successModel,
      inputMessages: [{ role: 'user' as const, content: [{ type: 'text' as const, text: 'hello' }] }],
      onResult: vi.fn(),
      shouldThrowError: true,
      methodType: 'stream' as const,
      modelSettings: { maxRetries: 0 },
    });
    const chunks = await collectStreamChunks(successStream);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.some(c => c.type === 'error')).toBe(false);
  });
});
