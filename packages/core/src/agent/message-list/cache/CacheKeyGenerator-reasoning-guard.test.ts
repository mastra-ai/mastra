import { describe, expect, it } from 'vitest';
import { CacheKeyGenerator } from './CacheKeyGenerator';

/**
 * Regression test for https://github.com/mastra-ai/mastra/issues/18280
 *
 * Models that emit an empty reasoning summary (e.g. Anthropic __GATEWAY_ANTHROPIC_MODEL_OPUS__ with
 * thinking `display: omitted`, or OpenAI __AI_SDK_OPENAI_MODEL_BASE__ via the Responses API returning
 * no summary) persist a reasoning part shaped like:
 *
 *   { type: 'reasoning', reasoning: '', details: [{ type: 'text' }] }   // no `text`
 *
 * On the next turn, Observational Memory reloads that message and
 * CacheKeyGenerator.fromLegacyPart crashes:
 *
 *   TypeError: Cannot read properties of undefined (reading 'length')
 *
 * This is the reasoning-branch sibling of the tool-invocation guard (#16756 /
 * #16773). The cache key generator must handle malformed/empty reasoning parts
 * gracefully instead of crashing the message-loading pipeline.
 */
describe('CacheKeyGenerator reasoning null guard (#18280)', () => {
  it('fromLegacyPart should not crash when a text detail has no `text`', () => {
    const brokenPart = {
      type: 'reasoning' as const,
      reasoning: '',
      details: [{ type: 'text' }],
    };

    expect(() => CacheKeyGenerator.fromLegacyPart(brokenPart as any)).not.toThrow();
  });

  it('fromLegacyPart should not crash when `details` is undefined', () => {
    const brokenPart = {
      type: 'reasoning' as const,
      reasoning: '',
    };

    expect(() => CacheKeyGenerator.fromLegacyPart(brokenPart as any)).not.toThrow();
  });

  it('fromLegacyPart should return a stable key for a broken reasoning part', () => {
    const brokenPart = {
      type: 'reasoning' as const,
      reasoning: '',
      details: [{ type: 'text' }],
    };

    const key1 = CacheKeyGenerator.fromLegacyPart(brokenPart as any);
    const key2 = CacheKeyGenerator.fromLegacyPart(brokenPart as any);

    expect(key1).toBe(key2);
  });

  it('fromLegacyParts should not crash when a reasoning part has malformed details', () => {
    const parts = [
      { type: 'text' as const, text: 'hello' },
      { type: 'reasoning' as const, reasoning: '', details: [{ type: 'text' }] },
    ];

    expect(() => CacheKeyGenerator.fromLegacyParts(parts as any)).not.toThrow();
  });

  it('fromDBParts should not crash when a reasoning part has malformed details', () => {
    const parts = [
      { type: 'text' as const, text: 'hello' },
      { type: 'reasoning' as const, reasoning: '', details: [{ type: 'text' }] },
    ];

    expect(() => CacheKeyGenerator.fromDBParts(parts as any)).not.toThrow();
  });

  it('fromLegacyPart should still work correctly with valid reasoning parts', () => {
    const validPart = {
      type: 'reasoning' as const,
      reasoning: 'thinking it through',
      details: [{ type: 'text', text: 'thinking it through' }],
    };

    const key = CacheKeyGenerator.fromLegacyPart(validPart as any);
    // text length (19) contributes to the key, unchanged by the guard.
    expect(key).toContain('thinking it through');
    expect(key).toContain('19');
  });
});
