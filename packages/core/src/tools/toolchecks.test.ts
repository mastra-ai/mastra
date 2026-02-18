import { describe, expect, it } from 'vitest';
import { isProviderDefinedTool } from './toolchecks';

describe('isProviderDefinedTool', () => {
  it('should return true for provider-defined and provider type tools with a string id', () => {
    expect(isProviderDefinedTool({ type: 'provider-defined', id: 'openai.web_search', args: {} })).toBe(true);
    expect(isProviderDefinedTool({ type: 'provider', id: 'gateway.perplexity_search' })).toBe(true);
  });

  it('should return false for non-provider tool types', () => {
    expect(isProviderDefinedTool({ type: 'function', description: 'A function tool' })).toBe(false);
    expect(isProviderDefinedTool({ type: 'custom', id: 'some.tool' })).toBe(false);
  });

  it('should return false when type is provider but id is missing or not a string', () => {
    expect(isProviderDefinedTool({ type: 'provider' })).toBe(false);
    expect(isProviderDefinedTool({ type: 'provider', id: 123 })).toBe(false);
  });

  it('should return false for non-object values', () => {
    expect(isProviderDefinedTool(null)).toBe(false);
    expect(isProviderDefinedTool(undefined)).toBe(false);
    expect(isProviderDefinedTool(42)).toBe(false);
    expect(isProviderDefinedTool({})).toBe(false);
  });
});
