import { describe, expect, it } from 'vitest';
import { isProviderTool, resolveToolTitle } from './toolchecks';

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

describe('resolveToolTitle', () => {
  it('returns the explicit top-level title when present', () => {
    expect(resolveToolTitle({ title: 'Search Web', mcp: { annotations: { title: 'MCP Title' } } })).toBe('Search Web');
  });

  it('falls back to mcp.annotations.title when no top-level title', () => {
    expect(resolveToolTitle({ mcp: { annotations: { title: 'MCP Title' } } })).toBe('MCP Title');
  });

  it('returns undefined for empty, missing, or non-string titles', () => {
    expect(resolveToolTitle({ title: '' })).toBeUndefined();
    expect(resolveToolTitle({ title: 42 })).toBeUndefined();
    expect(resolveToolTitle({})).toBeUndefined();
    expect(resolveToolTitle(null)).toBeUndefined();
    expect(resolveToolTitle(undefined)).toBeUndefined();
  });
});
