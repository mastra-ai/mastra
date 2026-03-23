import { describe, expect, it } from 'vitest';
import { isProviderTool } from './toolchecks';

describe('isProviderTool', () => {
  it('should return true for provider-defined and provider type tools with a string id', () => {
    expect(isProviderTool({ type: 'provider-defined', id: 'openai.web_search', args: {} })).toBe(true);
    expect(isProviderTool({ type: 'provider', id: 'gateway.perplexity_search' })).toBe(true);
  });

  it('should return false for non-provider tool types', () => {
    expect(isProviderTool({ type: 'function', description: 'A function tool' })).toBe(false);
    expect(isProviderTool({ type: 'custom', id: 'some.tool' })).toBe(false);
  });

  it('should return false when type is provider but id is missing or not a string', () => {
    expect(isProviderTool({ type: 'provider' })).toBe(false);
    expect(isProviderTool({ type: 'provider', id: 123 })).toBe(false);
    expect(isProviderTool({ type: 'provider-defined' })).toBe(false);
    expect(isProviderTool({ type: 'provider-defined', id: 123 })).toBe(false);
  });

  it('should return false for non-object values', () => {
    expect(isProviderTool(null)).toBe(false);
    expect(isProviderTool(undefined)).toBe(false);
    expect(isProviderTool(42)).toBe(false);
    expect(isProviderTool({})).toBe(false);
  });
});
