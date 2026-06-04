import { describe, expect, it } from 'vitest';
import { CacheKeyGenerator } from './CacheKeyGenerator';

/**
 * Regression test for https://github.com/mastra-ai/mastra/issues/16756
 *
 * When Observational Memory's UPSERT collision produces a tool-invocation part
 * with `toolInvocation === undefined`, CacheKeyGenerator.fromAIV4Part crashes:
 *
 *   TypeError: Cannot read properties of undefined (reading 'toolCallId')
 *
 * The cache key generator must handle malformed parts gracefully instead of
 * crashing the entire message loading pipeline.
 */
describe('CacheKeyGenerator tool-invocation null guard (#16756)', () => {
  it('fromAIV4Part should not crash when toolInvocation is undefined', () => {
    const brokenPart = {
      type: 'tool-invocation' as const,
      toolInvocation: undefined,
    };

    expect(() => CacheKeyGenerator.fromAIV4Part(brokenPart as any)).not.toThrow();
  });

  it('fromAIV4Part should return a stable key for a broken tool-invocation part', () => {
    const brokenPart = {
      type: 'tool-invocation' as const,
      toolInvocation: undefined,
    };

    const key1 = CacheKeyGenerator.fromAIV4Part(brokenPart as any);
    const key2 = CacheKeyGenerator.fromAIV4Part(brokenPart as any);

    expect(key1).toBe(key2);
  });

  it('fromAIV4Parts should not crash when a tool-invocation part has undefined toolInvocation', () => {
    const parts = [
      { type: 'text' as const, text: 'hello' },
      { type: 'tool-invocation' as const, toolInvocation: undefined },
    ];

    expect(() => CacheKeyGenerator.fromAIV4Parts(parts as any)).not.toThrow();
  });

  it('fromDBParts should not crash when a tool-invocation part has undefined toolInvocation', () => {
    const parts = [
      { type: 'text' as const, text: 'hello' },
      { type: 'tool-invocation' as const, toolInvocation: undefined },
    ];

    expect(() => CacheKeyGenerator.fromDBParts(parts as any)).not.toThrow();
  });

  it('fromDBParts should generate the same key for data parts with reordered object keys', () => {
    const messagePartsFromTextStorage = [
      {
        type: 'data-om-status' as const,
        data: {
          windows: {
            buffered: {
              observations: {
                chunks: 0,
                messageTokens: 0,
                projectedMessageRemoval: 0,
                observationTokens: 0,
                status: 'idle',
              },
              reflection: {
                inputObservationTokens: 0,
                observationTokens: 0,
                status: 'idle',
              },
            },
          },
        },
      },
    ];

    const messagePartsFromJsonbSnapshot = [
      {
        type: 'data-om-status' as const,
        data: {
          windows: {
            buffered: {
              reflection: {
                status: 'idle',
                observationTokens: 0,
                inputObservationTokens: 0,
              },
              observations: {
                chunks: 0,
                status: 'idle',
                messageTokens: 0,
                observationTokens: 0,
                projectedMessageRemoval: 0,
              },
            },
          },
        },
      },
    ];

    expect(CacheKeyGenerator.fromDBParts(messagePartsFromTextStorage as any)).toBe(
      CacheKeyGenerator.fromDBParts(messagePartsFromJsonbSnapshot as any),
    );
  });

  it('fromAIV4Part should still work correctly with valid tool-invocation parts', () => {
    const validPart = {
      type: 'tool-invocation' as const,
      toolInvocation: {
        toolCallId: 'call_123',
        state: 'result',
        toolName: 'myTool',
        args: {},
        result: 'done',
      },
    };

    const key = CacheKeyGenerator.fromAIV4Part(validPart as any);
    expect(key).toContain('call_123');
    expect(key).toContain('result');
  });
});
