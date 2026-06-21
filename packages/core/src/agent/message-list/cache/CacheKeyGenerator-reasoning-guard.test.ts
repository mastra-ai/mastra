import { describe, expect, it } from 'vitest';
import { CacheKeyGenerator } from './CacheKeyGenerator';

/**
 * Regression test for https://github.com/mastra-ai/mastra/issues/18280
 *
 * Models that emit an empty reasoning summary (e.g. Anthropic Opus 4.7/4.8 with
 * thinking `display: omitted`, or OpenAI gpt-5.x via the Responses API returning
 * no summary) persist a reasoning part shaped like:
 *
 *   { type: 'reasoning', reasoning: '', details: [{ type: 'text' }] }   // no `text`
 *
 * On the next turn, Observational Memory reloads that message and
 * CacheKeyGenerator.fromAIV4Part crashes:
 *
 *   TypeError: Cannot read properties of undefined (reading 'length')
 *
 * This is the reasoning-branch sibling of the tool-invocation guard (#16756 /
 * #16773). The cache key generator must handle malformed/empty reasoning parts
 * gracefully instead of crashing the message-loading pipeline.
 */
describe('CacheKeyGenerator reasoning null guard (#18280)', () => {
  it('fromAIV4Part should not crash when a text detail has no `text`', () => {
    const brokenPart = {
      type: 'reasoning' as const,
      reasoning: '',
      details: [{ type: 'text' }],
    };

    expect(() => CacheKeyGenerator.fromAIV4Part(brokenPart as any)).not.toThrow();
  });

  it('fromAIV4Part should not crash when `details` is undefined', () => {
    const brokenPart = {
      type: 'reasoning' as const,
      reasoning: '',
    };

    expect(() => CacheKeyGenerator.fromAIV4Part(brokenPart as any)).not.toThrow();
  });

  it('fromAIV4Part should return a stable key for a broken reasoning part', () => {
    const brokenPart = {
      type: 'reasoning' as const,
      reasoning: '',
      details: [{ type: 'text' }],
    };

    const key1 = CacheKeyGenerator.fromAIV4Part(brokenPart as any);
    const key2 = CacheKeyGenerator.fromAIV4Part(brokenPart as any);

    expect(key1).toBe(key2);
  });

  it('fromAIV4Parts should not crash when a reasoning part has malformed details', () => {
    const parts = [
      { type: 'text' as const, text: 'hello' },
      { type: 'reasoning' as const, reasoning: '', details: [{ type: 'text' }] },
    ];

    expect(() => CacheKeyGenerator.fromAIV4Parts(parts as any)).not.toThrow();
  });

  it('fromDBParts should not crash when a reasoning part has malformed details', () => {
    const parts = [
      { type: 'text' as const, text: 'hello' },
      { type: 'reasoning' as const, reasoning: '', details: [{ type: 'text' }] },
    ];

    expect(() => CacheKeyGenerator.fromDBParts(parts as any)).not.toThrow();
  });

  it('fromAIV4Part should still work correctly with valid reasoning parts', () => {
    const validPart = {
      type: 'reasoning' as const,
      reasoning: 'thinking it through',
      details: [{ type: 'text', text: 'thinking it through' }],
    };

    const key = CacheKeyGenerator.fromAIV4Part(validPart as any);
    // text length (19) contributes to the key, unchanged by the guard.
    expect(key).toContain('thinking it through');
    expect(key).toContain('19');
  });
});
