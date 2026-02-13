import { describe, expect, it } from 'vitest';
import { findToolByName, inferProviderExecuted, isGatewayTool, isProviderDefinedTool } from './provider-tool-utils';

describe('isProviderDefinedTool', () => {
  it('should return true for AI SDK v5 provider-defined tools', () => {
    const tool = { type: 'provider-defined', id: 'openai.web_search', args: {} };
    expect(isProviderDefinedTool(tool)).toBe(true);
  });

  it('should return true for AI SDK v6 provider tools', () => {
    const tool = { type: 'provider', id: 'openai.web_search', args: {} };
    expect(isProviderDefinedTool(tool)).toBe(true);
  });

  it('should return false for regular function tools', () => {
    const tool = { type: 'function', description: 'A function tool' };
    expect(isProviderDefinedTool(tool)).toBe(false);
  });

  it('should return false for null/undefined', () => {
    expect(isProviderDefinedTool(null)).toBe(false);
    expect(isProviderDefinedTool(undefined)).toBe(false);
  });

  it('should return false for provider tool without id', () => {
    const tool = { type: 'provider' };
    expect(isProviderDefinedTool(tool)).toBe(false);
  });

  it('should return false for non-object values', () => {
    expect(isProviderDefinedTool('string')).toBe(false);
    expect(isProviderDefinedTool(42)).toBe(false);
    expect(isProviderDefinedTool(true)).toBe(false);
  });
});

describe('isGatewayTool', () => {
  it('should return true for gateway tools (v6 type)', () => {
    const tool = { type: 'provider', id: 'gateway.perplexity_search', args: {} };
    expect(isGatewayTool(tool)).toBe(true);
  });

  it('should return true for gateway tools (v5 type)', () => {
    const tool = { type: 'provider-defined', id: 'gateway.perplexity_search', args: {} };
    expect(isGatewayTool(tool)).toBe(true);
  });

  it('should return false for native OpenAI provider tools', () => {
    const tool = { type: 'provider', id: 'openai.web_search', args: {} };
    expect(isGatewayTool(tool)).toBe(false);
  });

  it('should return false for native Anthropic provider tools', () => {
    const tool = { type: 'provider', id: 'anthropic.web_search', args: {} };
    expect(isGatewayTool(tool)).toBe(false);
  });

  it('should return false for regular function tools', () => {
    const tool = { type: 'function', description: 'A function tool' };
    expect(isGatewayTool(tool)).toBe(false);
  });

  it('should return false for null/undefined', () => {
    expect(isGatewayTool(null)).toBe(false);
    expect(isGatewayTool(undefined)).toBe(false);
  });
});

describe('inferProviderExecuted', () => {
  it('should return existing value when providerExecuted is already set to true', () => {
    const tool = { type: 'provider', id: 'openai.web_search' };
    expect(inferProviderExecuted(true, tool)).toBe(true);
  });

  it('should return existing value when providerExecuted is already set to false', () => {
    const tool = { type: 'function' };
    expect(inferProviderExecuted(false, tool)).toBe(false);
  });

  it('should infer true for provider-defined tools when providerExecuted is undefined', () => {
    const tool = { type: 'provider', id: 'openai.web_search' };
    expect(inferProviderExecuted(undefined, tool)).toBe(true);
  });

  it('should infer true for gateway tools when providerExecuted is undefined', () => {
    const tool = { type: 'provider', id: 'gateway.perplexity_search' };
    expect(inferProviderExecuted(undefined, tool)).toBe(true);
  });

  it('should return undefined for regular function tools when providerExecuted is undefined', () => {
    const tool = { type: 'function', description: 'test' };
    expect(inferProviderExecuted(undefined, tool)).toBeUndefined();
  });

  it('should return undefined for null tool when providerExecuted is undefined', () => {
    expect(inferProviderExecuted(undefined, null)).toBeUndefined();
  });

  it('should return undefined for undefined tool when providerExecuted is undefined', () => {
    expect(inferProviderExecuted(undefined, undefined)).toBeUndefined();
  });
});

describe('findToolByName', () => {
  const tools = {
    web_search: { type: 'provider', id: 'gateway.perplexity_search', args: {} },
    calculator: { type: 'function', description: 'A calculator' },
  };

  it('should find tool by direct key match', () => {
    expect(findToolByName(tools, 'web_search')).toBe(tools.web_search);
  });

  it('should find tool by provider tool ID', () => {
    expect(findToolByName(tools, 'gateway.perplexity_search')).toBe(tools.web_search);
  });

  it('should return undefined for unknown tool name', () => {
    expect(findToolByName(tools, 'unknown_tool')).toBeUndefined();
  });

  it('should return undefined when tools is undefined', () => {
    expect(findToolByName(undefined, 'web_search')).toBeUndefined();
  });

  it('should prefer direct key match over id match', () => {
    const toolsWithConflict = {
      'gateway.perplexity_search': { type: 'function', description: 'Direct match' },
      web_search: { type: 'provider', id: 'gateway.perplexity_search', args: {} },
    };
    expect(findToolByName(toolsWithConflict, 'gateway.perplexity_search')).toBe(
      toolsWithConflict['gateway.perplexity_search'],
    );
  });
});
