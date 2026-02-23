import { describe, expect, it } from 'vitest';
import { findProviderToolByName, inferProviderExecuted } from './provider-tool-utils';

describe('inferProviderExecuted', () => {
  it('should return the existing value when providerExecuted is already defined', () => {
    expect(inferProviderExecuted(true, { type: 'provider', id: 'openai.web_search' })).toBe(true);
    expect(inferProviderExecuted(false, { type: 'provider', id: 'openai.web_search' })).toBe(false);
  });

  it('should infer true for provider-defined tools when providerExecuted is undefined', () => {
    expect(inferProviderExecuted(undefined, { type: 'provider', id: 'openai.web_search' })).toBe(true);
    expect(inferProviderExecuted(undefined, { type: 'provider-defined', id: 'openai.web_search' })).toBe(true);
  });

  it('should return undefined for regular tools or missing tools when providerExecuted is undefined', () => {
    expect(inferProviderExecuted(undefined, { type: 'function', description: 'test' })).toBeUndefined();
    expect(inferProviderExecuted(undefined, null)).toBeUndefined();
  });
});

describe('findProviderToolByName', () => {
  const tools = {
    perplexitySearch: { type: 'provider' as const, id: 'gateway.perplexity_search', args: {} },
    webSearch: { type: 'provider-defined' as const, id: 'openai.web_search', args: {} },
    calculator: { type: 'function' as const, description: 'A calculator' },
  } as any;

  it('should find provider tools by their model-facing name (suffix after dot)', () => {
    expect(findProviderToolByName(tools, 'perplexity_search')).toBe(tools.perplexitySearch);
    expect(findProviderToolByName(tools, 'web_search')).toBe(tools.webSearch);
  });

  it('should return undefined for non-provider tools or unknown names', () => {
    expect(findProviderToolByName(tools, 'calculator')).toBeUndefined();
    expect(findProviderToolByName(tools, 'unknown_tool')).toBeUndefined();
  });

  it('should return undefined when tools is undefined or empty', () => {
    expect(findProviderToolByName(undefined, 'web_search')).toBeUndefined();
    expect(findProviderToolByName({} as any, 'web_search')).toBeUndefined();
  });

  it('should not match by the full qualified provider id', () => {
    // The LLM reports just the suffix (e.g. 'web_search'), not the full id ('openai.web_search')
    expect(findProviderToolByName(tools, 'openai.web_search')).toBeUndefined();
  });
});
