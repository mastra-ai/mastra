import { describe, expect, it } from 'vitest';

import { hasProviderSideResponseChain } from './response-item-metadata';

describe('hasProviderSideResponseChain', () => {
  it('detects an openai previousResponseId', () => {
    expect(hasProviderSideResponseChain({ openai: { previousResponseId: 'resp_1' } })).toBe(true);
  });

  it('detects a previousResponseId alongside other openai options', () => {
    expect(hasProviderSideResponseChain({ openai: { previousResponseId: 'resp_1', store: true } })).toBe(true);
  });

  it('detects an azure previousResponseId', () => {
    // Azure declares no previousResponseId of its own; the gateway mirrors azure.* into
    // openai.* only at call time, which is after memory recall has already run.
    expect(hasProviderSideResponseChain({ azure: { previousResponseId: 'resp_1' } })).toBe(true);
  });

  it('detects an xai previousResponseId', () => {
    expect(hasProviderSideResponseChain({ xai: { previousResponseId: 'resp_1' } })).toBe(true);
  });

  it('returns false when previousResponseId is null', () => {
    expect(hasProviderSideResponseChain({ openai: { previousResponseId: null } })).toBe(false);
  });

  it('returns false when previousResponseId is an empty string', () => {
    expect(hasProviderSideResponseChain({ openai: { previousResponseId: '' } })).toBe(false);
  });

  it('returns false when previousResponseId is absent', () => {
    expect(hasProviderSideResponseChain({ openai: { store: true } })).toBe(false);
  });

  it('returns false when every candidate namespace is null', () => {
    expect(
      hasProviderSideResponseChain({
        openai: { previousResponseId: null },
        azure: { previousResponseId: null },
        xai: { previousResponseId: null },
      }),
    ).toBe(false);
  });

  it('returns false for unrelated provider options', () => {
    expect(hasProviderSideResponseChain({ anthropic: { cacheControl: { type: 'ephemeral' } } })).toBe(false);
    expect(hasProviderSideResponseChain({ google: { cachedContent: 'abc' } })).toBe(false);
  });

  it('returns false for a non-string previousResponseId', () => {
    expect(hasProviderSideResponseChain({ openai: { previousResponseId: 123 } })).toBe(false);
    expect(hasProviderSideResponseChain({ openai: { previousResponseId: true } })).toBe(false);
  });

  it('returns false for undefined or non-object input', () => {
    expect(hasProviderSideResponseChain(undefined)).toBe(false);
    expect(hasProviderSideResponseChain(null)).toBe(false);
    expect(hasProviderSideResponseChain('resp_1')).toBe(false);
    expect(hasProviderSideResponseChain(42)).toBe(false);
  });

  it('returns false when the namespace is not an object', () => {
    expect(hasProviderSideResponseChain({ openai: 'resp_1' })).toBe(false);
    expect(hasProviderSideResponseChain({ openai: null })).toBe(false);
  });
});
