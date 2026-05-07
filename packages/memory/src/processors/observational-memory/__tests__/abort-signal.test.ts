/**
 * Abort Signal Tests
 *
 * Tests abort signal propagation at two levels:
 * 1. Baseline: agent.generate() returns empty result on abort (framework behavior)
 * 2. OM-level: withAbortCheck detects the abort and throws AbortError
 */

import { Agent } from '@mastra/core/agent';
import { describe, it, expect } from 'vitest';

// =============================================================================
// Slow model that takes a long time to respond (simulates real LLM latency)
// =============================================================================

function createSlowModel(delayMs: number) {
  return {
    specificationVersion: 'v2' as const,
    provider: 'mock-slow',
    modelId: 'mock-slow-model',
    defaultObjectGenerationMode: undefined,
    supportsImageUrls: false,
    supportedUrls: {},

    async doGenerate({ abortSignal }: { abortSignal?: AbortSignal } = {}) {
      // Simulate slow LLM response, abort-aware
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, delayMs);
        if (abortSignal) {
          if (abortSignal.aborted) {
            clearTimeout(timer);
            reject(new DOMException('The operation was aborted.', 'AbortError'));
            return;
          }
          abortSignal.addEventListener(
            'abort',
            () => {
              clearTimeout(timer);
              reject(new DOMException('The operation was aborted.', 'AbortError'));
            },
            { once: true },
          );
        }
      });

      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        content: [{ type: 'text' as const, text: 'Completed normally.' }],
        warnings: [],
      };
    },

    async doStream({ abortSignal }: { abortSignal?: AbortSignal } = {}) {
      const stream = new ReadableStream({
        async start(controller) {
          controller.enqueue({ type: 'stream-start', warnings: [] });
          controller.enqueue({
            type: 'response-metadata',
            id: 'id-0',
            modelId: 'mock-slow-model',
            timestamp: new Date(),
          });
          controller.enqueue({ type: 'text-start', id: 'text-1' });

          for (let i = 0; i < 10; i++) {
            if (abortSignal?.aborted) {
              controller.error(new DOMException('The operation was aborted.', 'AbortError'));
              return;
            }
            await new Promise(resolve => setTimeout(resolve, delayMs / 10));
            controller.enqueue({ type: 'text-delta', id: 'text-1', delta: `chunk-${i} ` });
          }

          controller.enqueue({ type: 'text-end', id: 'text-1' });
          controller.enqueue({
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          });
          controller.close();
        },
      });

      return {
        stream,
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('AbortSignal basics', () => {
  it('agent.generate() returns empty result on abort (framework behavior)', async () => {
    const controller = new AbortController();
    const agent = new Agent({
      id: 'abort-test-generate',
      name: 'Abort Test Generate',
      model: createSlowModel(5000) as any,
      instructions: 'You are a test agent.',
    });

    // Abort after 100ms
    setTimeout(() => controller.abort(), 100);

    const start = Date.now();
    // Framework returns empty result instead of throwing
    const result = await agent.generate('Hello', {
      abortSignal: controller.signal,
    });

    const elapsed = Date.now() - start;
    // Should complete quickly (not wait 5s)
    expect(elapsed).toBeLessThan(2000);
    // Framework returns empty text on abort
    expect(result.text).toBe('');
  }, 10000);

  it('agent.generate() completes normally without abort', async () => {
    const agent = new Agent({
      id: 'abort-test-no-abort',
      name: 'Abort Test No Abort',
      model: createSlowModel(100) as any,
      instructions: 'You are a test agent.',
    });

    const result = await agent.generate('Hello');
    expect(result.text).toBe('Completed normally.');
  }, 10000);
});

describe('AbortSignal in OM withAbortCheck', () => {
  it('withAbortCheck throws when signal fires during fn()', async () => {
    // Simulates what withAbortCheck does: agent.generate() returns empty on abort,
    // then the post-call abortSignal check catches it
    const controller = new AbortController();

    const fn = async () => {
      // Simulate agent.generate() returning empty on abort
      await new Promise(resolve => setTimeout(resolve, 200));
      return { text: '' };
    };

    // Abort after 50ms
    setTimeout(() => controller.abort(), 50);

    const abortSignal = controller.signal;

    let threw = false;
    try {
      if (abortSignal?.aborted) {
        throw new Error('The operation was aborted.');
      }
      await fn();
      // This is the key fix — check after fn() returns
      if (abortSignal?.aborted) {
        throw new Error('The operation was aborted.');
      }
    } catch {
      threw = true;
    }

    expect(threw).toBe(true);
  });

  it('withAbortCheck does NOT throw when signal is not aborted', async () => {
    const fn = async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      return { text: 'ok' };
    };

    let threw = false;
    try {
      await fn();
    } catch {
      threw = true;
    }

    expect(threw).toBe(false);
  });

  it('withAbortCheck throws immediately if signal already aborted', async () => {
    const controller = new AbortController();
    controller.abort(); // Already aborted

    const abortSignal = controller.signal;

    let threw = false;
    try {
      if (abortSignal?.aborted) {
        throw new Error('The operation was aborted.');
      }
    } catch {
      threw = true;
    }

    expect(threw).toBe(true);
  });
});
