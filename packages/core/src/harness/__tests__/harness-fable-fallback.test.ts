/**
 * Tests for the automatic Anthropic server-side fallback that the Harness
 * enables for `claude-fable-5` runs.
 *
 * fable-5 can have a turn blocked server-side by its safety classifiers. When
 * a fallback is configured via `providerOptions.anthropic.fallbacks`, Anthropic
 * transparently retries the blocked turn on the fallback model
 * (`claude-opus-4-8`) instead of refusing. The Harness injects this option for
 * fable-5 only, so other models are unaffected.
 */
import { describe, it, expect } from 'vitest';
import { buildFableFallbackProviderOptions } from '../harness';

describe('buildFableFallbackProviderOptions', () => {
  it('enables an opus-4-8 fallback for the provider-prefixed fable-5 id', () => {
    expect(buildFableFallbackProviderOptions('anthropic/claude-fable-5')).toEqual({
      anthropic: { fallbacks: [{ model: 'claude-opus-4-8' }] },
    });
  });

  it('enables the fallback for a bare fable-5 id', () => {
    expect(buildFableFallbackProviderOptions('claude-fable-5')).toEqual({
      anthropic: { fallbacks: [{ model: 'claude-opus-4-8' }] },
    });
  });

  it('enables the fallback for a pack-prefixed fable-5 id', () => {
    expect(buildFableFallbackProviderOptions('anthropic-custom/claude-fable-5')).toEqual({
      anthropic: { fallbacks: [{ model: 'claude-opus-4-8' }] },
    });
  });

  it('does not enable the fallback for other anthropic models', () => {
    expect(buildFableFallbackProviderOptions('anthropic/claude-opus-4-8')).toBeUndefined();
    expect(buildFableFallbackProviderOptions('anthropic/claude-sonnet-4-6')).toBeUndefined();
  });

  it('does not match on a partial or differently-suffixed id', () => {
    expect(buildFableFallbackProviderOptions('anthropic/claude-fable-5-preview')).toBeUndefined();
    expect(buildFableFallbackProviderOptions('claude-fable-50')).toBeUndefined();
    expect(buildFableFallbackProviderOptions('')).toBeUndefined();
  });
});
