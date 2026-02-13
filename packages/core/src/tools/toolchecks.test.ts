import { describe, expect, it } from 'vitest';
import { isGatewayTool, isProviderDefinedTool } from './toolchecks';

describe('isProviderDefinedTool', () => {
  it('should return true for provider-defined tools', () => {
    const tool = { type: 'provider-defined', id: 'openai.web_search', args: {} };

    const result = isProviderDefinedTool(tool);

    expect(result).toBe(true);
  });

  it('should return true for provider tools', () => {
    const tool = { type: 'provider', id: 'openai.web_search', args: {} };

    const result = isProviderDefinedTool(tool);

    expect(result).toBe(true);
  });

  it('should return false for regular function tools', () => {
    const tool = { type: 'function', description: 'A function tool' };

    const result = isProviderDefinedTool(tool);

    expect(result).toBe(false);
  });
});

describe('isGatewayTool', () => {
  it('should return true for gateway tools', () => {
    const tool = { type: 'provider', id: 'gateway.perplexity_search', args: {} };

    const result = isGatewayTool(tool);

    expect(result).toBe(true);
  });

  it('should return false for non-gateway provider tools', () => {
    const tool = { type: 'provider', id: 'openai.web_search', args: {} };

    const result = isGatewayTool(tool);

    expect(result).toBe(false);
  });

  it('should return false for regular function tools', () => {
    const tool = { type: 'function', description: 'A function tool' };

    const result = isGatewayTool(tool);

    expect(result).toBe(false);
  });
});
