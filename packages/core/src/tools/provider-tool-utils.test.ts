import { describe, expect, it } from 'vitest';
import { findProviderToolByName, inferProviderExecuted } from './provider-tool-utils';

describe('inferProviderExecuted', () => {
  it('should preserve true when providerExecuted is already true', () => {
    const tool = { type: 'provider', id: 'openai.web_search' };

    expect(inferProviderExecuted(true, tool)).toBe(true);
  });

  it('should preserve false when providerExecuted is already false', () => {
    const tool = { type: 'provider', id: 'openai.web_search' };

    expect(inferProviderExecuted(false, tool)).toBe(false);
  });

  it('should preserve false even for non-provider tools', () => {
    const tool = { type: 'function', description: 'test' };

    expect(inferProviderExecuted(false, tool)).toBe(false);
  });

  it('should infer true for provider-defined tools when providerExecuted is undefined', () => {
    const tool = { type: 'provider', id: 'openai.web_search' };

    expect(inferProviderExecuted(undefined, tool)).toBe(true);
  });

  it('should infer true for AI SDK v5 provider-defined tools', () => {
    const tool = { type: 'provider-defined', id: 'openai.web_search' };

    expect(inferProviderExecuted(undefined, tool)).toBe(true);
  });

  it('should return undefined for regular function tools when providerExecuted is undefined', () => {
    const tool = { type: 'function', description: 'test' };

    expect(inferProviderExecuted(undefined, tool)).toBeUndefined();
  });

  it('should return undefined when tool is null', () => {
    expect(inferProviderExecuted(undefined, null)).toBeUndefined();
  });

  it('should return undefined when tool is undefined', () => {
    expect(inferProviderExecuted(undefined, undefined)).toBeUndefined();
  });
});

describe('findProviderToolByName', () => {
  const tools = {
    perplexitySearch: { type: 'provider' as const, id: 'gateway.perplexity_search', args: {} },
    webSearch: { type: 'provider-defined' as const, id: 'openai.web_search', args: {} },
    calculator: { type: 'function' as const, description: 'A calculator' },
  } as any;

  it('should find a gateway provider tool by its model-facing name', () => {
    expect(findProviderToolByName(tools, 'perplexity_search')).toBe(tools.perplexitySearch);
  });

  it('should find an openai provider tool by its model-facing name', () => {
    expect(findProviderToolByName(tools, 'web_search')).toBe(tools.webSearch);
  });

  it('should return undefined for a non-provider tool name', () => {
    expect(findProviderToolByName(tools, 'calculator')).toBeUndefined();
  });

  it('should return undefined when no tool matches the name', () => {
    expect(findProviderToolByName(tools, 'unknown_tool')).toBeUndefined();
  });

  it('should return undefined when tools is undefined', () => {
    expect(findProviderToolByName(undefined, 'perplexity_search')).toBeUndefined();
  });

  it('should return undefined when tools is an empty object', () => {
    expect(findProviderToolByName({} as any, 'web_search')).toBeUndefined();
  });

  it('should not match by the full qualified provider id', () => {
    // The LLM reports just the suffix (e.g. 'web_search'), not the full id ('openai.web_search')
    expect(findProviderToolByName(tools, 'openai.web_search')).toBeUndefined();
  });

  it('should handle tools with multi-segment provider ids', () => {
    const multiDotTools = {
      deepSearch: { type: 'provider' as const, id: 'gateway.deep.search', args: {} },
    } as any;

    expect(findProviderToolByName(multiDotTools, 'deep.search')).toBe(multiDotTools.deepSearch);
  });

  it('should return the first match when multiple tools share the same model-facing name', () => {
    const duplicateTools = {
      searchA: { type: 'provider' as const, id: 'openai.web_search', args: {} },
      searchB: { type: 'provider' as const, id: 'gateway.web_search', args: {} },
    } as any;

    const result = findProviderToolByName(duplicateTools, 'web_search');

    expect(result).toBeDefined();
    expect(result === duplicateTools.searchA || result === duplicateTools.searchB).toBe(true);
  });
});
