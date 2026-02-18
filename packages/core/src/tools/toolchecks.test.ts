import { describe, expect, it } from 'vitest';
import { isProviderDefinedTool } from './toolchecks';

describe('isProviderDefinedTool', () => {
  it('should return true for provider-defined tools', () => {
    const tool = { type: 'provider-defined', id: 'openai.web_search', args: {} };

    expect(isProviderDefinedTool(tool)).toBe(true);
  });

  it('should return true for provider tools (AI SDK v6 type)', () => {
    const tool = { type: 'provider', id: 'openai.web_search', args: {} };

    expect(isProviderDefinedTool(tool)).toBe(true);
  });

  it('should return true for gateway provider tools', () => {
    const tool = { type: 'provider', id: 'gateway.perplexity_search' };

    expect(isProviderDefinedTool(tool)).toBe(true);
  });

  it('should return false for regular function tools', () => {
    const tool = { type: 'function', description: 'A function tool' };

    expect(isProviderDefinedTool(tool)).toBe(false);
  });

  it('should return false for tools with unknown type', () => {
    const tool = { type: 'custom', id: 'some.tool' };

    expect(isProviderDefinedTool(tool)).toBe(false);
  });

  it('should return false when type is provider but id is missing', () => {
    const tool = { type: 'provider' };

    expect(isProviderDefinedTool(tool)).toBe(false);
  });

  it('should return false when type is provider but id is not a string', () => {
    const tool = { type: 'provider', id: 123 };

    expect(isProviderDefinedTool(tool)).toBe(false);
  });

  it('should return false for null', () => {
    expect(isProviderDefinedTool(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isProviderDefinedTool(undefined)).toBe(false);
  });

  it('should return false for primitive values', () => {
    expect(isProviderDefinedTool(42)).toBe(false);
    expect(isProviderDefinedTool('string')).toBe(false);
    expect(isProviderDefinedTool(true)).toBe(false);
  });

  it('should return false for an empty object', () => {
    expect(isProviderDefinedTool({})).toBe(false);
  });

  it('should return false for an array', () => {
    expect(isProviderDefinedTool([{ type: 'provider', id: 'openai.search' }])).toBe(false);
  });
});
