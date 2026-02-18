import { describe, expect, it } from 'vitest';
import { findProviderToolByName, inferProviderExecuted } from './provider-tool-utils';

describe('inferProviderExecuted', () => {
  it('should return existing value when providerExecuted is defined', () => {
    const tool = { type: 'provider', id: 'openai.web_search' };

    const result = inferProviderExecuted(true, tool);

    expect(result).toBe(true);
  });

  it('should infer true for provider-defined tools when providerExecuted is undefined', () => {
    const tool = { type: 'provider', id: 'openai.web_search' };

    const result = inferProviderExecuted(undefined, tool);

    expect(result).toBe(true);
  });

  it('should return undefined for regular function tools when providerExecuted is undefined', () => {
    const tool = { type: 'function', description: 'test' };

    const result = inferProviderExecuted(undefined, tool);

    expect(result).toBeUndefined();
  });
});

describe('findProviderToolByName', () => {
  const tools = {
    perplexitySearch: { type: 'provider' as const, id: 'gateway.perplexity_search', args: {} },
    webSearch: { type: 'provider-defined' as const, id: 'openai.web_search', args: {} },
    calculator: { type: 'function' as const, description: 'A calculator' },
  } as any;

  it('should find provider tool by model-facing name (suffix after provider prefix)', () => {
    // The LLM stream reports toolName as 'perplexity_search' (without gateway. prefix)
    const result = findProviderToolByName(tools, 'perplexity_search');

    expect(result).toBe(tools.perplexitySearch);
  });

  it('should find openai provider tool by suffix', () => {
    const result = findProviderToolByName(tools, 'web_search');

    expect(result).toBe(tools.webSearch);
  });

  it('should return undefined for non-provider tool', () => {
    const result = findProviderToolByName(tools, 'calculator');

    expect(result).toBeUndefined();
  });

  it('should return undefined when tool is not found', () => {
    const result = findProviderToolByName(tools, 'unknown_tool');

    expect(result).toBeUndefined();
  });

  it('should return undefined when tools is undefined', () => {
    const result = findProviderToolByName(undefined, 'perplexity_search');

    expect(result).toBeUndefined();
  });
});
